export const instant = false;

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteNav, { ADMIN_MENU_LINKS, HOME_ADMIN_NAV_LINKS } from "@/components/NavigationHeader";
import { getProfile, isAdmin } from "@/lib/auth";
import { canScanAnything, fetchMyAttendance, isStudent } from "@/lib/attendance-server";
import LocalTime from "./LocalTime";
import StudentToken from "./StudentToken";
import {
  AttendanceBadge,
  BLUEPRINT_GRID,
  DateChip,
  EmptyState,
  Frame,
  Icon,
  MethodTag,
  PageHeader,
  PanelHeader,
  StatStrip,
} from "./ui";

export const metadata: Metadata = {
  title: "Attendance — SOE Hub",
};

export default async function AttendancePage() {
  const [profile, admin] = await Promise.all([getProfile(), isAdmin()]);
  const [student, canScan, history] = await Promise.all([
    isStudent(profile.id),
    canScanAnything(profile.id, admin),
    fetchMyAttendance(profile.id),
  ]);

  const present = history.filter((row) => row.status === "present");
  const lastCheckIn = present[0];

  const actions = (canScan || admin) && (
    <>
      {canScan && (
        <Link href="/attendance/scan" className="btn primary rounded-lg px-4 py-2 text-[13.5px]">
          <Icon name="scan" />
          Scan students
        </Link>
      )}
      {admin && (
        <Link href="/admin/attendance" className="btn ghost rounded-lg px-4 py-2 text-[13.5px]">
          <Icon name="sliders" />
          Manage events
        </Link>
      )}
    </>
  );

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
          eyebrow="SOE HUB / ATTENDANCE"
          title="Attendance"
          description={
            student
              ? "Show your pass at council events to get checked in, and look back at every event you've attended."
              : "Attendance passes and check-in history for council events."
          }
          actions={actions}
        />

        {student ? (
          <div className="grid grid-cols-[380px_minmax(0,1fr)] items-start gap-6 max-[900px]:grid-cols-1">
            {/* ───────── Attendance pass ───────── */}
            <Frame className="animate-fade-in-up p-0">
              <div className={`rounded-t-[5px] border-b-[3px] border-orange bg-navy px-5 py-4 ${BLUEPRINT_GRID}`}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="mono text-[10px] tracking-[0.12em] text-navy-tint uppercase">Attendance pass</span>
                  <span className="mono flex items-center gap-1.5 text-[10px] text-navy-tint">
                    <span className="relative flex size-1.5">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-yellow opacity-75" />
                      <span className="relative inline-flex size-1.5 rounded-full bg-yellow" />
                    </span>
                    LIVE
                  </span>
                </div>
                <div className="flex items-center gap-3.5">
                  {profile.avatarUrl ? (
                    <Image
                      src={profile.avatarUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="size-12 shrink-0 rounded-full border-2 border-paper object-cover shadow-[0_0_0_3px_rgba(217,83,30,0.4)]"
                    />
                  ) : (
                    <span className="font-display flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-paper bg-vellum text-[16px] font-semibold text-navy-deep shadow-[0_0_0_3px_rgba(217,83,30,0.4)]">
                      {profile.initials}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h2 className="mb-0.5 truncate text-[18px] text-paper">{profile.name}</h2>
                    <p className="mono mb-0 truncate text-[11px] text-navy-tint">
                      {profile.studentId} &middot; {profile.program}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-5 pt-7 pb-5">
                <StudentToken />
              </div>
            </Frame>

            {/* ───────── History ───────── */}
            <Frame className="animate-fade-in-up p-0 [animation-delay:0.08s]">
              <PanelHeader icon="history" title="My history">
                <span className="mono text-[11px] text-ink-soft">
                  {history.length} record{history.length === 1 ? "" : "s"}
                </span>
              </PanelHeader>

              <StatStrip
                stats={[
                  { label: "Present", value: present.length, dot: "bg-blue" },
                  { label: "Rejected", value: history.length - present.length, dot: "bg-[#b3261e]" },
                  {
                    label: "Last check-in",
                    value: lastCheckIn ? (
                      <span className="text-[15px]">
                        <LocalTime value={lastCheckIn.recorded_at} format="date" />
                      </span>
                    ) : (
                      "—"
                    ),
                  },
                ]}
              />

              {history.length === 0 ? (
                <div className="border-t border-rule-soft">
                  <EmptyState icon="calendar" title="NO ATTENDANCE YET">
                    Events you get scanned into will show up here.
                  </EmptyState>
                </div>
              ) : (
                <ul className="m-0 list-none divide-y divide-rule-soft border-t border-rule-soft">
                  {history.map((row, index) => (
                    <li
                      key={`${row.event_name}-${row.recorded_at}`}
                      className="animate-fade-in flex items-center gap-3.5 px-5 py-3.5 transition-colors duration-150 hover:bg-vellum/40"
                      style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                    >
                      <DateChip value={row.event_start} />
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 truncate text-[14px] font-semibold text-navy-deep">{row.event_name}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="mono text-[11px] text-ink-soft">
                            <LocalTime value={row.recorded_at} format="short" />
                          </span>
                          <MethodTag method={row.method} />
                        </div>
                        {row.note && (
                          <p className="mt-1.5 mb-0 border-l-2 border-orange/60 pl-2 text-[12px] text-ink-soft italic">
                            {row.note}
                          </p>
                        )}
                      </div>
                      <AttendanceBadge status={row.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Frame>
          </div>
        ) : (
          <Frame className="animate-fade-in-up max-w-[620px]">
            <EmptyState icon="qr" title="NO ATTENDANCE PASS">
              Only student accounts get an attendance pass.
              {(canScan || admin) && " You can still use the tools above to check students in."}
            </EmptyState>
          </Frame>
        )}
      </div>
    </>
  );
}
