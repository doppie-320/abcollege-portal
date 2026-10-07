export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/NavigationHeader";
import { getViewer } from "@/lib/auth";
import { formatISODate, formatPeso } from "@/lib/dates";
import { listAttendance, type AttendanceStatus as Status } from "@/lib/mock/portal-db";

export const metadata: Metadata = {
  title: "Attendance — SOE Hub",
};

const STATUS_STYLES: Record<Status, { label: string; className: string }> = {
  present: { label: "Present", className: "border-[#2f7a4f] text-[#2f7a4f]" },
  late: { label: "Late", className: "border-[#b8860b] text-[#8a6508]" },
  absent: { label: "Absent", className: "border-orange text-orange" },
  excused: { label: "Excused", className: "border-blue text-blue" },
};

const SUMMARY_ORDER: Status[] = ["present", "late", "absent", "excused"];

export default async function AttendancePage() {
  const viewer = await getViewer();
  // Newest first.
  const records = await listAttendance(viewer.id);

  const counts = Object.fromEntries(SUMMARY_ORDER.map((s) => [s, 0])) as Record<Status, number>;
  for (const r of records) counts[r.status]++;

  const totalFines = records.reduce((sum, r) => sum + r.fine, 0);
  const unpaidFines = records.reduce((sum, r) => sum + (r.finePaid ? 0 : r.fine), 0);

  return (
    <>
      <SiteNav
        initials={viewer.initials}
        name={viewer.name}
        userId={viewer.id}
        avatarUrl={viewer.avatarUrl}
      />

      <div className="page-wrap">
        <div className="mb-6 animate-fade-in-up">
          <span className="eyebrow mb-2 tracking-[0.08em]">SOE HUB / ATTENDANCE</span>
          <h1 className="mb-1 text-[30px] leading-none">Attendance</h1>
          <p className="mb-0 text-xs text-ink-soft">
            Your attendance at council events and any fines that came with it.
          </p>
        </div>

        <div className="grid grid-cols-[1fr_320px] items-start gap-7 max-[900px]:grid-cols-1">
          <div className="min-w-0">
            {/* ---------- Summary ---------- */}
            <section className="tick-frame mb-5 animate-fade-in-up [animation-delay:0.04s]">
              <span className="tick-bl" />
              <span className="tick-br" />
              <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-rule pb-2.5">
                <span className="mono text-[11px] uppercase tracking-[0.08em] text-navy">Summary</span>
                <span className="mono text-[11px] text-ink-soft">
                  {records.length} event{records.length === 1 ? "" : "s"} recorded
                </span>
              </div>
              <dl className="grid grid-cols-4 gap-2.5 max-[560px]:grid-cols-2">
                {SUMMARY_ORDER.map((status) => (
                  <div key={status} className="rounded-[6px] border border-rule-soft bg-vellum/50 px-3 py-2.5">
                    <dt className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-soft">
                      {STATUS_STYLES[status].label}
                    </dt>
                    <dd className="font-display text-[26px] font-semibold leading-tight text-navy-deep">
                      {counts[status]}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* ---------- History ---------- */}
            <section className="tick-frame animate-fade-in-up [animation-delay:0.08s]">
              <span className="tick-bl" />
              <span className="tick-br" />
              <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2.5">
                <span className="mono text-[11px] uppercase tracking-[0.08em] text-navy">Attendance history</span>
                <span className="mono text-[11px] text-ink-soft">Newest first</span>
              </div>

              {records.length === 0 ? (
                <p className="mb-0 pt-5 pb-1 text-[13px] text-ink-soft">
                  No attendance recorded yet. Scan your QR code at the next council event and it&apos;ll show up here.
                </p>
              ) : (
                <table className="w-full border-collapse text-[13.5px]">
                  <thead className="max-[560px]:sr-only">
                    <tr className="text-left font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-soft">
                      <th className="py-2.5 pr-3 font-medium">Date</th>
                      <th className="py-2.5 pr-3 font-medium">Event</th>
                      <th className="py-2.5 pr-3 font-medium">Status</th>
                      <th className="py-2.5 text-right font-medium">Fine</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr
                        key={r.id}
                        className="border-t border-rule-soft max-[560px]:grid max-[560px]:grid-cols-[1fr_auto] max-[560px]:gap-x-3 max-[560px]:py-2.5"
                      >
                        <td className="py-2.5 pr-3 align-top font-mono text-[12px] whitespace-nowrap text-ink-soft max-[560px]:col-span-2 max-[560px]:p-0">
                          {r.eventDate ? formatISODate(r.eventDate, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </td>
                        <td className="py-2.5 pr-3 align-top font-medium [overflow-wrap:anywhere] max-[560px]:p-0">
                          {r.eventName}
                        </td>
                        <td className="py-2.5 pr-3 align-top max-[560px]:row-span-2 max-[560px]:p-0 max-[560px]:text-right">
                          <span className={`tag ${STATUS_STYLES[r.status].className}`}>
                            {STATUS_STYLES[r.status].label.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 text-right align-top whitespace-nowrap max-[560px]:p-0 max-[560px]:text-left">
                          {r.fine > 0 ? (
                            <>
                              <span className={r.finePaid ? "text-ink-soft line-through" : "font-semibold text-orange"}>
                                {formatPeso(r.fine)}
                              </span>
                              {r.finePaid && <span className="ml-1.5 font-mono text-[10.5px] text-[#2f7a4f]">PAID</span>}
                            </>
                          ) : (
                            <span className="text-ink-soft">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <div className="flex flex-col gap-5">
            {/* ---------- Fines ---------- */}
            <section className="tick-frame animate-fade-in-up [animation-delay:0.12s]">
              <span className="tick-bl" />
              <span className="tick-br" />
              <div className="mb-3 border-b border-rule pb-2.5">
                <span className="mono text-[11px] uppercase tracking-[0.08em] text-navy">Total fines</span>
              </div>
              <p
                className={`mb-1 font-display text-[34px] font-semibold leading-none ${unpaidFines > 0 ? "text-orange" : "text-navy-deep"}`}
              >
                {formatPeso(unpaidFines)}
              </p>
              <p className="mb-0 text-[12.5px] text-ink-soft">
                {totalFines === 0
                  ? "No fines. Keep it up!"
                  : unpaidFines === 0
                    ? `All ${formatPeso(totalFines)} in fines settled.`
                    : `Outstanding, out of ${formatPeso(totalFines)} total. Settle at the SOE office.`}
              </p>
            </section>

            {/* ---------- QR quick link ---------- */}
            <section className="tick-frame animate-fade-in-up [animation-delay:0.16s]">
              <span className="tick-bl" />
              <span className="tick-br" />
              <div className="mb-3 border-b border-rule pb-2.5">
                <span className="mono text-[11px] uppercase tracking-[0.08em] text-navy">Attendance QR</span>
              </div>
              <p className="mb-3 text-[13px] text-ink-soft">
                Lost your printed or saved QR code? Pull it up again from your profile.
              </p>
              <Link href="/profile#qr" className="btn w-full gap-1.5 py-2 text-[13px]">
                <QrIcon />
                Open my QR code
              </Link>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

function QrIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
    </svg>
  );
}
