import { getExternalSourcesConfig } from '../config';
import { fetchBinaryFromSource, probeSourceUrl, ExternalSourceError } from '../adapters/base';
import type { ResolvedDownload, SourceKey } from '../types';

function normalizeMimeType(value: string | null) {
  return (value || '').split(';')[0].trim().toLowerCase();
}

function inferFileType(url: string, mimeType: string | null) {
  const mime = normalizeMimeType(mimeType);
  if (mime === 'application/pdf') return 'pdf' as const;
  if (mime === 'application/epub+zip') return 'epub' as const;

  const lowerUrl = url.toLowerCase();
  if (lowerUrl.endsWith('.pdf')) return 'pdf' as const;
  if (lowerUrl.endsWith('.epub')) return 'epub' as const;
  return 'unknown' as const;
}

function extractFilename(
  rawUrl: string,
  contentDisposition: string | null,
  fileType: 'pdf' | 'epub'
) {
  const ensureExtension = (value: string) => {
    const lower = value.toLowerCase();
    if (fileType === 'pdf' && lower.endsWith('.pdf')) return value;
    if (fileType === 'epub' && lower.endsWith('.epub')) return value;
    return `${value}.${fileType}`;
  };

  const filenameMatch = contentDisposition?.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);
  const encoded = filenameMatch?.[1] || filenameMatch?.[2];
  if (encoded) {
    return ensureExtension(decodeURIComponent(encoded).trim());
  }

  const pathname = new URL(rawUrl).pathname;
  const lastSegment = pathname.split('/').filter(Boolean).pop();
  if (lastSegment) return ensureExtension(lastSegment);
  return `recurso.${fileType}`;
}

function validateDownloadedBuffer(buffer: Buffer, fileType: 'pdf' | 'epub') {
  if (fileType === 'pdf') {
    const signature = buffer.subarray(0, 5).toString('utf8');
    if (signature !== '%PDF-') {
      throw new ExternalSourceError(
        'invalid_pdf',
        'La importación fue cancelada porque el archivo no tiene un formato compatible.',
        400,
        { phase: 'signature', expected: 'pdf' }
      );
    }
    return;
  }

  const zipSignature = buffer.subarray(0, 2).toString('utf8');
  if (zipSignature !== 'PK') {
    throw new ExternalSourceError(
      'invalid_epub',
      'La importación fue cancelada porque el archivo no tiene un formato compatible.',
      400,
      { phase: 'signature', expected: 'epub' }
    );
  }
}

export async function downloadValidatedFile(
  source: SourceKey,
  resolved: ResolvedDownload
) {
  const config = getExternalSourcesConfig();

  let headContentType: string | null = null;
  let headContentLength = 0;
  try {
    const probe = await probeSourceUrl(source, resolved.url);
    headContentType = probe.headers.get('content-type');
    headContentLength = Number(probe.headers.get('content-length') || 0);
  } catch (error) {
    // Some sources do not support HEAD correctly. We fallback to GET validation.
    console.warn('external_sources.probe failed', error);
  }

  if (headContentLength && headContentLength > config.maxDownloadBytes) {
    throw new ExternalSourceError(
      'file_too_large',
      'La importación fue cancelada porque el archivo supera el tamaño permitido.',
      400,
      { phase: 'head', contentLength: headContentLength }
    );
  }

  const headFileType = inferFileType(resolved.url, headContentType || resolved.mimeType);
  if (headFileType === 'unknown') {
    throw new ExternalSourceError(
      'unsupported_type',
      'La importación fue cancelada porque el archivo no tiene un formato compatible.',
      400,
      {
        phase: 'head',
        url: resolved.url,
        mimeType: headContentType || resolved.mimeType,
      }
    );
  }

  const response = await fetchBinaryFromSource(source, resolved.url);
  const contentType = normalizeMimeType(response.headers.get('content-type')) || normalizeMimeType(resolved.mimeType);
  const fileType = inferFileType(response.url || resolved.url, contentType);
  const contentLength = Number(response.headers.get('content-length') || 0);

  if (contentLength && contentLength > config.maxDownloadBytes) {
    throw new ExternalSourceError(
      'file_too_large',
      'La importación fue cancelada porque el archivo supera el tamaño permitido.',
      400,
      { phase: 'download', contentLength }
    );
  }

  if (fileType !== 'pdf' && fileType !== 'epub') {
    throw new ExternalSourceError(
      'unsupported_type',
      'La importación fue cancelada porque el archivo no tiene un formato compatible.',
      400,
      { phase: 'download', mimeType: contentType, url: response.url || resolved.url }
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > config.maxDownloadBytes) {
    throw new ExternalSourceError(
      'file_too_large',
      'La importación fue cancelada porque el archivo supera el tamaño permitido.',
      400,
      { phase: 'buffer', size: buffer.byteLength }
    );
  }

  validateDownloadedBuffer(buffer, fileType);

  return {
    buffer,
    mimeType: contentType || (fileType === 'pdf' ? 'application/pdf' : 'application/epub+zip'),
    fileType,
    filename: extractFilename(response.url || resolved.url, response.headers.get('content-disposition'), fileType),
    finalUrl: response.url || resolved.url,
  };
}
