import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  console.log('OAuth callback reached:', request.url)
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/home';

  if (code) {
  try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      console.error('Auth code exchange error:', error);
    } catch (err) {
      console.error('Auth callback exception:', err);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth-failed`);
}