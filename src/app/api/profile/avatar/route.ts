import { NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const authClient = createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se recibio ninguna foto' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'La foto debe ser una imagen valida' }, { status: 400 });
    }

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const bucket = 'avatars';
    const { data: bucketData } = await supabase.storage.getBucket(bucket);
    if (!bucketData) {
      await supabase.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      });
    }

    const fileExt = file.name.split('.').pop() || 'png';
    const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    const avatarUrl = publicUrlData.publicUrl;

    const metadata = {
      ...(user.user_metadata || {}),
      avatar_url: avatarUrl,
    };

    const { error: authError } = await authClient.auth.updateUser({
      data: metadata,
    });

    if (authError) throw authError;

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email || 'unknown@lecturai.local',
          full_name: (metadata as any).full_name || null,
          school_name: (metadata as any).school_name || null,
          avatar_url: avatarUrl,
        } as any,
        { onConflict: 'id' }
      );

    if (profileError) throw profileError;

    return NextResponse.json({ success: true, avatarUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
