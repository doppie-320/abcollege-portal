import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addDays,
  daysInMonth,
  instantAt,
  makeDayKey,
  monthGrid,
  monthOfDay,
  shiftMonth,
  toEventTag,
  type CalendarEvent,
  type Celebrant,
  type MonthView,
  type UpcomingBirthday,
} from "@/lib/calendar";

// Takes the Supabase client as an argument so the page can load the first month on the
// server and the browser can fetch other months directly when the user flips through.

export type MonthData = {
  events: CalendarEvent[];
  celebrants: Celebrant[];
};

type EventRow = {
  event_id: number;
  event_name: string;
  event_description: string | null;
  event_start: string;
  event_end: string;
  all_day: boolean | null;
  tag: string;
};

type CelebrantRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
  birth_day: number;
  is_hidden: boolean | null;
};

const EVENT_COLUMNS = "event_id, event_name, event_description, event_start, event_end, all_day, tag";

function toCalendarEvent(row: EventRow): CalendarEvent {
  return {
    id: row.event_id,
    name: row.event_name,
    description: row.event_description?.trim() ?? "",
    start: row.event_start,
    end: row.event_end,
    allDay: row.all_day ?? false,
    tag: toEventTag(row.tag),
  };
}

/** Events overlapping the weeks shown for `view`, plus everyone with a birthday that month. Throws if either read fails. */
export async function fetchCalendarMonth(supabase: SupabaseClient, view: MonthView): Promise<MonthData> {
  const grid = monthGrid(view);
  const from = instantAt(grid[0]);
  const to = instantAt(addDays(grid[grid.length - 1], 1));

  const [{ data: eventData, error: eventError }, celebrants] = await Promise.all([
    supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .lt("event_start", to)
      .gte("event_end", from)
      .order("event_start", { ascending: true }),
    fetchCelebrants(supabase, view.month),
  ]);

  if (eventError) throw eventError;

  return { events: ((eventData ?? []) as EventRow[]).map(toCalendarEvent), celebrants };
}

/** Everyone with a birthday in `month` (1–12). Throws if the read fails. */
export async function fetchCelebrants(supabase: SupabaseClient, month: number): Promise<Celebrant[]> {
  const { data, error } = await supabase.rpc("birthday_celebrants", { target_month: month });
  if (error) throw error;

  return ((data ?? []) as CelebrantRow[]).map((row) => {
    const firstName = row.first_name?.trim() ?? "";
    const lastName = row.last_name?.trim() ?? "";
    return {
      id: row.id,
      name: `${firstName} ${lastName}`.trim() || "SOE member",
      initials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?",
      avatarUrl: row.avatar_path
        ? supabase.storage.from("avatars").getPublicUrl(row.avatar_path).data.publicUrl
        : "",
      day: row.birth_day,
      hidden: row.is_hidden ?? false,
    };
  });
}

/** The event happening now, or the next one to start, for the countdown card. */
export async function fetchNextEvent(supabase: SupabaseClient, now: Date): Promise<CalendarEvent | null> {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .gte("event_end", now.toISOString())
    .order("event_start", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[calendar] loading the next event failed:", error);
    return null;
  }
  return data ? toCalendarEvent(data as EventRow) : null;
}

/** Events happening now or still to come, soonest first, for the home countdown. */
export async function fetchUpcomingEvents(supabase: SupabaseClient, now: Date, limit: number): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .gte("event_end", now.toISOString())
    .order("event_start", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[calendar] loading upcoming events failed:", error);
    return [];
  }
  return ((data ?? []) as EventRow[]).map(toCalendarEvent);
}

/**
 * Birthdays from `today` through the end of next month, soonest first. Hidden ones are left out
 * even for admins, so the home page shows what members see.
 */
export async function fetchUpcomingBirthdays(supabase: SupabaseClient, today: string): Promise<UpcomingBirthday[]> {
  const thisMonth = monthOfDay(today);
  const months = [thisMonth, shiftMonth(thisMonth, 1)];

  try {
    const lists = await Promise.all(months.map((view) => fetchCelebrants(supabase, view.month)));
    return lists
      .flatMap((celebrants, i) =>
        celebrants
          .filter((celebrant) => !celebrant.hidden)
          // Feb 29 birthdays are celebrated on the 28th in common years.
          .map((celebrant) => ({
            ...celebrant,
            date: makeDayKey(months[i].year, months[i].month, Math.min(celebrant.day, daysInMonth(months[i]))),
          })),
      )
      .filter((birthday) => birthday.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  } catch (error) {
    console.error("[calendar] loading upcoming birthdays failed:", error);
    return [];
  }
}
