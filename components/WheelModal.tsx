"use client";

import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBackdropDismiss } from "@/lib/useBackdropDismiss";

// The modal shell and scroll wheels shared by the date and time pickers on phones and tablets.

const ITEM_HEIGHT = 36;
// Rows shown above and below the selected one.
const ROWS_AROUND = 3;

export type WheelItem = { label: string; disabled: boolean };

type Props = {
  title: string;
  /** A line under the title, e.g. how long the event runs. */
  subtitle?: string;
  /** CSS grid columns for the wheels, one track per wheel. */
  columns: string;
  children: ReactNode;
  /** Shows a Clear button when given. */
  onClear?: () => void;
  onDone: () => void;
  onCancel: () => void;
};

export default function WheelModal({ title, subtitle, columns, children, onClear, onDone, onCancel }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const backdrop = useBackdropDismiss(onCancel);

  useEffect(() => {
    dialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    // Captured on window so Escape closes only this modal, not a dialog it was opened from.
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onCancel();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onCancel]);

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
          {title}
        </h3>
        {subtitle && <p className="wdSubtitle">{subtitle}</p>}

        <div className="wdWheels" style={{ gridTemplateColumns: columns }}>
          <span className="wdBand" aria-hidden="true" />
          {children}
        </div>

        <div className="wdActions">
          {onClear && (
            <button type="button" className="wdClear" onClick={onClear}>
              Clear
            </button>
          )}
          <button type="button" className="wdCancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="wdDone" onClick={onDone}>
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
          font-family: "Sora", sans-serif;
          font-size: 18px;
          color: var(--navy);
          margin: 0 0 12px 4px;
        }

        .wdSubtitle {
          font-family: "Inter", sans-serif;
          font-size: 13px;
          color: var(--ink-soft);
          margin: -8px 0 12px 4px;
        }

        .wdWheels {
          position: relative;
          display: grid;
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
  items: WheelItem[];
  index: number;
  onSelect: (index: number) => void;
  align: "left" | "center" | "right";
};

export function Wheel({ label, items, index, onSelect, align }: WheelProps) {
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
          font-variant-numeric: tabular-nums;
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
