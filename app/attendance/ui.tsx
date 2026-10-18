// Shared building blocks for the attendance pages (student, scanner and admin).
// No hooks here, so both server and client components can use them.

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { AttendanceMethod, AttendanceStatus, checkInState } from "@/lib/attendance";
import LocalTime from "./LocalTime";
import { CountUp } from "./motion";

export type CheckInState = ReturnType<typeof checkInState>;

/** Faint blueprint grid laid over navy banners. */
export const BLUEPRINT_GRID =
  "[background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:24px_24px]";

/** Text-like inputs inside attendance forms; overrides the global input margin. */
export const FIELD =
  "mb-0 w-full rounded-[5px] border border-rule bg-paper px-3 py-2 text-[13.5px] text-ink shadow-[inset_3px_3px_10px_rgba(28,35,51,0.14)] focus:outline-2 focus:outline-offset-1 focus:outline-blue";

export const FIELD_LABEL = "mono mb-1.5 block text-[10px] tracking-[0.08em] text-ink-soft uppercase";

/** Red ghost button, matching the reject action on User Account Review. */
export const DANGER_BTN =
  "btn ghost rounded-lg border-[#b3261e] text-[#b3261e] hover:bg-[rgba(205,79,60,0.08)]";

type Tone = { label: string; dot: string; text: string; border: string };

const ATTENDANCE_TONES: Record<AttendanceStatus, Tone> = {
  present: { label: "Present", dot: "bg-blue", text: "text-blue", border: "border-blue/40" },
  rejected: { label: "Rejected", dot: "bg-[#b3261e]", text: "text-[#b3261e]", border: "border-[#b3261e]/40" },
};

const CHECK_IN_TONES: Record<CheckInState, Tone> = {
  open: { label: "Check-in open", dot: "bg-orange", text: "text-orange", border: "border-orange/40" },
  upcoming: { label: "Upcoming", dot: "bg-blue", text: "text-blue", border: "border-blue/40" },
  closed: { label: "Closed", dot: "bg-ink-soft", text: "text-ink-soft", border: "border-rule" },
  "not tracked": { label: "Not tracked", dot: "bg-rule", text: "text-ink-soft", border: "border-dashed border-rule" },
};

