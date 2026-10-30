export const instant = false;

import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteNav, { ADMIN_MENU_LINKS, HOME_ADMIN_NAV_LINKS } from "@/components/NavigationHeader";
import { getProfile, isAdmin } from "@/lib/auth";
import { checkInState, checkInWindow, type AttendanceEvent } from "@/lib/attendance";
import { fetchMyAttendance, fetchScannableEvents } from "@/lib/attendance-server";
import { createClient } from "@/lib/supabase/server";
import LocalTime from "./LocalTime";
import RegisterServiceWorker from "./RegisterServiceWorker";
import HistoryList from "./HistoryList";
import { SplitBar } from "./motion";
import StaticPass from "./StaticPass";
import StudentToken from "./StudentToken";
import {
  BLUEPRINT_GRID,
  CheckInBadge,
  DateChip,
  EmptyState,
  Frame,
  Icon,
  IdleNotice,
  PageHeader,
  PanelHeader,
  StatStrip,
} from "./ui";

// Installable as its own app on phones; see public/attendance.webmanifest.
export const metadata: Metadata = {
  title: "Attendance — SOE Hub",
  manifest: "/attendance.webmanifest",
  appleWebApp: { title: "SOE Pass", statusBarStyle: "default" },
  icons: { apple: "/icons/pass-apple-180.png" },
};

// Navy, matching the manifest, so the phone's status bar blends with the app.
export const viewport: Viewport = {
  themeColor: "#132a4d",
};

type StudentRecord = {
  student_id: string;
  courses: { name: string } | null;
  yearlevels: { name: string } | null;
};

/** The student's own row; the pass reads its number from here, not the sign-up metadata. */
async function fetchStudentRecord(userId: string): Promise<StudentRecord | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("students")
    .select("student_id, courses(name), yearlevels(name)")
    .eq("id", userId)
    .maybeSingle<StudentRecord>();
  if (error) throw error;

  return data;
}

export default async function AttendancePage() {
  const [profile, admin] = await Promise.all([getProfile(), isAdmin()]);
  const [student, scannable, history] = await Promise.all([
    fetchStudentRecord(profile.id),
    fetchScannableEvents(profile.id, admin),
    fetchMyAttendance(profile.id),
  ]);
  const canScan = admin || scannable.length > 0;

  const studentNumber = student?.student_id || profile.studentId;
  const program = [student?.courses?.name, student?.yearlevels?.name].filter(Boolean).join(" · ") || profile.program;
  const present = history.filter((row) => row.status === "present");
  const lastCheckIn = present[0];

  const actions = (canScan || admin) && (
    <>
      {/* Staff scan from the button on their staff pass instead. */}
      {canScan && student && (
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
      <RegisterServiceWorker />
      <SiteNav
        initials={profile.initials}
        name={profile.name}
        userId={profile.id}
        avatarUrl={profile.avatarUrl}
        links={admin ? HOME_ADMIN_NAV_LINKS : undefined}
        menuLinks={admin ? ADMIN_MENU_LINKS : undefined}
      />

      {!student && !canScan ? (
        <IdleNotice
          backdrop="STAFF"
          title="No Events Assigned"
          actions={
            <Link href="/home" className="btn">
              Go home <span aria-hidden="true">&rarr;</span>
            </Link>
          }
        >
          Staff accounts don&apos;t get an attendance pass. Your check-in schedule shows up here once a council admin
          assigns you to scan for an event.
        </IdleNotice>
      ) : (
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
                      <h2 className="mb-1 truncate text-[18px] leading-tight text-paper">{profile.name}</h2>
                      <p className="mono mb-0.5 text-[13px] tracking-[0.06em] text-paper/90 tabular-nums">
                        {studentNumber}
                      </p>
                      <p className="mb-0 truncate text-[11.5px] text-navy-tint">{program}</p>
                    </div>
                  </div>
                </div>

                <div className="px-5 pt-7 pb-5">
                  <StudentToken name={profile.name} studentId={studentNumber} />
                  <StaticPass studentId={studentNumber} />
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

                {history.length > 0 && (
                  <div className="border-t border-rule-soft px-4 pt-3 pb-3.5">
                    <SplitBar
                      label="Attendance record"
                      segments={[
                        { label: "Present", value: present.length, color: "bg-blue" },
                        { label: "Rejected", value: history.length - present.length, color: "bg-[#b3261e]" },
                      ]}
                    />
                  </div>
                )}

                {history.length === 0 ? (
                  <div className="border-t border-rule-soft">
                    <EmptyState icon="calendar" title="NO ATTENDANCE YET">
                      Events you get scanned into will show up here.
                    </EmptyState>
                  </div>
                ) : (
                  <HistoryList history={history} />
                )}
              </Frame>
            </div>
          ) : (
            <StaffView profile={profile} admin={admin} events={scannable} />
          )}
        </div>
      )}
    </>
  );
}

type StaffProfile = { name: string; initials: string; avatarUrl: string | null };

