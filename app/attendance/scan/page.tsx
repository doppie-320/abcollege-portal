export const instant = false;

import type { Metadata } from "next";
import SiteNav, { ADMIN_MENU_LINKS, HOME_ADMIN_NAV_LINKS } from "@/components/NavigationHeader";
import { getProfile, isAdmin } from "@/lib/auth";
import { fetchScannableEvents } from "@/lib/attendance-server";
import { EmptyState, Frame, PageHeader } from "../ui";
import Scanner from "./Scanner";

export const metadata: Metadata = {
  title: "Scan Attendance — SOE Hub",
};

export default async function ScanPage() {
  const [profile, admin] = await Promise.all([getProfile(), isAdmin()]);
  const events = await fetchScannableEvents(profile.id, admin);

  return (
    <>
      <SiteNav
        initials={profile.initials}
        name={profile.name}
        userId={profile.id}
        avatarUrl={profile.avatarUrl}
        links={admin ? HOME_ADMIN_NAV_LINKS : undefined}
        menuLinks={admin ? ADMIN_MENU_LINKS : undefined}
      />

      <div className="page-wrap">
        <PageHeader
          back={{ href: "/attendance", label: "Back to attendance" }}
          eyebrow="SOE HUB / ATTENDANCE / SCANNER"
          title="Scan Attendance"
          description="Read a student's pass, check their face against the photo on file, then accept or reject."
        />

        {events.length === 0 ? (
          <Frame className="animate-fade-in-up max-w-[620px]">
            <EmptyState icon="scan" title="NOTHING TO SCAN FOR">
              You aren&apos;t assigned to scan for any upcoming or ongoing events.
            </EmptyState>
          </Frame>
        ) : (
          <Scanner events={events} />
        )}
      </div>
    </>
  );
}
