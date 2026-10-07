export const instant = false;

import type { Metadata } from "next";
import CalendarContent from "./CalendarContent";
import PageTransition from "@/components/PageTransition";
import { getViewer } from "@/lib/auth";
import { schoolToday, toISODate } from "@/lib/dates";
import { listBirthdayCelebrants, listEvents } from "@/lib/mock/portal-db";

export const metadata: Metadata = {
  title: "Calendar — SOE Hub",
};

const MONTH_PARAM_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const [viewer, { month: monthParam }] = await Promise.all([getViewer(), searchParams]);

  const today = schoolToday();
  // "?month=2026-10" picks the month; anything else falls back to the current one.
  const match = typeof monthParam === "string" ? MONTH_PARAM_RE.exec(monthParam) : null;
  const year = match ? Number(match[1]) : Number(today.slice(0, 4));
  const monthIndex = match ? Number(match[2]) - 1 : Number(today.slice(5, 7)) - 1;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const [entries, celebrants] = await Promise.all([
    listEvents(toISODate(year, monthIndex, 1), toISODate(year, monthIndex, daysInMonth)),
    listBirthdayCelebrants(monthIndex),
  ]);

  return (
    // Keyed by month: each month slides in as its own page, with fresh state (e.g. the selected day).
    <PageTransition key={`${year}-${monthIndex}`}>
      <CalendarContent
        viewer={viewer}
        year={year}
        monthIndex={monthIndex}
        today={today}
        entries={entries}
        celebrants={celebrants}
      />
    </PageTransition>
  );
}
