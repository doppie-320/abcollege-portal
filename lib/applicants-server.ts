import { createClient } from "@/lib/supabase/server";
import type { Applicant, ApplicantStatus } from "@/lib/applicants-db";

export async function fetchApplicants(): Promise<Applicant[]> {
  const supabase = await createClient();

  const [{ data: requestData, error: requestError }, { data: adminData, error: adminError }] = await Promise.all([
    supabase
      .from("users")
      .select("id, first_name, last_name, email_address, birthdate, students!inner(student_id, year_level, courses(name)), user_requests!inner(request_status, reject_date, submitted_at)"),
    supabase.from("admins").select("id"),
  ]);

  if (requestError || adminError) {
    console.error("Supabase error:", (requestError ?? adminError)?.message);
    return [];
  }

  console.log("Fetched users:", requestData);

  // Admins are already approved, so they're never up for accepting or rejecting.
  const adminIds = new Set(adminData.map((admin) => admin.id));

  const applicants: Applicant[] = requestData.filter((user) => !adminIds.has(user.id)).map((user) => {
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
      birthday: user.birthdate || undefined,
      program: course?.name ?? "N/A",
      status: (request?.request_status ?? "pending") as ApplicantStatus,
      rejectDate: request?.reject_date ?? new Date().toISOString(),
      submittedAt: request?.submitted_at ?? new Date().toISOString(),
    };
  });

  return applicants;
}