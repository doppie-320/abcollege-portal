"use client";

import { useEffect, useState, type FormEvent } from "react";
import DatePicker from "@/components/DatePicker";
import Select from "@/components/Select";
import { useScrollLock } from "@/lib/useScrollLock";
import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH, validateEvent, type EventInput } from "./validation";

const KIND_OPTIONS = [
  { value: "event", label: "Event" },
  { value: "holiday", label: "Holiday / no classes" },
];

export default function EventFormModal({
  isEdit,
  initialFields,
  initialError = "",
  onSave,
  onClose,
}: {
  isEdit: boolean;
  initialFields: EventInput;
  // Set when the form reopens after a save failed on the server.
  initialError?: string;
  // Called with valid fields; the caller closes the form and saves optimistically.
  onSave: (fields: EventInput) => void;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<EventInput>(initialFields);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  useScrollLock();

  // DatePicker only lists years up to `max`, so leave room to plan ahead.
  const thisYear = new Date().getFullYear();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function setField<K extends keyof EventInput>(key: K, value: EventInput[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errors = validateEvent(fields);
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) onSave(fields);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-navy-deep/55 px-4 py-[8vh] animate-fade-in"
      onClick={onClose}
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
          {isEdit ? "Edit entry" : "Add to calendar"}
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

        {initialError && (
          <p role="alert" className="mb-3 text-[12.5px] text-[#b3261e]">
            {initialError}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn ghost px-[18px] py-2 text-[13.5px]" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn px-[18px] py-2 text-[13.5px]">
            {isEdit ? "Save changes" : "Add entry"}
          </button>
        </div>
      </form>
    </div>
  );
}
