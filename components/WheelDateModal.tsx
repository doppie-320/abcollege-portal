"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useBackdropDismiss } from "@/lib/useBackdropDismiss";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const ITEM_HEIGHT = 36;
// Rows shown above and below the selected one.
const ROWS_AROUND = 3;

type Draft = { year: number; month: number; day: number };

type Props = {
  initial: Date;
  maxDate: Date | null;
  earliestYear: number;
  latestYear: number;
  canClear: boolean;
  onDone: (date: Date) => void;
  onClear: () => void;
  onCancel: () => void;
};

/** Pulls a picked date back inside the valid range, the way a native date wheel springs back. */
function normalize(draft: Draft, maxDate: Date | null): Draft {
  let { year, month, day } = draft;
  if (maxDate) {
    const maxY = maxDate.getFullYear();
    const maxM = maxDate.getMonth();
    if (year > maxY) year = maxY;
    if (year === maxY && month > maxM) month = maxM;
    if (year === maxY && month === maxM) day = Math.min(day, maxDate.getDate());
  }
  day = Math.min(day, new Date(year, month + 1, 0).getDate());
  return { year, month, day };
}

export default function WheelDateModal({
  initial,
  maxDate,
  earliestYear,
  latestYear,
  canClear,
  onDone,
  onClear,
  onCancel,
}: Props) {
  const [draft, setDraft] = useState<Draft>(() =>
    normalize(
      { year: initial.getFullYear(), month: initial.getMonth(), day: initial.getDate() },
      maxDate,
    ),
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const backdrop = useBackdropDismiss(onCancel);

  function update(patch: Partial<Draft>) {
    setDraft((d) => normalize({ ...d, ...patch }, maxDate));
  }

  useEffect(() => {
    dialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const maxY = maxDate?.getFullYear();
  const maxM = maxDate?.getMonth();
  const atMaxYear = draft.year === maxY;
  const atMaxMonth = atMaxYear && draft.month === maxM;

  const monthItems = MONTH_NAMES.map((name, i) => ({
    label: name,
    disabled: atMaxYear && maxM !== undefined && i > maxM,
  }));

  const daysInMonth = new Date(draft.year, draft.month + 1, 0).getDate();
  const dayItems = Array.from({ length: daysInMonth }, (_, i) => ({
    label: String(i + 1),
    disabled: atMaxMonth && !!maxDate && i + 1 > maxDate.getDate(),
  }));

  const yearItems: { label: string; disabled: boolean }[] = [];
  for (let y = earliestYear; y <= latestYear; y++) {
    yearItems.push({ label: String(y), disabled: maxY !== undefined && y > maxY });
  }

  return createPortal(
    <div className="wdBackdrop" {...backdrop}>
      <div
        className="wdModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wdTitle"
        tabIndex={-1}
        ref={dialogRef}
      >
        <h3 id="wdTitle" className="wdTitle">
          Select date
        </h3>

        <div className="wdWheels">
          <span className="wdBand" aria-hidden="true" />
          <Wheel
            label="Month"
            items={monthItems}
            index={draft.month}
            onSelect={(i) => update({ month: i })}
            align="left"
          />
          <Wheel
            label="Day"
            items={dayItems}
            index={draft.day - 1}
            onSelect={(i) => update({ day: i + 1 })}
            align="center"
          />
          <Wheel
            label="Year"
            items={yearItems}
            index={draft.year - earliestYear}
            onSelect={(i) => update({ year: earliestYear + i })}
            align="right"
          />
        </div>

        <div className="wdActions">
          {canClear && (
            <button type="button" className="wdClear" onClick={onClear}>
              Clear
            </button>
          )}
          <button type="button" className="wdCancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="wdDone"
            onClick={() => onDone(new Date(draft.year, draft.month, draft.day))}
          >
            Done
          </button>
        </div>
      </div>

      <style jsx>{`
        .wdBackdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(13, 30, 56, 0.55);
          backdrop-filter: blur(3px);
          animation: wdFadeIn 0.15s ease backwards;
        }

        .wdModal {
          width: 100%;
          max-width: 360px;
          background: var(--white);
          border: 1px solid #c9bfa0;
          border-radius: 8px;
          box-shadow: 0 24px 60px rgba(13, 30, 56, 0.35);
          padding: 20px 16px 16px;
          animation: wdPopIn 0.2s ease backwards;
        }

        .wdModal:focus {
          outline: none;
        }

        .wdTitle {
          font-family: "Space Grotesk", sans-serif;
          font-size: 18px;
          color: var(--navy);
          margin: 0 0 12px 4px;
        }

        .wdWheels {
          position: relative;
          display: grid;
          grid-template-columns: 1.6fr 0.8fr 1fr;
          gap: 4px;
        }

        .wdBand {
          position: absolute;
          left: 0;
          right: 0;
          top: ${ROWS_AROUND * ITEM_HEIGHT}px;
          height: ${ITEM_HEIGHT}px;
          border-top: 1px solid #e4dcc9;
          border-bottom: 1px solid #e4dcc9;
          background: rgba(237, 231, 217, 0.45);
          border-radius: 6px;
          pointer-events: none;
        }

        .wdActions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
        }

        .wdActions button {
          font-family: "Inter", sans-serif;
          font-size: 14px;
          border-radius: 5px;
          padding: 9px 16px;
          cursor: pointer;
        }

        .wdClear {
          margin-right: auto;
          background: none;
          border: none;
          color: var(--orange);
          padding-left: 4px !important;
        }

        .wdCancel {
          background: none;
          border: 1px solid #c9bfa0;
          color: var(--ink);
        }

        .wdDone {
          background: var(--navy);
          border: 1px solid var(--navy);
          color: var(--white);
          font-weight: 600;
        }

        @keyframes wdFadeIn {
          from {
            opacity: 0;
          }
        }

        @keyframes wdPopIn {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(8px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .wdBackdrop,
          .wdModal {
            animation: none;
          }
        }
      `}</style>
    </div>,
    document.body,
  );
}

type WheelProps = {
  label: string;
  items: { label: string; disabled: boolean }[];
  index: number;
  onSelect: (index: number) => void;
  align: "left" | "center" | "right";
};

function Wheel({ label, items, index, onSelect, align }: WheelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placed = useRef(false);

  // Tilts and fades the rows near the viewport so the column reads as a turning drum.
  function paint() {
    const el = ref.current;
    if (!el) return;
    const center = el.scrollTop / ITEM_HEIGHT;
    const rows = el.children;
    const from = Math.max(0, Math.floor(center) - ROWS_AROUND - 2);
    const to = Math.min(rows.length - 1, Math.ceil(center) + ROWS_AROUND + 2);
    for (let i = from; i <= to; i++) {
      const row = rows[i] as HTMLElement;
      const distance = i - center;
      const angle = Math.max(-75, Math.min(75, distance * 22));
      row.style.transform = `perspective(300px) rotateX(${-angle}deg)`;
      row.style.opacity = String(Math.max(0.2, 1 - Math.abs(distance) * 0.25));
    }
  }

  // Follow the selected value: jump on first render, glide after that.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = index * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - target) > 1) {
      el.scrollTo({ top: target, behavior: placed.current ? "smooth" : "auto" });
    }
    placed.current = true;
    paint();
  }, [index, items.length]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(frame.current);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  function onScroll() {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(paint);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.round(el.scrollTop / ITEM_HEIGHT);
      onSelect(Math.max(0, Math.min(items.length - 1, i)));
    }, 120);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 }[e.key];
    if (step !== undefined) {
      e.preventDefault();
      onSelect(Math.max(0, Math.min(items.length - 1, index + step)));
    } else if (e.key === "Home") {
      e.preventDefault();
      onSelect(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onSelect(items.length - 1);
    }
  }

  return (
    <div
      className={`wheel ${align}`}
      ref={ref}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      role="listbox"
      aria-label={label}
      aria-activedescendant={`wheel-${label}-${index}`}
      tabIndex={0}
    >
      {items.map((item, i) => (
        <div
          key={i}
          id={`wheel-${label}-${i}`}
          role="option"
          aria-selected={i === index}
          aria-disabled={item.disabled || undefined}
          className={`wheelRow ${i === index ? "selected" : ""} ${item.disabled ? "disabled" : ""}`}
          onClick={() =>
            ref.current?.scrollTo({ top: i * ITEM_HEIGHT, behavior: "smooth" })
          }
        >
          {item.label}
        </div>
      ))}

      <style jsx>{`
        .wheel {
          position: relative;
          height: ${(ROWS_AROUND * 2 + 1) * ITEM_HEIGHT}px;
          overflow-y: auto;
          overscroll-behavior: contain;
          scroll-snap-type: y mandatory;
          scrollbar-width: none;
          padding: ${ROWS_AROUND * ITEM_HEIGHT}px 0;
          border-radius: 6px;
          -webkit-mask-image: linear-gradient(transparent, #000 35%, #000 65%, transparent);
          mask-image: linear-gradient(transparent, #000 35%, #000 65%, transparent);
        }

        .wheel::-webkit-scrollbar {
          display: none;
        }

        .wheel:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: -2px;
        }

        .wheelRow {
          height: ${ITEM_HEIGHT}px;
          line-height: ${ITEM_HEIGHT}px;
          scroll-snap-align: center;
          padding: 0 10px;
          font-family: "Inter", sans-serif;
          font-size: 17px;
          color: var(--ink-soft);
          white-space: nowrap;
          cursor: pointer;
          user-select: none;
        }

        .left .wheelRow {
          text-align: left;
        }

        .center .wheelRow {
          text-align: center;
        }

        .right .wheelRow {
          text-align: right;
        }

        .wheelRow.selected {
          color: var(--ink);
          font-weight: 600;
        }

        .wheelRow.disabled {
          color: #c9bfa0;
        }
      `}</style>
    </div>
  );
}
