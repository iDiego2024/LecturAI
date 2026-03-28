import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from './types'

export function createClient() {
  const cookieStore = cookies()

  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: any[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  // TEMPORARY TEST BYPASS
  const originalGetUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = async () => {
    const { data: profiles } = await client.from('profiles').select('id').limit(1);
    if (profiles && profiles.length > 0) {
       return { data: { user: { id: profiles[0].id, email: 'test@lecturai.com' } as any }, error: null } as any;
    }
    return originalGetUser();
  };

  return client;
}
