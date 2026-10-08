import { createClient } from "@/lib/supabase/client";

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
  accept: "Accept",
  reject: "Reject",
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

export async function fetchApplicants(): Promise<Applicant[]> {
  const supabase = createClient();

  const { data: requestData, error: requestError } = await supabase
    .from("users")
    .select("id, first_name, last_name, email_address, students(student_id, year_level, birthdate, courses(name)), user_requests!inner(request_status, reject_date, submitted_at)")
    .eq("user_requests.request_status", "pending")

  if (requestError) {
    console.error("Supabase error:", requestError.message);
    return [];
  }

  console.log("Fetched users:", requestData);

  const applicants: Applicant[] = requestData.map((user) => {
    const student = Array.isArray(user.students) ? user.students[0] : user.students;
    const course = Array.isArray(student?.courses) ? student?.courses[0] : student?.courses;
    const request = Array.isArray(user.user_requests) ? user.user_requests[0] : user.user_requests;

    return {
      id: user.id,
      firstName: user.first_name ?? "",
      lastName: user.last_name ?? "",
      email: user.email_address ?? "",
      studentId: student?.student_id ?? "N/A",
      yearLevel: String(student?.year_level ?? "N/A"),
      birthday: student?.birthdate || undefined,
      program: course?.name ?? "N/A",
      status: (request?.request_status ?? "pending") as ApplicantStatus,
      rejectDate: request?.reject_date ?? new Date().toISOString(),
      submittedAt: request?.submitted_at ?? new Date().toISOString(),
    };
  });

  return applicants;
}

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