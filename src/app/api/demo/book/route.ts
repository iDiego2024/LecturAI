import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { chunkText } from '@/lib/pdf/chunk';
import { extractTextFromEpub } from '@/lib/pdf/extractEpub';
import { normalizeText } from '@/lib/pdf/normalize';
import {
  DEMO_BOOK_AUTHOR,
  DEMO_BOOK_FILE,
  DEMO_BOOK_TITLE,
  isDemoEmail,
} from '@/lib/demo';

export async function POST() {
  try {
    const authClient = createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDemoEmail(user.email)) {
      return NextResponse.json({ error: 'Esta opcion es solo para la cuenta demo.' }, { status: 403 });
    }

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const userId = user.id;

    const { data: existingBook } = await supabase
      .from('books')
      .select('id, processing_status, processing_progress')
      .eq('user_id', userId)
      .eq('title', DEMO_BOOK_TITLE)
      .limit(1)
      .maybeSingle();

    if (existingBook) {
      return NextResponse.json({ success: true, book: existingBook, reused: true });
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email ?? 'unknown@lecturai.local',
          full_name: (user.user_metadata as { full_name?: string } | null)?.full_name ?? null,
          school_name: (user.user_metadata as { school_name?: string } | null)?.school_name ?? null,
          avatar_url: (user.user_metadata as { avatar_url?: string } | null)?.avatar_url ?? null,
        },
        { onConflict: 'id' }
      );

    if (profileError) throw profileError;

    const demoBookPath = path.join(process.cwd(), DEMO_BOOK_FILE);
    const demoFileBuffer = await fs.readFile(demoBookPath);
    const filePath = `${userId}/demo-${DEMO_BOOK_FILE}`;

    const { error: uploadError } = await supabase.storage
      .from('books')
      .upload(
        filePath,
        new Blob([new Uint8Array(demoFileBuffer)], { type: 'application/epub+zip' }),
        {
          contentType: 'application/epub+zip',
          upsert: true,
        }
      );

    if (uploadError) throw uploadError;

    const { data: book, error: bookError } = await supabase
      .from('books')
      .insert({
        user_id: userId,
        title: DEMO_BOOK_TITLE,
        author: DEMO_BOOK_AUTHOR,
        file_path: filePath,
        file_size_bytes: demoFileBuffer.byteLength,
        processing_status: 'extracting',
        processing_progress: 10,
      })
      .select()
      .single();

    if (bookError) throw bookError;

    const { text, pages } = await extractTextFromEpub(demoFileBuffer);

    await supabase.from('books').update({
      page_count: pages,
      raw_text: text.substring(0, 100000),
      processing_status: 'chunking',
      processing_progress: 20,
    }).eq('id', book.id);

    const normalizedText = normalizeText(text);
    const chunks = chunkText(normalizedText, 500, 50);

    const { data: job, error: jobError } = await supabase
      .from('book_jobs')
      .insert({
        book_id: book.id,
        status: 'pending',
        total_chunks: chunks.length,
        processed_chunks: 0,
        failed_chunks: 0,
      })
      .select()
      .single();

    if (jobError) throw jobError;

    const chunkJobRecords = chunks.map((chunk, index) => ({
      job_id: job.id,
      chunk_index: index,
      status: 'pending',
      chunk_data: {
        content: chunk.content,
        pageNumber: chunk.pageNumber,
      },
    }));

    const batchSize = 100;
    for (let i = 0; i < chunkJobRecords.length; i += batchSize) {
      const batch = chunkJobRecords.slice(i, i + batchSize);
      const { error: chunksError } = await supabase
        .from('book_chunk_jobs')
        .insert(batch);

      if (chunksError) throw chunksError;
    }

    await supabase.from('books').update({
      processing_status: 'pending',
      processing_progress: 30,
    }).eq('id', book.id);

    return NextResponse.json({ success: true, book, job, reused: false });
  } catch (error) {
    console.error('Demo book setup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No fue posible preparar el libro demo.' },
      { status: 500 }
    );
  }
}
