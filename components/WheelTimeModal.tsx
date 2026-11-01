"use client";

import { useState } from "react";
import WheelModal, { Wheel } from "./WheelModal";

const LAST_MINUTE = 24 * 60 - 1;

// Hours run 12, 1, 2 … 11 so a row's index plus 12 for PM is the 24-hour hour.
type Draft = { hour: number; minute: number; pm: boolean };

type Props = {
  /** Minutes after midnight. */
  initial: number;
  /** Earliest pickable time in minutes after midnight, e.g. an event's start for its end. */
  min?: number;
  title: string;
  /** A line under the title for the time being picked, e.g. how long the event would run. */
  describe?: (minutes: number) => string;
  onDone: (minutes: number) => void;
  onCancel: () => void;
};

function totalOf({ hour, minute, pm }: Draft): number {
  return (hour + (pm ? 12 : 0)) * 60 + minute;
}

function draftOf(total: number): Draft {
  const hour24 = Math.floor(total / 60);
  return { hour: hour24 % 12, minute: total % 60, pm: hour24 >= 12 };
}

/** Springs a picked time forward to `min`, the way the date wheel springs back from its max. */
function normalize(draft: Draft, min: number): Draft {
  return totalOf(draft) < min ? draftOf(min) : draft;
}

export default function WheelTimeModal({ initial, min = 0, title, describe, onDone, onCancel }: Props) {
  const [draft, setDraft] = useState<Draft>(() =>
    normalize(draftOf(Math.min(Math.max(initial, 0), LAST_MINUTE)), min),
  );

  function update(patch: Partial<Draft>) {
    setDraft((d) => normalize({ ...d, ...patch }, min));
  }

  const base = draft.pm ? 12 : 0;

  const hourItems = Array.from({ length: 12 }, (_, i) => ({
    label: String(i || 12),
    disabled: (base + i) * 60 + 59 < min,
  }));

  const minuteItems = Array.from({ length: 60 }, (_, i) => ({
    label: String(i).padStart(2, "0"),
    disabled: (base + draft.hour) * 60 + i < min,
  }));

  const periodItems = [
    { label: "AM", disabled: 11 * 60 + 59 < min },
    { label: "PM", disabled: false },
  ];

  return (
    <WheelModal
      title={title}
      subtitle={describe?.(totalOf(draft))}
      columns="1fr 1fr 1fr"
      onDone={() => onDone(totalOf(draft))}
      onCancel={onCancel}
    >
      <Wheel
        label="Hour"
        items={hourItems}
        index={draft.hour}
        onSelect={(i) => update({ hour: i })}
        align="right"
      />
      <Wheel
        label="Minute"
        items={minuteItems}
        index={draft.minute}
        onSelect={(i) => update({ minute: i })}
        align="center"
      />
      <Wheel
        label="AM/PM"
        items={periodItems}
        index={draft.pm ? 1 : 0}
        onSelect={(i) => update({ pm: i === 1 })}
        align="left"
      />
    </WheelModal>
  );
}
