'use server'

import { refresh } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { ActionResult } from "@/lib/actionResult";
import { isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toAttendanceError } from "@/lib/attendance-server";
import type { AttendanceStatus } from "@/lib/attendance";
import { normalizeStudentId } from "@/lib/student-id";

// Every action re-checks admin here; RLS and the database functions enforce it
// again, so this only produces friendlier errors.
async function requireAdmin() {
    if (!(await isAdmin())) throw new Error("Only admins can manage attendance.");
    return createClient();
}

function eventIdFrom(formData: FormData): number {
    const eventId = Number(formData.get("eventId"));
    if (!Number.isInteger(eventId) || eventId <= 0) throw new Error("Missing event.");
    return eventId;
}

function text(formData: FormData, name: string): string {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
}

function failed(error: PostgrestError, messages: Record<string, string> = {}): ActionResult {
    if (messages[error.code]) return { error: messages[error.code] };
    return { error: toAttendanceError(error).error };
}

/** Turns attendance on or off for an event and sets its check-in window (blank = default). */
export async function updateEventAttendance(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    const supabase = await requireAdmin();

    const { error } = await supabase
        .from("events")
        .update({
            takes_attendance: formData.get("takesAttendance") === "on",
            // The form converts these to ISO strings in the browser's time zone.
            check_in_opens_at: text(formData, "checkInOpensAt") || null,
            check_in_closes_at: text(formData, "checkInClosesAt") || null,
            accepts_static_pass: formData.get("acceptsStaticPass") === "on",
        })
        .eq("event_id", eventIdFrom(formData));
    if (error) return failed(error, { "23514": "Check-in must close after it opens." });

    refresh();
    return { success: true };
}

export async function assignScanner(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    const supabase = await requireAdmin();
    const email = text(formData, "email").toLowerCase();
    if (!email) return { fieldErrors: { email: "Enter the scanner's email address." } };

    const { data: user, error: userError } = await supabase
        .from("users")
        .select("id")
        // Case-insensitive exact match: escape ilike's wildcards.
        .ilike("email_address", email.replace(/[\\%_]/g, "\\$&"))
        .maybeSingle();
    if (userError) return failed(userError);
    if (!user) return { fieldErrors: { email: "No account uses that email address." } };

    const { error } = await supabase
        .from("event_scanners")
        .insert({ event_id: eventIdFrom(formData), user_id: user.id });
    if (error) return failed(error, { "23505": "They are already a scanner for this event." });

    refresh();
    return { success: true };
}

export async function removeScanner(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    const supabase = await requireAdmin();

    const { error } = await supabase
        .from("event_scanners")
        .delete()
        .eq("event_id", eventIdFrom(formData))
        .eq("user_id", text(formData, "userId"));
    if (error) return failed(error);

    refresh();
    return { success: true };
}

/** Manual override by school student ID, e.g. for someone whose phone died. */
export async function setAttendance(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    const supabase = await requireAdmin();
    const studentId = normalizeStudentId(text(formData, "studentId"));
    const status = text(formData, "status") as AttendanceStatus;
    if (!studentId) return { fieldErrors: { studentId: "Enter a student ID." } };
    if (status !== "present" && status !== "rejected") return { fieldErrors: { status: "Pick a status." } };

    // Case-insensitive, since IDs saved before they were capitalised may have lowercase
    // letters. Escape ilike's wildcards so only that exact ID can match.
    const { data: matches, error: studentError } = await supabase
        .from("students")
        .select("id, student_id")
        .ilike("student_id", studentId.replace(/[\\%_]/g, "\\$&"))
        .limit(2);
    if (studentError) return failed(studentError);
    // Two IDs differing only by case: prefer the one saved in capitals.
    const student = matches.find((row) => row.student_id === studentId) ?? matches[0];
    if (!student) return { fieldErrors: { studentId: "No student has that ID." } };

    const { error } = await supabase.rpc("set_attendance", {
        p_event_id: eventIdFrom(formData),
        p_user_id: student.id,
        p_status: status,
        p_note: text(formData, "note") || null,
    });
    if (error) return failed(error);

    refresh();
    return { success: true };
}

export async function removeAttendance(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    const supabase = await requireAdmin();

    const { error } = await supabase
        .from("attendance")
        .delete()
        .eq("event_id", eventIdFrom(formData))
        .eq("user_id", text(formData, "userId"));
    if (error) return failed(error);

    refresh();
    return { success: true };
}
