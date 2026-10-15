'use server'

import { ActionResult } from "@/lib/actionResult";
import { EVENT_TAGS, instantAt, isDayKey, isTime, type EventTag } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";

export type EventInput = {
    /** Set when editing an existing event. */
    id?: number;
    name: string;
    description: string;
    tag: EventTag;
    allDay: boolean;
    /** "YYYY-MM-DD" and "HH:mm", in school time. Times are ignored for all-day events. */
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
};

const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1000;
const GENERIC_ERROR = "Couldn't save the event. Please try again.";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// RLS blocks non-admins too; this just gives them a clear message instead of a silent no-op.
async function requireAdmin(supabase: SupabaseServerClient): Promise<string | null> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) redirect("/login");

    const { data: adminRow, error } = await supabase
        .from("admins").select("id").eq("id", authData.user.id).maybeSingle();
    if (error) {
        console.error("[calendar] admin check failed:", error);
        return GENERIC_ERROR;
    }
    return adminRow ? null : "Only admins can manage calendar events.";
}

function validate(input: EventInput): { fieldErrors: Record<string, string> } | { row: Record<string, unknown> } {
    const fieldErrors: Record<string, string> = {};
    const name = String(input.name ?? "").trim();
    const description = String(input.description ?? "").trim();

    if (!name) fieldErrors.name = "Give the event a title.";
    else if (name.length > MAX_NAME_LENGTH) fieldErrors.name = `Keep the title under ${MAX_NAME_LENGTH} characters.`;

    if (description.length > MAX_DESCRIPTION_LENGTH) {
        fieldErrors.description = `Keep the details under ${MAX_DESCRIPTION_LENGTH} characters.`;
    }

    if (!EVENT_TAGS.includes(input.tag)) fieldErrors.tag = "Pick a tag.";

    if (!isDayKey(input.startDate)) fieldErrors.start = "Pick a start date.";
    else if (!input.allDay && !isTime(input.startTime)) fieldErrors.start = "Pick a start time.";

    if (!isDayKey(input.endDate)) fieldErrors.end = "Pick an end date.";
    else if (!input.allDay && !isTime(input.endTime)) fieldErrors.end = "Pick an end time.";

    if (Object.keys(fieldErrors).length) return { fieldErrors };

    const start = input.allDay ? instantAt(input.startDate) : instantAt(input.startDate, input.startTime);
    const end = input.allDay ? instantAt(input.endDate, "23:59") : instantAt(input.endDate, input.endTime);

    if (new Date(end) < new Date(start)) return { fieldErrors: { end: "The event can't end before it starts." } };

    return {
        row: {
            event_name: name,
            event_description: description || null,
            tag: input.tag,
            all_day: input.allDay,
            event_start: start,
            event_end: end,
        },
    };
}

export async function saveEvent(input: EventInput): Promise<ActionResult> {
    const supabase = await createClient();

    const denied = await requireAdmin(supabase);
    if (denied) return { error: denied };

    const checked = validate(input);
    if ("fieldErrors" in checked) return { error: "Check the highlighted fields.", fieldErrors: checked.fieldErrors };

    // Select the row back: a write blocked by RLS returns no error, just no rows.
    const { data, error } = input.id
        ? await supabase.from("events").update(checked.row).eq("event_id", input.id).select("event_id")
        : await supabase.from("events").insert(checked.row).select("event_id");

    if (error || !data?.length) {
        console.error("[calendar] saving event failed:", error ?? "no rows written");
        return { error: GENERIC_ERROR };
    }

    refresh();
    return { success: true };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shows or hides members' birthdays from regular users. Takes several ids for "Show all" / "Hide all". */
export async function setBirthdayVisibility(userIds: string[], visible: boolean): Promise<ActionResult> {
    const supabase = await createClient();

    const denied = await requireAdmin(supabase);
    if (denied) return { error: denied };

    const ids = [...new Set(userIds)].filter((id) => UUID_RE.test(id));
    if (!ids.length) return { error: "No one was selected." };

    // Already hidden (or already shown) people are left as they are, so repeating a click is harmless.
    const { error } = visible
        ? await supabase.from("hidden_birthdays").delete().in("user_id", ids)
        : await supabase
            .from("hidden_birthdays")
            .upsert(ids.map((user_id) => ({ user_id })), { onConflict: "user_id", ignoreDuplicates: true });

    if (error) {
        console.error("[calendar] changing birthday visibility failed:", error);
        return { error: "Couldn't update birthday visibility. Please try again." };
    }

    refresh();
    return { success: true };
}

export async function deleteEvent(id: number): Promise<ActionResult> {
    const supabase = await createClient();

    const denied = await requireAdmin(supabase);
    if (denied) return { error: denied };

    const { data, error } = await supabase.from("events").delete().eq("event_id", id).select("event_id");

    if (error || !data?.length) {
        console.error("[calendar] deleting event failed:", error ?? "no rows deleted");
        return { error: "Couldn't delete the event. Please try again." };
    }

    refresh();
    return { success: true };
}
