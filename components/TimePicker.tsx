"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

// Styled to match DatePicker. Values are "HH:mm" in 24-hour time, shown as "8:00 AM".
// Type a time ("2:30p", "1430", "2") or pick from the list; ↑/↓ and Enter work too.

const STEP_MINUTES = 30;
const LAST_MINUTE = 24 * 60 - 1;

export function minutesOf(value: string): number {
  const [h, m] = value.split(":").map(Number);
  const hour = Number.isInteger(h) && h >= 0 && h < 24 ? h : 8;
  const minute = Number.isInteger(m) && m >= 0 && m < 60 ? m : 0;
  return hour * 60 + minute;
}

export function timeFromMinutes(total: number): string {
  const clamped = Math.min(Math.max(Math.round(total), 0), LAST_MINUTE);
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

export function formatTimeValue(value: string): string {
  const total = minutesOf(value);
  const hour = Math.floor(total / 60);
  return `${hour % 12 || 12}:${String(total % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

/**
 * Reads what someone typed: "2:30 pm", "2:30p", "230p", "1430", "14:30", "2".
 * Without AM/PM, 1–6 is read as afternoon and 7–11 as morning, which suits school hours.
 */
export function parseTimeInput(text: string): string | null {
  const cleaned = text.toLowerCase().replace(/[\s.]/g, "");
  const match = /^(\d{1,4})(?::(\d{1,2}))?(a|am|p|pm)?$/.exec(cleaned);
  if (!match) return null;

  const period = match[3];
  let digits = match[1];
  let minutePart = match[2];
  if (!minutePart && digits.length > 2) {
    minutePart = digits.slice(-2);
    digits = digits.slice(0, -2);
  }
  let hour = Number(digits);
  const minute = minutePart ? Number(minutePart) : 0;
  if (minute > 59) return null;

  if (period) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (period.startsWith("p") ? 12 : 0);
  } else if (hour > 23) {
    return null;
  } else if (hour >= 1 && hour <= 6) {
    hour += 12;
  }
  return timeFromMinutes(hour * 60 + minute);
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return `${hours} hr${hours > 1 ? "s" : ""}${rest ? ` ${rest} min` : ""}`;
}

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  "aria-label"?: string;
  /** For an end time: list only times from this one on, each with how long the event would run. */
  durationFrom?: string;
};

export default function TimePicker({ id, value, onChange, "aria-label": ariaLabel, durationFrom }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const current = timeFromMinutes(minutesOf(value));
  const from = durationFrom ? minutesOf(durationFrom) : 0;

  const optionMinutes = new Set<number>([minutesOf(current)]);
  if (durationFrom) optionMinutes.add(from);
  for (let m = Math.ceil(from / STEP_MINUTES) * STEP_MINUTES; m <= LAST_MINUTE; m += STEP_MINUTES) optionMinutes.add(m);
  const options = [...optionMinutes]
    .filter((m) => m >= from || timeFromMinutes(m) === current)
    .sort((a, b) => a - b)
    .map(timeFromMinutes);

  const selectedIndex = options.indexOf(current);

  // Keeps the highlighted option in view without scrolling the page or modal around it.
  useEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;
    const index = active >= 0 ? active : selectedIndex;
    const option = list.children[index] as HTMLElement | undefined;
    if (!option) return;
    if (active < 0) {
      list.scrollTop = option.offsetTop - list.clientHeight / 2 + option.offsetHeight / 2;
    } else if (option.offsetTop < list.scrollTop) {
      list.scrollTop = option.offsetTop - 4;
    } else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight + 4;
    }
  }, [open, active, selectedIndex]);

  function close() {
    setOpen(false);
    setDraft(null);
    setActive(-1);
  }

  function commit(next: string) {
    onChange(next);
    close();
  }

  /** Index of the first option at or after `time`, so typing jumps the list there. */
  function nearestIndex(time: string): number {
    const index = options.findIndex((option) => option >= time);
    return index === -1 ? options.length - 1 : index;
  }

  function onType(text: string) {
    setDraft(text);
    setOpen(true);
    const parsed = parseTimeInput(text);
    setActive(parsed ? nearestIndex(parsed) : -1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const start = active >= 0 ? active : selectedIndex;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setOpen(true);
      setActive(Math.min(Math.max((start < 0 ? 0 : start) + (open ? step : 0), 0), options.length - 1));
    } else if (e.key === "Enter") {
      // Never let Enter here submit the event form.
      e.preventDefault();
      const parsed = draft !== null ? parseTimeInput(draft) : null;
      if (parsed) commit(parsed);
      else if (active >= 0) commit(options[active]);
      else close();
    } else if (e.key === "Escape" && open) {
      // Close just the list, not the modal around it.
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      close();
    }
  }

  function onBlur() {
    const parsed = draft !== null ? parseTimeInput(draft) : null;
    if (parsed) onChange(parsed);
    close();
  }

  const invalid = draft !== null && draft.trim() !== "" && !parseTimeInput(draft);

  return (
    <div className="timePicker">
      <input
        id={id}
        type="text"
        className={`timeInput${invalid ? " isInvalid" : ""}`}
        value={draft ?? formatTimeValue(value)}
        onChange={(e) => onType(e.target.value)}
        onFocus={(e) => {
          e.target.select();
          setOpen(true);
        }}
        onClick={() => setOpen(true)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
      />
      <span className="timeIcon" aria-hidden="true">
        <ClockIcon />
      </span>

      {open && (
        <div className="timeList" id={listId} ref={listRef} role="listbox" aria-label={ariaLabel ?? "Times"}>
          {options.map((option, index) => (
            <div
              key={option}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option === current}
              className={`timeOption${option === current ? " isSelected" : ""}${index === active ? " isActive" : ""}`}
              // Keep focus in the input so blur doesn't close the list before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(option)}
            >
              <span>{formatTimeValue(option)}</span>
              {durationFrom && <span className="timeDuration">{formatDuration(minutesOf(option) - from)}</span>}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .timePicker {
          position: relative;
        }

        .timeInput {
          width: 100%;
          margin: 0;
          padding: 11px 34px 11px 12px;
          font-size: 14px;
          font-variant-numeric: tabular-nums;
        }

        .timeInput.isInvalid {
          border-color: #b3261e;
        }

        .timeIcon {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          color: var(--ink-soft);
          pointer-events: none;
        }

        /* Anchored right: the field sits at the end of its row, and durations need room. */
        .timeList {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          z-index: 50;
          min-width: 100%;
          max-height: 220px;
          overflow-y: auto;
          padding: 4px;
          background: var(--white);
          border: 1px solid #c9bfa0;
          border-radius: 8px;
          box-shadow: 0 16px 36px rgba(13, 30, 56, 0.2);
          scrollbar-width: thin;
          scrollbar-color: #c9bfa0 transparent;
        }

        .timeOption {
          display: flex;
          align-items: baseline;
          gap: 8px;
          padding: 7px 10px;
          border-radius: 5px;
          font-size: 13px;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          color: var(--ink);
          cursor: pointer;
        }

        .timeOption:hover,
        .timeOption.isActive {
          background: var(--vellum-2);
        }

        .timeOption.isSelected {
          background: var(--navy);
          color: var(--white);
          font-weight: 600;
        }

        .timeDuration {
          margin-left: auto;
          font-size: 11.5px;
          font-weight: 400;
          color: var(--ink-soft);
        }

        .timeOption.isSelected .timeDuration {
          color: #c6d3e5;
        }
      `}</style>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
