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

function getBaseTitle(title: string) {
  return title.replace(/\s+-\s+Variante\s+[A-Z0-9-]+$/i, '');
}

export async function POST(
  _request: Request,
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

    const { data: test, error: testError } = await supabase
      .from('tests')
      .select(
        `
        *,
        test_items (
          item_order,
          points,
          question_bank (
            q_type,
            cognitive_level,
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
    const familyId = typedTest.variant_family_id || typedTest.id;
    const originalItems = (typedTest.test_items || [])
      .filter((item: any) => item.question_bank)
      .sort((a: any, b: any) => a.item_order - b.item_order);

    if (originalItems.length === 0) {
      return NextResponse.json(
        { error: 'Esta evaluacion no tiene preguntas para crear una variante.' },
        { status: 400 }
      );
    }

    const { data: siblingTests } = await supabase
      .from('tests')
      .select('variant_label')
      .eq('variant_family_id', familyId);

    const label = nextVariantLabel(
      (siblingTests || [])
        .map((item: any) => item.variant_label)
        .filter((value: unknown) => typeof value === 'string' && value.trim())
    );

    const generationConfig =
      typeof typedTest.generation_config === 'object' && typedTest.generation_config !== null
        ? typedTest.generation_config
        : {};
    const baseTeacherRequest =
      typeof generationConfig.teacherRequest === 'string'
        ? generationConfig.teacherRequest.trim()
        : '';

    const { data: newTest, error: insertTestError } = await supabase
      .from('tests')
      .insert({
        user_id: user.id,
        book_id: typedTest.book_id,
        title: `${getBaseTitle(typedTest.title)} - Variante ${label}`,
        target_grade: typedTest.target_grade,
        instructions: typedTest.instructions,
        status: 'draft',
        total_score: 0,
        generation_config: generationConfig,
        variant_label: label,
        variant_family_id: familyId,
      })
      .select()
      .single();

    if (insertTestError || !newTest) {
      throw insertTestError || new Error('No se pudo crear la variante.');
    }

    let existingContext = '';
    const usedTopics: string[] = [];

    for (const item of originalItems) {
      const question = item.question_bank;
      existingContext += `- ${question.question_text}\n`;
      const topicLabel = question.metadata?.topic_label;
      if (typeof topicLabel === 'string' && topicLabel.trim()) {
        usedTopics.push(topicLabel);
      }
    }

    const generatedQuestions = [];
    for (const item of originalItems) {
      const question = item.question_bank;
      const topicLabel =
        typeof question.metadata?.topic_label === 'string'
          ? question.metadata.topic_label.trim()
          : '';

      const questionVariant = await generateQuestion({
        bookId: typedTest.book_id,
        cognitiveLevel: question.cognitive_level,
        questionType: question.q_type,
        targetGrade: typedTest.target_grade,
        existingQuestionsContext: existingContext,
        topicHint: topicLabel,
        teacherRequest: [
          baseTeacherRequest,
          'Genera una variante distinta de la evaluacion actual. Mantén el nivel, el foco pedagógico y el tipo de pregunta, pero cambia la formulacion o la situacion evaluada.',
        ]
          .filter(Boolean)
          .join(' '),
        usedTopics,
      });

      generatedQuestions.push({
        question: questionVariant,
        points: Number(item.points || 1),
      });
      existingContext += `- ${questionVariant.question_text}\n`;

      const generatedTopic =
        typeof questionVariant.metadata?.topic_label === 'string'
          ? questionVariant.metadata.topic_label.trim()
          : '';
      if (generatedTopic) {
        usedTopics.push(generatedTopic);
      }
    }

    let totalScore = 0;
    const testItems = generatedQuestions.map((entry, index) => {
      totalScore += entry.points;
      return {
        test_id: newTest.id,
        question_id: entry.question.id,
        item_order: index + 1,
        points: entry.points,
      };
    });

    const { error: itemError } = await supabase.from('test_items').insert(testItems);
    if (itemError) throw itemError;

    const { error: scoreError } = await supabase
      .from('tests')
      .update({ total_score: totalScore })
      .eq('id', newTest.id);

    if (scoreError) throw scoreError;

    return NextResponse.json({
      success: true,
      testId: newTest.id,
      label,
      sourceQuestionCount: originalItems.length,
    });
  } catch (error) {
    console.error('Error creating test variant:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
