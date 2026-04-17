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

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function isSupportedQuestionType(value: unknown): value is SupportedQuestionType {
  return typeof value === 'string' && ALLOWED_QUESTION_TYPES.includes(value as SupportedQuestionType);
}

function isSupportedCognitiveLevel(
  value: unknown
): value is (typeof ALLOWED_COGNITIVE_LEVELS)[number] {
  return typeof value === 'string' && ALLOWED_COGNITIVE_LEVELS.includes(value as any);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const mode = body.mode === 'manual' ? 'manual' : 'ai';
    const cognitiveLevel = body.cognitiveLevel as (typeof ALLOWED_COGNITIVE_LEVELS)[number];
    const questionType = body.questionType as SupportedQuestionType;
    const targetGrade = normalizeString(body.targetGrade);
    const topicHint = normalizeString(body.topicHint);
    const teacherRequest = normalizeString(body.teacherRequest);

    if (
      !isSupportedCognitiveLevel(cognitiveLevel) ||
      !isSupportedQuestionType(questionType) ||
      !targetGrade
    ) {
      return NextResponse.json({ error: 'Solicitud invalida.' }, { status: 400 });
    }

    const { data: test, error: testError } = await supabase
      .from('tests')
      .select(
        `
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
      `
      )
      .eq('id', params.id)
      .single();

    if (testError || !test || (test as any).user_id !== user.id) {
      return NextResponse.json(
        { error: 'Evaluacion no encontrada o sin permisos.' },
        { status: 404 }
      );
    }

    const typedTest = test as any;
    const existingItems = typedTest.test_items || [];
    const existingContext = existingItems
      .map((item: any) => `- ${item.question_bank?.question_text || ''}`)
      .join('\n');
    const usedTopics = existingItems
      .map((item: any) => item.question_bank?.metadata?.topic_label)
      .filter((value: unknown) => typeof value === 'string' && value.trim().length > 0);

    let question: any;

    if (mode === 'ai') {
      question = await generateQuestion({
        bookId: typedTest.book_id,
        cognitiveLevel,
        questionType,
        targetGrade,
        topicHint,
        teacherRequest,
        existingQuestionsContext: existingContext,
        usedTopics,
      });
    } else {
      const questionText = normalizeString(body.questionText);
      const correctAnswer = normalizeString(body.correctAnswer);
      const rubric = normalizeString(body.rubric) || null;
      const justification = normalizeString(body.justification) || null;
      const distractors = normalizeStringArray(body.distractors);
      const metadata =
        typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : {};

      if (!questionText || !correctAnswer) {
        return NextResponse.json(
          { error: 'La pregunta y la respuesta esperada son obligatorias.' },
          { status: 400 }
        );
      }

      if (questionType === 'multiple_choice' && distractors.length < 3) {
        return NextResponse.json(
          { error: 'La seleccion multiple necesita al menos 3 alternativas incorrectas.' },
          { status: 400 }
        );
      }

      if (
        questionType === 'matching' &&
        (!Array.isArray((metadata as any).matching_pairs) ||
          (metadata as any).matching_pairs.length < 2)
      ) {
        return NextResponse.json(
          { error: 'Los terminos pareados necesitan al menos 2 pares.' },
          { status: 400 }
        );
      }

      const { data: createdQuestion, error: createQuestionError } = await supabase
        .from('question_bank')
        .insert({
          book_id: typedTest.book_id,
          q_type: questionType,
          cognitive_level: cognitiveLevel,
          question_text: questionText,
          correct_answer: correctAnswer,
          distractors: distractors.length > 0 ? distractors : null,
          rubric,
          justification,
          metadata,
          status: 'draft',
        })
        .select()
        .single();

      if (createQuestionError || !createdQuestion) {
        throw createQuestionError || new Error('No se pudo crear la pregunta manual.');
      }

      question = createdQuestion;
    }

    const nextOrder =
      existingItems.reduce((max: number, item: any) => Math.max(max, item.item_order || 0), 0) + 1;
    const requestedPoints = Number.isFinite(Number(body.points)) ? Math.max(1, Number(body.points)) : null;
    const points =
      requestedPoints ||
      (question.q_type === 'development' || question.q_type === 'creative_writing' ? 3 : 1);

    const { error: itemError } = await supabase.from('test_items').insert({
      test_id: typedTest.id,
      question_id: question.id,
      item_order: nextOrder,
      points,
    });

    if (itemError) throw itemError;

    const { error: scoreError } = await supabase
      .from('tests')
      .update({ total_score: Number(typedTest.total_score || 0) + points })
      .eq('id', typedTest.id);

    if (scoreError) throw scoreError;

    return NextResponse.json({ success: true, questionId: question.id, mode });
  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
