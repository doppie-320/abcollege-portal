"use client";

import { useSyncExternalStore } from "react";

// App-wide notices for work that finishes after its dialog has already closed,
// e.g. an optimistic delete the server then refuses. Call toast() from anywhere;
// <Toaster /> in the root layout draws them.

export type ToastTone = "success" | "warning" | "error";
type ToastItem = { id: number; text: string; tone: ToastTone };

/** Success toasts clear themselves; warnings and errors wait to be read. */
const SUCCESS_MS = 3000;
const MAX_TOASTS = 3;

let toasts: ToastItem[] = [];
let nextId = 0;
const listeners = new Set<() => void>();
const NO_TOASTS: ToastItem[] = [];

function emit(next: ToastItem[]) {
  toasts = next;
  listeners.forEach((listener) => listener());
}

export function dismissToast(id: number) {
  emit(toasts.filter((item) => item.id !== id));
}

export function toast(text: string, tone: ToastTone = "error") {
  const id = ++nextId;
  emit([...toasts, { id, text, tone }].slice(-MAX_TOASTS));
  if (tone === "success") setTimeout(() => dismissToast(id), SUCCESS_MS);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const TONES: Record<ToastTone, { box: string; badge: string; bar: string; icon: string }> = {
  success: { box: "border-blue/30 bg-[#e6f3ff] text-navy-deep", badge: "bg-blue", bar: "bg-blue/50", icon: "M20 6 9 17l-5-5" },
  warning: {
    box: "border-orange/40 bg-[#fcebdf] text-[#7a2e0f]",
    badge: "bg-orange",
    bar: "bg-orange/50",
    icon: "M12 9v4M12 17h.01",
  },
  error: {
    box: "border-[#b3261e]/30 bg-[#fbe9e7] text-[#8f1e18]",
    badge: "bg-[#b3261e]",
    bar: "bg-[#b3261e]/50",
    icon: "M12 8v4M12 16h.01",
  },
};

export default function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts, () => NO_TOASTS);
  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[130] flex flex-col items-center gap-2 px-4">
      {items.map((item) => {
        const tone = TONES[item.tone];
        return (
          <div
            key={item.id}
            role={item.tone === "error" ? "alert" : "status"}
            className={`animate-fade-in-up pointer-events-auto relative flex w-full max-w-[440px] items-start gap-3 overflow-hidden rounded-lg border px-3.5 py-3 text-[13px] shadow-[0_12px_32px_rgba(13,30,56,0.22)] ${tone.box}`}
          >
            <span className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-paper ${tone.badge}`}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={tone.icon} />
              </svg>
            </span>
            <p className="mb-0 flex-1 font-medium [overflow-wrap:anywhere]">{item.text}</p>
            <button
              type="button"
              onClick={() => dismissToast(item.id)}
              aria-label="Dismiss"
              className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent opacity-60 transition-opacity hover:opacity-100"
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
            {item.tone === "success" && (
              <span
                aria-hidden="true"
                className={`animate-shrink-x absolute inset-x-0 bottom-0 h-0.5 origin-left motion-reduce:hidden ${tone.bar}`}
                style={{ animationDuration: `${SUCCESS_MS}ms` }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
