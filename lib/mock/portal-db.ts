// Temporary in-memory mock of the calendar, attendance and suggestion box data
// until the backend tables exist. Like social-db.ts, callers only depend on the
// exported functions/types, so swapping in Supabase queries later stays inside
// this file. Server-only: state lives in the server process and resets on restart.

import type { CalendarEntry, Celebrant } from "@/app/calendar/CalendarContent";
import type { Suggestion, InboxItem } from "@/app/suggestions/SuggestionsContent";
import { schoolToday, toISODate } from "@/lib/dates";

export type AttendanceStatus = "present" | "late" | "absent" | "excused";

export type AttendanceRecord = {
  id: string;
  eventId: number;
  eventName: string;
  // YYYY-MM-DD
  eventDate: string;
  status: AttendanceStatus;
  fine: number;
  finePaid: boolean;
};

export type EventInput = Pick<CalendarEntry, "name" | "date" | "kind" | "description">;
export type SuggestionInput = { content: string; isAnonymous: boolean };

type StoredSuggestion = Suggestion & {
  authorId: string;
  authorName: string;
  authorInitials: string;
};

type Store = {
  nextEventId: number;
  events: CalendarEntry[];
  // The same sample history is shown to every student.
  attendance: { eventId: number; status: AttendanceStatus; fine: number; finePaid: boolean }[];
  celebrants: { name: string; initials: string; month: number; day: number }[];
  suggestions: StoredSuggestion[];
};

let store: Store | null = null;

// Seeded lazily (not at import) and relative to today, so the current month always has data.
function db(): Store {
  if (store) return store;

  const today = schoolToday();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  const date = (monthOffset: number, day: number) => {
    const d = new Date(year, month + monthOffset, day);
    return toISODate(d.getFullYear(), d.getMonth(), d.getDate());
  };
  const lastDay = new Date(year, month + 1, 0).getDate();

  const events: CalendarEntry[] = [
    { id: 1, name: "General Assembly", date: date(-1, 12), kind: "event", description: "Gym, 1:00 PM" },
    { id: 2, name: "CAD Workshop", date: date(0, 3), kind: "event", description: "Lab 3" },
    { id: 3, name: "Engineering Days opening", date: date(0, 12), kind: "event", description: "Main grounds, 8:00 AM. Wear your block shirt." },
    { id: 4, name: "Sportsfest: Basketball", date: date(0, 12), kind: "event", description: "" },
    { id: 5, name: "Sportsfest: Volleyball", date: date(0, 12), kind: "event", description: "" },
    { id: 6, name: "Midterm requirements deadline", date: date(0, 20), kind: "event", description: "Submit through your faculty." },
    { id: 7, name: "No classes", date: date(0, lastDay), kind: "holiday", description: "" },
    { id: 8, name: "Founding anniversary", date: date(1, 1), kind: "holiday", description: "" },
    { id: 9, name: "Leadership seminar", date: date(1, 15), kind: "event", description: "AVR, 9:00 AM" },
  ];

  const now = new Date();
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

  store = {
    nextEventId: events.length + 1,
    events,
    attendance: [
      { eventId: 1, status: "absent", fine: 50, finePaid: true },
      { eventId: 2, status: "late", fine: 20, finePaid: false },
      { eventId: 3, status: "present", fine: 0, finePaid: false },
    ],
    celebrants: [
      { name: "Ana Reyes", initials: "AR", month, day: 14 },
      { name: "Carlo Ramos", initials: "CR", month, day: Number(today.slice(8)) },
      { name: "Dina Santos", initials: "DS", month, day: 27 },
      { name: "Leo Fernandez", initials: "LF", month: (month + 1) % 12, day: 5 },
    ],
    suggestions: [
      {
        id: "s-seed-1",
        authorId: "u-maria",
        authorName: "Maria Santos",
        authorInitials: "MS",
        content: "Post the sportsfest brackets a week early so blocks can prepare.",
        isAnonymous: false,
        status: "pending",
        createdAt: minutesAgo(60 * 26),
        edited: false,
      },
      {
        id: "s-seed-2",
        authorId: "u-carlo",
        authorName: "Carlo Ramos",
        authorInitials: "CR",
        content: "Could the org room stay open during lunch for students waiting on afternoon labs?",
        isAnonymous: true,
        status: "reviewed",
        createdAt: minutesAgo(60 * 72),
        edited: false,
      },
    ],
  };
  return store;
}

