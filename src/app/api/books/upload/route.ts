import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { extractTextFromPdf } from '@/lib/pdf/extract';
import { extractTextFromEpub } from '@/lib/pdf/extractEpub';
import { normalizeText } from '@/lib/pdf/normalize';
import { chunkText } from '@/lib/pdf/chunk';

export const maxDuration = 60; // Max allowed for Vercel Hobby/Pro on normal routes

export async function POST(request: Request) {
  try {
    const authClient = createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const userId = user.id;
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { extractTextFromPdf } from '@/lib/pdf/extract';
import { extractTextFromEpub } from '@/lib/pdf/extractEpub';
import { normalizeText } from '@/lib/pdf/normalize';
import { chunkText } from '@/lib/pdf/chunk';

export const maxDuration = 60; // Max allowed for Vercel Hobby/Pro on normal routes

export async function POST(request: Request) {
  try {
    const authClient = createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const userId = user.id;

    // Ensure the profile exists (older accounts or externally-created users
    // may exist in auth.users but not yet in public.profiles).
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email ?? 'unknown@lecturai.local',
          full_name: (user.user_metadata as { full_name?: string } | null)?.full_name ?? null,
        },
        { onConflict: 'id' }
      );
    if (profileError) throw profileError;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const author = formData.get('author') as string;

    if (!file || !title) {
      return NextResponse.json({ error: 'File and title are required' }, { status: 400 });
    }

    if (file.type !== 'application/pdf' && file.type !== 'application/epub+zip' && !file.name.endsWith('.epub')) {
       return NextResponse.json({ error: 'El archivo debe ser un PDF o EPUB válido' }, { status: 400 });
    }

    // Limit to 20MB
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo es demasiado grande. El límite es de 20MB para proteger los límites de la API.' }, { status: 400 });
    }

    // Upload to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase
      .storage
      .from('books')
      .upload(fileName, buffer, {
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    // Create DB Record
    const { data: book, error: dbError } = await supabase
      .from('books')
      .insert({
        user_id: userId,
        title,
        author,
        file_path: fileName,
        file_size_bytes: file.size,
        processing_status: 'extracting',
        processing_progress: 10
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // 1. EXTRACT
    let text = '';
    let pages = 0;
    
    if (file.name.toLowerCase().endsWith('.epub')) {
      const result = await extractTextFromEpub(buffer);
      text = result.text;
      pages = result.pages;
    } else {
      const result = await extractTextFromPdf(buffer);
      text = result.text;
      pages = result.pages;
    }

    await supabase.from('books').update({ 
      page_count: pages,
      raw_text: text.substring(0, 100000), // Checkpoint
      processing_status: 'chunking',
      processing_progress: 20
    }).eq('id', book.id);

    // 2. NORMALIZE & CHUNK
    const normalizedText = normalizeText(text);
    const chunks = chunkText(normalizedText, 500, 50);

    // 3. CREATE JOBS FOR CHUNKS
    // Job creation
    const { data: job, error: jobError } = await supabase
      .from('book_jobs')
      .insert({
        book_id: book.id,
        status: 'pending',
        total_chunks: chunks.length,
        processed_chunks: 0,
        failed_chunks: 0
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Chunk jobs
    const chunkJobRecords = chunks.map((chunk, index) => ({
      job_id: job.id,
      chunk_index: index,
      status: 'pending',
      chunk_data: {
        content: chunk.content,
        pageNumber: chunk.pageNumber
      }
    }));

    // Insert chunk jobs in batches to avoid huge payloads just in case
    const batchSize = 100;
    for (let i = 0; i < chunkJobRecords.length; i += batchSize) {
      const batch = chunkJobRecords.slice(i, i + batchSize);
      const { error: chunksError } = await supabase
        .from('book_chunk_jobs')
        .insert(batch);
      
      if (chunksError) throw chunksError;
    }

    // Update book status to let frontend know it's ready to start the job
    await supabase.from('books').update({ 
      processing_status: 'pending', // Reverting to pending or custom 'chunking_ready'
      processing_progress: 30
    }).eq('id', book.id);

    return NextResponse.json({ success: true, book, job });

  } catch (error) {
    console.error('Upload Error:', error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Unknown error';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const author = formData.get('author') as string;

    if (!file || !title) {
      return NextResponse.json({ error: 'File and title are required' }, { status: 400 });
    }

    if (file.type !== 'application/pdf' && file.type !== 'application/epub+zip' && !file.name.endsWith('.epub')) {
       return NextResponse.json({ error: 'El archivo debe ser un PDF o EPUB válido' }, { status: 400 });
    }

    // Limit to 20MB
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo es demasiado grande. El límite es de 20MB para proteger los límites de la API.' }, { status: 400 });
    }

    // Upload to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase
      .storage
      .from('books')
      .upload(fileName, buffer, {
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    // Create DB Record
    const { data: book, error: dbError } = await supabase
      .from('books')
      .insert({
        user_id: userId,
        title,
        author,
        file_path: fileName,
        file_size_bytes: file.size,
        processing_status: 'extracting',
        processing_progress: 10
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // 1. EXTRACT
    let text = '';
    let pages = 0;
    
    if (file.name.toLowerCase().endsWith('.epub')) {
      const result = await extractTextFromEpub(buffer);
      text = result.text;
      pages = result.pages;
    } else {
      const result = await extractTextFromPdf(buffer);
      text = result.text;
      pages = result.pages;
    }

    await supabase.from('books').update({ 
      page_count: pages,
      raw_text: text.substring(0, 100000), // Checkpoint
      processing_status: 'chunking',
      processing_progress: 20
    }).eq('id', book.id);

    // 2. NORMALIZE & CHUNK
    const normalizedText = normalizeText(text);
    const chunks = chunkText(normalizedText, 500, 50);

    // 3. CREATE JOBS FOR CHUNKS
    // Job creation
    const { data: job, error: jobError } = await supabase
      .from('book_jobs')
      .insert({
        book_id: book.id,
        status: 'pending',
        total_chunks: chunks.length,
        processed_chunks: 0,
        failed_chunks: 0
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Chunk jobs
    const chunkJobRecords = chunks.map((chunk, index) => ({
      job_id: job.id,
      chunk_index: index,
      status: 'pending',
      chunk_data: {
        content: chunk.content,
        pageNumber: chunk.pageNumber
      }
    }));

    // Insert chunk jobs in batches to avoid huge payloads just in case
    const batchSize = 100;
    for (let i = 0; i < chunkJobRecords.length; i += batchSize) {
      const batch = chunkJobRecords.slice(i, i + batchSize);
      const { error: chunksError } = await supabase
        .from('book_chunk_jobs')
        .insert(batch);
      
      if (chunksError) throw chunksError;
    }

    // Update book status to let frontend know it's ready to start the job
    await supabase.from('books').update({ 
      processing_status: 'pending', // Reverting to pending or custom 'chunking_ready'
      processing_progress: 30
    }).eq('id', book.id);

    return NextResponse.json({ success: true, book, job });

  } catch (error) {
    console.error('Upload Error:', error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Unknown error';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
