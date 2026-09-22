'use server'

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function register(formData: FormData) {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
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
        throw new Error(`Error registering user: ${error.message}`);
    }    

    redirect("/home");
}