/** What admins and scanners see instead of a pass: their credentials and the check-ins they can run. */
function StaffView({ profile, admin, events }: { profile: StaffProfile; admin: boolean; events: AttendanceEvent[] }) {
  const listed = events.map((event) => ({ ...event, state: checkInState(event) }));
  const live = listed.filter((event) => event.state === "open");
  const nextUpcoming = listed.find((event) => event.state === "upcoming");
  const spotlight = live[0] ?? nextUpcoming;

  return (
    <div className="grid grid-cols-[380px_minmax(0,1fr)] items-start gap-6 max-[900px]:grid-cols-1">
      {/* ───────── Staff pass ───────── */}
      <Frame className="animate-fade-in-up p-0">
        <div className={`rounded-t-[5px] border-b-[3px] border-orange bg-navy px-5 py-4 ${BLUEPRINT_GRID}`}>
          <div className="mb-3 flex items-center justify-between">
            <span className="mono text-[10px] tracking-[0.12em] text-navy-tint uppercase">Staff access</span>
            <span className="mono rounded-full border border-yellow/50 px-2 py-px text-[10px] tracking-[0.08em] text-yellow uppercase">
              {admin ? "Admin" : "Scanner"}
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
              <h2 className="mb-1 truncate text-[18px] leading-tight text-paper">{profile.name}</h2>
              <p className="mb-0 text-[11.5px] text-navy-tint">
                {admin ? "Council admin · scans and manages every event" : "Assigned scanner for council events"}
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 pt-4 pb-5">
          {spotlight ? (
            <>
              <span className="mono mb-2 flex items-center gap-1.5 text-[10px] tracking-[0.1em] text-ink-soft uppercase">
                <span className="relative flex size-1.5">
                  {spotlight.state === "open" && (
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-orange opacity-75" />
                  )}
                  <span className={`relative inline-flex size-1.5 rounded-full ${spotlight.state === "open" ? "bg-orange" : "bg-blue"}`} />
                </span>
                {spotlight.state === "open" ? "Check-in open now" : "Next check-in"}
              </span>
              <div className="flex items-center gap-3">
                <DateChip value={spotlight.event_start} />
                <div className="min-w-0">
                  <p className="mb-0.5 truncate text-[15px] font-semibold text-navy-deep">{spotlight.event_name}</p>
                  <p className="mono mb-0 text-[11px] text-ink-soft">
                    {spotlight.state === "open" ? (
                      <>
                        Closes <LocalTime value={checkInWindow(spotlight).closes} format="time" />
                      </>
                    ) : (
                      <>
                        Opens <LocalTime value={checkInWindow(spotlight).opens} format="short" />
                      </>
                    )}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="mb-0 text-[13px] text-ink-soft">
              No check-ins scheduled. {admin ? "Turn on attendance for an event to get started." : "You'll see events here once you're assigned."}
            </p>
          )}
          <Link href="/attendance/scan" className="btn primary mt-4 w-full rounded-lg py-2 text-[13.5px]">
            <Icon name="scan" />
            Start scanning
          </Link>
        </div>
      </Frame>

      {/* ───────── Check-in schedule ───────── */}
      <Frame className="animate-fade-in-up p-0 [animation-delay:0.08s]">
        <PanelHeader icon="clock" title="Check-in schedule">
          <span className="mono text-[11px] text-ink-soft">
            {listed.length} event{listed.length === 1 ? "" : "s"}
          </span>
        </PanelHeader>

        <StatStrip
          stats={[
            { label: "Open now", value: live.length, dot: "bg-orange" },
            { label: "Upcoming", value: listed.length - live.length, dot: "bg-blue" },
            {
              label: "Next opens",
              value: nextUpcoming ? (
                <span className="text-[15px]">
                  <LocalTime value={checkInWindow(nextUpcoming).opens} format="date" />
                </span>
              ) : (
                "—"
              ),
            },
          ]}
        />

        {listed.length === 0 ? (
          <div className="border-t border-rule-soft">
            <EmptyState icon="calendar" title="NOTHING SCHEDULED">
              Open and upcoming check-ins you can scan for show up here.
            </EmptyState>
          </div>
        ) : (
          <ul className="m-0 list-none divide-y divide-rule-soft border-t border-rule-soft">
            {listed.map((event, index) => {
              const open = event.state === "open";
              const row = (
                <>
                  <DateChip value={event.event_start} />
                  <span className="min-w-0 flex-1">
                    <span className="mb-1 block truncate text-[14px] font-semibold text-navy-deep">{event.event_name}</span>
                    <span className="mono block truncate text-[11px] text-ink-soft">
                      <LocalTime value={event.event_start} format="short" /> &rarr;{" "}
                      <LocalTime value={event.event_end} format="time" />
                    </span>
                  </span>
                  <CheckInBadge state={event.state} />
                </>
              );
              const rowClass = `flex items-center gap-4 px-5 py-3.5 ${open ? "bg-orange/[0.04] shadow-[inset_3px_0_0_var(--orange)]" : ""}`;

              return (
                <li key={event.event_id} className="animate-fade-in" style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}>
                  {admin ? (
                    <Link
                      href={`/admin/attendance/${event.event_id}`}
                      className={`${rowClass} no-underline transition-[background-color,box-shadow] duration-150 hover:bg-vellum/40 hover:shadow-[inset_3px_0_0_var(--orange)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue`}
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className={rowClass}>{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Frame>
    </div>
  );
}
