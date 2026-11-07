'use server'

import { createClient } from "@/lib/supabase/server";
import { ActionResult } from "@/lib/actionResult";
import { authFailure, unexpectedFailure } from "@/lib/authErrors";
import { STUDENT_ID_FORMAT_ERROR, STUDENT_ID_RE, normalizeStudentId } from "@/lib/student-id";

const INVALID_OPTIONS_ERROR = "Please select a valid course and year level.";

// The dropdowns only list selectable options, but submitted IDs can be anything.
async function areOptionsSelectable(
    supabase: Awaited<ReturnType<typeof createClient>>,
    courseId: number,
    yearLevelId: number,
) {
    const [{ data: course }, { data: yearLevel }] = await Promise.all([
        supabase.from("courses").select("id").eq("id", courseId).eq("is_selectable", true).maybeSingle(),
        supabase.from("yearlevels").select("id").eq("id", yearLevelId).eq("is_selectable", true).maybeSingle(),
    ]);

    return Boolean(course && yearLevel);
}

// A birthday is only kept if the user ticked the consent box. The date picker
// only produces real past dates, so anything else is a tampered request: drop it.
function consentedBirthdate(formData: FormData): string | null {
    const value = String(formData.get("birthday") ?? "");
    if (formData.get("birthdayConsent") !== "true" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }

    const date = new Date(`${value}T00:00:00Z`);
    const isRealPastDate =
        !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) && date <= new Date();

    return isRealPastDate ? value : null;
}

export async function register(_prev: ActionResult, formData: FormData) : Promise<ActionResult> {
    const studentId = normalizeStudentId(String(formData.get("studentId") ?? ""));
    if (!STUDENT_ID_RE.test(studentId)) {
        return { error: STUDENT_ID_FORMAT_ERROR };
    }

    const yearLevel = Number(formData.get("yearLevelId"));
    const courseId = Number(formData.get("courseId"));

    const supabase = await createClient();

    if (!await areOptionsSelectable(supabase, courseId, yearLevel)) {
        return { error: INVALID_OPTIONS_ERROR };
    }

    const { error } = await supabase.auth.signUp({
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        options: {
            data: {
                first_name: formData.get("firstName") as string,
                last_name: formData.get("lastName") as string,
                student_id: studentId,
                year_level: yearLevel,
                course_id: courseId,
                consented_birthdate: consentedBirthdate(formData),
            }
        }
    });

    if(error) {
        if(error.code === "user_already_exists") {
            return { error: "An account with this email already exists.", status: "user_already_exists" }
        }

        return authFailure("signup", error);
    }

    return { success: true };
}

// Google sign-ups already have an auth user (created by the OAuth redirect), so
// instead of signUp we fill in the same metadata and student row afterwards.
export async function registerWithGoogle(_prev: ActionResult, formData: FormData) : Promise<ActionResult> {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if(userError || !user) {
        console.error("[auth:signup] session_expired", userError);
        return { error: "Your Google session expired. Please sign up with Google again.", code: "session_expired" }
    }

    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const studentId = normalizeStudentId(String(formData.get("studentId") ?? ""));
    const yearLevel = Number(formData.get("yearLevelId"));
    const courseId = Number(formData.get("courseId"));

    if(!firstName || !lastName || !studentId || !yearLevel || !courseId) {
        return { error: "Please fill in all required details." }
    }

    if (!STUDENT_ID_RE.test(studentId)) {
        return { error: STUDENT_ID_FORMAT_ERROR };
    }

    if (!await areOptionsSelectable(supabase, courseId, yearLevel)) {
        return { error: INVALID_OPTIONS_ERROR };
    }

    const { error: studentError } = await supabase
        .from("students")
        .insert({
            id: user.id,
            student_id: studentId,
            year_level: yearLevel,
            course: courseId,
        });

    if(studentError) {
        // students has two unique keys: one row per account, and one account per student ID.
        if(studentError.code === "23505") {
            return studentError.message.includes("students_id_key")
                ? { error: "You've already submitted your details, so your request is with the admins.", code: "request_already_submitted" }
                : { error: "This student ID is already registered. Contact the student council if it's yours.", code: "student_id_taken" };
        }

        return unexpectedFailure(
            "signup",
            `db_${studentError.code}`,
            "We couldn't save your student details because of a problem on our side. Please try again.",
            studentError,
        );
    }

    // The signup trigger guessed the name split from Google's full name; save
    // what the user confirmed instead, along with the birthday if they consented.
    const { error: profileError } = await supabase
        .from("users")
        .update({ first_name: firstName, last_name: lastName, birthdate: consentedBirthdate(formData) })
        .eq("id", user.id);

    const { error } = await supabase.auth.updateUser({
        data: {
            first_name: firstName,
            last_name: lastName,
            student_id: studentId,
            year_level: yearLevel,
            course_id: courseId,
        }
    });

    if(profileError || error) {
        // The student row is already saved, so the request itself did go through.
        return unexpectedFailure(
            "signup",
            "profile_update_failed",
            "Your request was submitted, but we couldn't save your name or birthday. Contact the student council if anything looks wrong.",
            profileError ?? error,
        );
    }

    // Same as email sign-ups: no session until an admin approves the request.
    await supabase.auth.signOut();

    return { success: true };
}
