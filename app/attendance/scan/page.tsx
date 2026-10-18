export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import SiteNav, { ADMIN_MENU_LINKS, HOME_ADMIN_NAV_LINKS } from "@/components/NavigationHeader";
import { getProfile, isAdmin } from "@/lib/auth";
import { fetchScannableEvents } from "@/lib/attendance-server";
import { IdleNotice, PageHeader } from "../ui";
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

      {events.length === 0 ? (
        <Standby admin={admin} />
      ) : (
        <div className="page-wrap">
          <PageHeader
            back={{ href: "/attendance", label: "Back to attendance" }}
            eyebrow="SOE HUB / ATTENDANCE / SCANNER"
            title="Scan Attendance"
            description="Read a student's pass, check their face against the photo on file, then accept or reject."
          />
          <Scanner events={events} />
        </div>
      )}
    </>
  );
}

/** Nothing to scan for. */
function Standby({ admin }: { admin: boolean }) {
  return (
    <IdleNotice
      backdrop="IDLE"
      title="Nothing to Scan"
      actions={
        <>
          {admin && (
            <Link href="/admin/attendance" className="btn">
              Manage events <span aria-hidden="true">&rarr;</span>
            </Link>
          )}
          <Link href="/attendance" className={admin ? "btn ghost" : "btn"}>
            Back to attendance
          </Link>
        </>
      }
    >
      {admin
        ? "No events are taking attendance right now or coming up. Turn on attendance for an event to start scanning for it."
        : "You aren't assigned to scan for any upcoming or ongoing events. Ask a council admin to add you as a scanner."}
    </IdleNotice>
  );
}
