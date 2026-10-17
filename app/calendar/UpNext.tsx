"use client";

import { useEffect, useState } from "react";
import css from "styled-jsx/css";
import {
  TAG_LABELS,
  eventStartDay,
  formatEventDates,
  formatEventTime,
  type CalendarEvent,
} from "@/lib/calendar";

type Props = {
  /** The event happening now, or the next one to start. */
  event: CalendarEvent | null;
  onSelectDay: (day: string) => void;
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function splitDuration(ms: number) {
  const clamped = Math.max(0, ms);
  return [
    { label: "Days", value: Math.floor(clamped / DAY) },
    { label: "Hrs", value: Math.floor((clamped % DAY) / HOUR) },
    { label: "Min", value: Math.floor((clamped % HOUR) / MINUTE) },
    { label: "Sec", value: Math.floor((clamped % MINUTE) / SECOND) },
  ];
}

export default function UpNext({ event, onSelectDay }: Props) {
  // Null until mounted, so the server and the first browser render agree.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, SECOND);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  if (!event) {
    return (
      <div className="upNext isQuiet">
        <span className="mono upEyebrow">UP NEXT</span>
        <strong className="upName">All quiet for now</strong>
        <span className="upMeta">No upcoming events on the calendar yet.</span>
        <style jsx>{styles}</style>
      </div>
    );
  }

  const start = new Date(event.start).getTime();
  const end = new Date(event.end).getTime();
  const live = now !== null && now >= start && now <= end;
  const target = live ? end : start;
  const units = now === null ? null : splitDuration(target - now);

  return (
    <button
      type="button"
      className={`upNext tone-${event.tag.toLowerCase()}${live ? " isLive" : ""}`}
      onClick={() => onSelectDay(eventStartDay(event))}
    >
      <span className="upTop">
        <span className="mono upEyebrow">
          {live ? (
            <>
              <span className="upLiveDot" aria-hidden="true" />
              HAPPENING NOW
            </>
          ) : (
            "UP NEXT"
          )}
        </span>
        <span className="mono upTag">{TAG_LABELS[event.tag]}</span>
      </span>

      <strong className="upName">{event.name}</strong>
      <span className="upMeta">
        {formatEventDates(event)} · {formatEventTime(event)}
      </span>

      <span className="upCountdown" aria-label={live ? "Time left" : "Starts in"}>
        <span className="mono upCountdownLabel">{live ? "ENDS IN" : "STARTS IN"}</span>
        <span className="upUnits">
          {(units ?? splitDuration(0)).map((unit) => (
            <span key={unit.label} className="upUnit">
              {/* Keyed by value so each change replays the tick animation. */}
              <span key={units ? unit.value : "pending"} className="upValue">
                {units ? String(unit.value).padStart(2, "0") : "--"}
              </span>
              <span className="mono upUnitLabel">{unit.label}</span>
            </span>
          ))}
        </span>
      </span>

      <style jsx>{styles}</style>
    </button>
  );
}

// Shared by the quiet and countdown versions of the card.
const styles = css`
  .upNext {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    padding: 16px 18px 16px;
    border: none;
    border-radius: 10px;
    border-bottom: 3px solid var(--orange);
    background-color: var(--navy);
    background-image:
      radial-gradient(ellipse 260px 160px at 100% 0%, rgba(46, 92, 138, 0.7), transparent 70%),
      linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: auto, 16px 16px, 16px 16px;
    color: var(--white);
    font: inherit;
    text-align: left;
    box-shadow: 4px 4px 0 var(--yellow);
    cursor: pointer;
    transition: transform 0.18s ease, box-shadow 0.18s ease;
    animation: fadeInUp 0.5s ease backwards;
    animation-delay: 0.1s;
  }

  button.upNext:hover {
    transform: translate(-2px, -2px);
    box-shadow: 3px 3px 0 var(--orange), 7px 7px 0 var(--yellow);
  }

  button.upNext:active {
    transform: none;
    box-shadow: 2px 2px 0 var(--yellow);
  }

  button.upNext:focus-visible {
    outline: 2px solid var(--blue);
    outline-offset: 3px;
  }

  .upNext.isQuiet {
    cursor: default;
  }

  .upTop {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .upEyebrow {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 10.5px;
    letter-spacing: 0.12em;
    color: var(--yellow);
  }

  .upLiveDot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #ff6b5b;
    animation: upPulse 1.6s ease-out infinite;
  }

  @keyframes upPulse {
    0% {
      box-shadow: 0 0 0 0 rgba(255, 107, 91, 0.6);
    }
    70%,
    100% {
      box-shadow: 0 0 0 8px rgba(255, 107, 91, 0);
    }
  }

  .upTag {
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 1px 7px;
    border-radius: 3px;
    background: var(--tone-tint, #e1eaf4);
    color: var(--tone, #2e5c8a);
  }

  .upName {
    margin-top: 6px;
    font-family: "Space Grotesk", sans-serif;
    font-size: 21px;
    font-weight: 700;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .upMeta {
    font-size: 12.5px;
    color: #c6d3e5;
  }

  .upCountdown {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed rgba(198, 211, 229, 0.35);
  }

  .upCountdownLabel {
    font-size: 10px;
    letter-spacing: 0.12em;
    color: #c6d3e5;
  }

  .upUnits {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }

  .upUnit {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 0 5px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    overflow: hidden;
  }

  .upValue {
    font-family: "Space Grotesk", sans-serif;
    font-size: 22px;
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
    animation: upTick 0.35s ease backwards;
  }

  @keyframes upTick {
    from {
      transform: translateY(-40%);
      opacity: 0;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }

  .upUnitLabel {
    font-size: 9.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #c6d3e5;
  }

  @media (prefers-reduced-motion: reduce) {
    .upNext,
    .upValue,
    .upLiveDot {
      animation: none;
    }

    .upNext {
      transition: none;
    }
  }
`;
