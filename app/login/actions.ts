'use server'

import { ActionResult } from "@/lib/actionResult";
import { STATUS_MESSAGES } from "./messages";
import { createClient } from "@/lib/supabase/server";
import { getAccountStatus } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function login(_prev: ActionResult, formData: FormData) : Promise<ActionResult> {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.get("email") as string,
        password: formData.get("password") as string,
    });

    if (error) {
        console.error("Login failed:", error);
        return { error: "Incorrect email or password." };
    }

    const status = await getAccountStatus(supabase, data.user.id);

    if (status !== "approved") {
        await supabase.auth.signOut();
        return { error: STATUS_MESSAGES[status] };
    }

    redirect("/home");
}