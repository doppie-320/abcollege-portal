'use server'

import { ActionResult } from "@/lib/actionResult";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function login(_prev: ActionResult, formData: FormData) : Promise<ActionResult> {
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
        email: formData.get("email") as string,
        password: formData.get("password") as string,
    });

    if (error) {
        console.error("Login failed:", error);
        return { error: "Incorrect email or password." };
    }

    redirect("/home");
}