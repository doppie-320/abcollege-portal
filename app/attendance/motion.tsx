"use client";

// Small entrance animations for attendance numbers. Both settle instantly
// for people who prefer reduced motion.

import { useEffect, useState } from "react";

const COUNT_MS = 700;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Counts up from 0 on mount, then follows `value` without animating. */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (value === 0 || prefersReducedMotion()) return;
    let frame = 0;
    const start = performance.now();
    function step(now: number) {
      const t = Math.min(1, (now - start) / COUNT_MS);
      // Ease out cubic: fast start, gentle landing.
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // Only the first value animates; later changes (e.g. after a refresh) just show.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setShown(value), [value]);

  return <span className="tabular-nums">{shown}</span>;
}

export type BarSegment = { label: string; value: number; color: string };

/** One horizontal bar split by share, growing in from the left on mount. */
export function SplitBar({ segments, label }: { segments: BarSegment[]; label: string }) {
  const [grown, setGrown] = useState(false);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div>
      <div className="mono mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[10px] tracking-[0.06em] text-ink-soft uppercase">
        <span>{label}</span>
        <span className="flex flex-wrap gap-x-3">
          {segments.map((segment) => (
            <span key={segment.label} className="flex items-center gap-1.5">
              <span className={`size-1.5 rounded-full ${segment.color}`} />
              {segment.label} {total ? Math.round((segment.value / total) * 100) : 0}%
            </span>
          ))}
        </span>
      </div>
      <div
        role="img"
        aria-label={segments.map((segment) => `${segment.label}: ${segment.value}`).join(", ")}
        className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-vellum-2"
      >
        {total > 0 &&
          segments.map((segment, index) =>
            segment.value > 0 ? (
              <span
                key={segment.label}
                className={`h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none ${segment.color}`}
                style={{
                  width: grown ? `${(segment.value / total) * 100}%` : "0%",
                  transitionDelay: `${index * 120}ms`,
                }}
              />
            ) : null,
          )}
      </div>
    </div>
  );
}
