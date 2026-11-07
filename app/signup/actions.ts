'use server'

import { createClient } from "@/lib/supabase/server";
import { ActionResult } from "@/lib/actionResult";
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
            }
        }
    });

    if(error) {
        console.error("Register failed:", error);

        if(error.code === "user_already_exists") {
            return { error: "An account with this email already exists.", status: "user_already_exists" }
        }

        if(error.code === "over_email_send_rate_limit") {
            return { error: "We're getting a lot of sign-ups right now. Please try again in a little while." }
        }

        return { error: "Could not complete your registration" }
    }

    return { success: true };
}

// Google sign-ups already have an auth user (created by the OAuth redirect), so
// instead of signUp we fill in the same metadata and student row afterwards.
export async function registerWithGoogle(_prev: ActionResult, formData: FormData) : Promise<ActionResult> {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if(userError || !user) {
        console.error("Google register failed:", userError);
        return { error: "Your Google session expired. Please sign up with Google again." }
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
        console.error("Google register failed:", studentError);
        return {
            error: studentError.code === "23505"
                ? "This student ID is already registered."
                : "Could not complete your registration"
        }
    }

    // The signup trigger guessed the name split from Google's full name; save
    // what the user confirmed instead.
    const { error: nameError } = await supabase
        .from("users")
        .update({ first_name: firstName, last_name: lastName })
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

    if(nameError || error) {
        console.error("Google register failed:", nameError ?? error);
        return { error: "Could not complete your registration" }
    }

    // Same as email sign-ups: no session until an admin approves the request.
    await supabase.auth.signOut();

    return { success: true };
}
