import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    
    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bookId = params.id;
    
    // Check ownership
    const { data: book, error: checkError } = await supabase
      .from('books')
      .select('id, user_id')
      .eq('id', bookId)
      .single();

    if (checkError || !book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    if ((book as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized to delete this book' }, { status: 403 });
    }

    // Delete the book. Supabase ON DELETE CASCADE handles chunk and test deletion natively.
    const { error: deleteError } = await supabase
      .from('books')
      .delete()
      .eq('id', bookId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting book:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
