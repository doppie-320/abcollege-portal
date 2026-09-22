'use server'

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function register(formData: FormData) {
    const supabase = await createClient();

    const data = {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        options: {
            data: {
                first_name: formData.get("fname") as string,
                last_name: formData.get("lname") as string,
                student_id: formData.get("studentid") as string,
            },
        },
    };

    const { data: signupData, error } = await supabase.auth.signUp(data);

    if (error) {
        throw new Error(`Error registering user: ${error.message}`);
    }

    redirect("/helloworld/auth/login");
}