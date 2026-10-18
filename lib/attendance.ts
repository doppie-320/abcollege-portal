// Shared attendance types and helpers, safe to import from client components.
// The rules themselves live in Postgres: see
// supabase/migrations/20261014164346_attendance_scanning.sql.

export type AttendanceStatus = "present" | "rejected";
export type AttendanceMethod = "scan" | "manual";

export type AttendanceEvent = {
  event_id: number;
  event_name: string;
  event_start: string;
  event_end: string;
  takes_attendance: boolean;
  check_in_opens_at: string | null;
  check_in_closes_at: string | null;
};

export const ATTENDANCE_EVENT_COLUMNS =
  "event_id, event_name, event_start, event_end, takes_attendance, check_in_opens_at, check_in_closes_at";

export type ScannedStudent = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatarUrl: string;
  student_id: string;
  course: string | null;
  year_level: string | null;
  status: AttendanceStatus | null;
  recorded_at: string | null;
};

export type AttendanceReportRow = {
  event_id: number;
  event_name: string;
  event_start: string;
  user_id: string;
  student_id: string | null;
  last_name: string | null;
  first_name: string | null;
  course: string | null;
  year_level: string | null;
  status: AttendanceStatus;
  method: AttendanceMethod;
  recorded_at: string;
  recorded_by: string | null;
  note: string | null;
};

/** One entry in a student's attendance history for an event; see attendance_history_report. */
export type AttendanceHistoryEntry = {
  id: number;
  event_id: number;
  user_id: string;
  action: "recorded" | "changed" | "removed";
  /** Null when the record was removed. */
  status: AttendanceStatus | null;
  previous_status: AttendanceStatus | null;
  method: AttendanceMethod | null;
  actor: string | null;
  note: string | null;
  happened_at: string;
};

/** `code` is the database's ATTENDANCE_* code when there is one, for UI branching. */
export type AttendanceResult<T> =
  | { data: T; error?: undefined; code?: undefined }
  | { data?: undefined; error: string; code?: string };

// Mirrors the defaults in private.assert_can_scan().
const DEFAULT_OPENS_BEFORE_START_MS = 30 * 60 * 1000;

export function checkInWindow(event: AttendanceEvent): { opens: Date; closes: Date } {
  return {
    opens: event.check_in_opens_at
      ? new Date(event.check_in_opens_at)
      : new Date(new Date(event.event_start).getTime() - DEFAULT_OPENS_BEFORE_START_MS),
    closes: new Date(event.check_in_closes_at ?? event.event_end),
  };
}

export function checkInState(event: AttendanceEvent, now = new Date()): "not tracked" | "upcoming" | "open" | "closed" {
  if (!event.takes_attendance) return "not tracked";
  const { opens, closes } = checkInWindow(event);
  if (now < opens) return "upcoming";
  if (now > closes) return "closed";
  return "open";
}
