import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listEnabledSourceDefinitions } from '@/lib/external-sources/registry';
import { fetchHtmlFromSource, ExternalSourceError } from '@/lib/external-sources/adapters/base';
import type { SourceKey } from '@/lib/external-sources/types';

function pickProbeUrl(source: SourceKey, baseUrl: string) {
  if (source === 'wikisource_es') {
    return `${baseUrl}/w/api.php?action=query&list=search&srsearch=lectura&format=json&srlimit=1`;
  }
  if (source === 'cervantes_virtual') {
    return `${baseUrl}/obras/serie/epubs_todos/?q=lectura`;
  }
  if (source === 'mineduc_biblioteca_digital') {
    return `${baseUrl}/discover?query=lectura`;
  }
  if (source === 'memoria_chilena') {
    return `${baseUrl}/602/w3-search.php?keywords=lectura&searchmode=and`;
  }
  if (source === 'bne_digital') {
    return `${baseUrl}/bd/es/results?query=lectura&w=lectura&f=name&y=s`;
  }
  if (source === 'elejandria') {
    return `${baseUrl}/sitemap.xml`;
  }
  if (source === 'project_gutenberg') {
    return `${baseUrl}/ebooks/search/?query=lectura`;
  }
  return `${baseUrl}/buscador?search_text=lectura`;
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const checkedAt = new Date().toISOString();
  const results = [];

  for (const source of listEnabledSourceDefinitions()) {
    const probeUrl = pickProbeUrl(source.key, source.baseUrl);
    const started = Date.now();

    try {
      const response = await fetchHtmlFromSource(source.key, probeUrl);
      results.push({
        key: source.key,
        name: source.name,
        baseUrl: source.baseUrl,
        ok: true,
        httpStatus: response.status,
        latencyMs: Date.now() - started,
        message: 'Conectado',
        checkedAt,
      });
    } catch (error) {
      results.push({
        key: source.key,
        name: source.name,
        baseUrl: source.baseUrl,
        ok: false,
        httpStatus: error instanceof ExternalSourceError ? error.status : undefined,
        latencyMs: Date.now() - started,
        message:
          error instanceof ExternalSourceError || error instanceof Error
            ? error.message
            : 'Error desconocido',
        checkedAt,
      });
    }
  }

  return NextResponse.json({
    ok: results.every((result) => result.ok),
    results,
  });
}
