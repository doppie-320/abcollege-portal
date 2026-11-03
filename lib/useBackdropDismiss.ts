"use client";

import { useRef, type MouseEvent } from "react";

/**
 * Spread onto a modal's backdrop so a click outside the dialog closes it.
 *
 * The browser also reports a "click" on the backdrop when a press starts inside the dialog
 * and is released outside it (selecting text, dragging a slider), or the other way round.
 * Only a press and a release that both land on the backdrop itself count as clicking outside.
 */
export function useBackdropDismiss(onDismiss: () => void, enabled = true) {
  const pressedOnBackdrop = useRef(false);
  const releasedOnBackdrop = useRef(false);

  return {
    onMouseDown(e: MouseEvent<HTMLElement>) {
      pressedOnBackdrop.current = e.target === e.currentTarget;
    },
    onMouseUp(e: MouseEvent<HTMLElement>) {
      releasedOnBackdrop.current = e.target === e.currentTarget;
    },
    onClick() {
      const outside = pressedOnBackdrop.current && releasedOnBackdrop.current;
      pressedOnBackdrop.current = false;
      releasedOnBackdrop.current = false;
      if (outside && enabled) onDismiss();
    },
  };
}
