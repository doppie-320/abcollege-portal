'use server'

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toAttendanceError } from "@/lib/attendance-server";
import type { AttendanceResult, AttendanceStatus, ScannedStudent } from "@/lib/attendance";

async function requireUser() {
    const supabase = await createClient();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) redirect("/login");

    return supabase;
}

/** The student's current QR payload, and how long until it should be refreshed. */
export async function getAttendanceToken(): Promise<AttendanceResult<{ token: string; refreshInMs: number }>> {
    const supabase = await requireUser();

    const { data, error } = await supabase.rpc("get_my_attendance_token").single<{ token: string; expires_at: string }>();
    if (error) return toAttendanceError(error);

    // Computed here rather than on the device so a wrong phone clock doesn't matter.
    return { data: { token: data.token, refreshInMs: Math.max(1000, new Date(data.expires_at).getTime() - Date.now()) } };
}

type StudentRow = Omit<ScannedStudent, "avatarUrl"> & { avatar_path: string | null };

function withAvatarUrl(supabase: Awaited<ReturnType<typeof createClient>>, { avatar_path, ...student }: StudentRow): ScannedStudent {
    const avatarUrl = avatar_path ? supabase.storage.from("avatars").getPublicUrl(avatar_path).data.publicUrl : "";
    return { ...student, avatarUrl };
}

/** Who a scanned QR belongs to. Records nothing. */
export async function lookupScan(eventId: number, token: string): Promise<AttendanceResult<ScannedStudent>> {
    const supabase = await requireUser();

    const { data, error } = await supabase
        .rpc("scan_student", { p_event_id: eventId, p_token: token.trim() })
        .single<StudentRow>();
    if (error) return toAttendanceError(error);

    return { data: withAvatarUrl(supabase, data) };
}

/** Who a typed school student ID belongs to, for a student who can't show their QR. Records nothing. */
export async function lookupStudentId(eventId: number, studentId: string): Promise<AttendanceResult<ScannedStudent>> {
    const supabase = await requireUser();

    const { data, error } = await supabase
        .rpc("lookup_student_by_id", { p_event_id: eventId, p_student_id: studentId.trim() })
        .single<StudentRow>();
    if (error) return toAttendanceError(error);

    return { data: withAvatarUrl(supabase, data) };
}

/**
 * Accept or reject the scanned student. Takes the token again, not a user id; see record_scan().
 * A present record is kept unless `override` is set, i.e. the scanner confirmed changing it.
 */
export async function recordScan(
    eventId: number,
    token: string,
    decision: AttendanceStatus,
    override = false,
): Promise<AttendanceResult<{ status: AttendanceStatus }>> {
    const supabase = await requireUser();

    const { data, error } = await supabase
        .rpc("record_scan", { p_event_id: eventId, p_token: token.trim(), p_decision: decision, p_override: override })
        .single<{ status: AttendanceStatus }>();
    if (error) return toAttendanceError(error);

    return { data: { status: data.status } };
}

/** Accept or reject a student by school ID; saved as a manual record with an optional note. See recordScan() for `override`. */
export async function recordStudentId(
    eventId: number,
    studentId: string,
    decision: AttendanceStatus,
    note: string,
    override = false,
): Promise<AttendanceResult<{ status: AttendanceStatus }>> {
    const supabase = await requireUser();

    const { data, error } = await supabase
        .rpc("record_by_student_id", {
            p_event_id: eventId,
            p_student_id: studentId.trim(),
            p_decision: decision,
            p_note: note.trim() || null,
            p_override: override,
        })
        .single<{ status: AttendanceStatus }>();
    if (error) return toAttendanceError(error);

    return { data: { status: data.status } };
}
