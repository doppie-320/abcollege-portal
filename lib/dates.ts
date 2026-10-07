// Date-only helpers. Calendar dates are plain "YYYY-MM-DD" strings (Postgres
// `date`), so they're parsed as local dates rather than UTC instants to keep
// them from shifting a day.

// The council runs on Philippine time; the server may not (e.g. UTC on Vercel).
const SCHOOL_TIME_ZONE = "Asia/Manila";

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

export function schoolToday(now = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: SCHOOL_TIME_ZONE }).format(now);
}

export function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

export function toISODate(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatISODate(value: string, options: Intl.DateTimeFormatOptions): string {
  const date = parseISODate(value);
  return date ? date.toLocaleDateString("en-US", options) : value;
}

export function formatPeso(amount: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

// A timestamptz as a school-time date ("Oct 8, 2026"). The fixed time zone keeps
// server and client renders identical.
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: SCHOOL_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
