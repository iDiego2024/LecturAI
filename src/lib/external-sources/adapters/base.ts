import { getExternalSourcesConfig } from '../config';
import { assertAllowedSourceUrl } from '../validation/domains';
import type { SourceAdapter, SourceKey } from '../types';

export class ExternalSourceError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status = 502,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function logExternalSource(
  event: string,
  payload: Record<string, unknown>
) {
  console.log(
    JSON.stringify({
      at: event,
      ...payload,
    })
  );
}

async function fetchWithRedirects(
  source: SourceKey,
  rawUrl: string,
  init?: RequestInit,
  depth = 0
): Promise<Response> {
  const config = getExternalSourcesConfig();
  if (depth > config.maxRedirects) {
    throw new ExternalSourceError('too_many_redirects', 'La fuente redirigió demasiadas veces.');
  }

  const url = assertAllowedSourceUrl(source, rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      ...init,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Comprendia/1.0',
        ...(init?.headers || {}),
      },
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        throw new ExternalSourceError(
          'redirect_without_location',
          'La fuente respondió con redirección sin destino.',
          502,
          { source, url: url.toString(), status: response.status }
        );
      }

      const nextUrl = new URL(location, url).toString();
      return fetchWithRedirects(
        source,
        nextUrl,
        {
          ...init,
          method: init?.method === 'HEAD' ? 'HEAD' : 'GET',
          body: undefined,
        },
        depth + 1
      );
    }

    return response;
  } catch (error) {
    if (error instanceof ExternalSourceError) throw error;

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ExternalSourceError(
        'timeout',
        'La consulta a la fuente tardó demasiado. Intenta nuevamente.',
        504,
        { source, url: url.toString(), phase: 'fetch' }
      );
    }

    const cause = (error as { cause?: { code?: string } } | undefined)?.cause;
    const code = cause?.code;

    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      throw new ExternalSourceError(
        'dns',
        `No se pudo resolver el dominio ${url.hostname}.`,
        502,
        { source, url: url.toString(), phase: 'dns' }
      );
    }

    throw new ExternalSourceError(
      'network_error',
      'No fue posible consultar esta fuente en este momento.',
      502,
      { source, url: url.toString(), phase: 'fetch' }
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchHtmlFromSource(source: SourceKey, rawUrl: string) {
  const response = await fetchWithRedirects(source, rawUrl, { method: 'GET' });

  if (!response.ok) {
    throw new ExternalSourceError(
      'source_http_error',
      `La fuente devolvió HTTP ${response.status}.`,
      response.status,
      {
        source,
        url: rawUrl,
        status: response.status,
      }
    );
  }

  return {
    html: await response.text(),
    finalUrl: response.url || rawUrl,
    status: response.status,
  };
}

export async function probeSourceUrl(source: SourceKey, rawUrl: string) {
  const response = await fetchWithRedirects(source, rawUrl, { method: 'HEAD' });
  return response;
}

export async function fetchBinaryFromSource(source: SourceKey, rawUrl: string) {
  const response = await fetchWithRedirects(source, rawUrl, { method: 'GET' });
  if (!response.ok) {
    throw new ExternalSourceError(
      'download_failed',
      `La fuente devolvió HTTP ${response.status} al descargar el archivo.`,
      response.status,
      { source, url: rawUrl, status: response.status, phase: 'download' }
    );
  }
  return response;
}

export function createAdapter<T extends SourceAdapter>(adapter: T) {
  return adapter;
}
