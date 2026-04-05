import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getExternalSourcesConfig } from '@/lib/external-sources/config';
import { listEnabledSourceDefinitions } from '@/lib/external-sources/registry';

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = getExternalSourcesConfig();
  const fallbackSources = listEnabledSourceDefinitions();

  const { data: rows, error } = await supabase
    .from('external_sources')
    .select('id, key, name, base_url, is_enabled')
    .order('name', { ascending: true });

  if (error || !rows) {
    return NextResponse.json({
      sources: fallbackSources.map((source) => ({
        id: source.key,
        key: source.key,
        name: source.name,
        baseUrl: source.baseUrl,
        isInstitutional: !['wikisource_es', 'cervantes_virtual', 'elejandria', 'project_gutenberg'].includes(source.key),
      })),
    });
  }

  const enabledKeys = new Set(
    Object.entries(config.enabledSources)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key)
  );

  const sources = (rows as Array<{ id: string; key: string; name: string; base_url: string; is_enabled: boolean }>)
    .filter((row) => row.is_enabled && enabledKeys.has(row.key))
    .map((row) => ({
      id: row.id,
      key: row.key,
      name: row.name,
      baseUrl: row.base_url,
      isInstitutional: !['wikisource_es', 'cervantes_virtual', 'elejandria', 'project_gutenberg'].includes(row.key),
    }));

  return NextResponse.json({ sources: sources.length > 0 ? sources : fallbackSources });
}
