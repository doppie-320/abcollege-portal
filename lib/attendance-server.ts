import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  ATTENDANCE_EVENT_COLUMNS,
  checkInState,
  type AttendanceEvent,
  type AttendanceHistoryEntry,
  type AttendanceMethod,
  type AttendanceReportRow,
  type AttendanceStatus,
} from "@/lib/attendance";

/**
 * Database functions raise ATTENDANCE_* codes with a readable hint; pass
 * those through and hide anything else.
 */
export function toAttendanceError(error: PostgrestError): { error: string; code?: string } {
  if (error.message.startsWith("ATTENDANCE_")) {
    return { error: error.hint || error.message, code: error.message };
  }
  console.error("Attendance error:", error);
  return { error: "Something went wrong. Please try again." };
}

export type MyAttendanceRow = {
  status: AttendanceStatus;
  method: AttendanceMethod;
  recorded_at: string;
  note: string | null;
  event_name: string;
  event_start: string;
};

export async function fetchMyAttendance(userId: string): Promise<MyAttendanceRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("attendance")
    .select("status, method, recorded_at, note, events(event_name, event_start)")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false });

  if (error) throw error;

  return data.map(({ events, ...row }) => {
    const event = (Array.isArray(events) ? events[0] : events) as { event_name: string; event_start: string };
    return { ...row, event_name: event.event_name, event_start: event.event_start } as MyAttendanceRow;
  });
}

export async function isStudent(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("students").select("id").eq("id", userId).maybeSingle();
  if (error) throw error;

  return data !== null;
}

/** Events the user may scan for that haven't closed yet: all tracked events for admins, assigned ones otherwise. */
export async function fetchScannableEvents(userId: string, admin: boolean): Promise<AttendanceEvent[]> {
  const supabase = await createClient();

  let events: AttendanceEvent[];
  if (admin) {
    const { data, error } = await supabase
      .from("events")
      .select(ATTENDANCE_EVENT_COLUMNS)
      .eq("takes_attendance", true)
      .order("event_start");
    if (error) throw error;
    events = data;
  } else {
    const { data, error } = await supabase
      .from("event_scanners")
      .select(`events(${ATTENDANCE_EVENT_COLUMNS})`)
      .eq("user_id", userId);
    if (error) throw error;
    events = data
      .flatMap(({ events }) => (Array.isArray(events) ? events : [events]) as AttendanceEvent[])
      .filter((event) => event.takes_attendance)
      .sort((a, b) => a.event_start.localeCompare(b.event_start));
  }

  return events.filter((event) => checkInState(event) !== "closed");
}

export async function canScanAnything(userId: string, admin: boolean): Promise<boolean> {
  return admin || (await fetchScannableEvents(userId, false)).length > 0;
}

export async function fetchAttendanceEvents(): Promise<AttendanceEvent[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select(ATTENDANCE_EVENT_COLUMNS)
    .order("event_start", { ascending: false });
  if (error) throw error;

  return data;
}

export type EventScanner = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email_address: string;
};

export type EventAttendance = {
  event: AttendanceEvent;
  scanners: EventScanner[];
  report: AttendanceReportRow[];
  /** Every student's history for the event, newest first. */
  history: AttendanceHistoryEntry[];
};

export async function fetchEventAttendance(eventId: number): Promise<EventAttendance | null> {
  const supabase = await createClient();

  const [eventResult, scannersResult, reportResult, historyResult] = await Promise.all([
    supabase.from("events").select(ATTENDANCE_EVENT_COLUMNS).eq("event_id", eventId).maybeSingle(),
    supabase
      .from("event_scanners")
      .select("user_id, users!event_scanners_user_id_fkey(first_name, last_name, email_address)")
      .eq("event_id", eventId),
    supabase
      .from("attendance_report")
      .select()
      .eq("event_id", eventId)
      .order("last_name")
      .order("first_name"),
    supabase
      .from("attendance_history_report")
      .select()
      .eq("event_id", eventId)
      .order("happened_at", { ascending: false })
      .order("id", { ascending: false }),
  ]);

  if (eventResult.error) throw eventResult.error;
  if (scannersResult.error) throw scannersResult.error;
  if (reportResult.error) throw reportResult.error;
  if (historyResult.error) throw historyResult.error;
  if (!eventResult.data) return null;

  const scanners = scannersResult.data.map(({ user_id, users }) => {
    const user = (Array.isArray(users) ? users[0] : users) as Omit<EventScanner, "user_id">;
    return { user_id, ...user };
  });

  return {
    event: eventResult.data,
    scanners,
    report: reportResult.data as AttendanceReportRow[],
    history: historyResult.data as AttendanceHistoryEntry[],
  };
}

const CSV_COLUMNS = "student_id, last_name, first_name, course, year_level, status, method, recorded_at, recorded_by, note";

export async function fetchAttendanceCsv(eventId: number): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("attendance_report")
    .select(CSV_COLUMNS)
    .eq("event_id", eventId)
    .order("last_name")
    .order("first_name")
    .csv();
  if (error) throw error;

  // The API returns no header for zero rows; add it so the file still opens with columns.
  return data.trim() ? data : `${CSV_COLUMNS.replaceAll(" ", "")}\n`;
}
