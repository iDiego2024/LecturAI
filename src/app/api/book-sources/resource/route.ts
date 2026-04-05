import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSourceKey } from '@/lib/external-sources/types';
import { getExternalResource } from '@/lib/external-sources/services/get-external-resource';

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');
  const externalId = searchParams.get('id');

  if (!isSourceKey(source) || !externalId) {
    return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 });
  }

  try {
    const resource = await getExternalResource(source, externalId);
    if (!resource) {
      return NextResponse.json({ error: 'Recurso no encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ resource });
  } catch (error) {
    console.error('book_sources.resource error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No fue posible cargar el detalle.' },
      { status: 500 }
    );
  }
}
