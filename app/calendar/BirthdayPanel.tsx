"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { formatShortDay, type Celebrant } from "@/lib/calendar";

type Props = {
  /** Already includes any visibility change still being saved. */
  celebrants: Celebrant[];
  /** Day key each celebrant is celebrated on this month (Feb 29 → 28 in common years). */
  dayOf: (celebrant: Celebrant) => string;
  today: string;
  monthName: string;
  currentUserId: string;
  isAdmin: boolean;
  saving: boolean;
  error: string;
  onSelectDay: (day: string) => void;
  onChangeVisibility: (userIds: string[], visible: boolean) => void;
};

const CONFETTI_COLORS = ["#d9531e", "#fdf701", "#2e5c8a", "#a8427a", "#2a7468"];

// Fixed positions so server and browser render the same confetti.
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  delay: `${((i * 0.29) % 2.2).toFixed(2)}s`,
  duration: `${(2.4 + (i % 4) * 0.45).toFixed(2)}s`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  tilt: `${(i * 47) % 360}deg`,
  round: i % 3 === 0,
}));

function firstName(name: string): string {
  return name.split(" ")[0] || name;
}

export default function BirthdayPanel({
  celebrants,
  dayOf,
  today,
  monthName,
  currentUserId,
  isAdmin,
  saving,
  error,
  onSelectDay,
  onChangeVisibility,
}: Props) {
  const visible = celebrants.filter((celebrant) => !celebrant.hidden);
  const hiddenCount = celebrants.length - visible.length;
  const todays = visible.filter((celebrant) => dayOf(celebrant) === today);
  const isMyBirthday = todays.some((celebrant) => celebrant.id === currentUserId);
  const others = todays.filter((celebrant) => celebrant.id !== currentUserId).map((c) => firstName(c.name));

  const greeting = isMyBirthday
    ? others.length
      ? `Happy birthday to you, ${others.join(" & ")} too!`
      : "Happy birthday to you!"
    : `Happy birthday, ${others.join(" & ")}!`;

  return (
    <section className="calSideBlock tick-frame">
      <span className="tick-bl" />
      <span className="tick-br" />
      <div className="calSectionHead">
        <span className="mono calSectionLabel">
          <span className="calSectionNum">01</span> Birthday celebrants
        </span>
        <span className="mono calSectionMeta">{visible.length}</span>
      </div>

      {todays.length > 0 && (
        <div className="bdBanner" role="status">
          <span className="bdConfetti" aria-hidden="true">
            {CONFETTI.map((piece, i) => (
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
          <span className="bdBannerIcon" aria-hidden="true">
            <CakeIcon size={20} />
          </span>
          <span className="bdBannerText">
            <span className="mono bdBannerEyebrow">{isMyBirthday ? "IT'S YOUR DAY" : "BIRTHDAY TODAY"}</span>
            <strong>{greeting}</strong>
          </span>
        </div>
      )}

      {celebrants.length === 0 ? (
        <p className="calSideEmpty">
          <span className="calSideEmptyIcon">
            <CakeIcon size={14} />
          </span>
          No birthdays in {monthName}.
        </p>
      ) : (
        <>
          <ul className="bdList">
            {celebrants.map((celebrant, index) => {
              const day = dayOf(celebrant);
              const isToday = day === today && !celebrant.hidden;
              return (
                <li
                  key={celebrant.id}
                  className={`bdRow${isToday ? " isToday" : ""}${celebrant.hidden ? " isHidden" : ""}`}
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  <button type="button" className="bdPerson" onClick={() => onSelectDay(day)}>
                    {celebrant.avatarUrl ? (
                      <Image
                        src={celebrant.avatarUrl}
                        alt=""
                        width={32}
                        height={32}
                        className="size-8 shrink-0 rounded-full border border-navy-tint object-cover"
                      />
                    ) : (
                      <span className="bdAvatar">{celebrant.initials}</span>
                    )}
                    <span className="bdName">
                      <span className="bdNameText">{celebrant.name}</span>
                      {celebrant.hidden && <span className="mono bdHiddenChip">HIDDEN</span>}
                    </span>
                    <span className="mono bdDate">{isToday ? "TODAY" : formatShortDay(day).toUpperCase()}</span>
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      className="bdToggle"
                      onClick={() => onChangeVisibility([celebrant.id], celebrant.hidden)}
                      aria-pressed={!celebrant.hidden}
                      aria-label={
                        celebrant.hidden
                          ? `Show ${celebrant.name}'s birthday to members`
                          : `Hide ${celebrant.name}'s birthday from members`
                      }
                      title={celebrant.hidden ? "Hidden from members — click to show" : "Shown to members — click to hide"}
                    >
                      {celebrant.hidden ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {isAdmin && (
            <div className="bdAdminBar">
              <span className="bdAdminNote">
                {hiddenCount > 0
                  ? `${hiddenCount} hidden from members`
                  : "All shown to members"}
              </span>
              <span className="bdAdminActions">
                <button
                  type="button"
                  className="bdLinkBtn"
                  disabled={saving || hiddenCount === 0}
                  onClick={() => onChangeVisibility(celebrants.filter((c) => c.hidden).map((c) => c.id), true)}
                >
                  Show all
                </button>
                <button
                  type="button"
                  className="bdLinkBtn"
                  disabled={saving || visible.length === 0}
                  onClick={() => onChangeVisibility(visible.map((c) => c.id), false)}
                >
                  Hide all
                </button>
              </span>
            </div>
          )}
        </>
      )}

      {error && (
        <p className="bdError" role="alert">
          {error}
        </p>
      )}

      <style jsx>{`
        /* ---------- Birthday banner + confetti ---------- */
        .bdBanner {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 14px;
          padding: 14px;
          border-radius: 8px;
          background: linear-gradient(135deg, #a8427a, #d9531e);
          color: var(--white);
          box-shadow: 3px 3px 0 var(--yellow);
          animation: popIn 0.35s ease backwards;
        }

        .bdConfetti {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .bdConfetti i {
          position: absolute;
          top: -10px;
          width: 6px;
          height: 9px;
          border-radius: 1px;
          opacity: 0.9;
          animation-name: bdFall;
          animation-timing-function: linear;
          animation-iteration-count: 3;
          animation-fill-mode: backwards;
        }

        .bdConfetti i.isRound {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        @keyframes bdFall {
          from {
            transform: translateY(0) rotate(var(--tilt));
            opacity: 0.95;
          }
          to {
            transform: translateY(110px) rotate(calc(var(--tilt) + 540deg));
            opacity: 0;
          }
        }

        .bdBannerIcon {
          position: relative;
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.18);
          border: 1px solid rgba(255, 255, 255, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: bdWiggle 2.4s ease-in-out infinite;
        }

        @keyframes bdWiggle {
          0%,
          70%,
          100% {
            transform: rotate(0);
          }
          78% {
            transform: rotate(-12deg) scale(1.08);
          }
          86% {
            transform: rotate(10deg) scale(1.08);
          }
          94% {
            transform: rotate(-4deg);
          }
        }

        .bdBannerText {
          position: relative;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .bdBannerEyebrow {
          font-size: 10px;
          letter-spacing: 0.12em;
          opacity: 0.85;
        }

        .bdBannerText strong {
          font-family: "Space Grotesk", sans-serif;
          font-size: 16px;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        /* ---------- List ---------- */
        .bdList {
          list-style: none;
          margin-top: 8px;
        }

        .bdRow {
          display: flex;
          align-items: center;
          gap: 4px;
          border-radius: 6px;
          transition: background 0.12s ease, opacity 0.2s ease;
          animation: fadeInUp 0.3s ease backwards;
        }

        .bdRow:hover {
          background: var(--vellum);
        }

        .bdRow.isToday {
          background: #f7e3ee;
        }

        .bdRow.isHidden .bdPerson {
          opacity: 0.5;
        }

        .bdPerson {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
          padding: 7px 6px;
          border: none;
          border-radius: 6px;
          background: none;
          font: inherit;
          text-align: left;
          color: var(--ink);
          cursor: pointer;
        }

        .bdPerson:focus-visible,
        .bdToggle:focus-visible,
        .bdLinkBtn:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: -2px;
        }

        .bdAvatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--blue);
          border: 1px solid var(--navy-tint);
          color: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-family: "Space Grotesk", sans-serif;
          font-size: 12px;
          font-weight: 600;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .bdPerson:hover .bdAvatar {
          transform: rotate(-8deg) scale(1.08);
        }

        .bdName {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
          min-width: 0;
          font-size: 13.5px;
          font-weight: 500;
        }

        .bdNameText {
          min-width: 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .bdHiddenChip {
          flex-shrink: 0;
          font-size: 9.5px;
          letter-spacing: 0.06em;
          padding: 0 5px;
          border: 1px dashed #c9bfa0;
          border-radius: 3px;
          color: var(--ink-soft);
        }

        .bdDate {
          font-size: 10.5px;
          letter-spacing: 0.04em;
          color: var(--ink-soft);
          flex-shrink: 0;
        }

        .bdRow.isToday .bdDate {
          color: #a8427a;
          font-weight: 600;
        }

        .bdToggle {
          display: flex;
          flex-shrink: 0;
          padding: 6px;
          margin-right: 2px;
          border: none;
          border-radius: 4px;
          background: none;
          color: var(--blue);
          cursor: pointer;
          transition: background 0.12s ease, color 0.12s ease;
        }

        .bdToggle:hover {
          background: var(--white);
          color: var(--navy);
        }

        .bdRow.isHidden .bdToggle {
          color: var(--ink-soft);
        }

        .bdAdminBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px dashed #c9bfa0;
        }

        .bdAdminNote {
          font-size: 11.5px;
          color: var(--ink-soft);
        }

        .bdAdminActions {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }

        .bdLinkBtn {
          padding: 3px 8px;
          border: 1px solid #c9bfa0;
          border-radius: 4px;
          background: var(--white);
          font: inherit;
          font-size: 11.5px;
          font-weight: 600;
          color: var(--navy);
          cursor: pointer;
          transition: background 0.12s ease;
        }

        .bdLinkBtn:hover:not(:disabled) {
          background: var(--vellum);
        }

        .bdLinkBtn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .bdError {
          margin: 10px 0 0;
          font-size: 12px;
          color: #b3261e;
        }

        @media (prefers-reduced-motion: reduce) {
          .bdConfetti {
            display: none;
          }

          .bdBannerIcon,
          .bdAvatar {
            animation: none;
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}

export function CakeIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21v-8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8" />
      <path d="M4 16s1.5-1 4-1 4 2 6 2 3-1 3-1" />
      <path d="M2 21h20" />
      <path d="M7 8v3M12 8v3M17 8v3" />
      <path d="M7 4h.01M12 4h.01M17 4h.01" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.4 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M14.1 14.1a3 3 0 1 1-4.2-4.2" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
