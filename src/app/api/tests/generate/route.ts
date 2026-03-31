import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateQuestion } from '@/lib/gemini/questions';
import { DEMO_MAX_TESTS, isDemoEmail } from '@/lib/demo';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    
    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { bookId, count, config } = body;

    if (!bookId || !count || !config) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify book ownership
    const { data: book } = await supabase
      .from('books')
      .select('id')
      .eq('id', bookId)
      .eq('user_id', user.id)
      .single();

    if (!book) {
      return NextResponse.json({ error: 'Book not found or unauthorized' }, { status: 404 });
    }

    if (isDemoEmail(user.email)) {
      const { count } = await supabase
        .from('tests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if ((count || 0) >= DEMO_MAX_TESTS) {
        return NextResponse.json(
          { error: 'La cuenta demo permite generar solo 1 evaluacion.' },
          { status: 403 }
        );
      }
    }

    // Generate questions in sequence to maintain context and avoid duplicates
    const questions = [];
    let existingContext = '';

    for (let i = 0; i < count; i++) {
      // Rotate cognitive levels and types based on config distribution
      const q = await generateQuestion({
        bookId,
        cognitiveLevel: config.distribution.cognitive[i % config.distribution.cognitive.length],
        questionType: config.distribution.types[i % config.distribution.types.length],
        targetGrade: config.targetGrade,
        existingQuestionsContext: existingContext
      });
      if (!q) {
        throw new Error('No se pudo generar una pregunta valida.');
      }

      questions.push(q);
      existingContext += `- [${q.cognitive_level}] ${q.question_text}\n`;
    }

    return NextResponse.json({ success: true, count: questions.length, questions });

  } catch (error) {
    console.error('API Error generating questions', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
