// No "use client": page.tsx imports COUNTDOWN_DAYS on the server. The component
// itself renders on the client as part of HomeContent.

import Image from "next/image";
import Link from "next/link";
import type { CalendarEntry, Celebrant } from "@/app/calendar/CalendarContent";
import { MONTH_NAMES, formatISODate } from "@/lib/dates";

// How far ahead the countdown looks, counting today.
export const COUNTDOWN_DAYS = 7;

export type UpcomingEntry = CalendarEntry & {
  // 0 = today.
  daysAway: number;
};

function whenLabel(daysAway: number) {
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  return `In ${daysAway} days`;
}

export default function HomeSidebar({
  today,
  birthdaysToday,
  upcoming,
}: {
  // YYYY-MM-DD in school time.
  today: string;
  birthdaysToday: Celebrant[];
  // Soonest first.
  upcoming: UpcomingEntry[];
}) {
  const [next, ...later] = upcoming;
  const monthName = MONTH_NAMES[Number(today.slice(5, 7)) - 1];
  const linkClass = "mt-4 inline-block font-mono text-[11px] text-blue hover:text-navy hover:underline";

  return (
    <>
      <div className="sideBlock tick-frame">
        <span className="tick-bl"></span>
        <span className="tick-br"></span>
        <div className="sectionHead">
          <span className="mono sectionLabel">01 — Birthdays today</span>
          <span className="mono sectionMeta">{formatISODate(today, { month: "short", day: "numeric" })}</span>
        </div>

        {birthdaysToday.length === 0 ? (
          <p className="mb-0 pt-4 pb-1 text-[13px] text-ink-soft">No birthdays today.</p>
        ) : (
          <>
            <ul className="list-none">
              {birthdaysToday.map((c) => (
                <li key={c.id} className="flex items-center gap-3 border-b border-rule-soft py-2.5 last:border-b-0">
                  {c.avatarUrl ? (
                    <Image
                      src={c.avatarUrl}
                      alt=""
                      width={34}
                      height={34}
                      className="size-[34px] shrink-0 rounded-full border border-navy-tint object-cover"
                    />
                  ) : (
                    <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full border border-navy-tint bg-blue font-display text-[12px] font-semibold text-paper">
                      {c.initials}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{c.name}</span>
                  <span className="shrink-0 text-[#b8860b]" aria-hidden>
                    <CakeIcon />
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 mb-0 text-[12.5px] text-ink-soft">Happy birthday from the SOE council!</p>
          </>
        )}

        <Link href="/calendar" transitionTypes={["nav-forward"]} className={linkClass}>
          All {monthName} birthdays →
        </Link>
      </div>

      <div className="sideBlock tick-frame">
        <span className="tick-bl"></span>
        <span className="tick-br"></span>
        <div className="sectionHead">
          <span className="mono sectionLabel">02 — Countdown</span>
          <span className="mono sectionMeta">Next {COUNTDOWN_DAYS} days</span>
        </div>

        {!next ? (
          <p className="mb-0 pt-4 pb-1 text-[13px] text-ink-soft">
            Nothing on the calendar for the next {COUNTDOWN_DAYS} days.
          </p>
        ) : (
          <>
            <div className="pt-4">
              {next.daysAway === 0 ? (
                <span className="font-display text-[34px] font-semibold leading-none text-orange">TODAY</span>
              ) : (
                <span className="flex items-baseline gap-2">
                  <span className="font-display text-[44px] font-semibold leading-none text-navy-deep">
                    {next.daysAway}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-soft">
                    {next.daysAway === 1 ? "day" : "days"} to go
                  </span>
                </span>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <strong className="text-[15px] font-semibold text-ink [overflow-wrap:anywhere]">{next.name}</strong>
                {next.kind === "holiday" && <span className="tag orange">HOLIDAY</span>}
              </div>
              <span className="font-mono text-[12px] text-ink-soft">
                {formatISODate(next.date, { weekday: "long", month: "short", day: "numeric" })}
              </span>
            </div>

            {later.length > 0 && (
              <ul className="mt-3 list-none border-t border-dashed border-rule pt-1">
                {later.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2.5 py-1.5">
                    <span
                      className={`size-2 shrink-0 rounded-full ${entry.kind === "holiday" ? "bg-orange" : "bg-navy"}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{entry.name}</span>
                    <span className="shrink-0 font-mono text-[11px] text-ink-soft">{whenLabel(entry.daysAway)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <Link
          // The month of the next entry, which may already be next month.
          href={next ? `/calendar?month=${next.date.slice(0, 7)}` : "/calendar"}
          transitionTypes={["nav-forward"]}
          className={linkClass}
        >
          Open calendar →
        </Link>
      </div>
    </>
  );
}

function CakeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1M2 21h20M7 8v3M12 8v3M17 8v3M7 4h.01M12 4h.01M17 4h.01" />
    </svg>
  );
}
