export const instant = false;

import type { Metadata } from "next";
import HomeContent from "./HomeContent";

import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin, requireUserId } from "@/lib/auth";
import { toDayKey } from "@/lib/calendar";
import { fetchUpcomingBirthdays, fetchUpcomingEvents } from "@/lib/calendar-data";
import { getDeploymentLabel } from "@/lib/deployment";

export const metadata: Metadata = {
  title: "Home — SOE Hub",
};

export default async function HomePage() {
  // Signed out or the session expired: send them to log in before fetching
  // anything. This only checks the token, so it doesn't cost a database trip.
  // It also reads the request, which has to happen before `new Date()` below.
  await requireUserId();

  // Decided on the server so the page and the browser agree on "today" (school time).
  const now = new Date();
  const today = toDayKey(now);
  const supabase = await createClient();

  // All in one go: the profile (which redirects unapproved accounts) and the
  // cards' data don't depend on each other.
  const [profile, admin, birthdays, upcomingEvents, deploymentLabel] = await Promise.all([
    getProfile(),
    isAdmin(),
    fetchUpcomingBirthdays(supabase, today),
    fetchUpcomingEvents(supabase, now, 8),
    getDeploymentLabel(),
  ]);

  return (
    <HomeContent
      current_user={{
        id: profile.id,
        name: `${profile.firstName} ${profile.lastName}`.trim(),
        initials: profile.initials,
        avatar_path: profile.avatarUrl,
      }}
      is_admin={admin}
      today={today}
      birthdays={birthdays}
      upcomingEvents={upcomingEvents}
      deploymentLabel={deploymentLabel}
    />
  );
}