function Pill({ tone, live = false }: { tone: Tone; live?: boolean }) {
  return (
    <span
      className={`mono inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-paper px-2 py-0.5 text-[10.5px] whitespace-nowrap ${tone.border} ${tone.text}`}
    >
      <span className="relative flex size-1.5">
        {live && <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-75 ${tone.dot}`} />}
        <span className={`relative inline-flex size-1.5 rounded-full ${tone.dot}`} />
      </span>
      {tone.label}
    </span>
  );
}

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  return <Pill tone={ATTENDANCE_TONES[status]} />;
}

export function CheckInBadge({ state }: { state: CheckInState }) {
  return <Pill tone={CHECK_IN_TONES[state]} live={state === "open"} />;
}

export function MethodTag({ method }: { method: AttendanceMethod }) {
  return (
    <span className="mono inline-flex items-center gap-1 rounded bg-vellum-2 px-1.5 py-px text-[10px] text-ink-soft">
      <Icon name={method === "scan" ? "qr" : "pen"} size={10} />
      {method === "scan" ? "QR scan" : "Manual"}
    </span>
  );
}

/** Corner-tick card, the site's recurring structural motif. */
export function Frame({
  className = "",
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <section className={`tick-frame ${className}`} style={style}>
      <span className="tick-bl" />
      <span className="tick-br" />
      {children}
    </section>
  );
}

/** Title row for a padding-less Frame. */
export function PanelHeader({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule-soft px-5 py-3.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-navy/20 bg-vellum text-navy">
          <Icon name={icon} size={14} />
        </span>
        <h2 className="mb-0 truncate text-[16px]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  back,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="group mono mb-4 inline-flex items-center gap-1.5 text-[11px] text-blue no-underline hover:text-navy"
          >
            <span className="transition-transform duration-150 group-hover:-translate-x-0.5">
              <Icon name="arrowLeft" size={12} />
            </span>
            {back.label}
          </Link>
        )}
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="mb-1 text-[30px] leading-none [overflow-wrap:anywhere]">{title}</h1>
        {description && <p className="mb-0 text-xs text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export type Stat = { label: string; value: ReactNode; dot?: string };

/** Row of big numbers; `columns` is a grid-cols-* class. */
export function StatStrip({ stats, columns = "grid-cols-3" }: { stats: Stat[]; columns?: string }) {
  return (
    <dl className={`grid gap-px bg-rule-soft ${columns}`}>
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0 bg-paper px-4 pt-3 pb-2.5">
          <dt className="mono mb-1 flex items-center gap-1.5 text-[10px] tracking-[0.08em] text-ink-soft uppercase">
            {stat.dot && <span className={`size-1.5 shrink-0 rounded-full ${stat.dot}`} />}
            <span className="truncate">{stat.label}</span>
          </dt>
          <dd className="font-display truncate text-[26px] leading-none font-semibold text-navy-deep tabular-nums">
            {typeof stat.value === "number" ? <CountUp value={stat.value} /> : stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-dashed border-rule bg-vellum text-ink-soft">
        <Icon name={icon} size={20} />
      </span>
      <div className="max-w-[340px]">
        <p className="mono mb-1 text-[11px] tracking-[0.06em] text-ink-soft">{title}</p>
        {children && <div className="text-[13px] text-ink-soft">{children}</div>}
      </div>
    </div>
  );
}

/** Tear-off calendar chip for an event's date. */
export function DateChip({ value }: { value: string }) {
  return (
    <span className="flex w-12 shrink-0 flex-col overflow-hidden rounded-md border border-navy bg-paper text-center shadow-[2px_2px_0_var(--rule-soft)]">
      <span className="mono bg-navy py-0.5 text-[9.5px] tracking-[0.1em] text-paper uppercase">
        <LocalTime value={value} format="month" />
      </span>
      <span className="font-display py-1.5 text-[19px] leading-none font-semibold text-navy-deep">
        <LocalTime value={value} format="day" />
      </span>
    </span>
  );
}

export function Initials({ first, last }: { first: string | null; last: string | null }) {
  return <>{`${first?.charAt(0) ?? ""}${last?.charAt(0) ?? ""}`.toUpperCase() || "?"}</>;
}

/**
 * Who a confirmation dialog is about, drawn like the applicant card on User Account Review.
 * `mark` puts a small badge on the avatar, e.g. a red trash can for a delete.
 */
export function PersonChip({
  first,
  last,
  detail,
  aside,
  mark,
}: {
  first: string | null;
  last: string | null;
  detail: ReactNode;
  aside?: ReactNode;
  mark?: { icon: IconName; color: string };
}) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-lg border border-rule-soft bg-vellum/40 px-3 py-2.5">
      <span className="mono relative flex size-10 shrink-0 items-center justify-center rounded-full border border-navy bg-vellum text-[12px] font-semibold text-navy-deep">
        <Initials first={first} last={last} />
        {mark && (
          <span
            className={`absolute -right-1 -bottom-1 flex size-[18px] items-center justify-center rounded-full border-2 border-paper text-paper ${mark.color}`}
          >
            <Icon name={mark.icon} size={9} />
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-0 truncate text-[14px] font-semibold text-navy-deep">
          {`${first ?? ""} ${last ?? ""}`.trim() || "Unnamed student"}
        </p>
        <p className="mono mb-0 truncate text-[11px] text-ink-soft">{detail}</p>
      </div>
      {aside}
    </div>
  );
}

/** SVG paths (24×24) by name; also passed to ConfirmDialog's `icon`. */
export const ICON_PATHS = {
  qr: (
    <>
      <rect width="5" height="5" x="3" y="3" rx="1" />
      <rect width="5" height="5" x="16" y="3" rx="1" />
      <rect width="5" height="5" x="3" y="16" rx="1" />
      <path d="M21 16h-3a2 2 0 0 0-2 2v3M21 21v.01M12 7v3a2 2 0 0 1-2 2H7M3 12h.01M12 3h.01M12 16v.01M16 12h1M21 12v.01M12 21v-1" />
    </>
  ),
  scan: <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" />,
  camera: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  cameraOff: (
    <path d="m2 2 20 20M7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16M9.5 4h5L17 7h3a2 2 0 0 1 2 2v7.5M14.12 15.12a3 3 0 1 1-4.24-4.24" />
  ),
  calendar: (
    <>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  history: <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2" />,
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  user: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  plus: <path d="M12 5v14M5 12h14" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
  download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  arrowLeft: <path d="M19 12H5M12 19l-7-7 7-7" />,
  arrowRight: <path d="M5 12h14M12 5l7 7-7 7" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  sliders: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  trash: <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />,
  mail: (
    <>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  pen: <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />,
  userX: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="m17 8 5 5M22 8l-5 5" />
    </>
  ),
  userCheck: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="m16 11 2 2 4-4" />
    </>
  ),
  id: (
    <>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <circle cx="8" cy="12" r="2" />
      <path d="M14 10h4M14 14h4" />
    </>
  ),
  cap: (
    <>
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
