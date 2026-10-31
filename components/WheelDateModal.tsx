"use client";

import { useState } from "react";
import WheelModal, { Wheel, type WheelItem } from "./WheelModal";

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

  function update(patch: Partial<Draft>) {
    setDraft((d) => normalize({ ...d, ...patch }, maxDate));
  }

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

  const yearItems: WheelItem[] = [];
  for (let y = earliestYear; y <= latestYear; y++) {
    yearItems.push({ label: String(y), disabled: maxY !== undefined && y > maxY });
  }

  return (
    <WheelModal
      title="Select date"
      columns="1.6fr 0.8fr 1fr"
      onClear={canClear ? onClear : undefined}
      onDone={() => onDone(new Date(draft.year, draft.month, draft.day))}
      onCancel={onCancel}
    >
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
    </WheelModal>
  );
}