// ---------- Calendar ----------

export async function listEvents(from: string, to: string): Promise<CalendarEntry[]> {
  return db()
    .events.filter((e) => e.date >= from && e.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
    .map((e) => ({ ...e }));
}

export async function listBirthdayCelebrants(monthIndex: number): Promise<Celebrant[]> {
  return db()
    .celebrants.filter((c) => c.month === monthIndex)
    .sort((a, b) => a.day - b.day)
    .map((c, i) => ({ id: `bday-${monthIndex}-${i}`, name: c.name, initials: c.initials, avatarUrl: "", day: c.day }));
}

export async function createEvent(input: EventInput): Promise<void> {
  const s = db();
  s.events.push({ ...input, id: s.nextEventId++ });
}

export async function updateEvent(id: number, input: EventInput): Promise<boolean> {
  const event = db().events.find((e) => e.id === id);
  if (!event) return false;
  Object.assign(event, input);
  return true;
}

// "has-attendance": events with recorded attendance are kept so fines don't disappear.
export async function deleteEvent(id: number): Promise<"deleted" | "not-found" | "has-attendance"> {
  const s = db();
  if (s.attendance.some((a) => a.eventId === id)) return "has-attendance";
  const before = s.events.length;
  s.events = s.events.filter((e) => e.id !== id);
  return s.events.length < before ? "deleted" : "not-found";
}

// ---------- Attendance ----------

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the real query will filter by user.
export async function listAttendance(userId: string): Promise<AttendanceRecord[]> {
  const s = db();
  return s.attendance
    .map((a, i) => {
      const event = s.events.find((e) => e.id === a.eventId);
      return {
        id: `att-${i}`,
        eventId: a.eventId,
        eventName: event?.name ?? "Removed event",
        eventDate: event?.date ?? "",
        status: a.status,
        fine: a.fine,
        finePaid: a.finePaid,
      };
    })
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate));
}

// ---------- Suggestion box ----------

function toSuggestion({ id, content, isAnonymous, status, createdAt, edited }: StoredSuggestion): Suggestion {
  return { id, content, isAnonymous, status, createdAt, edited };
}

export async function listMySuggestions(authorId: string): Promise<Suggestion[]> {
  return db()
    .suggestions.filter((s) => s.authorId === authorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toSuggestion);
}

// Every student's suggestions for the council, with anonymous authors blanked out.
export async function listSuggestionInbox(): Promise<InboxItem[]> {
  return db()
    .suggestions.slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((s) => ({
      ...toSuggestion(s),
      authorName: s.isAnonymous ? null : s.authorName,
      authorInitials: s.isAnonymous ? "?" : s.authorInitials,
      authorAvatar: "",
    }));
}

export async function createSuggestion(
  author: { id: string; name: string; initials: string },
  input: SuggestionInput,
): Promise<void> {
  db().suggestions.push({
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    authorId: author.id,
    authorName: author.name,
    authorInitials: author.initials,
    content: input.content,
    isAnonymous: input.isAnonymous,
    status: "pending",
    createdAt: new Date().toISOString(),
    edited: false,
  });
}

// Authors can only edit their own suggestions while they're still pending.
export async function updateSuggestion(authorId: string, id: string, input: SuggestionInput): Promise<boolean> {
  const suggestion = db().suggestions.find((s) => s.id === id && s.authorId === authorId && s.status === "pending");
  if (!suggestion) return false;
  Object.assign(suggestion, { content: input.content, isAnonymous: input.isAnonymous, edited: true });
  return true;
}

export async function deleteSuggestion(authorId: string, id: string): Promise<boolean> {
  const s = db();
  const before = s.suggestions.length;
  s.suggestions = s.suggestions.filter((x) => !(x.id === id && x.authorId === authorId));
  return s.suggestions.length < before;
}

export async function setSuggestionStatus(id: string, status: Suggestion["status"]): Promise<boolean> {
  const suggestion = db().suggestions.find((s) => s.id === id);
  if (!suggestion) return false;
  suggestion.status = status;
  return true;
}
