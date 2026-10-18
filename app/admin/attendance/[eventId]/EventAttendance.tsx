"use client";

import Link from "next/link";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import ConfirmDialog from "@/app/home/ConfirmDialog";
import { toast } from "@/components/Toaster";
import { settle, type ActionResult } from "@/lib/actionResult";
import { checkInState, type AttendanceEvent, type AttendanceStatus } from "@/lib/attendance";
import type { EventScanner } from "@/lib/attendance-server";
import LocalTime from "@/app/attendance/LocalTime";
import { SplitBar } from "@/app/attendance/motion";
import {
  AttendanceBadge,
  CheckInBadge,
  EmptyState,
  FIELD,
  FIELD_LABEL,
  Frame,
  ICON_PATHS,
  Icon,
  Initials,
  PageHeader,
  PanelHeader,
  PersonChip,
  StatStrip,
} from "@/app/attendance/ui";
import { assignScanner, removeAttendance, removeScanner, setAttendance } from "../actions";
import ActionForm from "../ActionForm";
import EventSettings, { type AttendanceSettings } from "./EventSettings";
import RosterTable, { rosterName, type RosterRow } from "./RosterTable";

const ICON_BUTTON =
  "flex size-8 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-ink-soft transition-colors duration-150 hover:border-[#b3261e]/30 hover:bg-[rgba(205,79,60,0.08)] hover:text-[#b3261e] focus-visible:outline-2 focus-visible:outline-blue disabled:cursor-not-allowed disabled:opacity-50";

/** A scanner row; `pending` while an assignment is still being saved. */
type ScannerRow = EventScanner & { pending?: boolean };

type PageState = { event: AttendanceEvent; scanners: ScannerRow[]; report: RosterRow[] };

type Change =
  | { type: "settings"; settings: AttendanceSettings }
  | { type: "record"; row: RosterRow }
  | { type: "removeRecord"; userId: string }
  | { type: "addScanner"; scanner: ScannerRow }
  | { type: "removeScanner"; userId: string };

