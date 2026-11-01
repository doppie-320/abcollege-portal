"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PopoverPlace = {
  left: number;
  top: number;
  width: number;
  /** Room left between the trigger and the edge of the screen it opens towards. */
  maxHeight: number;
  /** Opens upward: `top` is then the popover's bottom edge, so shift it up by its own height. */
  above: boolean;
};

type Options = {
  /** "start" lines the popover up with the trigger's left edge, "end" with its right edge. */
  align?: "start" | "end";
  /** Popover width; by default it matches the trigger. */
  width?: number;
  /** Space between the trigger and the popover. */
  gap?: number;
  /** With less room than this below the trigger, it opens upward if there's more room above. */
  minHeight?: number;
};

const EDGE = 8;

function placeAt(trigger: HTMLElement, { align = "start", width, gap = 4, minHeight = 200 }: Options): PopoverPlace {
  const rect = trigger.getBoundingClientRect();
  // Measure against what's actually visible, which excludes an on-screen keyboard.
  const vv = window.visualViewport;
  const viewLeft = vv?.offsetLeft ?? 0;
  const viewTop = vv?.offsetTop ?? 0;
  const viewWidth = vv?.width ?? window.innerWidth;
  const viewBottom = viewTop + (vv?.height ?? window.innerHeight);
  const popoverWidth = Math.min(width ?? rect.width, viewWidth - EDGE * 2);
  const left = align === "end" ? rect.right - popoverWidth : rect.left;
  const spaceBelow = viewBottom - rect.bottom - gap - EDGE;
  const spaceAbove = rect.top - viewTop - gap - EDGE;
  const above = spaceBelow < minHeight && spaceAbove > spaceBelow;
  return {
    left: Math.max(viewLeft + EDGE, Math.min(left, viewLeft + viewWidth - popoverWidth - EDGE)),
    top: above ? rect.top - gap : rect.bottom + gap,
    width: popoverWidth,
    maxHeight: above ? spaceAbove : spaceBelow,
    above,
  };
}

/**
 * A dropdown pinned to its trigger with position: fixed, for rendering into document.body so a
 * modal or scroll area that clips its overflow can't cut it off. It follows the trigger while the
 * page scrolls or resizes, and opens upward when there's more room above.
 */
export function useAnchoredPopover<T extends HTMLElement>(options: Options = {}) {
  const triggerRef = useRef<T>(null);
  const [place, setPlace] = useState<PopoverPlace | null>(null);
  const open = place !== null;

  // Read through a ref so the listeners below don't need re-adding when a caller passes a new object.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!open) return;
    function follow() {
      const trigger = triggerRef.current;
      if (trigger) setPlace(placeAt(trigger, optionsRef.current));
    }
    const vv = window.visualViewport;
    window.addEventListener("resize", follow);
    vv?.addEventListener("resize", follow);
    vv?.addEventListener("scroll", follow);
    document.addEventListener("scroll", follow, true);
    return () => {
      window.removeEventListener("resize", follow);
      vv?.removeEventListener("resize", follow);
      vv?.removeEventListener("scroll", follow);
      document.removeEventListener("scroll", follow, true);
    };
  }, [open]);

  function show() {
    const trigger = triggerRef.current;
    if (trigger) setPlace(placeAt(trigger, optionsRef.current));
  }

  // Stable, so callers can list it in their own effects' dependencies.
  const hide = useCallback(() => setPlace(null), []);

  return { triggerRef, place, open, show, hide };
}
