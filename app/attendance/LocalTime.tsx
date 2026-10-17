"use client";

import { useSyncExternalStore } from "react";

const FORMATS = {
  datetime: { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" },
  short: { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  date: { month: "short", day: "numeric", year: "numeric" },
  time: { hour: "numeric", minute: "2-digit" },
  month: { month: "short" },
  day: { day: "numeric" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type TimeFormat = keyof typeof FORMATS;

const noopSubscribe = () => () => {};

/** False during SSR and hydration, true after. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/**
 * A timestamp in the viewer's own time zone. The server would format it in
 * its zone instead, so the text is filled in once the page hydrates.
 */
export default function LocalTime({ value, format = "datetime" }: { value: string | Date; format?: TimeFormat }) {
  const hydrated = useHydrated();
  const date = new Date(value);

  return (
    <time dateTime={date.toISOString()}>
      {hydrated ? date.toLocaleString(undefined, FORMATS[format]) : " "}
    </time>
  );
}
