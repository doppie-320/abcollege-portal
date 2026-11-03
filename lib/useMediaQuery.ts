"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Whether `query` matches right now; false on the server and when no query is given. */
export function useMediaQuery(query: string | undefined): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!query) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => !!query && window.matchMedia(query).matches,
    () => false,
  );
}
