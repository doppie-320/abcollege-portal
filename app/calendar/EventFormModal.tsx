"use client";

import { useEffect, useState, type FormEvent } from "react";
import DatePicker from "@/components/DatePicker";
import Select from "@/components/Select";
import { useScrollLock } from "@/lib/useScrollLock";
import { saveEvent, type EventInput } from "./actions";
import type { CalendarEntry } from "./CalendarContent";

// Keep in sync with the limits in actions.ts.
const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1000;

const KIND_OPTIONS = [
  { value: "event", label: "Event" },
  { value: "holiday", label: "Holiday / no classes" },
];

export default function EventFormModal({
  entry,
  defaultDate,
  onClose,
}: {
  // Edit this entry, or create a new one when omitted.
  entry?: CalendarEntry;
  defaultDate: string;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<EventInput>({
    name: entry?.name ?? "",
    date: entry?.date ?? defaultDate,
    kind: entry?.kind ?? "event",
    description: entry?.description ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useScrollLock();

  // DatePicker only lists years up to `max`, so leave room to plan ahead.
  const thisYear = new Date().getFullYear();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [saving, onClose]);

  function setField<K extends keyof EventInput>(key: K, value: EventInput[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const result = await saveEvent(fields, entry?.id);
      setFieldErrors(result.fieldErrors ?? {});
      if (result.success) {
        onClose();
        return;
      }
      if (result.error) setError(result.error);
    } catch {
      setError("Couldn't save this entry. Please try again.");
    }
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-navy-deep/55 px-4 py-[8vh] animate-fade-in"
      onClick={() => !saving && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        noValidate
        role="dialog"
        aria-modal="true"
        aria-labelledby="eventFormHeading"
        className="w-full max-w-[460px] rounded-lg border border-rule border-t-4 border-t-navy bg-paper px-6 pt-5 pb-5 shadow-[0_24px_60px_rgba(13,30,56,0.35)] animate-pop-in"
      >
        <span className="eyebrow mb-1">SOE CALENDAR</span>
        <h2 id="eventFormHeading" className="mb-4 text-xl">
          {entry ? "Edit entry" : "Add to calendar"}
        </h2>

        <label htmlFor="eventName">Name</label>
        <input
          id="eventName"
          type="text"
          value={fields.name}
          maxLength={MAX_NAME_LENGTH}
          onChange={(e) => setField("name", e.target.value)}
          placeholder="e.g. Engineering Days opening"
          autoFocus
          className={fieldErrors.name ? "mb-1" : undefined}
        />
        {fieldErrors.name && <p className="mb-3 text-xs text-[#b3261e]">{fieldErrors.name}</p>}

        <div className="mb-4 grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
          <div>
            <label htmlFor="eventDate">Date</label>
            <DatePicker
              id="eventDate"
              value={fields.date}
              onChange={(v) => setField("date", v)}
              max={`${thisYear + 2}-12-31`}
              minYear={thisYear - 2}
            />
            {fieldErrors.date && <p className="mt-1 mb-0 text-xs text-[#b3261e]">{fieldErrors.date}</p>}
          </div>
          <div>
            <label htmlFor="eventKind">Type</label>
            <Select
              id="eventKind"
              value={fields.kind}
              onChange={(v) => setField("kind", v as EventInput["kind"])}
              options={KIND_OPTIONS}
            />
          </div>
        </div>

        <label htmlFor="eventDescription">
          Details <span className="font-normal text-ink-soft/80">(optional)</span>
        </label>
        <textarea
          id="eventDescription"
          rows={3}
          value={fields.description}
          maxLength={MAX_DESCRIPTION_LENGTH}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="Venue, time, what to bring…"
          className="resize-y"
        />
        {fieldErrors.description && (
          <p className="-mt-3 mb-3 text-xs text-[#b3261e]">{fieldErrors.description}</p>
        )}

        {error && (
          <p role="alert" className="mb-3 text-[12.5px] text-[#b3261e]">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn ghost px-[18px] py-2 text-[13.5px]" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn px-[18px] py-2 text-[13.5px]" disabled={saving}>
            {saving ? "Saving…" : entry ? "Save changes" : "Add entry"}
          </button>
        </div>
      </form>
    </div>
  );
}
