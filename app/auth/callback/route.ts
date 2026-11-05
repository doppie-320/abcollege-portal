import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { needsMFA, getAccountStatus, isRecoverySession } from '@/lib/auth';

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
  let failure = 'oauth-failed';

  if (code) {
  try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      const { data: { user } } = await supabase.auth.getUser();

      if (!error && user) {
        const status = await getAccountStatus(supabase, user.id);

        if (status === 'approved') {
          // Password reset link. Skips the MFA step because that page signs them out when
          // it's done, so they log in again (and verify) with the new password.
          if (await isRecoverySession(supabase)) {
            return NextResponse.redirect(`${origin}/auth/update-password`);
          }
          if (await needsMFA(supabase)) {
            return NextResponse.redirect(`${origin}/login/verify`);
          }
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
      // An email link opened in a different browser from the one that requested it.
      if (error?.code === 'pkce_code_verifier_not_found') failure = 'link-failed';
    } catch (err) {
      console.error('Auth callback exception:', err);
    }
  } else {
    console.error('OAuth error:', searchParams.get('error_description') ?? searchParams.get('error'));
    // An email link that expired or was already used.
    if (searchParams.get('error_code') === 'otp_expired') failure = 'link-failed';
  }

  return NextResponse.redirect(`${origin}${failurePath}?error=${failure}`);
}

