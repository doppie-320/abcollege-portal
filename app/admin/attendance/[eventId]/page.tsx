export const instant = false;

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import SiteNav, { ADMIN_MENU_LINKS, HOME_ADMIN_NAV_LINKS } from "@/components/NavigationHeader";
import { getProfile, isAdmin } from "@/lib/auth";
import { fetchEventAttendance } from "@/lib/attendance-server";
import EventAttendance from "./EventAttendance";

export const metadata: Metadata = {
  title: "Event Attendance — SOE Hub",
};

export default async function EventAttendancePage(props: PageProps<"/admin/attendance/[eventId]">) {
  const [profile, admin] = await Promise.all([getProfile(), isAdmin()]);
  if (!admin) redirect("/home");

  const eventId = Number((await props.params).eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) notFound();

  const details = await fetchEventAttendance(eventId);
  if (!details) notFound();

  return (
    <>
      <SiteNav
        initials={profile.initials}
        name={profile.name}
        userId={profile.id}
        avatarUrl={profile.avatarUrl}
        links={HOME_ADMIN_NAV_LINKS}
        menuLinks={ADMIN_MENU_LINKS}
      />

      <div className="page-wrap">
        <EventAttendance
          event={details.event}
          scanners={details.scanners}
          report={details.report}
          history={details.history}
          recorderName={profile.name}
        />
      </div>
    </>
  );
}
