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
        return { error: "Could not complete your registration" }
    }

    return { success: true };
}