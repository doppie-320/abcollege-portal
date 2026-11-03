// Shared by the sign-up form and its server actions.

/** School student IDs: capital letters and numbers, any length. */
export const STUDENT_ID_RE = /^[A-Z0-9]+$/;

export const STUDENT_ID_FORMAT_ERROR = "Use letters and numbers only.";

/** Trims and capitalises what was typed, so "soe123 " is stored as "SOE123". */
export function normalizeStudentId(value: string): string {
  return value.trim().toUpperCase();
}
