"use client";

import { useEffect } from "react";

// Ref-counted so nested modals (e.g. a ConfirmDialog inside CreatePostModal) can
// unmount in any order without leaving the body stuck on overflow: hidden.
let lockCount = 0;
let previousOverflow = "";

export function useScrollLock() {
  useEffect(() => {
    if (lockCount === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    lockCount++;
    return () => {
      lockCount--;
      if (lockCount === 0) document.body.style.overflow = previousOverflow;
    };
  }, []);
}
