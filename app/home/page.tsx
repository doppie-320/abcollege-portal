export const instant = false;

import type { Metadata } from "next";
import HomeContent from "./HomeContent";
import { COUNTDOWN_DAYS } from "./HomeSidebar";

import PageTransition from "@/components/PageTransition";
import { addDaysISO, daysBetweenISO, schoolToday } from "@/lib/dates";
import { listBirthdayCelebrants, listEvents } from "@/lib/mock/portal-db";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Home — SOE Hub",
};

export default async function HomePage() {
  const supabase = await createClient();

  const { data: authUser, error: authError } = await supabase.auth.getUser();

  if (authError) throw authError;

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("id, first_name, last_name, avatar_path")
    .eq('id', authUser.user.id)
    .single();

  if (userError) throw userError;

  // A row in "admins" (keyed by users.id) is what makes an account an admin.
  const { data: adminRow, error: adminError } = await supabase
    .from("admins")
    .select("id")
    .eq("id", userData.id)
    .maybeSingle();

  if (adminError) throw adminError;

  // Sidebar: today's birthdays and what's coming up, from the same data as the calendar.
  const today = schoolToday();
  const [celebrants, upcoming] = await Promise.all([
    listBirthdayCelebrants(Number(today.slice(5, 7)) - 1),
    listEvents(today, addDaysISO(today, COUNTDOWN_DAYS)),
  ]);

  const firstName = userData.first_name?.trim() ?? "";
  const lastName = userData.last_name?.trim() ?? "";

  const avatarUrl = userData.avatar_path
    ? supabase.storage.from("avatars").getPublicUrl(userData.avatar_path).data.publicUrl
    : "";

  return (
    <PageTransition>
      <HomeContent
        current_user={{
          id: userData.id,
          name: `${firstName} ${lastName}`.trim(),
          initials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase(),
          avatar_path: avatarUrl,
        }}
        is_admin={adminRow !== null}
        today={today}
        birthdaysToday={celebrants.filter((c) => c.day === Number(today.slice(8)))}
        upcoming={upcoming.map((entry) => ({ ...entry, daysAway: daysBetweenISO(today, entry.date) }))}
      />
    </PageTransition>
  );
  
}

