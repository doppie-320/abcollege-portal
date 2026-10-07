// Attendance marks and fine rules, shared by the server (portal-db, actions)
// and the admin sheet (to show fines optimistically).

// What actually happened at the event.
export type AttendanceMark = "present" | "late" | "absent";

// What a student sees: their mark, or "excused" once an admin waived it.
export type AttendanceStatus = AttendanceMark | "excused";

// Pesos per late / absent mark, entered by admins for each event.
export type FineRates = { late: number; absent: number };

export const DEFAULT_FINE_RATES: FineRates = { late: 20, absent: 50 };
export const MAX_FINE = 10_000;

// One student's record for one event, as admins edit it.
export type AttendanceEntry = {
  mark: AttendanceMark;
  // Override: waives the fine for a late or absent mark.
  excused: boolean;
  finePaid: boolean;
};

// Fines are never stored. They follow from the mark and the event's rates, so
// editing a rate updates every fine for that event.
export function computeFine(entry: AttendanceEntry, rates: FineRates): number {
  if (entry.mark === "present" || entry.excused) return 0;
  return rates[entry.mark];
}

// Drops flags that can't apply: nothing to excuse when present, nothing to pay
// when there's no fine.
export function normalizeEntry(entry: AttendanceEntry): AttendanceEntry {
  const excused = entry.mark !== "present" && entry.excused;
  return { mark: entry.mark, excused, finePaid: entry.mark !== "present" && !excused && entry.finePaid };
}

export function validateRates(rates: FineRates): string | null {
  for (const [label, value] of [["late", rates.late], ["absent", rates.absent]] as const) {
    if (!Number.isInteger(value) || value < 0 || value > MAX_FINE) {
      return `The ${label} fine must be a whole number of pesos from 0 to ${MAX_FINE.toLocaleString()}.`;
    }
  }
  return null;
}
