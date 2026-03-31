import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const schoolName = typeof body.schoolName === 'string' ? body.schoolName.trim() : '';

    if (!fullName) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    const metadata = {
      ...(user.user_metadata || {}),
      full_name: fullName,
      school_name: schoolName || null,
    };

    const { error: authError } = await supabase.auth.updateUser({
      data: metadata,
    });

    if (authError) throw authError;

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email || 'unknown@lecturai.local',
          full_name: fullName,
          school_name: schoolName || null,
          avatar_url: (metadata as any).avatar_url || null,
        } as any,
        { onConflict: 'id' }
      );

    if (profileError) throw profileError;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
