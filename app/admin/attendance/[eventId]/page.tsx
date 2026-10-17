export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SiteNav, { ADMIN_MENU_LINKS } from "@/components/NavigationHeader";
import { getProfile, isAdmin } from "@/lib/auth";
import { checkInState } from "@/lib/attendance";
import { fetchEventAttendance } from "@/lib/attendance-server";
import LocalTime from "@/app/attendance/LocalTime";
import { SplitBar } from "@/app/attendance/motion";
import {
  CheckInBadge,
  EmptyState,
  FIELD,
  FIELD_LABEL,
  Frame,
  Icon,
  Initials,
  PageHeader,
  PanelHeader,
  StatStrip,
} from "@/app/attendance/ui";
import { assignScanner, removeScanner, setAttendance } from "../actions";
import ActionForm from "../ActionForm";
import EventSettings from "./EventSettings";
import RosterTable from "./RosterTable";

export const metadata: Metadata = {
  title: "Event Attendance — SOE Hub",
};

const ICON_BUTTON =
  "flex size-8 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-ink-soft transition-colors duration-150 hover:border-[#b3261e]/30 hover:bg-[rgba(205,79,60,0.08)] hover:text-[#b3261e] focus-visible:outline-2 focus-visible:outline-blue disabled:cursor-not-allowed disabled:opacity-50";

