// Placeholders shaped like the real page, shown by each route's loading.tsx while its data
// loads. No hooks here, so server and client components can both use them.
import type { CSSProperties, ReactNode } from "react";

/** A shimmering block; give it a size with utility classes. `dark` is for navy backgrounds. */
export function Skeleton({
  className = "",
  style,
  dark = false,
}: {
  className?: string;
  style?: CSSProperties;
  dark?: boolean;
}) {
  return <span aria-hidden="true" className={`skeleton ${dark ? "on-dark" : ""} ${className}`} style={style} />;
}

/** The page body while it loads. Tells screen readers what's coming instead of reading out empty boxes. */
export function SkeletonPage({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="page-wrap animate-fade-in" role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Corner-tick card, like Frame in app/attendance/ui.tsx. */
export function SkeletonFrame({ className = "", children }: { className?: string; children?: ReactNode }) {
  return (
    <div className={`tick-frame ${className}`}>
      <span className="tick-bl" />
      <span className="tick-br" />
      {children}
    </div>
  );
}

/** Lines of body text; the last one stops short like a real paragraph. */
export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={`h-3 ${index === lines - 1 && lines > 1 ? "w-3/5" : "w-full"}`} />
      ))}
    </div>
  );
}

/** Matches PageHeader in app/attendance/ui.tsx: optional back link, eyebrow, title, description, buttons. */
export function SkeletonPageHeader({
  back = false,
  title = "w-64",
  actions = 0,
}: {
  back?: boolean;
  /** Width class for the title bar. */
  title?: string;
  /** How many buttons sit on the right. */
  actions?: number;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="min-w-0 flex-1">
        {back && <Skeleton className="mb-4 h-3 w-28" />}
        <Skeleton className="mb-2.5 h-3 w-48" />
        <Skeleton className={`mb-2 h-[var(--fs-section)] max-w-full ${title}`} />
        <Skeleton className="h-3 w-full max-w-md" />
      </div>
      {actions > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: actions }, (_, index) => (
            <Skeleton key={index} className="h-[38px] w-36 rounded-lg" />
          ))}
        </div>
      )}
    </div>
  );
}

/** The big hero on Home, Calendar and Suggestions: eyebrow, display title, date rule. */
export function SkeletonHero({ title = "w-80", className = "" }: { title?: string; className?: string }) {
  return (
    <div className={className}>
      <Skeleton className="mb-2.5 h-3 w-52" />
      <Skeleton className={`h-[var(--fs-display)] max-w-full ${title}`} />
      <div className="mt-3.5 flex items-center gap-3.5">
        <Skeleton className="h-3 w-56" />
        <span className="flex-1 border-t border-rule" />
      </div>
    </div>
  );
}

/** Title row of a padding-less frame, like PanelHeader in app/attendance/ui.tsx. */
export function SkeletonPanelHeader({ meta = true }: { meta?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-rule-soft px-5 py-3.5">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="h-4 w-32" />
      </div>
      {meta && <Skeleton className="h-3 w-16" />}
    </div>
  );
}

/** Row of big numbers, like StatStrip in app/attendance/ui.tsx. */
export function SkeletonStatStrip({ count = 3, columns = "grid-cols-3" }: { count?: number; columns?: string }) {
  return (
    <div className={`grid gap-px bg-rule-soft ${columns}`}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="bg-paper px-4 pt-3 pb-2.5">
          <Skeleton className="mb-2 h-2.5 w-16" />
          <Skeleton className="h-[var(--fs-stat-sm)] w-10" />
        </div>
      ))}
    </div>
  );
}

/** Event list rows: date chip, name and times, status badge. */
export function SkeletonEventRows({ count = 4 }: { count?: number }) {
  return (
    <ul className="m-0 list-none divide-y divide-rule-soft">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="flex items-center gap-4 px-5 py-3.5">
          <Skeleton className="h-[54px] w-12 shrink-0 rounded-md" />
          <span className="min-w-0 flex-1">
            <Skeleton className="mb-2 h-3.5 w-1/2" />
            <Skeleton className="h-2.5 w-1/3" />
          </span>
          <Skeleton className="h-5 w-24 shrink-0 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

/** Person rows: avatar, name and detail line, optional badge. */
export function SkeletonPeopleRows({ count = 5, badge = true }: { count?: number; badge?: boolean }) {
  return (
    <ul className="m-0 list-none divide-y divide-rule-soft">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <span className="min-w-0 flex-1">
            <Skeleton className="mb-2 h-3 w-2/5" />
            <Skeleton className="h-2.5 w-3/5" />
          </span>
          {badge && <Skeleton className="h-5 w-20 shrink-0 rounded-full" />}
        </li>
      ))}
    </ul>
  );
}

/** One bulletin post: author line, title, body, reaction bar. Used by the Home loader and its feed. */
export function SkeletonPost() {
  return (
    <div className="border border-rule bg-paper px-6 pt-[22px] pb-4">
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <span className="flex-1">
          <Skeleton className="mb-2 h-3 w-36" />
          <Skeleton className="h-2.5 w-24" />
        </span>
      </div>
      <Skeleton className="mb-3 h-5 w-3/5" />
      <SkeletonText lines={3} />
      <div className="mt-5 flex gap-2 border-t border-rule-soft pt-3">
        <Skeleton className="h-7 w-20 rounded-md" />
        <Skeleton className="h-7 w-24 rounded-md" />
      </div>
    </div>
  );
}
