"use client";

import { useEffect, useRef, useState } from "react";

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

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseISO(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isSameDay(a: Date, year: number, month: number, day: number): boolean {
  return a.getFullYear() === year && a.getMonth() === month && a.getDate() === day;
}

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  max?: string;
  minYear?: number;
};

export default function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Select a date",
  max,
  minYear,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = parseISO(value);
  const maxDate = max ? parseISO(max) : null;
  const today = new Date();

  const [viewYear, setViewYear] = useState(() => (selected ?? today).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (selected ?? today).getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggleOpen() {
    if (!open && selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
    setOpen((v) => !v);
  }

  const earliestYear = minYear ?? today.getFullYear() - 100;
  const latestYear = maxDate ? maxDate.getFullYear() : today.getFullYear();
  const years: number[] = [];
  for (let y = latestYear; y >= earliestYear; y--) years.push(y);

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function isDisabled(day: number): boolean {
    if (!maxDate) return false;
    return new Date(viewYear, viewMonth, day) > maxDate;
  }

  function selectDay(day: number) {
    if (isDisabled(day)) return;
    onChange(toISO(new Date(viewYear, viewMonth, day)));
    setOpen(false);
  }

  function goPrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function goNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  return (
    <div className="datePicker" ref={containerRef}>
      <button
        type="button"
        id={id}
        className="dateTrigger"
        onClick={toggleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={selected ? "dateValue" : "datePlaceholder"}>
          {selected ? formatDisplay(selected) : placeholder}
        </span>
        <CalendarIcon />
      </button>

      {open && (
        <div className="dateDropdown" role="dialog" aria-label="Choose a date">
          <div className="dateHeader">
            <button
              type="button"
              className="dateNav"
              onClick={goPrevMonth}
              aria-label="Previous month"
            >
              ‹
            </button>
            <div className="dateHeaderSelects">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                aria-label="Month"
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                aria-label="Year"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="dateNav"
              onClick={goNextMonth}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="dateWeekdays">
            {WEEKDAY_LABELS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="dateGrid">
            {cells.map((day, i) =>
              day === null ? (
                <span key={`empty-${i}`} className="dateCellEmpty" />
              ) : (
                <button
                  type="button"
                  key={day}
                  className={
                    "dateCell" +
                    (selected && isSameDay(selected, viewYear, viewMonth, day)
                      ? " dateCellSelected"
                      : "") +
                    (isSameDay(today, viewYear, viewMonth, day) ? " dateCellToday" : "")
                  }
                  disabled={isDisabled(day)}
                  onClick={() => selectDay(day)}
                >
                  {day}
                </button>
              ),
            )}
          </div>

          {selected && (
            <button
              type="button"
              className="dateClear"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear date
            </button>
          )}
        </div>
      )}

      <style jsx>{`
        .datePicker {
          position: relative;
        }

        .dateTrigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          border: 1px solid #c9bfa0;
          border-radius: 5px;
          background: var(--white);
          padding: 11px 12px;
          font-family: "Inter", sans-serif;
          font-size: 14px;
          color: var(--ink);
          box-shadow: inset 3px 3px 10px rgba(28, 35, 51, 0.14);
          cursor: pointer;
          text-align: left;
        }

        .dateTrigger:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 1px;
        }

        .datePlaceholder {
          color: var(--ink-soft);
        }

        .dateTrigger svg {
          flex-shrink: 0;
          color: var(--ink-soft);
        }

        .dateDropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 50;
          width: 260px;
          background: var(--white);
          border: 1px solid #c9bfa0;
          border-radius: 8px;
          box-shadow: 0 16px 36px rgba(13, 30, 56, 0.2);
          padding: 12px;
        }

        .dateHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          margin-bottom: 10px;
        }

        .dateNav {
          background: none;
          border: none;
          padding: 4px 8px;
          font-size: 16px;
          line-height: 1;
          color: var(--ink-soft);
          cursor: pointer;
          border-radius: 4px;
        }

        .dateNav:hover {
          background: var(--vellum-2);
          color: var(--navy);
        }

        .dateHeaderSelects {
          display: flex;
          gap: 4px;
          flex: 1;
        }

        .dateHeaderSelects select {
          appearance: auto;
          -webkit-appearance: menulist;
          -moz-appearance: menulist;
          background-image: none;
          border: 1px solid #c9bfa0;
          border-radius: 4px;
          background-color: var(--white);
          font-family: "Inter", sans-serif;
          font-size: 12px;
          color: var(--ink);
          padding: 3px 4px;
          margin-bottom: 0;
          box-shadow: none;
        }

        .dateWeekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          margin-bottom: 4px;
        }

        .dateWeekdays span {
          text-align: center;
          font-family: "IBM Plex Mono", monospace;
          font-size: 10px;
          color: var(--ink-soft);
        }

        .dateGrid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
        }

        .dateCell,
        .dateCellEmpty {
          aspect-ratio: 1;
        }

        .dateCell {
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: none;
          border-radius: 6px;
          font-family: "Inter", sans-serif;
          font-size: 13px;
          color: var(--ink);
          cursor: pointer;
        }

        .dateCell:hover:not(:disabled) {
          background: var(--vellum-2);
        }

        .dateCellToday {
          font-weight: 600;
          color: var(--blue);
        }

        .dateCellSelected,
        .dateCellSelected:hover {
          background: var(--navy);
          color: var(--white);
          font-weight: 600;
        }

        .dateCell:disabled {
          color: #c9bfa0;
          cursor: not-allowed;
        }

        .dateClear {
          width: 100%;
          margin-top: 10px;
          padding-top: 8px;
          border: none;
          border-top: 1px solid #e4dcc9;
          background: none;
          font-family: "Inter", sans-serif;
          font-size: 12px;
          color: var(--orange);
          cursor: pointer;
        }

        .dateClear:hover {
          color: #a84f29;
        }
      `}</style>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}
