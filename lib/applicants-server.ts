import { createClient } from "@/lib/supabase/server";
import {
  APPLICANT_PAGE_SIZE,
  type Applicant,
  type ApplicantCounts,
  type ApplicantPage,
  type ApplicantQuery,
  type ApplicantStatus,
} from "@/lib/applicants-db";

/** A row from the review_applicants function. */
type ReviewRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_address: string | null;
  avatar_path: string | null;
  birthdate: string | null;
  student_id: string | null;
  year_level: string | null;
  program: string | null;
  request_status: ApplicantStatus | null;
  reject_date: string | null;
  submitted_at: string | null;
  total_count: number;
};

type CountsRow = Record<ApplicantStatus, number>;

const NO_COUNTS: ApplicantCounts = { pending: 0, accept: 0, reject: 0 };

/**
 * One page of applicants for the account review page, filtered and searched in
 * the database. The review_applicants and review_applicant_counts functions
 * only answer admins, so this is safe to start before the admin check finishes.
 */
export async function fetchApplicantPage({ filter, search, page }: ApplicantQuery): Promise<ApplicantPage> {
  const supabase = await createClient();

  const fetchRows = (pageIndex: number, limit = APPLICANT_PAGE_SIZE) =>
    supabase.rpc("review_applicants", {
      p_status: filter === "all" ? null : filter,
      p_search: search || null,
      p_limit: limit,
      p_offset: pageIndex * APPLICANT_PAGE_SIZE,
    });

  const [rowsResult, countsResult] = await Promise.all([
    fetchRows(page),
    supabase.rpc("review_applicant_counts").single<CountsRow>(),
  ]);

  if (rowsResult.error || countsResult.error) {
    console.error("[UAR] couldn't load applicants:", (rowsResult.error ?? countsResult.error)?.message);
    return { applicants: [], total: 0, page: 0, counts: NO_COUNTS, failed: true };
  }

  let rows = (rowsResult.data ?? []) as ReviewRow[];
  let pageIndex = page;

  // Asked for a page past the end (an old link, or the last applicant on it was
  // just reviewed): show the last page instead of an empty one.
  if (rows.length === 0 && page > 0) {
    const probe = await fetchRows(0, 1);
    const total = Number((probe.data as ReviewRow[] | null)?.[0]?.total_count ?? 0);
    pageIndex = Math.max(0, Math.ceil(total / APPLICANT_PAGE_SIZE) - 1);

    if (total > 0) {
      const lastPage = await fetchRows(pageIndex);
      if (lastPage.error) {
        console.error("[UAR] couldn't load applicants:", lastPage.error.message);
        return { applicants: [], total: 0, page: 0, counts: NO_COUNTS, failed: true };
      }
      rows = (lastPage.data ?? []) as ReviewRow[];
    }
  }

  const counts = countsResult.data;

  return {
    applicants: rows.map((row) => toApplicant(row, supabase)),
    total: Number(rows[0]?.total_count ?? 0),
    page: pageIndex,
    counts: {
      pending: Number(counts?.pending ?? 0),
      accept: Number(counts?.accept ?? 0),
      reject: Number(counts?.reject ?? 0),
    },
    failed: false,
  };
}

function toApplicant(row: ReviewRow, supabase: Awaited<ReturnType<typeof createClient>>): Applicant {
  return {
    id: row.id,
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    email: row.email_address ?? "",
    avatarUrl: row.avatar_path ? supabase.storage.from("avatars").getPublicUrl(row.avatar_path).data.publicUrl : "",
    studentId: row.student_id ?? "N/A",
    yearLevel: row.year_level ?? "N/A",
    birthday: row.birthdate ?? undefined,
    program: row.program ?? "N/A",
    status: row.request_status ?? "pending",
    rejectDate: row.reject_date ?? new Date().toISOString(),
    submittedAt: row.submitted_at ?? new Date().toISOString(),
  };
}
