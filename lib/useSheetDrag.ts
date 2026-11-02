"use client";

import { useEffect, useRef, type PointerEvent } from "react";

/** Below this width the modals are bottom sheets; matches their CSS. */
export const SHEET_QUERY = "(max-width: 819px)";

/** Pulled down this far (px), the sheet closes on release. */
const CLOSE_DISTANCE = 120;
/** Pulled up this far (px), the sheet grows to full screen. */
const EXPAND_DISTANCE = 60;
/** A flick this fast (px per ms) counts even when it's short. */
const FLICK_SPEED = 0.6;
/** Movement (px) before a press on the handle counts as a drag instead of a tap. */
const DRAG_SLOP = 5;
const SETTLE_MS = 280;
const SETTLE = `${SETTLE_MS}ms cubic-bezier(0.32, 0.9, 0.35, 1)`;
const EXIT_MS = 220;

type Options = {
  /** Where the modal is a bottom sheet; dragging does nothing elsewhere. */
  query?: string;
  /**
   * Asked when the sheet is pulled far enough to close (or the handle is tapped).
   * Return false to keep it open, e.g. after asking about unsaved work.
   */
  onRequestClose: () => boolean;
  /** Called once the sheet has slid off screen; the modal should unmount without its own exit animation. */
  onClosed: () => void;
  /** Closes from the handle button (tap or keyboard), using the modal's own exit animation. */
  onHandleClose: () => void;
};

type Drag = {
  id: number;
  startY: number;
  lastY: number;
  lastT: number;
  velocity: number;
  /** Panel height when the drag began. */
  baseHeight: number;
  captured: boolean;
};

/**
 * Facebook-style bottom sheet gestures: drag the top bar down to close, up to go full screen,
 * and down again from full screen to shrink back. Spread `zoneProps` on the top bar,
 * `handleProps` on the <SheetHandle />, and attach the two refs.
 */
export function useSheetDrag<P extends HTMLElement>({
  query = SHEET_QUERY,
  onRequestClose,
  onClosed,
  onHandleClose,
}: Options) {
  const panelRef = useRef<P>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const expanded = useRef(false);
  /** Height to shrink back to from full screen. */
  const restHeight = useRef(0);
  const dragged = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Leaving sheet sizes (rotating, resizing) drops any drag styling so the desktop dialog looks normal.
  useEffect(() => {
    const mql = window.matchMedia(query);
    function onChange() {
      if (mql.matches) return;
      expanded.current = false;
      const panel = panelRef.current;
      if (!panel) return;
      panel.style.transition = "";
      panel.style.transform = "";
      setExpandedStyles(panel, false);
    }
    mql.addEventListener("change", onChange);
    return () => {
      mql.removeEventListener("change", onChange);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [query]);

  /** Animates the panel to `height` (px) with no offset, then hands sizing back to CSS (or full screen). */
  function settle(panel: P, height: number, expand: boolean) {
    panel.style.transition = `transform ${SETTLE}, height ${SETTLE}, border-radius ${SETTLE}`;
    panel.style.transform = "";
    panel.style.height = `${height}px`;
    panel.style.borderRadius = expand ? "0" : "";
    expanded.current = expand;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      panel.style.transition = "";
      setExpandedStyles(panel, expand);
    }, SETTLE_MS);
  }

  function slideOut(panel: P) {
    panel.style.transition = `transform ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1)`;
    panel.style.transform = "translateY(100%)";
    const backdrop = backdropRef.current;
    if (backdrop) {
      backdrop.style.transition = `opacity ${EXIT_MS}ms ease`;
      backdrop.style.opacity = "0";
    }
    setTimeout(onClosed, EXIT_MS);
  }

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    if (e.button !== 0 || drag.current || !window.matchMedia(query).matches) return;
    // Other controls in the bar keep working as taps.
    const target = e.target as HTMLElement;
    if (target.closest("a, input, textarea, select, button:not([data-sheet-handle])")) return;
    const panel = panelRef.current;
    if (!panel) return;

    if (settleTimer.current) clearTimeout(settleTimer.current);
    const height = panel.getBoundingClientRect().height;
    if (!expanded.current) restHeight.current = height;
    dragged.current = false;
    drag.current = {
      id: e.pointerId,
      startY: e.clientY,
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
      baseHeight: height,
      captured: false,
    };
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    const panel = panelRef.current;
    if (!d || !panel || e.pointerId !== d.id) return;

    const dy = e.clientY - d.startY;
    if (!d.captured) {
      if (Math.abs(dy) < DRAG_SLOP) return;
      // Only now, so a plain tap on the handle still reaches its click handler.
      e.currentTarget.setPointerCapture(e.pointerId);
      d.captured = true;
      dragged.current = true;
      panel.style.transition = "none";
    }

    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.velocity = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;

    if (dy >= 0) {
      panel.style.transform = `translateY(${dy}px)`;
      panel.style.height = `${d.baseHeight}px`;
    } else {
      // Grows toward full screen, with a little resistance past it.
      const max = window.innerHeight;
      const grown = d.baseHeight - dy;
      const height = grown <= max ? grown : max + (grown - max) * 0.15;
      panel.style.transform = height > max ? `translateY(${max - height}px)` : "";
      panel.style.height = `${Math.min(height, max)}px`;
      panel.style.maxHeight = "none";
    }
  }

  function onPointerEnd(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    const panel = panelRef.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (!d.captured || !panel) return;

    const dy = e.clientY - d.startY;
    const flickDown = d.velocity > FLICK_SPEED;
    const flickUp = d.velocity < -FLICK_SPEED;
    const fullHeight = window.innerHeight;

    if (dy > 0) {
      // From full screen, a modest pull only shrinks it back down.
      if (expanded.current && !flickDown && dy < fullHeight * 0.45) {
        settle(panel, restHeight.current || d.baseHeight, false);
        return;
      }
      if (dy > CLOSE_DISTANCE || (flickDown && dy > 20)) {
        if (onRequestClose()) {
          slideOut(panel);
          return;
        }
      }
      settle(panel, d.baseHeight, expanded.current);
      return;
    }

    if (dy < -EXPAND_DISTANCE || flickUp) settle(panel, fullHeight, true);
    else settle(panel, d.baseHeight, expanded.current);
  }

  return {
    panelRef,
    backdropRef,
    zoneProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      style: { touchAction: "none" as const },
    },
    handleProps: {
      onClick() {
        // The release at the end of a drag isn't a tap.
        if (dragged.current) {
          dragged.current = false;
          return;
        }
        onHandleClose();
      },
    },
  };
}

/** Full screen, or back to whatever size the modal's CSS gives it. */
function setExpandedStyles(panel: HTMLElement, on: boolean) {
  panel.style.height = on ? "100dvh" : "";
  panel.style.maxHeight = on ? "100dvh" : "";
  panel.style.borderRadius = on ? "0" : "";
}
