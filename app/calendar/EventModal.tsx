"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useBackdropDismiss } from "@/lib/useBackdropDismiss";
import DatePicker from "@/components/DatePicker";
import Select from "@/components/Select";
import TimePicker, { minutesOf, timeFromMinutes } from "@/components/TimePicker";
import {
  EVENT_TAGS,
  MAX_EVENT_DESCRIPTION_LENGTH,
  MAX_EVENT_NAME_LENGTH,
  TAG_LABELS,
  toDayKey,
  toTimeValue,
  validateEvent,
  type CalendarEvent,
  type EventInput,
  type EventTag,
} from "@/lib/calendar";

type Props = {
  /** The event being edited; omit to create one. */
  event?: CalendarEvent;
  /** What the admin had typed, when the modal reopens after a failed save. */
  draft?: EventInput;
  initialError?: string;
  initialFieldErrors?: Record<string, string>;
  /** Pre-filled date for a new event, e.g. the selected day. */
  defaultDay: string;
  onClose: () => void;
  /**
   * Called with checked input, then the modal closes. The calendar shows `preview` at once
   * and reopens the modal with the draft if the server refuses it.
   */
  onSave: (input: EventInput, preview: Omit<CalendarEvent, "id">) => void;
};

export default function EventModal({
  event,
  draft,
  initialError = "",
  initialFieldErrors = {},
  defaultDay,
  onClose,
  onSave,
}: Props) {
  const isEdit = Boolean(event);
  const timed = event && !event.allDay;

  const [name, setName] = useState(draft?.name ?? event?.name ?? "");
  const [tag, setTag] = useState<EventTag>(draft?.tag ?? event?.tag ?? "EVENT");
  const [allDay, setAllDay] = useState(draft?.allDay ?? event?.allDay ?? false);
  const [startDate, setStartDate] = useState(draft?.startDate ?? (event ? toDayKey(event.start) : defaultDay));
  const [startTime, setStartTime] = useState(draft?.startTime ?? (timed ? toTimeValue(event.start) : "08:00"));
  const [endDate, setEndDate] = useState(draft?.endDate ?? (event ? toDayKey(event.end) : defaultDay));
  const [endTime, setEndTime] = useState(draft?.endTime ?? (timed ? toTimeValue(event.end) : "09:00"));
  const [description, setDescription] = useState(draft?.description ?? event?.description ?? "");
  const [error, setError] = useState(initialError);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>(initialFieldErrors);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Keeps the picker's year list around the event rather than capping it at this year.
  const baseYear = Number(defaultDay.slice(0, 4));

  const requestClose = useCallback(() => {
    if (closing) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      onClose();
      return;
    }
    setClosing(true);
    closeTimer.current = setTimeout(onClose, 250);
  }, [closing, onClose]);

  const backdrop = useBackdropDismiss(requestClose);

  useEffect(() => {
    // The sheet sizes don't autofocus: on phones the keyboard would open mid-slide
    // and fight the animation, which is why the /home comment sheet stays smooth.
    if (window.matchMedia?.("(min-width: 820px)").matches) nameRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  function changeTag(value: string) {
    const next = value as EventTag;
    // Holidays almost always last the whole day.
    if (next === "HOLIDAY" && tag !== "HOLIDAY") setAllDay(true);
    setTag(next);
  }

  function changeStartDate(value: string) {
    setStartDate(value);
    // Moving the start past the end drags the end along, like most calendar apps.
    if (value && (!endDate || endDate < value)) setEndDate(value);
  }

  // On a one-day event, moving the start time moves the end with it so the length stays the same.
  function changeStartTime(value: string) {
    if (startDate === endDate && minutesOf(endTime) >= minutesOf(startTime)) {
      setEndTime(timeFromMinutes(minutesOf(endTime) + minutesOf(value) - minutesOf(startTime)));
    }
    setStartTime(value);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const input: EventInput = { id: event?.id, name, description, tag, allDay, startDate, startTime, endDate, endTime };
    const checked = validateEvent(input);
    if ("fieldErrors" in checked) {
      setError("Check the highlighted fields.");
      setFieldErrors(checked.fieldErrors);
      return;
    }
    onSave(input, checked.event);
    onClose();
  }

  return (
    <div className={`evBackdrop${closing ? " closing" : ""}`} {...backdrop}>
      <form
        className={`evPanel${closing ? " closing" : ""}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="eventModalHeading"
        noValidate
      >
        <div className="evTopBar">
          <span className="sheetHandle" aria-hidden="true" />
          <span className="evTopBarTitle mono" id="eventModalHeading">
            {isEdit ? "EDIT EVENT" : "NEW EVENT"} / {TAG_LABELS[tag].toUpperCase()}
          </span>
          <button type="button" className="evClose" onClick={requestClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="evAccent" />

        <div className="evBody">
          <div className="evField">
            <label htmlFor="eventName">Title</label>
            <input
              ref={nameRef}
              id="eventName"
              type="text"
              className={fieldErrors.name ? "evInvalid" : undefined}
              placeholder="e.g. Engineering Week opening"
              value={name}
              maxLength={MAX_EVENT_NAME_LENGTH}
              onChange={(e) => setName(e.target.value)}
            />
            {fieldErrors.name && <p className="evError">{fieldErrors.name}</p>}
          </div>

          <div className="evRow">
            <div className="evField evTagField">
              <label htmlFor="eventTag">Tag</label>
              <Select
                id="eventTag"
                value={tag}
                onChange={changeTag}
                options={EVENT_TAGS.map((value) => ({ value, label: TAG_LABELS[value] }))}
              />
              {fieldErrors.tag && <p className="evError">{fieldErrors.tag}</p>}
            </div>

            <label className="evSwitch">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
              <span className="evSwitchTrack" aria-hidden="true" />
              All-day
            </label>
          </div>

          <div className="evField">
            <span className="evLabel" id="eventStartsLabel">Starts</span>
            <div className={`evWhen isStart${allDay ? " dateOnly" : ""}`} role="group" aria-labelledby="eventStartsLabel">
              <DatePicker
                value={startDate}
                onChange={changeStartDate}
                placeholder="Start date"
                minYear={baseYear - 2}
                maxYear={baseYear + 5}
              />
              {!allDay && (
                <TimePicker value={startTime} onChange={changeStartTime} aria-label="Start time" />
              )}
            </div>
            {fieldErrors.start && <p className="evError">{fieldErrors.start}</p>}
          </div>

          <div className="evField">
            <span className="evLabel" id="eventEndsLabel">Ends</span>
            <div className={`evWhen${allDay ? " dateOnly" : ""}`} role="group" aria-labelledby="eventEndsLabel">
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                placeholder="End date"
                minYear={baseYear - 2}
                maxYear={baseYear + 5}
              />
              {!allDay && (
                <TimePicker
                  value={endTime}
                  onChange={setEndTime}
                  aria-label="End time"
                  durationFrom={startDate === endDate ? startTime : undefined}
                />
              )}
            </div>
            {fieldErrors.end && <p className="evError">{fieldErrors.end}</p>}
          </div>

          <div className="evField">
            <label htmlFor="eventDescription">
              Details <span className="evOptional">(optional)</span>
            </label>
            <textarea
              id="eventDescription"
              className={fieldErrors.description ? "evInvalid" : undefined}
              rows={3}
              maxLength={MAX_EVENT_DESCRIPTION_LENGTH}
              placeholder="Venue, dress code, what to bring…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {fieldErrors.description && <p className="evError">{fieldErrors.description}</p>}
          </div>

          {error && (
            <p className="evFormError" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="evFooter">
          <span className="evHint mono">TIMES IN PHILIPPINE TIME</span>
          <div className="evActions">
            <button type="button" className="btn ghost" onClick={requestClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              {isEdit ? "Save changes" : "Add event"}
            </button>
          </div>
        </div>
      </form>

      <style jsx>{`
        .evBackdrop {
          position: fixed;
          inset: 0;
          background: rgba(13, 30, 56, 0.55);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 0;
          z-index: 100;
          backdrop-filter: blur(3px);
          animation: fadeIn 0.15s ease backwards;
        }

        .evBackdrop.closing {
          animation: fadeOut 0.25s ease forwards;
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        /* On phones and tablets the form is a bottom sheet, like the comment sheet on /home. */
        .evPanel {
          width: 100%;
          max-width: 100%;
          height: 92vh;
          height: 92dvh;
          max-height: 92vh;
          max-height: 92dvh;
          margin: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--white);
          border-radius: 16px 16px 0 0;
          border: 1px solid #c9bfa0;
          border-bottom: none;
          box-shadow: 0 -12px 48px rgba(13, 30, 56, 0.35);
          will-change: transform;
          animation: sheetUp 0.28s cubic-bezier(0.32, 0.9, 0.35, 1) backwards;
        }

        .evPanel.closing {
          animation: sheetDown 0.25s cubic-bezier(0.4, 0, 0.4, 1) forwards;
        }

        @keyframes sheetUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        @keyframes sheetDown {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(100%);
          }
        }

        @keyframes popOut {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(0.96) translateY(8px);
          }
        }

        @media (min-width: 820px) {
          .evBackdrop {
            align-items: center;
            padding: 24px;
            overflow-y: auto;
          }

          /* No overflow clipping, so the date picker's dropdown can hang below the panel. */
          .evPanel {
            max-width: 520px;
            height: auto;
            max-height: none;
            margin: auto;
            display: block;
            overflow: visible;
            border-radius: 8px;
            border-bottom: 1px solid #c9bfa0;
            box-shadow: 0 24px 60px rgba(13, 30, 56, 0.35);
            animation: popIn 0.2s ease backwards;
          }

          .evPanel.closing {
            animation: popOut 0.2s ease forwards;
          }
        }

        .evTopBar {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 18px 12px 10px 18px;
          background: var(--navy);
          border-bottom: 3px solid var(--orange);
          border-radius: 0;
          flex-shrink: 0;
        }

        .sheetHandle {
          position: absolute;
          top: 7px;
          left: 50%;
          transform: translateX(-50%);
          width: 40px;
          height: 4px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.5);
        }

        @media (min-width: 820px) {
          .evTopBar {
            padding-top: 10px;
            border-radius: 7px 7px 0 0;
          }

          .sheetHandle {
            display: none;
          }
        }

        .evTopBarTitle {
          font-size: 11.5px;
          color: #c6d3e5;
          letter-spacing: 0.08em;
        }

        .evAccent {
          height: 3px;
          background: var(--yellow);
        }

        .evClose {
          background: rgba(255, 255, 255, 0.12);
          border: none;
          padding: 5px;
          border-radius: 4px;
          color: var(--white);
          cursor: pointer;
          display: flex;
          transition: background 0.15s ease;
        }

        .evClose:hover {
          background: rgba(255, 255, 255, 0.24);
        }

        .evClose:focus-visible {
          outline: 2px solid var(--grid);
          outline-offset: 1px;
        }

        .evBody {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 20px 22px 6px;
          scrollbar-width: thin;
          scrollbar-color: #c9bfa0 transparent;
        }

        @media (min-width: 820px) {
          .evBody {
            flex: none;
            overflow: visible;
          }
        }

        .evField {
          margin-bottom: 16px;
        }

        .evField :global(input[type="text"]),
        .evField textarea {
          margin-bottom: 0;
        }

        .evField textarea {
          resize: vertical;
          min-height: 80px;
        }

        .evLabel {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: var(--ink-soft);
          margin-bottom: 6px;
        }

        .evOptional {
          font-weight: 400;
          font-size: 12px;
        }

        .evRow {
          display: flex;
          align-items: flex-end;
          gap: 16px;
        }

        .evTagField {
          flex: 1;
          min-width: 0;
          position: relative;
          z-index: 4;
        }

        /* Each row stacks above the ones after it, so an open dropdown (tag list, date
           picker) covers the fields below instead of being covered by them. */
        .evWhen {
          display: grid;
          grid-template-columns: 1fr 136px;
          gap: 10px;
          position: relative;
          z-index: 2;
        }

        .evWhen.isStart {
          z-index: 3;
        }

        .evWhen.dateOnly {
          grid-template-columns: 1fr;
        }

        /* All-day toggle, styled as a small switch. */
        .evSwitch {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          height: var(--control-h);
          margin: 0 0 16px;
          font-size: 13px;
          font-weight: 500;
          color: var(--ink);
          cursor: pointer;
          user-select: none;
          flex-shrink: 0;
        }

        .evSwitch input {
          position: absolute;
          opacity: 0;
          width: 1px;
          height: 1px;
        }

        .evSwitchTrack {
          position: relative;
          width: 34px;
          height: 20px;
          border-radius: 999px;
          background: var(--vellum-2);
          border: 1px solid #c9bfa0;
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .evSwitchTrack::after {
          content: "";
          position: absolute;
          top: 2px;
          left: 2px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--white);
          box-shadow: 0 1px 2px rgba(13, 30, 56, 0.3);
          transition: transform 0.15s ease;
        }

        .evSwitch input:checked + .evSwitchTrack {
          background: var(--navy);
          border-color: var(--navy);
        }

        .evSwitch input:checked + .evSwitchTrack::after {
          transform: translateX(14px);
        }

        .evSwitch input:focus-visible + .evSwitchTrack {
          outline: 2px solid var(--blue);
          outline-offset: 2px;
        }

        .evInvalid {
          border-color: #b3261e !important;
        }

        .evError {
          margin: 5px 0 0;
          font-size: 12px;
          color: #b3261e;
        }

        .evFormError {
          margin: 0 0 14px;
          padding: 8px 12px;
          font-size: 12.5px;
          color: #b3261e;
          background: #fbe9e7;
          border-radius: 5px;
        }

        .evFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 22px calc(12px + env(safe-area-inset-bottom));
          border-top: 1px solid #c9bfa0;
          background: var(--vellum);
          border-radius: 0;
          flex-shrink: 0;
        }

        @media (min-width: 820px) {
          .evFooter {
            padding: 12px 22px;
            border-radius: 0 0 8px 8px;
          }
        }

        .evHint {
          font-size: 10.5px;
          letter-spacing: 0.08em;
          color: var(--ink-soft);
        }

        .evActions {
          display: flex;
          gap: 8px;
        }

        .evActions .btn {
          padding: 8px 18px;
          font-size: 13.5px;
        }

        @media (max-width: 560px) {
          .evBody {
            padding: 16px 16px 4px;
          }

          .evFooter {
            padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
          }

          .evHint {
            display: none;
          }

          .evActions {
            width: 100%;
            justify-content: flex-end;
          }

          .evWhen:not(.dateOnly) {
            grid-template-columns: 1fr 124px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .evSwitchTrack,
          .evSwitchTrack::after {
            transition: none;
          }

          .evPanel {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
