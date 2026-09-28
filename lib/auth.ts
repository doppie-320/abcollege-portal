import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

export async function getProfile(): Promise<Profile> {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  const authUser = authData?.user;

  if (authError || !authUser) redirect("/login");

  const { data: user } = await supabase
    .from("users")
    .select("id, first_name, last_name")
    .eq("id", authUser.id)
    .maybeSingle();

  const metadata = (authUser.user_metadata ?? {}) as AuthMetadata;

  const firstName = clean(user?.first_name ?? metadata.first_name);
  const lastName = clean(user?.last_name ?? metadata.last_name);

  const courseId = toId(metadata.course_id);
  const yearLevelId = toId(metadata.year_level);

  const [{ data: course }, { data: yearLevel }] = await Promise.all([
    courseId === null
      ? Promise.resolve({ data: null })
      : supabase.from("courses").select("id, name").eq("id", courseId).maybeSingle(),
    yearLevelId === null
      ? Promise.resolve({ data: null })
      : supabase
          .from("yearlevels")
          .select("id, name")
          .eq("id", yearLevelId)
          .maybeSingle(),
  ]);

  return {
    id: authUser.id,
    firstName,
    lastName,
    name: toDisplay(`${firstName} ${lastName}`.trim()),
    initials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase(),
    studentId: toDisplay(metadata.student_id),
    email: toDisplay(authUser.email),
    program: toDisplay(course?.name),
    yearLevel: toDisplay(yearLevel?.name),
  };
}
