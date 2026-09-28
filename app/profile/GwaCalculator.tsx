"use client";

import { useState } from "react";
import Select from "@/components/Select";

const GRADE_POINTS = [
  "1.00",
  "1.25",
  "1.50",
  "1.75",
  "2.00",
  "2.25",
  "2.50",
  "2.75",
  "3.00",
  "3.50",
  "3.75",
  "4.00",
  "4.25",
  "4.50",
  "4.75",
  "5.00",
];

const GRADE_OPTIONS = GRADE_POINTS.map((value) => ({ value, label: value }));

const MAX_UNITS = 12;

type Subject = {
  id: string;
  code: string;
  units: string;
  grade: string;
};

type SubjectErrors = {
  code?: string;
  units?: string;
  grade?: string;
};

const EMPTY_FIELDS: Omit<Subject, "id"> = {
  code: "",
  units: "",
  grade: "",
};

let nextKey = 0;

function newSubject(): Subject {
  nextKey += 1;
  return { id: `subject-${nextKey}`, ...EMPTY_FIELDS };
}

function validate(subject: Subject): SubjectErrors {
  const errors: SubjectErrors = {};

  if (!subject.code.trim()) {
    errors.code = "Enter the subject code.";
  }

  if (!subject.units.trim()) {
    errors.units = "Enter units.";
  } else {
    const units = Number(subject.units);

    if (!Number.isFinite(units) || units <= 0) {
      errors.units = "Units must be greater than 0.";
    } else if (units > MAX_UNITS) {
      errors.units = `Units cannot exceed ${MAX_UNITS}.`;
    }
  }

  if (!subject.grade) {
    errors.grade = "Pick a grade.";
  }

  return errors;
}

function isCounted(subject: Subject): boolean {
  return Object.keys(validate(subject)).length === 0;
}

function computeGwa(subjects: Subject[]) {
  const counted = subjects.filter(isCounted);

  if (counted.length === 0) {
    return { gwa: null as number | null, units: 0, subjects: 0 };
  }

  let totalPoints = 0;
  let totalUnits = 0;

  for (const subject of counted) {
    const units = Number(subject.units);
    totalPoints += Number(subject.grade) * units;
    totalUnits += units;
  }

  return {
    gwa: totalUnits === 0 ? null : totalPoints / totalUnits,
    units: totalUnits,
    subjects: counted.length,
  };
}

