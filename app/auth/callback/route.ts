import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getAccountStatus } from '@/lib/auth';

export async function GET(request: Request) {
  console.log('OAuth callback reached:', request.url)
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');
  // Only allow same-site paths so `next` can't redirect off-site.
  const next = nextParam?.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/home';

  // Set by the sign-up page's Google button. Both Google buttons use this exact
  // callback URL with no query string, so it always matches Supabase's
  // Redirect URLs list; a URL it doesn't accept sends the user to the Site URL.
  const cookieStore = await cookies();
  const fromSignup = cookieStore.get('oauth_from')?.value === 'signup' || next.startsWith('/signup');
  cookieStore.delete('oauth_from');

  // Send sign-up failures back to sign-up instead of the login page.
  const failurePath = fromSignup ? '/signup' : '/login';

  if (code) {
  try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      const { data: { user } } = await supabase.auth.getUser();

      if (!error && user) {
        const status = await getAccountStatus(supabase, user.id);

        if (status === 'approved') {
          return NextResponse.redirect(`${origin}${fromSignup ? '/home' : next}`);
        }

        // Google account with no sign-up yet. Keep the session so they can go
        // straight to the sign-up form (it signs them out once submitted); the
        // login page asks first and signs them out if they say no.
        if (status === 'no-account') {
          return NextResponse.redirect(`${origin}${fromSignup ? '/signup' : '/login?error=no-account'}`);
        }

        // Pending or rejected: no session until an admin accepts them.
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=${status}`);
      }
      console.error('Auth code exchange error:', error);
    } catch (err) {
      console.error('Auth callback exception:', err);
    }
  } else {
    console.error('OAuth error:', searchParams.get('error_description') ?? searchParams.get('error'));
  }

  return NextResponse.redirect(`${origin}${failurePath}?error=oauth-failed`);
}
