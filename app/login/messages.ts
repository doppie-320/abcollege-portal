import type { AccountStatus } from "@/lib/auth";

export const STATUS_MESSAGES: Record<Exclude<AccountStatus, "approved">, string> = {
  pending: "Your account request is still pending. Please wait for an admin to approve it.",
  rejected: "Your account request was rejected. Please contact the student council if you think this is a mistake.",
  "no-account": "This account does not exist. Request an account first.",
};

export const LOGIN_ERRORS: Record<string, string> = {
  "oauth-failed": "Log in with Google failed. Please try again.",
  pending: STATUS_MESSAGES.pending,
  rejected: STATUS_MESSAGES.rejected,
};

/** How the login page styles a message (see StatusNotice). */
export type NoticeKind = "pending" | "rejected" | "error";

export type Notice = { kind: NoticeKind; message: string };

/** `status` is an account status or a `?error=` key from the URL. */
export function toNotice(status: string | undefined, message: string): Notice {
  const kind: NoticeKind = status === "pending" || status === "rejected" ? status : "error";
  return { kind, message };
}
