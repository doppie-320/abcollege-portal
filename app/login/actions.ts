'use server'

import { ActionResult } from "@/lib/actionResult";
import { STATUS_MESSAGES } from "./messages";
import { createClient } from "@/lib/supabase/server";
import { getAccountStatus, needsMFA, type AccountStatus } from "@/lib/auth";
import { authFailure, unexpectedFailure } from "@/lib/authErrors";
import { authCallbackUrl } from "@/lib/requestOrigin";
import { redirect } from "next/navigation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Offered when log in says the email isn't confirmed (which Supabase only says
// for the right password). Without it, a lost or expired confirmation email
// left the account unusable even after an admin approved it.
export async function resendConfirmation(email: string): Promise<ActionResult> {
    const trimmed = String(email ?? "").trim();
    if (!EMAIL_RE.test(trimmed)) return { error: "Enter a valid email address." };

    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
        type: "signup",
        email: trimmed,
        options: { emailRedirectTo: await authCallbackUrl() },
    });

    if (error) return authFailure("confirm", error);
    return { success: true };
}

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
