import { isAuthRetryableFetchError, isAuthWeakPasswordError, type AuthError } from "@supabase/supabase-js";
import type { ActionResult } from "@/lib/actionResult";

export type AuthScope = "login" | "signup" | "reset" | "confirm";

/** Shown with an error so people can quote it. Neither part reveals anything about an account. */
export type ErrorDetails = {
  /** What went wrong, e.g. `over_request_rate_limit`. */
  code?: string;
  /** Finds this failure in the server logs. Only set for failures on our side. */
  reference?: string;
};

const COMMON_MESSAGES: Record<string, string> = {
  over_request_rate_limit: "Too many attempts right now. Please wait a few minutes and try again.",
  request_timeout: "The sign-in service took too long to respond. Please try again.",
};

// Security: "invalid_credentials" must stay one message for a wrong password and an unknown
// email. "email_not_confirmed" is safe because Supabase only returns it for a correct password.
const MESSAGES: Record<AuthScope, Record<string, string>> = {
  login: {
    invalid_credentials:
      "Incorrect email or password. If you signed up with Google, use “Continue with Google” instead.",
    email_not_confirmed:
      "This email hasn't been confirmed yet. Use the link in the confirmation email (check your spam folder too), or send yourself a new one.",
    user_banned: "This account has been disabled. Please contact the student council.",
    email_provider_disabled: "Logging in with email is turned off right now. Try “Continue with Google” instead.",
    validation_failed: "Enter a valid email address and password.",
  },
  signup: {
    over_email_send_rate_limit: "We're getting a lot of sign-ups right now. Please try again in a little while.",
    email_address_invalid: "That email address can't be used. Check it for typos or try a different one.",
    email_address_not_authorized: "We can't send email to that address right now. Please try a different one.",
    signup_disabled: "New account requests are closed right now.",
    email_provider_disabled: "Signing up with email is turned off right now. Try “Sign up with Google” instead.",
    validation_failed: "Check your email address and password, then try again.",
    // What Supabase returns when the signup trigger fails, usually a student ID that was just taken.
    unexpected_failure:
      "Your account couldn't be created. Check that your student ID isn't already registered, then try again.",
  },
  reset: {
    over_email_send_rate_limit: "Too many reset emails have been sent. Please try again later.",
    email_address_invalid: "That email address can't be used. Check it for typos and try again.",
  },
  // Resending the sign-up confirmation email.
  confirm: {
    over_email_send_rate_limit: "Too many emails have been sent to this address. Please wait a few minutes and try again.",
    email_address_invalid: "That email address can't be used. Check it for typos and try again.",
    email_address_not_authorized:
      "We can't send email to that address right now. Please contact the student council.",
  },
};

const FALLBACKS: Record<AuthScope, string> = {
  login: "We couldn't log you in because of a problem on our side. Please try again.",
  signup: "We couldn't submit your request because of a problem on our side. Please try again.",
  reset: "Couldn't send the reset link. Please try again.",
  confirm: "Couldn't send a new confirmation email. Please try again.",
};

function weakPasswordMessage(reasons: string[]): string {
  if (reasons.includes("pwned")) return "That password has appeared in a data breach. Please choose a different one.";
  if (reasons.includes("length")) return "That password is too short. Please choose a longer one.";
  return "That password is too easy to guess. Use a mix of letters, numbers and symbols.";
}

/** Turns a Supabase auth error into text that's safe to show. Never uses `error.message`. */
export function describeAuthError(scope: AuthScope, error: AuthError) {
  if (isAuthRetryableFetchError(error)) {
    return {
      message: "We couldn't reach the sign-in service. Please try again in a moment.",
      code: "auth_service_unreachable",
      ourFault: true,
    };
  }

  const code = error.code ?? "unknown";
  const message = isAuthWeakPasswordError(error)
    ? weakPasswordMessage(error.reasons)
    : (MESSAGES[scope][code] ?? COMMON_MESSAGES[code]);

  return {
    message: message ?? FALLBACKS[scope],
    code,
    ourFault: !message || (error.status ?? 0) >= 500,
  };
}

export function newErrorReference(): string {
  return crypto.randomUUID().slice(0, 8);
}

/** For failures on our side: logs the real cause under a reference the user can quote. */
export function unexpectedFailure(scope: string, code: string, message: string, cause: unknown): ActionResult {
  const reference = newErrorReference();
  console.error(`[auth:${scope}] ${code} ref=${reference}`, cause);
  return { error: message, code, reference };
}

/** The result for a failed Supabase auth call in a server action. */
export function authFailure(scope: AuthScope, error: AuthError): ActionResult {
  const { message, code, ourFault } = describeAuthError(scope, error);
  if (ourFault) return unexpectedFailure(scope, code, message, error);

  console.error(`[auth:${scope}] ${code}`);
  return { error: message, code };
}

/** Reads `?reason=&ref=`. Anyone can craft these links, so only well-formed values are shown. */
export function readErrorDetails(reason?: string, ref?: string): ErrorDetails {
  return {
    code: reason && /^[a-z0-9_]{1,64}$/.test(reason) ? reason : undefined,
    reference: ref && /^[a-f0-9]{8}$/.test(ref) ? ref : undefined,
  };
}
