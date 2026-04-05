import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateQuestion, type SupportedQuestionType } from '@/lib/gemini/questions';

const ALLOWED_COGNITIVE_LEVELS = ['locate', 'interpret', 'reflect'] as const;
const ALLOWED_QUESTION_TYPES = [
  'multiple_choice',
  'true_false',
  'development',
  'matching',
  'creative_writing',
] as const;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const cognitiveLevel = body.cognitiveLevel as (typeof ALLOWED_COGNITIVE_LEVELS)[number];
    const questionType = body.questionType as SupportedQuestionType;
    const targetGrade = body.targetGrade as string;
    const topicHint = typeof body.topicHint === 'string' ? body.topicHint.trim() : '';
    const teacherRequest = typeof body.teacherRequest === 'string' ? body.teacherRequest.trim() : '';

    if (
      !ALLOWED_COGNITIVE_LEVELS.includes(cognitiveLevel) ||
      !ALLOWED_QUESTION_TYPES.includes(questionType) ||
      !targetGrade?.trim()
    ) {
      return NextResponse.json({ error: 'Solicitud invalida.' }, { status: 400 });
    }

    const { data: test, error: testError } = await supabase
      .from('tests')
      .select(`
        id,
        user_id,
        book_id,
        target_grade,
        total_score,
        test_items (
          item_order,
          question_bank (
            question_text,
            metadata
          )
        )
      `)
      .eq('id', params.id)
      .single();

    if (testError || !test || (test as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Evaluacion no encontrada o sin permisos.' }, { status: 404 });
    }

    const typedTest = test as any;
    const existingItems = typedTest.test_items || [];
    const existingContext = existingItems
      .map((item: any) => `- ${item.question_bank?.question_text || ''}`)
      .join('\n');
    const usedTopics = existingItems
      .map((item: any) => item.question_bank?.metadata?.topic_label)
      .filter((value: unknown) => typeof value === 'string' && value.trim().length > 0);

    const question = await generateQuestion({
      bookId: typedTest.book_id,
      cognitiveLevel,
      questionType,
      targetGrade,
      topicHint,
      teacherRequest,
      existingQuestionsContext: existingContext,
      usedTopics,
    });

    const nextOrder =
      existingItems.reduce((max: number, item: any) => Math.max(max, item.item_order || 0), 0) + 1;
    const points =
      question.q_type === 'development' || question.q_type === 'creative_writing' ? 3 : 1;

    const { error: itemError } = await supabase.from('test_items').insert({
      test_id: typedTest.id,
      question_id: question.id,
      item_order: nextOrder,
      points,
    });

    if (itemError) throw itemError;

    const { error: scoreError } = await supabase
      .from('tests')
      .update({ total_score: (typedTest.total_score || 0) + points })
      .eq('id', typedTest.id);

    if (scoreError) throw scoreError;

    return NextResponse.json({ success: true, questionId: question.id });
  } catch (error) {
    console.error('Error creating AI question:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
