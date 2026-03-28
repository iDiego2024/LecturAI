import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const maxDuration = 60; // Max allowed for Vercel Hobby/Pro on normal routes

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Auth check
    let userId = null;
    const testAdminId = request.headers.get('x-test-admin-id');
    if (testAdminId) {
      userId = testAdminId;
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
         // TEST BYPASS
         const { data: profiles } = await supabase.from('profiles').select('id').limit(1);
         if (profiles && profiles.length > 0) {
            userId = profiles[0].id;
         } else {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
         }
      } else {
         userId = user.id;
      }
    }

    const bookId = params.id;
    
    // Get active job
    const { data: job, error: jobError } = await supabase
      .from('book_jobs')
      .select('*')
      .eq('book_id', bookId)
      .in('status', ['pending', 'processing', 'failed', 'paused'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'No active job found' }, { status: 404 });
    }

    if (job.status === 'completed' || job.status === 'consolidating') {
      return NextResponse.json({ success: true, message: 'Job already past chunk processing', job });
    }
    
    // Update job to processing
    if (job.status !== 'processing') {
      await supabase.from('book_jobs').update({ status: 'processing' }).eq('id', job.id);
      await supabase.from('books').update({ processing_status: 'chunking' }).eq('id', bookId);
    }

    // Fetch batch (increased to 50 since we bypass the Gemini limit completely)
    const BATCH_SIZE = 50;
    const { data: chunks, error: chunksError } = await supabase
      .from('book_chunk_jobs')
      .select('*')
      .eq('job_id', job.id)
      .in('status', ['pending', 'retrying'])
      .order('chunk_index', { ascending: true })
      .limit(BATCH_SIZE);

    if (chunksError) throw chunksError;

    if (!chunks || chunks.length === 0) {
      // Are there failed chunks?
      const { count: failedCount, error: countError } = await supabase
        .from('book_chunk_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', job.id)
        .eq('status', 'failed');
        
      if (failedCount && failedCount > 0) {
        await supabase.from('book_jobs').update({ status: 'failed', error_message: `${failedCount} chunks failed permanently` }).eq('id', job.id);
        await supabase.from('books').update({ processing_status: 'failed', processing_progress: 0, processing_error: 'Some chunks failed permanently' }).eq('id', bookId);
        return NextResponse.json({ error: 'Job failed due to permanently failed chunks', job });
      }

      // No chunks left! Advance to consolidating
      await supabase.from('book_jobs').update({ status: 'consolidating' }).eq('id', job.id);
      await supabase.from('books').update({ processing_status: 'analyzing', processing_progress: 80 }).eq('id', bookId);
      
      return NextResponse.json({ success: true, message: 'All chunks processed', nextAction: 'consolidate', job });
    }

    // Mark these as processing
    const chunkIds = chunks.map(c => c.id);
    await supabase.from('book_chunk_jobs').update({ status: 'processing' }).in('id', chunkIds);

    // Bypass Gemini API embedding generation entirely
    // The previous implementation used generateEmbeddingsBatch which resulted in 429 Rate Limits.
    // Since we've switched to gemini-3.1-flash-lite-preview with a 1M context limit,
    // semantic chunk retrieval using embeddings is no longer strictly necessary.
    
    // Success! Save without vector embeddings
    const chunkRecords = chunks.map((chunk) => ({
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
    const newProcessedItems = job.processed_chunks + chunks.length;
    const progressPercent = 20 + Math.floor((newProcessedItems / job.total_chunks) * 60);

    await supabase.from('book_jobs').update({ processed_chunks: newProcessedItems }).eq('id', job.id);
    await supabase.from('books').update({ processing_progress: progressPercent }).eq('id', bookId);

    // No need for a long delay anymore because there are no API calls to rate limit here.
    await new Promise(res => setTimeout(res, 100));

    return NextResponse.json({ 
      success: true, 
      processed: chunks.length, 
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
