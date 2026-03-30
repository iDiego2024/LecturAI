import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { analyzeBookNarrative } from '@/lib/gemini/analyze';
import { createClient as createAuthClient } from '@/lib/supabase/server';

export const maxDuration = 60; 

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
      .in('status', ['consolidating'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (jobError || !job) {
      // Check if it's already completed
      const { data: completedJob } = await supabase.from('book_jobs').select('*').eq('book_id', bookId).eq('status', 'completed').limit(1).single();
      if (completedJob) {
        return NextResponse.json({ success: true, message: 'Already consolidated' });
      }
      return NextResponse.json({ error: 'No ready job found for consolidation' }, { status: 400 });
    }

    // Fetch all chunks to reconstruct full text for narrative analysis
    const { data: chunks, error: chunksError } = await supabase
      .from('book_chunks')
      .select('content')
      .eq('book_id', bookId)
      .order('chunk_index', { ascending: true });

    if (chunksError) throw chunksError;

    const fullText = chunks ? chunks.map(c => c.content).join(' ') : '';
    
    if (!fullText) {
       return NextResponse.json({ error: 'No text available for consolidation' }, { status: 400 });
    }

    // Process narrative analysis (characters, themes, etc)
    const analysisSuccess = await analyzeBookNarrative(bookId, fullText);

    if (analysisSuccess) {
      // Finish job
      await supabase.from('book_jobs').update({ status: 'completed' }).eq('id', job.id);
      
      await supabase.from('books').update({ 
        processing_status: 'ready', 
        processing_progress: 100 
      }).eq('id', bookId);

      return NextResponse.json({ success: true, message: 'Consolidation successful', nextAction: 'done' });
    } else {
      await supabase.from('book_jobs').update({ status: 'failed', error_message: 'Analysis consolidation failed' }).eq('id', job.id);
      return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
    }

  } catch (error) {
    console.error('Consolidate Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
