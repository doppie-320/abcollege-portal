// Shared by the calendar page (server) and its client components, so nothing here touches Supabase.

/** Every date on the calendar is read in school time, whatever the viewer's device says. */
export const SCHOOL_TIME_ZONE = "Asia/Manila";

/** Manila has no daylight saving, so a fixed offset turns a wall-clock time into an instant. */
const SCHOOL_UTC_OFFSET = "+08:00";

export const EVENT_TAGS = ["EVENT", "ACADEMIC", "DEADLINE", "HOLIDAY"] as const;
export type EventTag = (typeof EVENT_TAGS)[number];

export const TAG_LABELS: Record<EventTag, string> = {
  EVENT: "Event",
  ACADEMIC: "Academic",
  DEADLINE: "Deadline",
  HOLIDAY: "Holiday",
};

export type CalendarEvent = {
  id: number;
  name: string;
  description: string;
  /** ISO instants. All-day events run from 00:00 on the first day to 23:59 on the last. */
  start: string;
  end: string;
  allDay: boolean;
  tag: EventTag;
};

export type Celebrant = {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string;
  /** Day of the month; the birth year is never sent to the page. */
  day: number;
  /** Hidden from regular users by an admin. Only admins ever receive hidden celebrants. */
  hidden: boolean;
};

/** month is 1–12. */
export type MonthView = {
  year: number;
  month: number;
};

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function toEventTag(value: string | null | undefined): EventTag {
  const upper = (value ?? "").trim().toUpperCase();
  return (EVENT_TAGS as readonly string[]).includes(upper) ? (upper as EventTag) : "EVENT";
}

// ---------- Day keys ("YYYY-MM-DD" in school time) ----------

// en-CA formats dates as YYYY-MM-DD.
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: SCHOOL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: SCHOOL_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

const time24Format = new Intl.DateTimeFormat("en-GB", {
  timeZone: SCHOOL_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function toDayKey(instant: string | Date): string {
  return dayKeyFormat.format(typeof instant === "string" ? new Date(instant) : instant);
}

export function makeDayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Day-key arithmetic runs in UTC so the viewer's own time zone can't shift a day.
function keyToUTC(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function utcToKey(date: Date): string {
  return makeDayKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function isDayKey(value: string): boolean {
  const match = DAY_KEY_RE.exec(value);
  if (!match) return false;
  // Round-trip so impossible dates like 2026-02-31 are rejected.
  return utcToKey(keyToUTC(value)) === value;
}

export function isTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function addDays(key: string, days: number): string {
  const date = keyToUTC(key);
  date.setUTCDate(date.getUTCDate() + days);
  return utcToKey(date);
}

export function weekdayOf(key: string): number {
  return keyToUTC(key).getUTCDay();
}

export function dayOf(key: string): number {
  return Number(key.slice(8, 10));
}

export function daysInMonth({ year, month }: MonthView): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "HH:mm" (00–23) in school time, for filling the event form. */
export function toTimeValue(instant: string): string {
  return time24Format.format(new Date(instant));
}

/** Turns a school-time date and "HH:mm" into an ISO instant. */
export function instantAt(dayKey: string, time = "00:00"): string {
  return `${dayKey}T${time}:00${SCHOOL_UTC_OFFSET}`;
}

// ---------- Months ----------

export function monthKey({ year, month }: MonthView): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthOfDay(key: string): MonthView {
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) };
}

/** Reads "?month=YYYY-MM", falling back to the month containing `fallbackDay`. */
export function parseMonthParam(param: string | undefined, fallbackDay: string): MonthView {
  const match = /^(\d{4})-(\d{2})$/.exec(param ?? "");
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year >= 1900 && year <= 2999 && month >= 1 && month <= 12) return { year, month };
  }
  return monthOfDay(fallbackDay);
}

export function shiftMonth({ year, month }: MonthView, delta: number): MonthView {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Whole weeks (Sunday first) covering the month, including the spill-over days on either side. */
export function monthGrid(view: MonthView): string[] {
  const first = makeDayKey(view.year, view.month, 1);
  const lead = weekdayOf(first);
  const weeks = Math.ceil((lead + daysInMonth(view)) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i - lead));
}

// ---------- Events ----------

/** Longest span drawn on the grid, so a bad end date can't loop for years. */
const MAX_EVENT_DAYS = 400;

export function eventStartDay(event: CalendarEvent): string {
  return toDayKey(event.start);
}

export function eventEndDay(event: CalendarEvent): string {
  return toDayKey(event.end);
}

/** Every school-time day the event touches, first to last. */
export function eventDays(event: CalendarEvent): string[] {
  const last = eventEndDay(event);
  const days: string[] = [];
  for (let day = eventStartDay(event); day <= last && days.length < MAX_EVENT_DAYS; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

/** All-day events first, then by start time. */
export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.start.localeCompare(b.start) || a.name.localeCompare(b.name);
}

export function formatTime(instant: string): string {
  return timeFormat.format(new Date(instant));
}

/** "8:00 AM – 12:00 PM", or "All day". */
export function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  const start = formatTime(event.start);
  const end = formatTime(event.end);
  return start === end ? start : `${start} – ${end}`;
}

/** "Oct 15", "Oct 15 – 17" or "Oct 30 – Nov 2". */
export function formatEventDates(event: CalendarEvent): string {
  const first = eventStartDay(event);
  const last = eventEndDay(event);
  const firstLabel = formatShortDay(first);
  if (first === last) return firstLabel;
  return first.slice(0, 7) === last.slice(0, 7)
    ? `${firstLabel} – ${dayOf(last)}`
    : `${firstLabel} – ${formatShortDay(last)}`;
}

export function formatShortDay(key: string): string {
  return `${MONTH_NAMES[Number(key.slice(5, 7)) - 1].slice(0, 3)} ${dayOf(key)}`;
}

/** "Thursday, October 15". */
export function formatLongDay(key: string): string {
  return `${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekdayOf(key)]}, ${
    MONTH_NAMES[Number(key.slice(5, 7)) - 1]
  } ${dayOf(key)}`;
}

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

export const MAX_EVENT_NAME_LENGTH = 120;
export const MAX_EVENT_DESCRIPTION_LENGTH = 1000;

/**
 * Checks an event form. Runs in the modal, so it can close the moment the input is good,
 * and again in saveEvent, since the browser's check can be bypassed.
 */
export function validateEvent(
  input: EventInput,
): { fieldErrors: Record<string, string> } | { event: Omit<CalendarEvent, "id"> } {
  const fieldErrors: Record<string, string> = {};
  const name = String(input.name ?? "").trim();
  const description = String(input.description ?? "").trim();

  if (!name) fieldErrors.name = "Give the event a title.";
  else if (name.length > MAX_EVENT_NAME_LENGTH) fieldErrors.name = `Keep the title under ${MAX_EVENT_NAME_LENGTH} characters.`;

  if (description.length > MAX_EVENT_DESCRIPTION_LENGTH) {
    fieldErrors.description = `Keep the details under ${MAX_EVENT_DESCRIPTION_LENGTH} characters.`;
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

  return { event: { name, description, tag: input.tag, allDay: input.allDay, start, end } };
}
