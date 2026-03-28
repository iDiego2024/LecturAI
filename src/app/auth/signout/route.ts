import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = createClient();
  
  // Sign out the user
  await supabase.auth.signOut();
  
  // Redirect to login
  const url = new URL('/login', request.url);
  return NextResponse.redirect(url, {
    status: 302,
  });
}
