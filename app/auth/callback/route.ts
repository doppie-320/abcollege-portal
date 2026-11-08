import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { needsMFA, getAccountStatus, isRecoverySession } from '@/lib/auth';
import { newErrorReference } from '@/lib/authErrors';

// What an email link can be (see supabase/templates). The portal sends sign-up
// confirmations and password resets; the rest are here so a link Supabase sends
// on its own (e.g. an invite from the dashboard) still works.
const EMAIL_LINK_TYPES = new Set<string>(['signup', 'email', 'recovery', 'invite', 'magiclink']);

export async function GET(request: Request) {
  console.log('OAuth callback reached:', request.url)
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');
  // Only allow same-site paths so `next` can't redirect off-site.
  const next = nextParam?.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/home';

  // Email links built from {{ .TokenHash }} (see supabase/templates). Unlike a
  // code, a token hash doesn't need the browser that asked for the email, so the
  // link also works on another device or in a mail app's own browser.
  const tokenHash = searchParams.get('token_hash');
  const linkType = searchParams.get('type');
  const emailLink =
    tokenHash && linkType && EMAIL_LINK_TYPES.has(linkType)
      ? { tokenHash, type: linkType as EmailOtpType }
      : null;

  // Set by the sign-up page's Google button. Both Google buttons use this exact
  // callback URL with no query string, so it always matches Supabase's
  // Redirect URLs list; a URL it doesn't accept sends the user to the Site URL.
  const cookieStore = await cookies();
  const fromSignup =
    !emailLink && (cookieStore.get('oauth_from')?.value === 'signup' || next.startsWith('/signup'));
  cookieStore.delete('oauth_from');

  // Send sign-up failures back to sign-up instead of the login page.
  const failurePath = fromSignup ? '/signup' : '/login';
  let failure = 'oauth-failed';
  let reason = 'unexpected_failure';
  let cause: unknown;

  if (code || emailLink) {
  try {
      const supabase = await createClient();
      const { error } = emailLink
        ? await supabase.auth.verifyOtp({ type: emailLink.type, token_hash: emailLink.tokenHash })
        : await supabase.auth.exchangeCodeForSession(code!);

      const { data: { user } } = await supabase.auth.getUser();

      if (!error && user) {
        const status = await getAccountStatus(supabase, user.id);

        if (status === 'approved') {
          // Password reset link. Skips the MFA step because that page signs them out when
          // it's done, so they log in again (and verify) with the new password.
          const recovery = emailLink ? emailLink.type === 'recovery' : await isRecoverySession(supabase);
          if (recovery) {
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

        // The sign-up confirmation link: say it worked, not just "still pending".
        const confirmedEmail = emailLink?.type === 'signup' || emailLink?.type === 'email';
        const notice = status === 'pending' && confirmedEmail ? 'email-confirmed' : status;
        return NextResponse.redirect(`${origin}/login?error=${notice}`);
      }
      cause = error;
      reason = error?.code ?? 'no_user_returned';
      // An email link opened in a different browser from the one that requested it.
      if (error?.code === 'pkce_code_verifier_not_found') failure = 'link-failed';
      // An email link that expired or was already used.
      else if (error?.code === 'otp_expired') failure = 'link-failed';
    } catch (err) {
      cause = err;
    }
  } else {
    const providerError = searchParams.get('error');
    const errorCode = searchParams.get('error_code');
    cause = searchParams.get('error_description');
    reason = errorCode ?? providerError ?? (tokenHash ? 'invalid_link_type' : 'missing_auth_code');
    // An email link that expired or was already used, or one we can't read.
    if (errorCode === 'otp_expired' || tokenHash) failure = 'link-failed';
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
