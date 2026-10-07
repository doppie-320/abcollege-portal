'use server'

import { ActionResult } from "@/lib/actionResult";
import { getViewer } from "@/lib/auth";
import { parseISODate } from "@/lib/dates";
import { createEvent, deleteEvent as removeEvent, updateEvent } from "@/lib/mock/portal-db";
import { refresh } from "next/cache";

// Keep in sync with the limits in EventFormModal.tsx.
const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1000;
const KINDS = ["event", "holiday"] as const;

export type EventInput = {
    name: string;
    date: string;
    kind: (typeof KINDS)[number];
    description: string;
};

function validate(input: EventInput): Record<string, string> {
    const fieldErrors: Record<string, string> = {};
    const name = input.name.trim();

    if (!name) fieldErrors.name = "Give the event a name.";
    else if (name.length > MAX_NAME_LENGTH) fieldErrors.name = `Keep the name under ${MAX_NAME_LENGTH} characters.`;

    if (!parseISODate(input.date)) fieldErrors.date = "Pick a date.";
    if (!KINDS.includes(input.kind)) fieldErrors.kind = "Pick event or holiday.";

    if (input.description.trim().length > MAX_DESCRIPTION_LENGTH) {
        fieldErrors.description = `Keep the details under ${MAX_DESCRIPTION_LENGTH} characters.`;
    }

    return fieldErrors;
}

const NOT_ADMIN = "Only council admins can edit the calendar.";

// Creates an entry, or updates entry `id` when given. Admin-only.
export async function saveEvent(input: EventInput, id?: number): Promise<ActionResult> {
    const fieldErrors = validate(input);
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