function applyChange(state: PageState, change: Change): PageState {
  switch (change.type) {
    case "settings":
      return { ...state, event: { ...state.event, ...change.settings } };
    case "record": {
      // A manual record overrides the student's existing one, if they have one.
      const exists = state.report.some((row) => row.student_id === change.row.student_id);
      return {
        ...state,
        report: exists
          ? state.report.map((row) => (row.student_id === change.row.student_id ? change.row : row))
          : [...state.report, change.row],
      };
    }
    case "removeRecord":
      return { ...state, report: state.report.filter((row) => row.user_id !== change.userId) };
    case "addScanner":
      return { ...state, scanners: [...state.scanners, change.scanner] };
    case "removeScanner":
      return { ...state, scanners: state.scanners.filter((scanner) => scanner.user_id !== change.userId) };
  }
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function scannerName(scanner: ScannerRow): string {
  return `${scanner.first_name ?? ""} ${scanner.last_name ?? ""}`.trim() || scanner.email_address;
}

type Confirming = { kind: "record"; row: RosterRow } | { kind: "scanner"; scanner: ScannerRow };

/**
 * Everything on an event's attendance page below the nav. Each change shows at once
 * through useOptimistic; the server actions refresh the page with the saved data, and
 * a failed change reverts by itself (forms show why, row deletes raise a toast).
 */
export default function EventAttendance({
  event: savedEvent,
  scanners: savedScanners,
  report: savedReport,
  recorderName,
}: {
  event: AttendanceEvent;
  scanners: EventScanner[];
  report: RosterRow[];
  /** Shown as "by …" on manual records until the saved row arrives. */
  recorderName: string;
}) {
  const saved = useMemo<PageState>(
    () => ({ event: savedEvent, scanners: savedScanners, report: savedReport }),
    [savedEvent, savedScanners, savedReport],
  );
  const [{ event, scanners, report }, apply] = useOptimistic(saved, applyChange);
  const [, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<Confirming | null>(null);

  const present = report.filter((row) => row.status === "present").length;
  const exportHref = `/admin/attendance/${event.event_id}/export`;

  /** Applies `change` now and undoes it, with a toast, if the action fails. */
  function mutate(change: Change, fields: Record<string, string>, action: typeof removeAttendance, failure: string) {
    const formData = new FormData();
    formData.set("eventId", String(event.event_id));
    for (const [name, value] of Object.entries(fields)) formData.set(name, value);

    startTransition(async () => {
      apply(change);
      const result: ActionResult = await settle(action({}, formData));
      if (result.error) toast(`${failure} ${result.error}`);
    });
  }

  function removeRecord(row: RosterRow) {
    mutate(
      { type: "removeRecord", userId: row.user_id },
      { userId: row.user_id },
      removeAttendance,
      `Couldn't remove ${rosterName(row)}'s record.`,
    );
  }

  function unassignScanner(scanner: ScannerRow) {
    mutate(
      { type: "removeScanner", userId: scanner.user_id },
      { userId: scanner.user_id },
      removeScanner,
      `Couldn't remove ${scannerName(scanner)} as a scanner.`,
    );
  }

  function recordOptimistically(formData: FormData) {
    const studentId = text(formData, "studentId");
    const status = text(formData, "status") as AttendanceStatus;
    if (!studentId || (status !== "present" && status !== "rejected")) return;

    const existing = report.find((row) => row.student_id === studentId);
    apply({
      type: "record",
      row: {
        // A student who isn't on the roster yet shows by ID until the server looks them up.
        ...(existing ?? {
          event_id: event.event_id,
          event_name: event.event_name,
          event_start: event.event_start,
          user_id: `pending-${studentId}`,
          student_id: studentId,
          last_name: null,
          first_name: null,
          course: null,
          year_level: null,
        }),
        status,
        method: "manual",
        note: text(formData, "note") || null,
        recorded_at: new Date().toISOString(),
        recorded_by: recorderName,
        pending: true,
      },
    });
  }

  function assignOptimistically(formData: FormData) {
    const email = text(formData, "email").toLowerCase();
    if (!email || scanners.some((scanner) => scanner.email_address.toLowerCase() === email)) return;
    apply({
      type: "addScanner",
      scanner: { user_id: `pending-${email}`, first_name: null, last_name: null, email_address: email, pending: true },
    });
  }

  return (
    <>
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

      <RosterTable report={report} exportHref={exportHref} onRemove={(row) => setConfirming({ kind: "record", row })} />

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
                optimistic={recordOptimistically}
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
              <EventSettings event={event} onSave={(settings) => apply({ type: "settings", settings })} />
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
                  <li
                    key={scanner.user_id}
                    aria-busy={scanner.pending || undefined}
                    className={`animate-fade-in flex items-start gap-3 px-5 py-3 ${scanner.pending ? "opacity-60" : ""}`}
                  >
                    <span className="mono mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-navy bg-vellum text-[11px] font-semibold text-navy-deep">
                      <Initials first={scanner.first_name} last={scanner.last_name} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-navy-deep">
                        {scanner.pending ? "Assigning…" : scannerName(scanner)}
                      </span>
                      <span className="mono block truncate text-[10.5px] text-ink-soft">{scanner.email_address}</span>
                    </span>
                    {!scanner.pending && (
                      <button
                        type="button"
                        onClick={() => setConfirming({ kind: "scanner", scanner })}
                        className={ICON_BUTTON}
                        aria-label={`Remove ${scannerName(scanner)} as a scanner`}
                        title="Remove scanner"
                      >
                        <Icon name="x" size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-rule-soft bg-vellum/30 px-5 py-4">
              <ActionForm
                action={assignScanner}
                optimistic={assignOptimistically}
                successMessage="Assigned."
                className="flex items-end gap-2"
              >
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

      {confirming?.kind === "record" && (
        <ConfirmDialog
          eyebrow="REMOVE · ATTENDANCE RECORD"
          icon={ICON_PATHS.trash}
          title="Remove this record?"
          message={
            <>
              <strong>{rosterName(confirming.row)}</strong>&rsquo;s attendance for <strong>{event.event_name}</strong>{" "}
              will be deleted. They can be scanned or recorded again afterwards.
            </>
          }
          confirmLabel="Remove record"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            setConfirming(null);
            removeRecord(confirming.row);
          }}
        >
          <PersonChip
            first={confirming.row.first_name}
            last={confirming.row.last_name}
            detail={[confirming.row.student_id, confirming.row.course, confirming.row.year_level].filter(Boolean).join(" · ") || "—"}
            aside={<AttendanceBadge status={confirming.row.status} />}
            mark={{ icon: "trash", color: "bg-[#b3261e]" }}
          />
        </ConfirmDialog>
      )}

      {confirming?.kind === "scanner" && (
        <ConfirmDialog
          tone="warning"
          eyebrow="REMOVE · SCANNER"
          icon={ICON_PATHS.userX}
          title="Remove this scanner?"
          message={
            <>
              <strong>{scannerName(confirming.scanner)}</strong> won&rsquo;t be able to check students in to{" "}
              <strong>{event.event_name}</strong> anymore. You can assign them again at any time.
            </>
          }
          confirmLabel="Remove scanner"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            setConfirming(null);
            unassignScanner(confirming.scanner);
          }}
        >
          <PersonChip
            first={confirming.scanner.first_name}
            last={confirming.scanner.last_name}
            detail={confirming.scanner.email_address}
            mark={{ icon: "x", color: "bg-orange" }}
          />
        </ConfirmDialog>
      )}
    </>
  );
}
