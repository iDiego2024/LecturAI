import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processNewBook } from '@/lib/pipeline/ingest';

export const maxDuration = 120; // Allow 2 mins for manual trigger

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Get the book details
    const bookId = '0a5194fe-6d5b-4f14-993a-3304fb1beaf0';
    const { data: book, error } = await supabase.from('books').select('*').eq('id', bookId).single();
    
    if (error) throw error;

    console.log('Downloading file from storage...');
    const { data: fileData, error: downloadError } = await supabase.storage.from('books').download(book.file_path);
    if (downloadError) throw downloadError;

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('Triggering processNewBook SYNC...');
    // We will await it here so we catch any errors directly in the API response!
    await processNewBook(book.id, buffer, 'Cien anos de soledad.epub');

    return NextResponse.json({ success: true, message: 'Pipeline visually completed!' });
  } catch (error: any) {
    console.error('Trigger Error:', error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
