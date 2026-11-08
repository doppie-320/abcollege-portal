'use server'

import { Resend } from "resend";
import type { ActionResult } from "@/lib/actionResult";
import { isAdmin } from "@/lib/auth";
import { requestOrigin } from "@/lib/requestOrigin";
import { createClient } from "@/lib/supabase/server";

export type Decision = "accept" | "reject" | "reject-immediate";

const COUNCIL_NOTE = "Please contact the student council if you think this is a mistake.";

// Used when the request doesn't say which site it came from.
const DEFAULT_SITE = "https://www.soe-hub.app";

// The login link points at the site the admin is using, so someone approved on
// the dev deployment isn't sent to production, where their account doesn't exist.
const EMAILS: Record<Decision, { subject: string; body: (site: string) => string }> = {
    accept: {
        subject: "Your SOE Hub account was approved",
        body: (site) => `Your account request was approved. You can now log in at ${site}/login.`,
    },
    reject: {
        subject: "Your SOE Hub account request was rejected",
        body: () => `Your account request was rejected, and your account will be deleted after 7 days. ${COUNCIL_NOTE}`,
    },
    "reject-immediate": {
        subject: "Your SOE Hub account request was rejected",
        body: () => `Your account request was rejected, and your account has been deleted. ${COUNCIL_NOTE}`,
    }
};

export async function decideApplicant(
    userId: string,
    decision: Decision,
): Promise<ActionResult & { emailFailed?: boolean }> {
    if(!(await isAdmin())) return { error: "Only admins can review applications." };
    const supabase = await createClient();

    // Read first: an immediate reject deletes this row.
    const { data: applicant, error: readError } = await supabase
        .from("users")
        .select("first_name, email_address, user_requests!inner(request_status)")
        .eq("id", userId)
        .maybeSingle();

    if(readError || !applicant) {
        console.error("[UAR] couldn't read applicant:", readError);
        return { error: "Couldn't find this applicant." };
    }

    const request = Array.isArray(applicant.user_requests)
        ? applicant.user_requests[0]
        : applicant.user_requests;

    const { error } = decision === "reject-immediate"
        ? await supabase.rpc("reject_user", { target_user: userId })
        : await supabase
            .from("user_requests")
            .update({
                request_status: decision,
                reject_date: decision === "reject" ? new Date().toISOString() : null,
            })
            .eq("user_id", userId);

    if(error) {
        console.error("[UAR] couldn't save decision:", error);
        return { error: "Couldn't save the decision" };
    }

    const newStatus = decision === "accept" ? "accept" : "reject";
    if(request?.request_status === newStatus || !applicant.email_address) {
        return { success: true };
    }

    const { subject, body } = EMAILS[decision];
    const site = (await requestOrigin()) ?? DEFAULT_SITE;
    const { error: sendError } = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: applicant.email_address,
        subject,
        text: [`Hi ${applicant.first_name || "there"},`, "", body(site)].join("\n"),
    });

    if(sendError) {
        console.error("[UAR] Email provider couldn't send the email:", sendError);
        return { success: true, emailFailed: true };
    }

    return { success: true };
}