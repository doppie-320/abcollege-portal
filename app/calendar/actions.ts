'use server'

import { ActionResult } from "@/lib/actionResult";
import { getViewer } from "@/lib/auth";
import { createEvent, deleteEvent as removeEvent, updateEvent } from "@/lib/mock/portal-db";
import { refresh } from "next/cache";
import { validateEvent, type EventInput } from "./validation";

const NOT_ADMIN = "Only council admins can edit the calendar.";

// Creates an entry, or updates entry `id` when given. Admin-only.
export async function saveEvent(input: EventInput, id?: number): Promise<ActionResult> {
    const fieldErrors = validateEvent(input);
    if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

    const viewer = await getViewer();
    if (!viewer.isAdmin) return { error: NOT_ADMIN };

    const entry = {
        name: input.name.trim(),
        date: input.date,
        kind: input.kind,
        description: input.description.trim(),
    };

    if (id === undefined) {
        await createEvent(entry);
    } else if (!(await updateEvent(id, entry))) {
        return { error: "This entry no longer exists." };
    }

    refresh();
    return { success: true };
}

export async function deleteEvent(id: number): Promise<ActionResult> {
    const viewer = await getViewer();
    if (!viewer.isAdmin) return { error: NOT_ADMIN };

    const result = await removeEvent(id);
    if (result === "has-attendance") {
        return { error: "Attendance has already been recorded for this event, so it can't be deleted." };
    }
    if (result === "not-found") return { error: "This entry no longer exists." };

    refresh();
    return { success: true };
}
