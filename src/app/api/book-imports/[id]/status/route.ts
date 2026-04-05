import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: row, error } = await supabase
      .from('book_imports')
      .select('id, import_status, book_id, error_message, created_at, updated_at')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (error || !row) {
      return NextResponse.json({ error: 'Importacion no encontrada.' }, { status: 404 });
    }

    return NextResponse.json({ import: row });
  } catch (error) {
    console.error('book_imports.status error', error);
    return NextResponse.json({ error: 'No fue posible consultar el estado.' }, { status: 500 });
  }
}

