import { fullAvatarPath } from "@/lib/avatarPaths";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cache } from "react";

export type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  initials: string;
  studentId: string;
  email: string;
  program: string;
  yearLevel: string;
  avatarUrl: string;
  /** The whole photo the avatar was cropped from; the avatar itself when there is no separate one. */
  avatarFullUrl: string;
  /** Council role from the admins table. Empty for non-admins or when unset. */
  role: string;
};

const UNKNOWN = "—";

type AuthMetadata = {
  first_name?: string;
  last_name?: string;
  student_id?: string;
  course_id?: number;
  year_level?: number;
};

function clean(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function toDisplay(value: unknown): string {
  return clean(value) || UNKNOWN;
}

function toId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** PostgREST returns one-to-one embeds as an object, but be lenient in case one comes back as a list. */
function one<T>(value: T | T[] | null | undefined): T | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * - approved: an admin, or an admin accepted their account request
 * - pending / rejected: what the admin decided on their request
 * - no-account: signed in (e.g. with Google) but never filled in the sign-up
 *   form, so there's no student record to review
 */
export type AccountStatus = "approved" | "pending" | "rejected" | "no-account";

function toStatus(isAdmin: boolean, requestStatus: string | undefined, hasStudent: boolean): AccountStatus {
  if (isAdmin || requestStatus === "accept") return "approved";
  if (!hasStudent) return "no-account";
  return requestStatus === "reject" ? "rejected" : "pending";
}

export async function getAccountStatus(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<AccountStatus> {
  const [{ data: adminRow }, { data: request }, { data: student }] = await Promise.all([
    supabase.from("admins").select("id").eq("id", userId).maybeSingle(),
    supabase.from("user_requests").select("request_status").eq("user_id", userId).maybeSingle(),
    supabase.from("students").select("id").eq("id", userId).maybeSingle(),
  ]);

  return toStatus(adminRow !== null, request?.request_status, student !== null);
}

/**
 * Returns true for users whose current session hasn't have a valid MFA pass
 */
export async function needsMFA(supabase: SupabaseServerClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("mfa_pending");
  if (error) console.error("[auth] MFA check failed:", error);
  return data !== false;
}

/**
 * The signed-in user's verified token claims, read once per request.
 *
 * getClaims() checks the JWT's signature locally against the project's public
 * key (cached for 10 minutes), so unlike getUser() it doesn't wait on a round
 * trip to the Auth server. The proxy has already refreshed the session by now.
 */
const getSession = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return { supabase, claims: error ? null : (data?.claims ?? null) };
});

/** The signed-in user's id, or a redirect to log in. Doesn't touch the database. */
export async function requireUserId(): Promise<string> {
  const { claims } = await getSession();
  if (!claims?.sub) redirect("/login");
  return claims.sub;
}

type AccountRow = {
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
  admins: Record<string, unknown> | Record<string, unknown>[] | null;
  user_requests: { request_status: string } | { request_status: string }[] | null;
  students: { id: string } | { id: string }[] | null;
};

/**
  * Everything needed to decide who the user is and what they may see: their
  * users row with their admin row, account request and student row embedded, and
  * whether this session still owes an MFA code. Shared by getProfile() and
  * isAdmin() within a request.
 */
const getAccount = cache(async (userId: string) => {
  const { supabase } = await getSession();

  // admins(*) rather than admins(role): the table has no role column yet, and
  // naming a missing column would fail the whole query.
  const [{ data, error }, { data: mfaData, error: mfaError }] = await Promise.all([
    supabase
      .from("users")
      .select("first_name, last_name, avatar_path, admins(*), user_requests(request_status), students(id)")
      .eq("id", userId)
      .maybeSingle<AccountRow>(),
    supabase.rpc("mfa_pending")
  ]);

  if (error) throw error;
  if (mfaError) throw mfaError;

  const adminRow = one(data?.admins);
  const hasAdminRow = adminRow !== null;
  const mfaPending = mfaData !== false;

  return {
    user: data,
    isAdmin: hasAdminRow && !mfaPending,
    mfaPending,
    role: clean(adminRow?.role),
    status: toStatus(hasAdminRow, one(data?.user_requests)?.request_status, one(data?.students) !== null),
  };
});

export const getProfile = cache(async (): Promise<Profile> => {
  const userId = await requireUserId();
  const { supabase, claims } = await getSession();

  const email = claims?.email;
  const metadata = (claims?.user_metadata ?? {}) as AuthMetadata;
  const courseId = toId(metadata.course_id);
  const yearLevelId = toId(metadata.year_level);

  // The course and year level ids come from the token, so their lookups run
  // alongside the account query instead of after it.
  const [account, { data: course }, { data: yearLevel }] = await Promise.all([
    getAccount(userId),
    courseId === null
      ? Promise.resolve({ data: null })
      : supabase.from("courses").select("id, name").eq("id", courseId).maybeSingle(),
    yearLevelId === null
      ? Promise.resolve({ data: null })
      : supabase.from("yearlevels").select("id, name").eq("id", yearLevelId).maybeSingle(),
  ]);

  if (account.status !== "approved") redirect("/login?error=pending");
  if (account.mfaPending) redirect("/login/verify");

  const { user } = account;
  const firstName = clean(user?.first_name ?? metadata.first_name);
  const lastName = clean(user?.last_name ?? metadata.last_name);
  const avatarPath = user?.avatar_path;

  const avatars = supabase.storage.from("avatars");
  const avatarUrl = avatarPath ? avatars.getPublicUrl(avatarPath).data.publicUrl : "";
  const avatarFullUrl = avatarPath ? avatars.getPublicUrl(fullAvatarPath(avatarPath)).data.publicUrl : "";

  return {
    id: userId,
    firstName,
    lastName,
    name: toDisplay(`${firstName} ${lastName}`.trim()),
    initials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase(),
    studentId: toDisplay(metadata.student_id),
    email: toDisplay(email),
    program: toDisplay(course?.name),
    yearLevel: toDisplay(yearLevel?.name),
    avatarUrl: avatarUrl,
    avatarFullUrl,
    role: account.role,
  };
});

export async function isAdmin(): Promise<boolean> {
  const { claims } = await getSession();
  if (!claims?.sub) return false;

  return (await getAccount(claims.sub)).isAdmin;
}
