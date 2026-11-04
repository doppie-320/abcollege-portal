'use server'

import { ActionResult } from "@/lib/actionResult";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { randomInt } from "crypto";
import { Resend } from "resend";

const SEND_ERROR = "Couldn't send the code. Please try again.";

type IssueResult =
    | { status: "sent"; email: string;  retry_after: number }
    | { status: "active"| "cooldown";   retry_after: number }
    | { status: "rate_limited" | "not_required" | "verified" };

type SendResult = {
    cooldown: number;
    sent?: boolean;
    error?: string;
    redirecTo?: string;
}

export async function sendVerificationCode(isResend: boolean): Promise<SendResult> {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims.sub;
    const sessionId = data?.claims.session_id;
    if (!userId || !sessionId) return { cooldown: 0, redirecTo: "/login" };

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");

    const { data: issued, error } = await createAdminClient().rpc("issue_mfa_code", {
        p_user_id: userId,
        p_session_id: sessionId,
        p_code: code,
        p_resend: isResend,
    });

    if (error) {
        console.error("[verify] couldn't create a code:", error);
        return { cooldown: 0, error: SEND_ERROR };
    }

    const result = issued as IssueResult;

    switch(result.status) {
        case "verified":
        case "not_required":
            return { cooldown: 0, redirecTo: "/home" };
        case "rate_limited":
            return { cooldown: 60, error: "Too many codes requested. Please try again later." };

        case "active":
        case "cooldown":
            return { cooldown: result.retry_after };
    }

    const { error: sendError } = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: result.email,
        subject: "Your SOE Hub verification code",
        text: [
            `Your verification code is ${code}. It expires in 10 minutes.`,
            "",
            "If you didn't just log in, someone else may have your password. Change it ASAP."
        ].join("\n"),
    });

    if (sendError) {
        console.error("[verify] Resend rejected the email:", sendError);
        return { cooldown: result.retry_after, error: SEND_ERROR };
    }

    return { cooldown: result.retry_after, sent: true };
}

export async function verifyCode(code: string): Promise<ActionResult> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("verify_mfa_code", { p_code: code});

    if (error) {
        console.error("[verify] couldn't check the code:", error);
        return { error: "Couldn't check the code. Please try again." };
    }

    if (data === "verified") return { success: true };

    return {
        error: data === "expired"
            ? "This code is no longer valid. Request a new one."
            : "Incorrect code."
    };
}