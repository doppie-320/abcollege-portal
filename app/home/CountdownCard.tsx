"use client";

import Link from "next/link";
import css from "styled-jsx/css";
import UpNext, { calendarHref } from "@/app/calendar/UpNext";
import {
  addDays,
  dayOf,
  daysBetween,
  eventStartDay,
  formatEventTime,
  MONTH_NAMES,
  type CalendarEvent,
} from "@/lib/calendar";

type Props = {
  /** Happening now or still to come, soonest first. */
  events: CalendarEvent[];
  today: string;
  /** Called once when the event on the card ends, to load what's next. */
  onExpire: () => void;
};

const MAX_COMING_UP = 3;

/** "Today", "Tomorrow", "in 4d", or "Ongoing" for something that started on an earlier day. */
function startsIn(event: CalendarEvent, today: string): string {
  const days = daysBetween(today, eventStartDay(event));
  if (days < 0) return "Ongoing";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days}d`;
}

export default function CountdownCard({ events, today, onExpire }: Props) {
  const [next, ...rest] = events;
  const comingUp = rest.slice(0, MAX_COMING_UP);
  const weekEnd = addDays(today, 6);
  const thisWeek = events.filter((event) => eventStartDay(event) <= weekEnd).length;

  return (
    <section className="sideBlock tick-frame hcBlock">
      <span className="tick-bl"></span>
      <span className="tick-br"></span>
      <div className="sectionHead">
        <span className="mono sectionLabel">
          <span className="sectionNum">02</span> Countdown
        </span>
        <span className="mono sectionMeta">{thisWeek} this week</span>
      </div>

      <div className="hcSlot">
        <UpNext event={next ?? null} today={today} onEnded={onExpire} />
      </div>

      {comingUp.length > 0 && (
        <div className="hcComing">
          <span className="mono hcComingLabel">Coming up</span>
          <ul>
            {comingUp.map((event, index) => {
              const day = eventStartDay(event);
              return (
                <li key={event.id} style={{ animationDelay: `${150 + index * 60}ms` }}>
                  <Link href={calendarHref(day)} className={`hcRow hcTone-${event.tag.toLowerCase()}`}>
                    <span className="hcRowDate">
                      <span className="mono hcRowMonth">{MONTH_NAMES[Number(day.slice(5, 7)) - 1].slice(0, 3)}</span>
                      <span className="hcRowDay">{dayOf(day)}</span>
                    </span>
                    <span className="hcRowText">
                      <span className="hcRowName">{event.name}</span>
                      <span className="hcRowTime">{formatEventTime(event)}</span>
                    </span>
                    <span className="mono hcRowIn">{startsIn(event, today)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="hcFoot">
        <span className="hcFootNote">{next && comingUp.length === 0 ? "Nothing else lined up yet" : ""}</span>
        <Link href="/calendar" className="hcFootLink">
          Open calendar
          <ArrowIcon />
        </Link>
      </div>

      <style jsx>{styles}</style>
    </section>
  );
}

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

// Global so the classes reach next/link, which styled-jsx scoping skips.
// The hcTone-* colour variables come from UpNext, which this block always renders.
const styles = css.global`
  .hcSlot {
    margin-top: 14px;
  }

  /* ---------- Coming up ---------- */
  .hcComing {
    margin-top: 14px;
  }

  .hcComingLabel {
    display: block;
    margin-bottom: 4px;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .hcComing ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .hcComing li {
    animation: fadeInUp 0.35s ease backwards;
  }

  .hcRow {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 6px;
    margin: 0 -6px;
    border-radius: 6px;
    color: var(--ink);
    text-decoration: none;
    transition: background 0.12s ease;
  }

  .hcRow:hover {
    background: var(--vellum);
  }

  .hcRow:focus-visible {
    outline: 2px solid var(--blue);
    outline-offset: 2px;
  }

  .hcRowDate {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 36px;
    padding: 3px 0;
    border-radius: 5px;
    background: var(--hc-tone-tint, #e1eaf4);
    color: var(--hc-tone, #2e5c8a);
  }

  .hcRowMonth {
    font-size: 8.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .hcRowDay {
    font-family: "Space Grotesk", sans-serif;
    font-size: 15px;
    font-weight: 700;
    line-height: 1;
  }

  .hcRowText {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .hcRowName {
    font-size: 13px;
    font-weight: 500;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .hcRowTime {
    font-size: 11.5px;
    color: var(--ink-soft);
  }

  .hcRowIn {
    flex-shrink: 0;
    font-size: 10.5px;
    color: var(--ink-soft);
  }

  /* ---------- Footer ---------- */
  .hcFoot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px dashed #c9bfa0;
  }

  .hcFootNote {
    font-size: 11.5px;
    color: var(--ink-soft);
  }

  .hcFootLink {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 600;
    color: var(--navy);
    text-decoration: none;
  }

  .hcFootLink svg {
    transition: transform 0.15s ease;
  }

  .hcFootLink:hover svg {
    transform: translateX(3px);
  }

  .hcFootLink:focus-visible {
    outline: 2px solid var(--blue);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .hcComing li {
      animation: none;
    }

    .hcFootLink svg {
      transition: none;
    }
  }
`;
