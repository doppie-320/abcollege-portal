import type { AccountStatus } from "@/lib/auth";
import type { ErrorDetails } from "@/lib/authErrors";

export const STATUS_MESSAGES: Record<Exclude<AccountStatus, "approved">, string> = {
  pending: "Your account request is still pending. Please wait for an admin to approve it.",
  rejected: "Your account request was rejected. Please contact the student council if you think this is a mistake.",
  "no-account": "This account does not exist. Request an account first.",
};

export const LOGIN_ERRORS: Record<string, string> = {
  "oauth-failed": "Log in with Google failed. Please try again.",
  "oauth-cancelled": "Log in with Google was cancelled. Try again whenever you're ready.",
  "link-failed":
    "That link has expired, was already used, or was opened in a different browser from the one that requested it. Please request a new one.",
  pending: STATUS_MESSAGES.pending,
  rejected: STATUS_MESSAGES.rejected,
};

export const SIGNUP_ERRORS: Record<string, string> = {
  "oauth-failed": "Sign up with Google failed. Please try again.",
  "oauth-cancelled": "Sign up with Google was cancelled. Try again whenever you're ready.",
  "link-failed": LOGIN_ERRORS["link-failed"],
};

/** How the login page styles a message (see StatusNotice). */
export type NoticeKind = "pending" | "rejected" | "error";

export type Notice = ErrorDetails & { kind: NoticeKind; message: string };

/** `status` is an account status or a `?error=` key from the URL. */
export function toNotice(status: string | undefined, message: string, details?: ErrorDetails): Notice {
  const kind: NoticeKind = status === "pending" || status === "rejected" ? status : "error";
  return { kind, message, code: details?.code, reference: details?.reference };
}
