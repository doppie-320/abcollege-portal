"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import css from "styled-jsx/css";
import { CakeIcon } from "@/app/calendar/BirthdayPanel";
import {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  daysBetween,
  formatShortDay,
  monthKey,
  monthOfDay,
  shiftMonth,
  weekdayOf,
  type UpcomingBirthday,
} from "@/lib/calendar";

type Props = {
  /** Today onward through next month, soonest first, hidden ones already left out. */
  birthdays: UpcomingBirthday[];
  today: string;
  currentUserId: string;
};

const CONFETTI_COLORS = ["#fdf701", "#fbfaf6", "#2e5c8a", "#ffb37a", "#7fd1c1"];

// Fixed positions so server and browser render the same confetti rain.
const RAIN = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 37 + 7) % 100}%`,
  delay: `${((i * 0.31) % 2.6).toFixed(2)}s`,
  duration: `${(2.6 + (i % 4) * 0.5).toFixed(2)}s`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  tilt: `${(i * 47) % 360}deg`,
  round: i % 3 === 0,
}));

type Burst = {
  id: number;
  x: number;
  y: number;
  pieces: { dx: number; dy: number; spin: number; color: string; round: boolean; delay: number }[];
};

const BURST_PIECES = 34;
/** Matches the hbBurst animation length. */
const BURST_MS = 1300;
const MAX_UPCOMING = 3;

function firstName(name: string): string {
  return name.split(" ")[0] || name;
}

/** "Ana", "Ana & Ben", "Ana, Ben & Cy", "Ana, Ben & 3 others". */
function joinNames(names: string[]): string {
  if (names.length <= 2) return names.join(" & ");
  if (names.length === 3) return `${names[0]}, ${names[1]} & ${names[2]}`;
  return `${names[0]}, ${names[1]} & ${names.length - 2} others`;
}

function calendarHref(day: string): string {
  return `/calendar?month=${monthKey(monthOfDay(day))}`;
}

function inDays(days: number): string {
  return days === 1 ? "Tomorrow" : `in ${days}d`;
}

export default function BirthdaysCard({ birthdays, today, currentUserId }: Props) {
  const todays = birthdays.filter((birthday) => birthday.date === today);
  const upcoming = birthdays.filter((birthday) => birthday.date > today);
  const nextMonthName = MONTH_NAMES[shiftMonth(monthOfDay(today), 1).month - 1];

  return (
    <section className="sideBlock tick-frame hbBlock">
      <span className="tick-bl"></span>
      <span className="tick-br"></span>
      <div className="sectionHead">
        <span className="mono sectionLabel">
          <span className="sectionNum">01</span> Birthdays
        </span>
        {todays.length > 0 ? (
          <span className="mono hbTodayChip">
            <span className="hbTodayDot" aria-hidden="true" />
            TODAY
          </span>
        ) : (
          <span className="mono sectionMeta">{upcoming.length} coming up</span>
        )}
      </div>

      {todays.length > 0 ? (
        <>
          <PartyBanner celebrants={todays} currentUserId={currentUserId} />
          {upcoming.length > 0 && <UpcomingList birthdays={upcoming.slice(0, 2)} today={today} label="Next up" />}
        </>
      ) : upcoming.length > 0 ? (
        <>
          <Spotlight birthdays={upcoming} today={today} />
          <UpcomingList
            birthdays={upcoming.filter((birthday) => birthday.date !== upcoming[0].date).slice(0, MAX_UPCOMING)}
            today={today}
            label="After that"
          />
        </>
      ) : (
        <p className="hbEmpty">
          <span className="hbEmptyIcon">
            <CakeIcon size={14} />
          </span>
          No birthdays between now and the end of {nextMonthName}.
        </p>
      )}

      <style jsx>{styles}</style>
    </section>
  );
}

function PartyBanner({ celebrants, currentUserId }: { celebrants: UpcomingBirthday[]; currentUserId: string }) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [cheers, setCheers] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const mine = celebrants.find((celebrant) => celebrant.id === currentUserId);
  const others = celebrants.filter((celebrant) => celebrant.id !== currentUserId).map((c) => firstName(c.name));

  const greeting = mine ? `Happy birthday, ${firstName(mine.name)}!` : `Happy birthday, ${joinNames(others)}!`;
  const subline = mine
    ? others.length
      ? `You share the day with ${joinNames(others)}. Double the cake.`
      : "The whole SOE is cheering for you today."
    : celebrants.length > 1
      ? `${celebrants.length} celebrants today. Make some noise!`
      : "Make some noise for them!";

  function cheer(event: MouseEvent<HTMLButtonElement>) {
    const banner = bannerRef.current;
    if (!banner) return;
    const box = banner.getBoundingClientRect();
    const button = event.currentTarget.getBoundingClientRect();
    const id = Date.now() + Math.random();

    const burst: Burst = {
      id,
      x: button.left + button.width / 2 - box.left,
      y: button.top + button.height / 2 - box.top,
      pieces: Array.from({ length: BURST_PIECES }, (_, i) => {
        // Mostly upward, fanned out, so it reads as a popper going off.
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
        const distance = 70 + Math.random() * 90;
        return {
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          spin: (Math.random() - 0.5) * 900,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          round: i % 3 === 0,
          delay: Math.random() * 60,
        };
      }),
    };

    setBursts((current) => [...current, burst]);
    setCheers((count) => count + 1);
    timers.current.push(setTimeout(() => setBursts((current) => current.filter((b) => b.id !== id)), BURST_MS));
  }

  const shown = celebrants.slice(0, 4);

  return (
    <div ref={bannerRef} className={`hbParty${mine ? " isMine" : ""}`} role="status">
      <span className="hbRain" aria-hidden="true">
        {RAIN.map((piece, i) => (
          <i
            key={i}
            className={piece.round ? "isRound" : undefined}
            style={
              {
                left: piece.left,
                background: piece.color,
                animationDelay: piece.delay,
                animationDuration: piece.duration,
                "--tilt": piece.tilt,
              } as CSSProperties
            }
          />
        ))}
      </span>

      <span className="hbBalloons" aria-hidden="true">
        <Balloon color="#fdf701" className="b1" />
        <Balloon color="#2e5c8a" className="b2" />
        <Balloon color="#fbfaf6" className="b3" />
      </span>

      <div className="hbStack">
        {shown.map((celebrant, i) => (
          <span key={celebrant.id} className="hbStackItem" style={{ zIndex: shown.length - i }}>
            {i === 0 && <PartyHat />}
            <Avatar celebrant={celebrant} size={44} />
          </span>
        ))}
        {celebrants.length > shown.length && (
          <span className="hbStackItem hbStackMore">+{celebrants.length - shown.length}</span>
        )}
      </div>

      <span className="mono hbEyebrow">
        <CakeIcon size={12} />
        {mine ? "IT'S YOUR DAY" : "BIRTHDAY TODAY"}
      </span>
      <strong className="hbGreeting">{greeting}</strong>
      <span className="hbSub">{subline}</span>

      <button type="button" className="hbCheer" onClick={cheer}>
        <PopperIcon />
        {cheers === 0 ? "Celebrate" : `Cheers ×${cheers}`}
      </button>

      {bursts.map((burst) => (
        <span key={burst.id} className="hbBurst" style={{ left: burst.x, top: burst.y }} aria-hidden="true">
          {burst.pieces.map((piece, i) => (
            <i
              key={i}
              className={piece.round ? "isRound" : undefined}
              style={
                {
                  background: piece.color,
                  animationDelay: `${piece.delay}ms`,
                  "--dx": `${piece.dx}px`,
                  "--dy": `${piece.dy}px`,
                  "--spin": `${piece.spin}deg`,
                } as CSSProperties
              }
            />
          ))}
        </span>
      ))}
    </div>
  );
}

function Spotlight({ birthdays, today }: { birthdays: UpcomingBirthday[]; today: string }) {
  const date = birthdays[0].date;
  const group = birthdays.filter((birthday) => birthday.date === date);
  const days = daysBetween(today, date);
  const weekday = WEEKDAY_NAMES[weekdayOf(date)];

  return (
    <Link href={calendarHref(date)} className="hbSpot">
      <span className="hbSpotAvatars">
        {group.slice(0, 2).map((celebrant, i) => (
          <span key={celebrant.id} className={`hbSpotRing${i > 0 ? " isSecond" : ""}`}>
            <Avatar celebrant={celebrant} size={38} />
          </span>
        ))}
      </span>

      <span className="hbSpotText">
        <span className="mono hbSpotEyebrow">{days === 1 ? "TOMORROW" : "NEXT BIRTHDAY"}</span>
        <strong className="hbSpotName">{joinNames(group.map((celebrant) => firstName(celebrant.name)))}</strong>
        <span className="hbSpotDate">
          {weekday}, {formatShortDay(date)}
        </span>
      </span>

      <span className="hbSpotCount" aria-label={`${days} day${days === 1 ? "" : "s"} to go`}>
        <span className="hbSpotNum">{days}</span>
        <span className="mono hbSpotUnit">{days === 1 ? "DAY" : "DAYS"}</span>
      </span>
    </Link>
  );
}

function UpcomingList({ birthdays, today, label }: { birthdays: UpcomingBirthday[]; today: string; label: string }) {
  if (birthdays.length === 0) return null;

  return (
    <div className="hbUpcoming">
      <span className="mono hbUpcomingLabel">{label}</span>
      <ul>
        {birthdays.map((birthday, index) => (
          <li key={birthday.id} style={{ animationDelay: `${120 + index * 60}ms` }}>
            <Link href={calendarHref(birthday.date)} className="hbRow">
              <Avatar celebrant={birthday} size={28} />
              <span className="hbRowName">{birthday.name}</span>
              <span className="mono hbRowDate">{formatShortDay(birthday.date).toUpperCase()}</span>
              <span className="mono hbRowIn">{inDays(daysBetween(today, birthday.date))}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Avatar({ celebrant, size }: { celebrant: UpcomingBirthday; size: number }) {
  return celebrant.avatarUrl ? (
    <Image
      src={celebrant.avatarUrl}
      alt=""
      width={size}
      height={size}
      className="hbAvatar"
      style={{ width: size, height: size }}
    />
  ) : (
    <span className="hbAvatar hbInitials" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {celebrant.initials}
    </span>
  );
}

function Balloon({ color, className }: { color: string; className: string }) {
  return (
    <svg className={`hbBalloon ${className}`} width="22" height="40" viewBox="0 0 22 40">
      <path d="M11 30c0 3-2 4-1 6s-1 3-1 4" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
      <ellipse cx="11" cy="13" rx="10" ry="12.5" fill={color} />
      <path d="M9.5 25.5h3L11 28z" fill={color} />
      <ellipse cx="7.5" cy="8.5" rx="2.4" ry="3.6" fill="rgba(255,255,255,0.45)" transform="rotate(-20 7.5 8.5)" />
    </svg>
  );
}

function PartyHat() {
  return (
    <svg className="hbHat" width="22" height="24" viewBox="0 0 22 24" aria-hidden="true">
      <path d="M11 3 20 22H2z" fill="#fdf701" stroke="#132a4d" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6.3 13.5 15.2 11M4.3 18 17.6 15.2" stroke="#d9531e" strokeWidth="2" strokeLinecap="round" />
      <circle cx="11" cy="3" r="2.6" fill="#d9531e" stroke="#132a4d" strokeWidth="1.2" />
    </svg>
  );
}

function PopperIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5.8 11.3 2 22l10.7-3.8" />
      <path d="M4 3h.01M22 8h.01M15 2h.01M22 20h.01" />
      <path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10" />
      <path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11-.11.7-.72 1.22-1.43 1.22H17" />
      <path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98-.7.1-1.22.72-1.22 1.43V7" />
      <path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z" />
    </svg>
  );
}

// Global so the classes reach next/link and next/image, which styled-jsx scoping skips.
const styles = css.global`
  /* ---------- Header ---------- */
  .hbTodayChip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    letter-spacing: 0.1em;
    padding: 2px 8px;
    border-radius: 999px;
    background: #f7e3ee;
    color: #a8427a;
    font-weight: 600;
  }

  .hbTodayDot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #a8427a;
    animation: hbPing 1.6s ease-out infinite;
  }

  @keyframes hbPing {
    0% {
      box-shadow: 0 0 0 0 rgba(168, 66, 122, 0.55);
    }
    70%,
    100% {
      box-shadow: 0 0 0 7px rgba(168, 66, 122, 0);
    }
  }

  /* ---------- Shared avatar ---------- */
  .hbAvatar {
    display: block;
    flex-shrink: 0;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--white);
    background: var(--blue);
  }

  .hbInitials {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--white);
    font-family: "Space Grotesk", sans-serif;
    font-weight: 700;
  }

  /* ---------- Today: the party banner ---------- */
  .hbParty {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    margin-top: 14px;
    padding: 18px 16px 16px;
    border-radius: 10px;
    background:
      radial-gradient(circle at 85% 15%, rgba(253, 247, 1, 0.28), transparent 45%),
      radial-gradient(circle at 0% 100%, rgba(46, 92, 138, 0.45), transparent 55%),
      linear-gradient(135deg, #a8427a 0%, #c24a4f 55%, #d9531e 100%);
    color: var(--white);
    box-shadow: 0 2px 8px rgba(19, 42, 77, 0.12);
    animation: fadeInUp 0.45s ease backwards;
  }

  .hbParty.isMine {
    background:
      radial-gradient(circle at 85% 15%, rgba(253, 247, 1, 0.4), transparent 50%),
      radial-gradient(circle at 0% 100%, rgba(168, 66, 122, 0.6), transparent 55%),
      linear-gradient(135deg, #d9531e 0%, #e0782a 50%, #a8427a 100%);
  }

  .hbRain {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .hbRain i {
    position: absolute;
    top: -12px;
    width: 6px;
    height: 10px;
    border-radius: 1px;
    animation-name: hbFall;
    animation-timing-function: linear;
    animation-iteration-count: 2;
    animation-fill-mode: backwards;
  }

  .hbRain i.isRound,
  .hbBurst i.isRound {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  @keyframes hbFall {
    from {
      transform: translateY(0) rotate(var(--tilt));
      opacity: 0.95;
    }
    to {
      transform: translateY(240px) rotate(calc(var(--tilt) + 600deg));
      opacity: 0;
    }
  }

  .hbBalloons {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 70px;
    height: 70px;
    pointer-events: none;
  }

  .hbBalloon {
    position: absolute;
    filter: drop-shadow(0 2px 3px rgba(19, 42, 77, 0.25));
    transform-origin: 50% 100%;
    animation: hbBob 5s ease-in-out infinite;
  }

  .hbBalloon.b1 {
    right: 30px;
    top: 6px;
  }

  .hbBalloon.b2 {
    right: 12px;
    top: 0;
    animation-delay: -1.6s;
    animation-duration: 5.6s;
  }

  .hbBalloon.b3 {
    right: -2px;
    top: 14px;
    animation-delay: -3.2s;
    animation-duration: 5.3s;
  }

  @keyframes hbBob {
    0%,
    100% {
      transform: translateY(0) rotate(-3deg);
    }
    50% {
      transform: translateY(-3px) rotate(3deg);
    }
  }

  .hbStack {
    position: relative;
    display: flex;
    align-items: center;
    padding-top: 10px;
    margin-bottom: 10px;
  }

  .hbStackItem {
    position: relative;
    display: flex;
    border-radius: 50%;
    box-shadow: 0 0 0 2px rgba(19, 42, 77, 0.25);
    animation: fadeIn 0.4s ease backwards;
  }

  .hbStackItem + .hbStackItem {
    margin-left: -12px;
  }

  .hbStackItem:nth-child(2) {
    animation-delay: 0.08s;
  }

  .hbStackItem:nth-child(3) {
    animation-delay: 0.16s;
  }

  .hbStackItem:nth-child(4) {
    animation-delay: 0.24s;
  }

  .hbStackMore {
    width: 44px;
    height: 44px;
    align-items: center;
    justify-content: center;
    background: var(--navy);
    border: 2px solid var(--white);
    font-family: "Space Grotesk", sans-serif;
    font-size: 13px;
    font-weight: 700;
  }

  .hbHat {
    position: absolute;
    top: -15px;
    left: -5px;
    z-index: 2;
    transform: rotate(-22deg);
  }

  .hbEyebrow {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    letter-spacing: 0.14em;
    color: var(--yellow);
  }

  .hbGreeting {
    position: relative;
    max-width: 100%;
    font-family: "Space Grotesk", sans-serif;
    font-size: 22px;
    font-weight: 700;
    line-height: 1.15;
    overflow-wrap: anywhere;
    text-shadow: 0 1px 3px rgba(19, 42, 77, 0.3);
  }

  .hbSub {
    position: relative;
    font-size: 12.5px;
    color: rgba(251, 250, 246, 0.88);
  }

  .hbCheer {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-top: 12px;
    padding: 7px 13px;
    border: none;
    border-radius: 999px;
    background: var(--yellow);
    color: var(--navy);
    font: inherit;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(19, 42, 77, 0.25);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .hbCheer:hover {
    box-shadow: 0 4px 12px rgba(19, 42, 77, 0.3);
  }

  .hbCheer:active {
    transform: scale(0.97);
  }

  .hbCheer:focus-visible {
    outline: 2px solid var(--white);
    outline-offset: 2px;
  }

  .hbBurst {
    position: absolute;
    width: 0;
    height: 0;
    pointer-events: none;
    z-index: 3;
  }

  .hbBurst i {
    position: absolute;
    left: -3px;
    top: -4px;
    width: 6px;
    height: 9px;
    border-radius: 1px;
    animation: hbBurst 1.3s cubic-bezier(0.15, 0.7, 0.35, 1) backwards;
  }

  @keyframes hbBurst {
    0% {
      transform: translate(0, 0) rotate(0) scale(0.6);
      opacity: 1;
    }
    60% {
      opacity: 1;
    }
    100% {
      /* Overshoot past the fan, then gravity pulls it back down. */
      transform: translate(var(--dx), calc(var(--dy) + 60px)) rotate(var(--spin)) scale(1);
      opacity: 0;
    }
  }

  /* ---------- No birthday today: next-up spotlight ---------- */
  .hbSpot {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 14px;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid var(--rule-soft);
    background: var(--white);
    color: var(--ink);
    text-decoration: none;
    box-shadow: 0 1px 3px rgba(19, 42, 77, 0.08);
    transition: box-shadow 0.18s ease, border-color 0.18s ease;
    animation: fadeInUp 0.45s ease backwards;
  }

  .hbSpot:hover {
    border-color: #c9bfa0;
    box-shadow: 0 4px 12px rgba(19, 42, 77, 0.12);
  }

  .hbSpot:focus-visible,
  .hbRow:focus-visible {
    outline: 2px solid var(--blue);
    outline-offset: 2px;
  }

  .hbSpotAvatars {
    display: flex;
    flex-shrink: 0;
  }

  .hbSpotRing {
    display: flex;
    border-radius: 50%;
  }

  .hbSpotRing .hbAvatar {
    border-width: 1px;
    border-color: var(--navy-tint);
  }

  .hbSpotRing.isSecond {
    margin-left: -12px;
  }

  .hbSpotRing.isSecond .hbAvatar {
    border: 2px solid var(--white);
  }

  .hbSpotText {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .hbSpotEyebrow {
    font-size: 9.5px;
    letter-spacing: 0.1em;
    color: var(--ink-soft);
  }

  .hbSpotName {
    font-family: "Space Grotesk", sans-serif;
    font-size: 15px;
    line-height: 1.2;
    color: var(--navy);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .hbSpotDate {
    font-size: 12px;
    color: var(--ink-soft);
  }

  .hbSpotCount {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    flex-shrink: 0;
    padding-left: 12px;
    border-left: 1px solid var(--rule-soft);
  }

  .hbSpotNum {
    font-family: "Space Grotesk", sans-serif;
    font-size: 20px;
    font-weight: 700;
    line-height: 1;
    color: #a8427a;
    font-variant-numeric: tabular-nums;
  }

  .hbSpotUnit {
    margin-top: 3px;
    font-size: 9px;
    letter-spacing: 0.1em;
    color: var(--ink-soft);
  }

  /* ---------- Upcoming list ---------- */
  .hbUpcoming {
    margin-top: 14px;
  }

  .hbUpcomingLabel {
    display: block;
    margin-bottom: 4px;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .hbUpcoming ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .hbUpcoming li {
    animation: fadeInUp 0.35s ease backwards;
  }

  .hbRow {
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

  .hbRow:hover {
    background: var(--vellum);
  }

  .hbRow .hbAvatar {
    border-width: 1px;
    border-color: var(--navy-tint);
  }

  .hbRowName {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 500;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .hbRowDate {
    flex-shrink: 0;
    font-size: 10px;
    letter-spacing: 0.04em;
    padding: 1px 6px;
    border-radius: 3px;
    background: #f7e3ee;
    color: #a8427a;
  }

  .hbRowIn {
    flex-shrink: 0;
    width: 58px;
    text-align: right;
    font-size: 10.5px;
    color: var(--ink-soft);
  }

  /* ---------- Empty ---------- */
  .hbEmpty {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 14px 0 0;
    font-size: 12.5px;
    color: var(--ink-soft);
  }

  .hbEmptyIcon {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1px dashed #c9bfa0;
    background: var(--vellum);
    color: #a8427a;
  }

  @media (max-width: 640px) {
    .hbGreeting {
      font-size: 19px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hbRain,
    .hbBurst {
      display: none;
    }

    .hbParty,
    .hbBalloon,
    .hbStackItem,
    .hbSpot,
    .hbTodayDot,
    .hbUpcoming li {
      animation: none;
    }
  }
`;
