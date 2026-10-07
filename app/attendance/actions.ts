'use server'

import { ActionResult } from "@/lib/actionResult";
import { getViewer } from "@/lib/auth";
import {
    markUnrecorded as markRest,
    saveAttendance as writeAttendance,
    setFineRates,
} from "@/lib/mock/portal-db";
import { refresh } from "next/cache";
import { validateRates, type AttendanceEntry, type AttendanceMark, type FineRates } from "./fines";

const MARKS: AttendanceMark[] = ["present", "late", "absent"];
const NOT_ADMIN = "Only council admins can edit attendance.";
const NO_EVENT = "This event no longer exists.";

// Admin-only. A null entry clears the student's record for the event.
export async function saveAttendance(eventId: number, userId: string, entry: AttendanceEntry | null): Promise<ActionResult> {
    const viewer = await getViewer();
    if (!viewer.isAdmin) return { error: NOT_ADMIN };

    if (!userId) return { error: "Unknown student." };
    if (entry && !MARKS.includes(entry.mark)) return { error: "Unknown attendance mark." };

    const saved = await writeAttendance(
        eventId,
        userId,
        entry && { mark: entry.mark, excused: entry.excused === true, finePaid: entry.finePaid === true },
    );
    if (!saved) return { error: NO_EVENT };

    refresh();
    return { success: true };
}

// Admin-only. Rates apply to every fine for the event, including ones already recorded.
export async function saveFineRates(eventId: number, rates: FineRates): Promise<ActionResult> {
    const viewer = await getViewer();
    if (!viewer.isAdmin) return { error: NOT_ADMIN };

    const invalid = validateRates(rates);
    if (invalid) return { error: invalid };

    if (!(await setFineRates(eventId, rates))) return { error: NO_EVENT };

    refresh();
    return { success: true };
}

// Admin-only. Marks every listed student who has no record yet.
export async function markUnrecorded(eventId: number, userIds: string[], mark: AttendanceMark): Promise<ActionResult> {
    const viewer = await getViewer();
    if (!viewer.isAdmin) return { error: NOT_ADMIN };
    if (!MARKS.includes(mark)) return { error: "Unknown attendance mark." };

    if (!(await markRest(eventId, userIds, mark))) return { error: NO_EVENT };

    refresh();
    return { success: true };
}
