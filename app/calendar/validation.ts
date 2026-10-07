import { parseISODate } from "@/lib/dates";

// Shared by EventFormModal (checked before the form closes optimistically)
// and saveEvent (the check that actually counts).
export const MAX_NAME_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const KINDS = ["event", "holiday"] as const;

export type EventInput = {
    name: string;
    date: string;
    kind: (typeof KINDS)[number];
    description: string;
};

export function validateEvent(input: EventInput): Record<string, string> {
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
