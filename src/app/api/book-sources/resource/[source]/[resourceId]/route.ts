import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSourceKey } from '@/lib/external-sources/types';
import { getExternalResource } from '@/lib/external-sources/services/get-external-resource';

export async function GET(
  _request: Request,
  { params }: { params: { source: string; resourceId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isSourceKey(params.source)) {
    return NextResponse.json({ error: 'Fuente inválida.' }, { status: 400 });
  }

  try {
    const resource = await getExternalResource(params.source, decodeURIComponent(params.resourceId));
    if (!resource) {
      return NextResponse.json({ error: 'Recurso no encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ resource });
  } catch (error) {
    console.error('book_sources.resource.byPath error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No fue posible cargar el detalle.' },
      { status: 500 }
    );
  }
}
