import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateQuestion } from '@/lib/gemini/questions';

function nextVariantLabel(existingLabels: string[]) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  for (const letter of alphabet) {
    if (!existingLabels.includes(letter)) return letter;
  }
  return `VAR-${existingLabels.length + 1}`;
}

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

    const { data: test, error: testError } = await supabase
      .from('tests')
      .select(`
        *,
        test_items (
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
    const generationConfig = typedTest.generation_config;

    if (!generationConfig?.questionPlan?.length) {
      return NextResponse.json(
        { error: 'Esta evaluacion no tiene configuracion guardada para crear variantes.' },
        { status: 400 }
      );
    }

    const { data: siblingTests } = await supabase
      .from('tests')
      .select('variant_label')
      .eq('book_id', typedTest.book_id)
      .eq('user_id', user.id);

    const label = nextVariantLabel(
      (siblingTests || [])
        .map((item: any) => item.variant_label)
        .filter((value: unknown) => typeof value === 'string' && value.trim())
    );

    const variantTitle = typedTest.title.replace(/\s+-\s+Variante\s+[A-Z0-9-]+$/i, '');
    const { data: newTest, error: insertTestError } = await supabase
      .from('tests')
      .insert({
        user_id: user.id,
        book_id: typedTest.book_id,
        title: `${variantTitle} - Variante ${label}`,
        target_grade: typedTest.target_grade,
        instructions: typedTest.instructions,
        status: 'draft',
        total_score: 0,
        generation_config: generationConfig,
        variant_label: label,
      })
      .select()
      .single();

    if (insertTestError || !newTest) throw insertTestError || new Error('No se pudo crear la variante.');

    let existingContext = '';
    const usedTopics: string[] = [];
    const originalItems = typedTest.test_items || [];
    originalItems.forEach((item: any) => {
      const question = item.question_bank;
      if (!question) return;
      existingContext += `- ${question.question_text}\n`;
      const topicLabel = question.metadata?.topic_label;
      if (typeof topicLabel === 'string' && topicLabel.trim()) usedTopics.push(topicLabel);
    });

    const generatedQuestions = [];
    for (const planItem of generationConfig.questionPlan) {
      const question = await generateQuestion({
        bookId: typedTest.book_id,
        cognitiveLevel: planItem.cognitiveLevel,
        questionType: planItem.questionType,
        targetGrade: typedTest.target_grade,
        existingQuestionsContext: existingContext,
        topicHint: planItem.topicHint,
        teacherRequest: `Genera una variante distinta de la evaluacion original. Mantén el nivel, pero cambia el foco, formulacion o situacion evaluada.`,
        usedTopics,
      });

      generatedQuestions.push(question);
      existingContext += `- ${question.question_text}\n`;
      const topicLabel = (question as any).metadata?.topic_label;
      if (typeof topicLabel === 'string' && topicLabel.trim()) usedTopics.push(topicLabel);
    }

    let totalScore = 0;
    const testItems = generatedQuestions.map((question: any, index: number) => {
      const points =
        question.q_type === 'development' || question.q_type === 'creative_writing' ? 3 : 1;
      totalScore += points;
      return {
        test_id: newTest.id,
        question_id: question.id,
        item_order: index + 1,
        points,
      };
    });

    const { error: itemError } = await supabase.from('test_items').insert(testItems);
    if (itemError) throw itemError;

    const { error: scoreError } = await supabase
      .from('tests')
      .update({ total_score: totalScore })
      .eq('id', newTest.id);

    if (scoreError) throw scoreError;

    return NextResponse.json({ success: true, testId: newTest.id, label });
  } catch (error) {
    console.error('Error creating test variant:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
