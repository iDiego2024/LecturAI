import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { ingestBookFromBuffer } from '@/lib/books/ingest';
import { downloadValidatedFile } from '../validation/files';
import { getAdapter } from '../registry';
import { getExternalResource } from './get-external-resource';
import { logExternalSource } from '../adapters/base';
import type { ExternalResource, SourceKey } from '../types';

type ImportInput = {
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  };
  source: SourceKey;
  externalId: string;
};

async function upsertCachedResource(
  admin: any,
  sourceId: string,
  resource: ExternalResource
) {
  const payload = {
    source_id: sourceId,
    external_resource_key: resource.externalId,
    title: resource.title,
    author: resource.author || resource.institutionalAuthor || null,
    description: resource.description || null,
    source_url: resource.sourceUrl,
    download_url: resource.downloadUrl || null,
    file_type: resource.fileType || 'unknown',
    downloadable: resource.downloadable,
    language: resource.language || null,
    available_formats: resource.availableFormats || null,
    license_label: resource.licenseLabel || null,
    license_url: resource.licenseUrl || null,
    parser_version: 'v2',
    last_checked_at: new Date().toISOString(),
    metadata_json: resource.metadata || null,
    fetched_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from('external_resources')
    .upsert(payload as never, { onConflict: 'source_id,external_resource_key' })
    .select('id')
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

export async function importExternalResource({ user, source, externalId }: ImportInput) {
  const admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: sourceRow, error: sourceError } = await admin
    .from('external_sources')
    .select('id, key')
    .eq('key', source)
    .single();

  if (sourceError || !sourceRow) {
    throw new Error('Fuente no configurada.');
  }

  const adapter = getAdapter(source);
  const resource = await getExternalResource(source, externalId);
  if (!resource) {
    throw new Error('No fue posible cargar el detalle del recurso.');
  }

  const cachedResourceId = await upsertCachedResource(admin, (sourceRow as { id: string }).id, resource);

  const { data: importRow, error: importError } = await admin
    .from('book_imports')
    .insert({
      user_id: user.id,
      source_id: (sourceRow as { id: string }).id,
      external_resource_id: cachedResourceId,
      import_status: 'queued',
      original_url: resource.sourceUrl,
    })
    .select('id')
    .single();

  if (importError || !importRow) throw importError || new Error('No fue posible crear la importación.');

  const importId = (importRow as { id: string }).id;

  const updateImport = async (patch: Record<string, unknown>) => {
    await admin.from('book_imports').update(patch).eq('id', importId);
  };

  try {
    await updateImport({ import_status: 'downloading' });

    const resolvedDownload = await adapter.resolveDownload(resource);
    if (!resolvedDownload) {
      throw new Error('El recurso no tiene un archivo PDF o EPUB descargable.');
    }

    await updateImport({
      resolved_download_url: resolvedDownload.url,
      import_status: 'validating',
      mime_type: resolvedDownload.mimeType,
    });

    const downloaded = await downloadValidatedFile(source, resolvedDownload);

    await updateImport({
      import_status: 'storing',
      mime_type: downloaded.mimeType,
    });

    logExternalSource('external_sources.import.ingest', {
      source,
      externalId,
      importId,
      fileType: downloaded.fileType,
      finalUrl: downloaded.finalUrl,
      bytes: downloaded.buffer.byteLength,
    });

    await updateImport({ import_status: 'ingesting' });

    const { book, storagePath } = await ingestBookFromBuffer({
      userId: user.id,
      userEmail: user.email,
      userMetadata: user.user_metadata || null,
      title: resource.title,
      author: resource.author || resource.institutionalAuthor || null,
      originalFileName: downloaded.filename,
      mimeType: downloaded.mimeType,
      buffer: downloaded.buffer,
      fileSizeBytes: downloaded.buffer.byteLength,
      sourceType: 'external_import',
      sourceReference: {
        source,
        externalId: resource.externalId,
        sourceUrl: resource.sourceUrl,
        resolvedDownloadUrl: downloaded.finalUrl,
        language: resource.language || null,
        availableFormats: resource.availableFormats || [],
        licenseLabel: resource.licenseLabel || null,
        licenseUrl: resource.licenseUrl || null,
        importedAt: new Date().toISOString(),
        externalResourceId: cachedResourceId,
      },
    });

    await updateImport({
      import_status: 'completed',
      book_id: (book as { id: string }).id,
      storage_path: storagePath,
    });

    return {
      importId,
      bookId: (book as { id: string }).id,
      status: 'completed' as const,
    };
  } catch (error) {
    await updateImport({
      import_status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
