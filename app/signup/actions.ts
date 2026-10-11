'use server'

import { createClient } from "@/lib/supabase/server";
import { ActionResult } from "@/lib/actionResult";

export async function register(_prev: ActionResult, formData: FormData) : Promise<ActionResult> {
    const supabase = await createClient();

    const { error } = await supabase.auth.signUp({
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        options: {
            data: {
                first_name: formData.get("firstName") as string,
                last_name: formData.get("lastName") as string,
                student_id: formData.get("studentId") as string,
                year_level: Number(formData.get("yearLevelId")),
                course_id: Number(formData.get("courseId")),
            }
        }
    });

    if(error) {
        console.error("Register failed:", error);

        if(error.code === "user_already_exists") {
            return { error: "An account with this email already exists.", status: "user_already_exists" }
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
    const studentId = String(formData.get("studentId") ?? "").trim();
    const yearLevel = Number(formData.get("yearLevelId"));
    const courseId = Number(formData.get("courseId"));

    if(!firstName || !lastName || !studentId || !yearLevel || !courseId) {
        return { error: "Please fill in all required details." }
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
