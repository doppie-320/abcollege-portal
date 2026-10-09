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