export default function GwaCalculator() {
  const [subjects, setSubjects] = useState<Subject[]>([newSubject()]);

  function updateSubject(id: string, patch: Partial<Omit<Subject, "id">>) {
    setSubjects((prev) =>
      prev.map((subject) =>
        subject.id === id ? { ...subject, ...patch } : subject
      )
    );
  }

  function addSubject() {
    setSubjects((prev) => [...prev, newSubject()]);
  }

  function removeSubject(id: string) {
    setSubjects((prev) =>
      prev.length === 1
        ? [newSubject()]
        : prev.filter((subject) => subject.id !== id)
    );
  }

  function clearAll() {
    setSubjects([newSubject()]);
  }

  const { gwa, units, subjects: countedSubjects } = computeGwa(subjects);
  const [only] = subjects;
  const isBlank =
    subjects.length === 1 && !only.code && !only.units && !only.grade;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <span className="eyebrow mb-1.5">GWA CALCULATOR</span>
          <h2 className="mb-0 text-lg">Running general weighted average</h2>
        </div>
        <div className="flex flex-col items-end gap-0.5 max-[620px]:items-start">
          <span className="font-mono text-[34px] font-bold leading-none text-orange">
            {gwa === null ? "—" : gwa.toFixed(2)}
          </span>
          <span className="font-mono text-[9.5px] tracking-[0.04em] text-ink-soft">
            GENERAL WEIGHTED AVERAGE
          </span>
        </div>
      </div>

      <hr className="my-3.5 border-0 border-t border-rule" />

      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <th
              scope="col"
              className="pb-2 pr-2 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.04em] text-ink-soft"
            >
              Subject
            </th>
            <th
              scope="col"
              className="w-[108px] pb-2 pr-2 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.04em] text-ink-soft max-[620px]:w-[84px]"
            >
              Units
            </th>
            <th
              scope="col"
              className="w-[108px] pb-2 pr-2 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.04em] text-ink-soft max-[620px]:w-[84px]"
            >
              Grade
            </th>
            <th scope="col" className="w-10 pb-2 text-left">
              <span className="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-vellum-2">
          {subjects.map((subject) => {
            const errors = validate(subject);

            return (
              <tr key={subject.id}>
                <td className="py-0 pr-2 align-top text-[13px]">
                  <input
                    type="text"
                    className="mb-0 w-full p-2 text-[13.5px] shadow-none"
                    placeholder="e.g. CS 101"
                    aria-label="Subject code"
                    value={subject.code}
                    onChange={(e) =>
                      updateSubject(subject.id, { code: e.target.value })
                    }
                  />
                  {errors.code && (
                    <p className="mt-1 mb-0 text-[11px] text-orange">
                      {errors.code}
                    </p>
                  )}
                </td>
                <td className="py-0 pr-2 align-top text-[13px]">
                  <input
                    type="text"
                    inputMode="decimal"
                    className="mb-0 w-full p-2 text-center text-[13.5px] shadow-none"
                    placeholder="3"
                    aria-label="Units"
                    value={subject.units}
                    onChange={(e) =>
                      updateSubject(subject.id, { units: e.target.value })
                    }
                  />
                  {errors.units && (
                    <p className="mt-1 mb-0 text-[11px] text-orange">
                      {errors.units}
                    </p>
                  )}
                </td>
                <td className="py-0 pr-2 align-top text-[13px]">
                  <Select
                    compact
                    aria-label="Grade point"
                    value={subject.grade}
                    onChange={(value) =>
                      updateSubject(subject.id, { grade: value })
                    }
                    options={GRADE_OPTIONS}
                    placeholder="Grade"
                  />
                  {errors.grade && (
                    <p className="mt-1 mb-0 text-[11px] text-orange">
                      {errors.grade}
                    </p>
                  )}
                </td>
                <td className="w-10 py-0 align-top">
                  <button
                    type="button"
                    className="cursor-pointer rounded-[5px] border border-transparent bg-transparent p-1.5 text-ink-soft hover:border-rule hover:text-orange"
                    aria-label={`Remove ${subject.code.trim() || "subject"}`}
                    onClick={() => removeSubject(subject.id)}
                  >
                    <RemoveIcon />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td
              colSpan={2}
              className="border-t border-rule pt-3 pr-2 text-[12.5px] text-ink-soft"
            >
              {countedSubjects} of {subjects.length} subject
              {subjects.length === 1 ? "" : "s"} counted
            </td>
            <td className="border-t border-rule pt-3 pr-2 font-mono text-[14px] text-ink">
              {units || "—"}
            </td>
            <td className="w-10 border-t border-rule pt-3">
              <span className="font-mono text-[9.5px] tracking-[0.04em] text-ink-soft">
                UNITS
              </span>
            </td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-1 flex flex-wrap gap-2.5">
        <button
          type="button"
          className="btn ghost px-4 py-2 text-[13px]"
          onClick={addSubject}
        >
          <PlusIcon />
          Add subject
        </button>
        <button
          type="button"
          className="btn ghost px-4 py-2 text-[13px]"
          onClick={clearAll}
          disabled={isBlank}
        >
          Clear all
        </button>
      </div>

      <p className="mt-3.5 mb-0 text-xs text-ink-soft">
        GWA = &Sigma;(grade point &times; units) &divide; total units. Rows still
        missing a subject code, units, or grade are skipped. This calculator is a
        scratchpad and is not saved to your account.
      </p>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
