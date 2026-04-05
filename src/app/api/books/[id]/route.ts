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
      .select('id, user_id, file_path, cover_url')
      .eq('id', bookId)
      .single();

    if (checkError || !book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    if ((book as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized to delete this book' }, { status: 403 });
    }

    const typedBook = book as { file_path: string | null; cover_url: string | null };
    const storagePathsToDelete = typedBook.file_path ? [typedBook.file_path] : [];

    const coverPathMatch = typedBook.cover_url?.match(/\/object\/public\/covers\/(.+)$/);
    const coverPath = coverPathMatch ? decodeURIComponent(coverPathMatch[1]) : null;

    // Delete the book. Supabase ON DELETE CASCADE handles chunk and test deletion natively.
    const { error: deleteError } = await supabase
      .from('books')
      .delete()
      .eq('id', bookId);

    if (deleteError) throw deleteError;

    if (storagePathsToDelete.length > 0) {
      const { error: storageError } = await supabase.storage.from('books').remove(storagePathsToDelete);
      if (storageError) {
        console.warn('Failed to delete book file from storage:', storageError);
      }
    }

    if (coverPath) {
      const { error: coverDeleteError } = await supabase.storage.from('covers').remove([coverPath]);
      if (coverDeleteError) {
        console.warn('Failed to delete cover from storage:', coverDeleteError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting book:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