export default async function EventAttendancePage(props: PageProps<"/admin/attendance/[eventId]">) {
  const [profile, admin] = await Promise.all([getProfile(), isAdmin()]);
  if (!admin) redirect("/home");

  const eventId = Number((await props.params).eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) notFound();

  const details = await fetchEventAttendance(eventId);
  if (!details) notFound();
  const { event, scanners, report } = details;
  const present = report.filter((row) => row.status === "present").length;
  const exportHref = `/admin/attendance/${event.event_id}/export`;

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
          back={{ href: "/admin/attendance", label: "All events" }}
          eyebrow="SOE HUB / ADMIN PANEL / ATTENDANCE"
          title={event.event_name}
          description={
            <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <CheckInBadge state={checkInState(event)} />
              <span className="mono text-[11px]">
                <LocalTime value={event.event_start} format="short" /> &rarr;{" "}
                <LocalTime value={event.event_end} format="short" />
              </span>
            </span>
          }
          actions={
            <>
              <a href={exportHref} className="btn ghost rounded-lg px-4 py-2 text-[13.5px]">
                <Icon name="download" />
                Export CSV
              </a>
              <Link href="/attendance/scan" className="btn primary rounded-lg px-4 py-2 text-[13.5px]">
                <Icon name="scan" />
                Scan students
              </Link>
            </>
          }
        />

        <Frame className="animate-fade-in-up mb-6 p-0">
          <StatStrip
            columns="grid-cols-2 sm:grid-cols-4"
            stats={[
              { label: "Present", value: present, dot: "bg-blue" },
              { label: "Rejected", value: report.length - present, dot: "bg-[#b3261e]" },
              { label: "Recorded", value: report.length },
              { label: "Scanners", value: scanners.length },
            ]}
          />
          {report.length > 0 && (
            <div className="border-t border-rule-soft px-4 pt-3 pb-3.5">
              <SplitBar
                label="Check-in mix"
                segments={[
                  { label: "Present", value: present, color: "bg-blue" },
                  { label: "Rejected", value: report.length - present, color: "bg-[#b3261e]" },
                ]}
              />
            </div>
          )}
        </Frame>

        <RosterTable eventId={event.event_id} report={report} exportHref={exportHref} />

        <div className="grid grid-cols-2 items-start gap-6 max-[900px]:grid-cols-1">
          <div className="flex min-w-0 flex-col gap-6">
            {/* ───────── Manual record ───────── */}
            <Frame className="animate-fade-in-up p-0 [animation-delay:0.1s]">
              <PanelHeader icon="pen" title="Record manually" />
              <div className="px-5 py-4">
                <p className="mb-4 text-[12.5px] text-ink-soft">
                  Overrides any existing record, e.g. for a student whose phone died.
                </p>
                <ActionForm
                  action={setAttendance}
                  className="grid grid-cols-[minmax(0,1fr)_200px] items-end gap-3 max-[640px]:grid-cols-1"
                >
                  <input type="hidden" name="eventId" value={event.event_id} />
                  <label className="m-0">
                    <span className={FIELD_LABEL}>Student ID</span>
                    <input type="text" name="studentId" required autoComplete="off" className={`${FIELD} font-mono`} />
                  </label>
                  <div>
                    <span className={FIELD_LABEL} id="manual-status-label">
                      Status
                    </span>
                    <div
                      role="radiogroup"
                      aria-labelledby="manual-status-label"
                      className="flex gap-0.5 rounded-[5px] border border-rule bg-paper p-0.5"
                    >
                      {(["present", "rejected"] as const).map((status) => (
                        <label key={status} className="m-0 flex-1 cursor-pointer">
                          <input
                            type="radio"
                            name="status"
                            value={status}
                            defaultChecked={status === "present"}
                            className="peer sr-only"
                          />
                          <span className="mono block rounded-[3px] px-3 py-[7px] text-center text-[11px] tracking-[0.04em] text-ink-soft uppercase transition-colors duration-150 peer-checked:bg-navy peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-blue hover:bg-vellum-2 peer-checked:hover:bg-navy">
                            {status}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="m-0">
                    <span className={FIELD_LABEL}>Note (optional)</span>
                    <input type="text" name="note" autoComplete="off" className={FIELD} />
                  </label>
                  <button type="submit" className="btn rounded-lg px-4 py-2 text-[13px]">
                    <Icon name="check" size={13} />
                    Save record
                  </button>
                </ActionForm>
              </div>
            </Frame>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            {/* ───────── Settings ───────── */}
            <Frame className="animate-fade-in-up p-0 [animation-delay:0.08s]">
              <PanelHeader icon="sliders" title="Check-in settings" />
              <div className="px-5 py-4">
                <EventSettings event={event} />
              </div>
            </Frame>

            {/* ───────── Scanners ───────── */}
            <Frame className="animate-fade-in-up p-0 [animation-delay:0.12s]">
              <PanelHeader icon="scan" title="Scanners">
                <span className="mono text-[11px] text-ink-soft">{scanners.length} assigned</span>
              </PanelHeader>

              {scanners.length === 0 ? (
                <EmptyState icon="users" title="NO SCANNERS ASSIGNED">
                  Admins can always scan. Assign council members below to let them help.
                </EmptyState>
              ) : (
                <ul className="m-0 list-none divide-y divide-rule-soft">
                  {scanners.map((scanner) => (
                    <li key={scanner.user_id} className="flex items-start gap-3 px-5 py-3">
                      <span className="mono mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-navy bg-vellum text-[11px] font-semibold text-navy-deep">
                        <Initials first={scanner.first_name} last={scanner.last_name} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-navy-deep">
                          {scanner.first_name} {scanner.last_name}
                        </span>
                        <span className="mono block truncate text-[10.5px] text-ink-soft">{scanner.email_address}</span>
                      </span>
                      <ActionForm action={removeScanner} successMessage="Removed." className="flex justify-end">
                        <input type="hidden" name="eventId" value={event.event_id} />
                        <input type="hidden" name="userId" value={scanner.user_id} />
                        <button
                          type="submit"
                          className={ICON_BUTTON}
                          aria-label={`Remove ${scanner.first_name} ${scanner.last_name} as a scanner`}
                          title="Remove scanner"
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-rule-soft bg-vellum/30 px-5 py-4">
                <ActionForm action={assignScanner} successMessage="Assigned." className="flex items-end gap-2">
                  <input type="hidden" name="eventId" value={event.event_id} />
                  <label className="m-0 min-w-0 flex-1">
                    <span className={FIELD_LABEL}>Assign by email</span>
                    <input type="email" name="email" required placeholder="Their account email" className={FIELD} />
                  </label>
                  <button type="submit" className="btn rounded-lg px-3 py-2 text-[13px]">
                    <Icon name="plus" size={13} />
                    Assign
                  </button>
                </ActionForm>
              </div>
            </Frame>
          </div>
        </div>
      </div>
    </>
  );
}
