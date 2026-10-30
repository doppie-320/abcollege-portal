"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import css from "styled-jsx/css";
import {
  TAG_LABELS,
  daysBetween,
  eventStartDay,
  formatEventDates,
  formatEventTime,
  monthKey,
  monthOfDay,
  type CalendarEvent,
} from "@/lib/calendar";

// The countdown card shared by the calendar hero and the home sidebar.

type Props = {
  /** The event happening now, or the next one to start. */
  event: CalendarEvent | null;
  /** "YYYY-MM-DD" in school time, for the "Tomorrow" / "In 3 days" label. */
  today: string;
  /** Stay on the page and pick the event's day. Without it the card links to that month on the calendar. */
  onSelectDay?: (day: string) => void;
  /** Called once when the event on the card ends, so the page can load what's next. */
  onEnded?: () => void;
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

function splitDuration(ms: number) {
  const clamped = Math.max(0, ms);
  return [
    { label: "Days", value: Math.floor(clamped / DAY) },
    { label: "Hrs", value: Math.floor((clamped % DAY) / HOUR) },
    { label: "Min", value: Math.floor((clamped % HOUR) / MINUTE) },
    { label: "Sec", value: Math.floor((clamped % MINUTE) / SECOND) },
  ];
}

export function calendarHref(day: string): string {
  return `/calendar?month=${monthKey(monthOfDay(day))}`;
}

export default function UpNext({ event, today, onSelectDay, onEnded }: Props) {
  // Null until mounted, so the server and the first browser render agree.
  const [now, setNow] = useState<number | null>(null);
  const endedFor = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, SECOND);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const end = event ? new Date(event.end).getTime() : null;
  const ended = now !== null && end !== null && now > end;

  useEffect(() => {
    if (ended && event && endedFor.current !== event.id) {
      endedFor.current = event.id;
      onEnded?.();
    }
  }, [ended, event, onEnded]);

  if (!event) return <Quiet />;

  const start = new Date(event.start).getTime();
  const live = now !== null && now >= start && !ended;
  const remaining = now === null ? null : (live || ended ? end! : start) - now;
  const units = remaining === null ? null : splitDuration(remaining);

  // The fuse burns down over the final week, or across the event while it runs.
  const progress =
    now === null
      ? 0
      : live || ended
        ? Math.min((now - start) / Math.max(end! - start, 1), 1)
        : 1 - Math.min(Math.max((remaining ?? WEEK) / WEEK, 0), 1);
  const percent = Math.round(progress * 100);

  const daysAway = daysBetween(today, eventStartDay(event));
  const when = ended
    ? "THAT'S A WRAP"
    : live
      ? "HAPPENING NOW"
      : daysAway <= 0
        ? "T-MINUS · TODAY"
        : daysAway === 1
          ? "T-MINUS · TOMORROW"
          : `T-MINUS · IN ${daysAway} DAYS`;
  const urgent = !live && !ended && remaining !== null && remaining < HOUR;
  const className = `hcCard hcTone-${event.tag.toLowerCase()}${live ? " isLive" : ""}${urgent ? " isUrgent" : ""}`;

  const body: ReactNode = (
    <>
      <span className="hcGlow" aria-hidden="true" />

      <span className="hcTop">
        <span className="mono hcEyebrow">
          <span className="hcBeacon" aria-hidden="true" />
          {when}
        </span>
        <span className="mono hcTag">{TAG_LABELS[event.tag]}</span>
      </span>

      <strong className="hcName">{event.name}</strong>
      <span className="hcMeta">
        {formatEventDates(event)} · {formatEventTime(event)}
      </span>

      <span className="hcUnits" role="timer" aria-label={live ? "Time left" : "Starts in"}>
        {(units ?? splitDuration(0)).map((unit, i) => (
          <span key={unit.label} className="hcUnitWrap">
            {i > 0 && (
              <span className="hcColon" aria-hidden="true">
                :
              </span>
            )}
            <span className="hcUnit">
              <span className="hcFlap">
                {/* Keyed by value so each change replays the flip. */}
                <span key={units ? unit.value : "pending"} className="hcValue">
                  {units ? String(unit.value).padStart(2, "0") : "--"}
                </span>
              </span>
              <span className="mono hcUnitLabel">{unit.label}</span>
            </span>
          </span>
        ))}
      </span>

      <span className="hcFuse" aria-hidden="true">
        <span className="hcFuseTrack">
          <span className="hcFuseBurn" style={{ width: `${percent}%` }} />
          <span className="hcSpark" style={{ left: `${percent}%` }} />
        </span>
        <span className="mono hcFuseLabels">
          <span>{live || ended ? "STARTED" : remaining !== null && remaining > WEEK ? "OVER A WEEK OUT" : "7 DAYS OUT"}</span>
          <span>{live || ended ? `${percent}% DONE` : "GO TIME"}</span>
        </span>
      </span>

      <style jsx>{styles}</style>
    </>
  );

  return onSelectDay ? (
    <button type="button" className={className} onClick={() => onSelectDay(eventStartDay(event))}>
      {body}
    </button>
  ) : (
    <Link href={calendarHref(eventStartDay(event))} className={className}>
      {body}
    </Link>
  );
}

