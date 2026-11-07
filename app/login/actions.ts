'use server'

import { ActionResult } from "@/lib/actionResult";
import { STATUS_MESSAGES } from "./messages";
import { createClient } from "@/lib/supabase/server";
import { getAccountStatus, needsMFA, type AccountStatus } from "@/lib/auth";
import { authFailure, unexpectedFailure } from "@/lib/authErrors";
import { redirect } from "next/navigation";

export async function login(_prev: ActionResult, formData: FormData) : Promise<ActionResult> {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.get("email") as string,
        password: formData.get("password") as string,
    });

    if (error) return authFailure("login", error);

    let status: AccountStatus;
    try {
        status = await getAccountStatus(supabase, data.user.id);
    } catch (cause) {
        await supabase.auth.signOut();
        return unexpectedFailure(
            "login",
            "status_check_failed",
            "We couldn't check your account status because of a problem on our side. Please try again.",
            cause,
        );
    }

    if (status !== "approved") {
        await supabase.auth.signOut();
        return { error: STATUS_MESSAGES[status], status };
    }

    redirect(
        (await needsMFA(supabase)) ?
        "/login/verify" :
        "/home"
    );
}
