export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import SiteNav, { ADMIN_MENU_LINKS } from "@/components/NavigationHeader";
import { getProfile, isAdmin } from "@/lib/auth";
import { checkInState } from "@/lib/attendance";
import { fetchAttendanceEvents } from "@/lib/attendance-server";
import LocalTime from "@/app/attendance/LocalTime";
import { CheckInBadge, DateChip, EmptyState, Frame, Icon, PageHeader, PanelHeader, StatStrip, type CheckInState } from "@/app/attendance/ui";

export const metadata: Metadata = {
  title: "Event Attendance — SOE Hub",
};

export default async function AdminAttendancePage() {
  const [profile, admin] = await Promise.all([getProfile(), isAdmin()]);
  if (!admin) redirect("/home");

  const events = (await fetchAttendanceEvents()).map((event) => ({ ...event, state: checkInState(event) }));
  const count = (state: CheckInState) => events.filter((event) => event.state === state).length;

  return (
    <>
      <SiteNav
        initials={profile.initials}
        name={profile.name}
        userId={profile.id}
        avatarUrl={profile.avatarUrl}
        nameOverride="ADMIN"
        links={[]}
        brandHref="/admin"
        profileHref="/admin/profile"
        profileLabel="My profile"
        menuLinks={ADMIN_MENU_LINKS}
      />

      <div className="page-wrap">
        <PageHeader
          back={{ href: "/admin", label: "Admin console" }}
          eyebrow="SOE HUB / ADMIN PANEL / ATTENDANCE"
          title="Event Attendance"
          description="Choose which events take attendance, assign scanners, and review who checked in."
          actions={
            <Link href="/attendance/scan" className="btn primary rounded-lg px-4 py-2 text-[13.5px]">
              <Icon name="scan" />
              Scan students
            </Link>
          }
        />

        <Frame className="animate-fade-in-up p-0">
          <StatStrip
            columns="grid-cols-2 sm:grid-cols-4"
            stats={[
              { label: "Open now", value: count("open"), dot: "bg-orange" },
              { label: "Upcoming", value: count("upcoming"), dot: "bg-blue" },
              { label: "Closed", value: count("closed"), dot: "bg-ink-soft" },
              { label: "Not tracked", value: count("not tracked"), dot: "bg-rule" },
            ]}
          />
        </Frame>

        <Frame className="animate-fade-in-up mt-6 p-0 [animation-delay:0.08s]">
          <PanelHeader icon="calendar" title="All events">
            <span className="mono text-[11px] text-ink-soft">
              {events.length} event{events.length === 1 ? "" : "s"}
            </span>
          </PanelHeader>

          {events.length === 0 ? (
            <EmptyState icon="calendar" title="NO EVENTS YET">
              Create them on the calendar, then come back to turn on attendance.
            </EmptyState>
          ) : (
            <ul className="m-0 list-none divide-y divide-rule-soft">
              {events.map((event, index) => (
                <li key={event.event_id} className="animate-fade-in" style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}>
                  <Link
                    href={`/admin/attendance/${event.event_id}`}
                    className={`group flex items-center gap-4 px-5 py-3.5 no-underline transition-[background-color,box-shadow] duration-150 hover:bg-vellum/40 hover:shadow-[inset_3px_0_0_var(--orange)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue ${
                      event.state === "not tracked" ? "opacity-70 hover:opacity-100" : ""
                    }`}
                  >
                    <DateChip value={event.event_start} />
                    <span className="min-w-0 flex-1">
                      <span className="mb-1 block truncate text-[14px] font-semibold text-navy-deep">{event.event_name}</span>
                      <span className="mono block truncate text-[11px] text-ink-soft">
                        <LocalTime value={event.event_start} format="short" /> &rarr;{" "}
                        <LocalTime value={event.event_end} format="time" />
                      </span>
                    </span>
                    <CheckInBadge state={event.state} />
                    <span className="mono hidden items-center gap-1.5 text-[11px] text-blue sm:flex">
                      Manage
                      <span className="transition-transform duration-150 group-hover:translate-x-1">
                        <Icon name="arrowRight" size={12} />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Frame>
      </div>
    </>
  );
}