function Quiet() {
  return (
    <div className="hcCard isQuiet">
      <span className="hcGlow" aria-hidden="true" />
      <span className="mono hcEyebrow">ALL QUIET</span>
      <strong className="hcName">Nothing on the calendar</strong>
      <span className="hcMeta">New events will start counting down here.</span>
      <span className="hcStars" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      <style jsx>{styles}</style>
    </div>
  );
}

// Global so the classes reach next/link, which styled-jsx scoping skips. The hcTone-* classes
// are also used by the home sidebar's "Coming up" list.
const styles = css.global`
  .hcTone-event {
    --hc-tone: #2e5c8a;
    --hc-tone-soft: #7fa6cf;
    --hc-tone-tint: #e1eaf4;
  }

  .hcTone-academic {
    --hc-tone: #2a7468;
    --hc-tone-soft: #6cc2b3;
    --hc-tone-tint: #dcefea;
  }

  .hcTone-deadline {
    --hc-tone: #d9531e;
    --hc-tone-soft: #ff9a6b;
    --hc-tone-tint: #fcebdf;
  }

  .hcTone-holiday {
    --hc-tone: #b3261e;
    --hc-tone-soft: #ff7f74;
    --hc-tone-tint: #fbe6e3;
  }

  .hcCard {
    position: relative;
    overflow: hidden;
    isolation: isolate;
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 100%;
    padding: 16px 16px 14px;
    border: none;
    border-radius: 10px;
    border-bottom: 3px solid var(--hc-tone-soft, var(--orange));
    background-color: var(--navy);
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: 16px 16px;
    color: var(--white);
    font: inherit;
    text-align: left;
    text-decoration: none;
    box-shadow: 0 2px 8px rgba(19, 42, 77, 0.12);
    transition: box-shadow 0.18s ease;
    animation: fadeInUp 0.5s ease backwards;
    animation-delay: 0.1s;
  }

  a.hcCard,
  button.hcCard {
    cursor: pointer;
  }

  a.hcCard:hover,
  button.hcCard:hover {
    box-shadow: 0 6px 18px rgba(19, 42, 77, 0.18);
  }

  a.hcCard:focus-visible,
  button.hcCard:focus-visible {
    outline: 2px solid var(--blue);
    outline-offset: 3px;
  }

  /* A soft wash of the event's colour behind everything. */
  .hcGlow {
    position: absolute;
    inset: -40%;
    z-index: -1;
    background:
      radial-gradient(circle at 70% 30%, var(--hc-tone, #2e5c8a), transparent 38%),
      radial-gradient(circle at 25% 80%, rgba(217, 83, 30, 0.35), transparent 35%);
    opacity: 0.75;
    filter: blur(6px);
  }

  .hcTop {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .hcEyebrow {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 10px;
    letter-spacing: 0.12em;
    color: var(--yellow);
  }

  .hcBeacon {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--yellow);
  }

  /* Only pulses while the event is actually running. */
  .hcCard.isLive .hcBeacon {
    background: #ff6b5b;
    animation: hcBeacon 1.8s ease-out infinite;
  }

  @keyframes hcBeacon {
    0% {
      box-shadow: 0 0 0 0 rgba(255, 107, 91, 0.6);
    }
    70%,
    100% {
      box-shadow: 0 0 0 8px rgba(255, 107, 91, 0);
    }
  }

  .hcTag {
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 1px 7px;
    border-radius: 3px;
    background: var(--hc-tone-tint, #e1eaf4);
    color: var(--hc-tone, #2e5c8a);
    font-weight: 600;
  }

  .hcName {
    margin-top: 6px;
    font-family: "Space Grotesk", sans-serif;
    font-size: 21px;
    font-weight: 700;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .hcMeta {
    font-size: 12.5px;
    color: #c6d3e5;
  }

  /* ---------- Flip tiles ---------- */
  .hcUnits {
    display: flex;
    align-items: flex-start;
    margin-top: 14px;
  }

  .hcUnitWrap {
    display: flex;
    flex: 1;
    min-width: 0;
  }

  .hcColon {
    width: 10px;
    flex-shrink: 0;
    padding-top: 7px;
    text-align: center;
    font-family: "Space Grotesk", sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: rgba(253, 247, 1, 0.7);
  }

  .hcUnit {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    min-width: 0;
    gap: 5px;
  }

  .hcFlap {
    position: relative;
    display: flex;
    justify-content: center;
    width: 100%;
    padding: 6px 0;
    border-radius: 6px;
    background: linear-gradient(#22406b 0 50%, #1a3459 50% 100%);
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow: 0 3px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    perspective: 200px;
    overflow: hidden;
  }

  /* The hinge across the middle of a split-flap tile. */
  .hcFlap::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 1px;
    background: rgba(0, 0, 0, 0.45);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  .hcValue {
    display: block;
    font-family: "Space Grotesk", sans-serif;
    font-size: 24px;
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
    transform-origin: 50% 0%;
    animation: hcFlip 0.3s ease-out backwards;
  }

  @keyframes hcFlip {
    from {
      transform: rotateX(-50deg);
      opacity: 0.4;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }

  .hcUnitLabel {
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #c6d3e5;
  }

  /* Final hour: tiles heat up. */
  .hcCard.isUrgent .hcFlap {
    background: linear-gradient(#c2441a 0 50%, #a93a15 50% 100%);
    border-color: rgba(253, 247, 1, 0.4);
  }

  /* ---------- The fuse ---------- */
  .hcFuse {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 14px;
  }

  .hcFuseTrack {
    position: relative;
    height: 4px;
    border-radius: 2px;
    background: repeating-linear-gradient(90deg, rgba(198, 211, 229, 0.35) 0 6px, transparent 6px 10px);
  }

  .hcFuseBurn {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    border-radius: 2px;
    background: linear-gradient(90deg, rgba(217, 83, 30, 0.2), var(--orange) 60%, var(--yellow));
    transition: width 1s linear;
  }

  .hcSpark {
    position: absolute;
    top: 50%;
    width: 10px;
    height: 10px;
    margin: -5px 0 0 -5px;
    border-radius: 50%;
    background: var(--yellow);
    box-shadow: 0 0 6px 1px rgba(253, 247, 1, 0.55);
    transition: left 1s linear;
  }

  .hcFuseLabels {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    letter-spacing: 0.1em;
    color: #c6d3e5;
  }

  /* ---------- Quiet ---------- */
  .hcCard.isQuiet {
    border-bottom-color: var(--navy-tint);
    cursor: default;
  }

  .hcCard.isQuiet .hcName {
    font-size: 18px;
  }

  .hcStars i {
    position: absolute;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--white);
    animation: hcTwinkle 4s ease-in-out infinite;
  }

  .hcStars i:nth-child(1) { top: 14px; right: 22px; }
  .hcStars i:nth-child(2) { top: 34px; right: 56px; animation-delay: 0.6s; }
  .hcStars i:nth-child(3) { top: 22px; right: 90px; animation-delay: 1.2s; }
  .hcStars i:nth-child(4) { bottom: 18px; right: 30px; animation-delay: 0.3s; }
  .hcStars i:nth-child(5) { bottom: 28px; right: 74px; animation-delay: 1.6s; }

  @keyframes hcTwinkle {
    0%,
    100% {
      opacity: 0.2;
    }
    50% {
      opacity: 0.8;
    }
  }

  @media (max-width: 640px) {
    .hcName {
      font-size: 19px;
    }

    .hcCard.isQuiet .hcName {
      font-size: 16px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hcCard,
    .hcCard.isLive .hcBeacon,
    .hcValue,
    .hcStars i {
      animation: none;
    }

    .hcCard,
    .hcFuseBurn,
    .hcSpark {
      transition: none;
    }
  }
`;
