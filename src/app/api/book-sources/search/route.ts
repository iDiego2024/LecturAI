import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { isDemoEmail } from '@/lib/demo';
import { searchExternalResources } from '@/lib/external-sources/services/search-external-resources';
import type { SearchFilters, SourceKey } from '@/lib/external-sources/types';

type SearchRequestBody = {
  query?: string;
  source?: SourceKey | 'all';
  filters?: SearchFilters;
  page?: number;
};

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (isDemoEmail(user.email)) {
      return NextResponse.json(
        { error: 'El modo demo no permite importar recursos externos.' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as SearchRequestBody;
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (!query) {
      return NextResponse.json({ error: 'Ingresa un término de búsqueda.' }, { status: 400 });
    }

    const result = await searchExternalResources({
      query,
      source: body.source || 'all',
      filters: body.filters || {},
      page: Number(body.page || 1),
    });

    const admin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: sourceRows } = await admin.from('external_sources').select('id, key');
    const sourceIdByKey = new Map(
      ((sourceRows as Array<{ id: string; key: string }> | null) || []).map((row) => [row.key, row.id])
    );

    const upserts = result.items
      .map((item) => {
        const sourceId = sourceIdByKey.get(item.source);
        if (!sourceId) return null;
        return {
          source_id: sourceId,
          external_resource_key: item.externalId,
          title: item.title,
          author: item.author || item.institutionalAuthor || null,
          description: item.description || null,
          source_url: item.sourceUrl,
          download_url: item.downloadUrl || null,
          file_type: item.fileType || 'unknown',
          downloadable: item.downloadable,
          language: item.language || null,
          available_formats: item.availableFormats || null,
          license_label: item.licenseLabel || null,
          license_url: item.licenseUrl || null,
          parser_version: 'v2',
          last_checked_at: new Date().toISOString(),
          metadata_json: item.metadata || null,
          fetched_at: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    if (upserts.length > 0) {
      await admin.from('external_resources').upsert(upserts as never[], {
        onConflict: 'source_id,external_resource_key',
      });
    }

    if (result.items.length === 0 && result.warnings.length > 0) {
      return NextResponse.json(
        {
          error:
            'No fue posible consultar las fuentes oficiales en este momento. Revisa tu conexión o intenta más tarde.',
          warnings: result.warnings,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('book_sources.search error', error);
    return NextResponse.json(
      { error: 'No fue posible buscar recursos oficiales en este momento.' },
      { status: 500 }
    );
  }
}
