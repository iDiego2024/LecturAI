import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createAuthClient } from '@/lib/supabase/server';

export const maxDuration = 60; // Max allowed for Vercel Hobby/Pro on normal routes

const STALE_CHUNK_TIMEOUT_SECONDS = 300;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    const bookId = params.id;

    const { data: ownedBook, error: ownedBookError } = await authClient
      .from('books')
      .select('id')
      .eq('id', bookId)
      .eq('user_id', user.id)
      .single();

    if (ownedBookError || !ownedBook) {
      return NextResponse.json({ error: 'Book not found or unauthorized' }, { status: 404 });
    }
    
    // Get active job
    const { data: job, error: jobError } = await supabase
      .from('book_jobs')
      .select('*')
      .eq('book_id', bookId)
      .in('status', ['pending', 'processing', 'failed', 'paused', 'consolidating', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'No active job found' }, { status: 404 });
    }

    if (job.status === 'completed' || job.status === 'consolidating') {
      return NextResponse.json({ success: true, message: 'Job already past chunk processing', job });
    }

    const staleBeforeIso = new Date(
      Date.now() - STALE_CHUNK_TIMEOUT_SECONDS * 1000
    ).toISOString();

    const { error: staleResetError } = await supabase
      .from('book_chunk_jobs')
      .update({
        status: 'retrying',
        error_message: `Chunk reclaimed after ${STALE_CHUNK_TIMEOUT_SECONDS}s without progress`,
      })
      .eq('job_id', job.id)
      .eq('status', 'processing')
      .lt('updated_at', staleBeforeIso);

    if (staleResetError) throw staleResetError;
    
    // Update job to processing
    if (job.status !== 'processing') {
      await supabase.from('book_jobs').update({ status: 'processing' }).eq('id', job.id);
      await supabase.from('books').update({ processing_status: 'chunking' }).eq('id', bookId);
    }

    // Fetch candidate chunks, then claim them one by one to avoid duplicate work
    // when two requests hit this route at nearly the same time.
    const BATCH_SIZE = 50;
    const { data: candidateChunks, error: chunksError } = await supabase
      .from('book_chunk_jobs')
      .select('*')
      .eq('job_id', job.id)
      .in('status', ['pending', 'retrying'])
      .order('chunk_index', { ascending: true })
      .limit(BATCH_SIZE * 2);

    if (chunksError) throw chunksError;

    const claimedChunks = [];
    for (const chunk of candidateChunks || []) {
      if (claimedChunks.length >= BATCH_SIZE) break;

      const { data: claimedChunk, error: claimError } = await supabase
        .from('book_chunk_jobs')
        .update({ status: 'processing' })
        .eq('id', chunk.id)
        .in('status', ['pending', 'retrying'])
        .select('*')
        .maybeSingle();

      if (claimError) throw claimError;
      if (claimedChunk) {
        claimedChunks.push(claimedChunk);
      }
    }

    if (claimedChunks.length === 0) {
      const [
        { count: processingCount, error: processingCountError },
        { count: failedCount, error: failedCountError },
      ] = await Promise.all([
        supabase
          .from('book_chunk_jobs')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', job.id)
          .eq('status', 'processing'),
        supabase
          .from('book_chunk_jobs')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', job.id)
          .eq('status', 'failed'),
      ]);

      if (processingCountError) throw processingCountError;
      if (failedCountError) throw failedCountError;

      if ((processingCount || 0) > 0) {
        return NextResponse.json({
          success: true,
          message: 'Waiting for in-flight chunks to finish',
          processed: 0,
          totalProcessed: job.processed_chunks,
          totalChunks: job.total_chunks,
          progress: 20 + Math.floor((job.processed_chunks / job.total_chunks) * 60),
          nextAction: 'process-chunks',
        });
      }

      // Are there failed chunks?
      if (failedCount && failedCount > 0) {
        await supabase.from('book_jobs').update({ status: 'failed', error_message: `${failedCount} chunks failed permanently` }).eq('id', job.id);
        await supabase.from('books').update({ processing_status: 'failed', processing_progress: 0, processing_error: 'Some chunks failed permanently' }).eq('id', bookId);
        return NextResponse.json(
          { error: 'Job failed due to permanently failed chunks', job },
          { status: 500 }
        );
      }

      const { count: completedChunks, error: completedCountError } = await supabase
        .from('book_chunk_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', job.id)
        .eq('status', 'completed');

      if (completedCountError) throw completedCountError;

      // No chunks left! Advance to consolidating
      await supabase.from('book_jobs').update({ status: 'consolidating', processed_chunks: completedChunks || job.processed_chunks }).eq('id', job.id);
      await supabase.from('books').update({ processing_status: 'analyzing', processing_progress: 80 }).eq('id', bookId);
      
      return NextResponse.json({ success: true, message: 'All chunks processed', nextAction: 'consolidate', job });
    }

    // Bypass Gemini API embedding generation entirely
    // The previous implementation used generateEmbeddingsBatch which resulted in 429 Rate Limits.
    // Since we've switched to gemini-3.1-flash-lite-preview with a 1M context limit,
    // semantic chunk retrieval using embeddings is no longer strictly necessary.
    
    // Success! Save without vector embeddings
    const chunkIds = claimedChunks.map(c => c.id);
    const chunkRecords = claimedChunks.map((chunk) => ({
      book_id: bookId,
      chunk_index: chunk.chunk_index,
      content: chunk.chunk_data.content,
      page_number: chunk.chunk_data.pageNumber || 0,
      embedding: null
    }));

    const { error: insertError } = await supabase.from('book_chunks').insert(chunkRecords);
    if (insertError) {
       await supabase.from('book_chunk_jobs').update({ status: 'retrying', error_message: 'DB Insert Failed' }).in('id', chunkIds);
       throw insertError;
    }

    // Mark chunk jobs as completed
    await supabase.from('book_chunk_jobs').update({ status: 'completed' }).in('id', chunkIds);

    // Update global progress
    const { count: completedChunks, error: completedCountError } = await supabase
      .from('book_chunk_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', job.id)
      .eq('status', 'completed');

    if (completedCountError) throw completedCountError;

    const newProcessedItems = completedChunks || 0;
    const progressPercent = 20 + Math.floor((newProcessedItems / job.total_chunks) * 60);

    await supabase.from('book_jobs').update({ processed_chunks: newProcessedItems }).eq('id', job.id);
    await supabase.from('books').update({ processing_progress: progressPercent }).eq('id', bookId);

    // No need for a long delay anymore because there are no API calls to rate limit here.
    await new Promise(res => setTimeout(res, 100));

    return NextResponse.json({ 
      success: true, 
      processed: claimedChunks.length, 
      totalProcessed: newProcessedItems,
      totalChunks: job.total_chunks,
      progress: progressPercent,
      nextAction: 'process-chunks'
    });

  } catch (error) {
    console.error('Process Chunks Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
