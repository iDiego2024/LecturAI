import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateQuestion, type SupportedQuestionType } from '@/lib/gemini/questions';
import { DEMO_MAX_TESTS, isDemoEmail } from '@/lib/demo';

const ALLOWED_COGNITIVE_LEVELS = ['locate', 'interpret', 'reflect'] as const;
const ALLOWED_QUESTION_TYPES = [
  'multiple_choice',
  'true_false',
  'development',
  'matching',
  'creative_writing',
] as const;
const MAX_QUESTIONS_PER_TEST = 45;

type QuestionPlanItem = {
  cognitiveLevel: (typeof ALLOWED_COGNITIVE_LEVELS)[number];
  questionType: SupportedQuestionType;
  topicHint?: string;
};

function isQuestionPlan(value: unknown): value is QuestionPlanItem[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as QuestionPlanItem).cognitiveLevel === 'string' &&
        ALLOWED_COGNITIVE_LEVELS.includes((item as QuestionPlanItem).cognitiveLevel) &&
        typeof (item as QuestionPlanItem).questionType === 'string' &&
        ALLOWED_QUESTION_TYPES.includes((item as QuestionPlanItem).questionType)
    )
  );
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { bookId, config } = body;

    if (!bookId || !config) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (
      typeof config?.targetGrade !== 'string' ||
      !config.targetGrade.trim() ||
      !isQuestionPlan(config?.questionPlan)
    ) {
      return NextResponse.json({ error: 'Configuracion de evaluacion invalida.' }, { status: 400 });
    }

    const questionPlan = config.questionPlan;

    if (questionPlan.length < 1 || questionPlan.length > MAX_QUESTIONS_PER_TEST) {
      return NextResponse.json(
        { error: `La cantidad de preguntas debe estar entre 1 y ${MAX_QUESTIONS_PER_TEST}.` },
        { status: 400 }
      );
    }

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

    const questions = [];
    const usedTopics: string[] = [];
    let existingContext = '';

    for (const planItem of questionPlan) {
      const question = await generateQuestion({
        bookId,
        cognitiveLevel: planItem.cognitiveLevel,
        questionType: planItem.questionType,
        targetGrade: config.targetGrade,
        existingQuestionsContext: existingContext,
        topicHint: planItem.topicHint,
        teacherRequest: config.teacherRequest,
        usedTopics,
      });

      if (!question) {
        throw new Error('No se pudo generar una pregunta valida.');
      }

      questions.push(question);
      const topicLabel = (question as any).metadata?.topic_label;
      if (typeof topicLabel === 'string' && topicLabel.trim()) {
        usedTopics.push(topicLabel);
      }
      existingContext += `- [${question.cognitive_level}] ${question.question_text}\n`;
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
