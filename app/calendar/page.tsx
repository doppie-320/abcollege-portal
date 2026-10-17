export const instant = false;

import type { Metadata } from "next";
import CalendarContent from "./CalendarContent";
import { getProfile, isAdmin } from "@/lib/auth";
import { parseMonthParam, toDayKey, type MonthView } from "@/lib/calendar";
import { fetchCalendarMonth, fetchNextEvent, type MonthData } from "@/lib/calendar-data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Calendar — SOE Hub",
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// A failed read still renders the page; the calendar just starts out empty.
async function loadMonth(supabase: SupabaseServerClient, view: MonthView): Promise<MonthData> {
  try {
    return await fetchCalendarMonth(supabase, view);
  } catch (error) {
    console.error("[calendar] loading the month failed:", error);
    return { events: [], celebrants: [] };
  }
}

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const [profile, admin, { month }, supabase] = await Promise.all([
    getProfile(),
    isAdmin(),
    searchParams,
    createClient(),
  ]);

  // Decided on the server so the page and the browser agree on "today".
  const now = new Date();
  const today = toDayKey(now);
  const view = parseMonthParam(typeof month === "string" ? month : undefined, today);
  const [{ events, celebrants }, nextEvent] = await Promise.all([
    loadMonth(supabase, view),
    fetchNextEvent(supabase, now),
  ]);

  return (
    <CalendarContent
      profile={profile}
      isAdmin={admin}
      view={view}
      today={today}
      events={events}
      celebrants={celebrants}
      nextEvent={nextEvent}
    />
  );
}
