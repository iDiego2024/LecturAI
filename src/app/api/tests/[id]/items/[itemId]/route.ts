import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type RouteParams = {
  params: {
    id: string;
    itemId: string;
  };
};

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

export async function PATCH(request: Request, { params }: RouteParams) {
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
      .select('id, user_id')
      .eq('id', params.id)
      .single();

    if (testError || !test || (test as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Evaluacion no encontrada o sin permisos.' }, { status: 404 });
    }

    const { data: item, error: itemError } = await supabase
      .from('test_items')
      .select('id, test_id, question_id, points')
      .eq('id', params.itemId)
      .eq('test_id', params.id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Pregunta no encontrada.' }, { status: 404 });
    }

    const body = await request.json();
    const questionText = normalizeString(body.questionText);
    const correctAnswer = normalizeString(body.correctAnswer);
    const rubric = normalizeString(body.rubric) || null;
    const justification = normalizeString(body.justification) || null;
    const points = Number.isFinite(body.points) ? Math.max(1, Number(body.points)) : Number((item as any).points || 1);
    const distractors = normalizeStringArray(body.distractors);
    const metadata = typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : {};

    if (!questionText || !correctAnswer) {
      return NextResponse.json({ error: 'La pregunta y la respuesta esperada son obligatorias.' }, { status: 400 });
    }

    const { error: updateQuestionError } = await supabase
      .from('question_bank')
      .update({
        question_text: questionText,
        correct_answer: correctAnswer,
        distractors: distractors.length > 0 ? distractors : null,
        rubric,
        justification,
        metadata,
      })
      .eq('id', (item as any).question_id);

    if (updateQuestionError) throw updateQuestionError;

    const previousPoints = Number((item as any).points || 1);
    if (points !== previousPoints) {
      const { error: updateItemError } = await supabase
        .from('test_items')
        .update({ points })
        .eq('id', params.itemId);

      if (updateItemError) throw updateItemError;

      const currentScore = Number((test as any).total_score || 0);
      const { error: updateScoreError } = await supabase
        .from('tests')
        .update({ total_score: currentScore + (points - previousPoints) })
        .eq('id', params.id);

      if (updateScoreError) throw updateScoreError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating test item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
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
      .select('id, user_id, total_score')
      .eq('id', params.id)
      .single();

    if (testError || !test || (test as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Evaluacion no encontrada o sin permisos.' }, { status: 404 });
    }

    const { data: item, error: itemError } = await supabase
      .from('test_items')
      .select('id, test_id, question_id, item_order, points')
      .eq('id', params.itemId)
      .eq('test_id', params.id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Pregunta no encontrada.' }, { status: 404 });
    }

    const questionId = (item as any).question_id;
    const deletedOrder = Number((item as any).item_order || 0);
    const deletedPoints = Number((item as any).points || 0);

    const { error: deleteItemError } = await supabase.from('test_items').delete().eq('id', params.itemId);
    if (deleteItemError) throw deleteItemError;

    const { data: remainingItems } = await supabase
      .from('test_items')
      .select('id, item_order')
      .eq('test_id', params.id)
      .order('item_order', { ascending: true });

    for (const remainingItem of remainingItems || []) {
      const typedItem = remainingItem as any;
      if (Number(typedItem.item_order) <= deletedOrder) continue;

      const { error: reorderError } = await supabase
        .from('test_items')
        .update({ item_order: Number(typedItem.item_order) - 1 })
        .eq('id', typedItem.id);

      if (reorderError) throw reorderError;
    }

    const nextScore = Math.max(0, Number((test as any).total_score || 0) - deletedPoints);
    const { error: updateScoreError } = await supabase
      .from('tests')
      .update({ total_score: nextScore })
      .eq('id', params.id);

    if (updateScoreError) throw updateScoreError;

    const { count } = await supabase
      .from('test_items')
      .select('*', { count: 'exact', head: true })
      .eq('question_id', questionId);

    if (!count) {
      await supabase.from('question_bank').delete().eq('id', questionId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting test item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
