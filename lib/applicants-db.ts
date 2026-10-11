export type ApplicantStatus = "pending" | "accept" | "reject";

export type Applicant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  yearLevel: string;
  birthday?: string;
  studentId: string;
  program: string;
  status: ApplicantStatus;
  rejectDate: string;
  submittedAt: string;
};

export const STATUS_LABELS: Record<ApplicantStatus, string> = {
  pending: "Pending",
  accept: "Accepted",
  reject: "Rejected",
};

const UNKNOWN = "—";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function applicantName(applicant: Applicant): string {
  return `${applicant.firstName} ${applicant.lastName}`.trim() || UNKNOWN;
}

export function applicantInitials(applicant: Applicant): string {
  return `${applicant.firstName.charAt(0)}${applicant.lastName.charAt(0)}`.toUpperCase() || "?";
}

export function applicantBirthday(applicant: Applicant): string {
  return applicant.birthday?.trim() || UNKNOWN;
}

export function formatSubmittedDate(iso: string): string {
  const date = new Date(iso);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}