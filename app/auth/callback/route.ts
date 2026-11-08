import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { needsMFA, getAccountStatus, isRecoverySession } from '@/lib/auth';
import { newErrorReference } from '@/lib/authErrors';

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
  let reason = 'unexpected_failure';
  let cause: unknown;

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

        // Google account with no sign-up yet. Keep the session and go straight to
        // the sign-up details step (it signs them out once submitted, or if they
        // back out). `from=login` tells it to explain why they ended up there.
        if (status === 'no-account') {
          return NextResponse.redirect(`${origin}${fromSignup ? '/signup' : '/signup?from=login'}`);
        }

        // Pending or rejected: no session until an admin accepts them.
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=${status}`);
      }
      cause = error;
      reason = error?.code ?? 'no_user_returned';
      // An email link opened in a different browser from the one that requested it.
      if (error?.code === 'pkce_code_verifier_not_found') failure = 'link-failed';
    } catch (err) {
      cause = err;
    }
  } else {
    const providerError = searchParams.get('error');
    const errorCode = searchParams.get('error_code');
    cause = searchParams.get('error_description');
    reason = errorCode ?? providerError ?? 'missing_auth_code';
    // An email link that expired or was already used.
    if (errorCode === 'otp_expired') failure = 'link-failed';
    // They pressed cancel on Google's screen. Expired email links are access_denied too, but those have an error_code.
    else if (providerError === 'access_denied' && !errorCode) failure = 'oauth-cancelled';
  }

  const params = new URLSearchParams({ error: failure, reason });
  // Only unexplained failures need finding in the logs.
  const reference = failure === 'oauth-failed' ? newErrorReference() : undefined;
  if (reference) params.set('ref', reference);
  console.error(`[auth:callback] ${failure} reason=${reason} ref=${reference ?? '-'}`, cause);

  return NextResponse.redirect(`${origin}${failurePath}?${params}`);
}

