import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership
    const { data: test, error: fetchError } = await supabase
      .from('tests')
      .select('user_id')
      .eq('id', params.id)
      .single();

    const t = test as any;
    if (fetchError || !test || t.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized to delete this test' }, { status: 403 });
    }

    // Delete the test. Supabase ON DELETE CASCADE handles test_items deletion natively.
    const { error: deleteError } = await supabase
      .from('tests')
      .delete()
      .eq('id', params.id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting test:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
