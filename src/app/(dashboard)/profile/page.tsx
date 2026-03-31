import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProfileForm from './ProfileForm';

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, school_name, avatar_url')
    .eq('id', user.id)
    .single();

  return (
    <ProfileForm
      initialFullName={profile?.full_name || (user.user_metadata?.full_name as string) || ''}
      initialSchoolName={profile?.school_name || (user.user_metadata?.school_name as string) || ''}
      initialAvatarUrl={(profile as any)?.avatar_url || (user.user_metadata?.avatar_url as string) || ''}
      email={user.email || ''}
    />
  );
}
