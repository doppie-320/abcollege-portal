"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Instant feedback while the next page loads: an orange bar creeps across the top the
// moment a link is clicked, and a spinner shows up if the wait drags on. Without it a
// click on a server-rendered page looks like nothing happened until the new page lands.

/** Where the bar jumps to on click, so the response feels immediate. */
const START = 0.15;
/** The bar slows toward this and only fills the rest once the page arrives. */
const CEILING = 0.9;
const TRICKLE_MS = 250;
const FINISH_MS = 400;
/** Stop waiting if the URL never changes, e.g. a redirect back to the same page. */
const GIVE_UP_MS = 10000;

type Phase = "idle" | "loading" | "done";

/** True when a click on this link will start a client-side move to a different page. */
function leavesPage(e: MouseEvent): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const link = (e.target as Element | null)?.closest?.("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return false;
  if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return false;
  const url = new URL(link.href, window.location.href);
  // Same-page links (hash jumps, nav reselects, query-only changes) never change the pathname.
  return url.origin === window.location.origin && url.pathname !== window.location.pathname;
}

function Indicator() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const fromPath = useRef<string | null>(null);

  // Capture phase, so the bar starts even if a handler further down stops the click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!leavesPage(e)) return;
      // A second click mid-load keeps the bar where it is instead of snapping back.
      if (fromPath.current === null) setProgress(START);
      fromPath.current = window.location.pathname;
      setPhase("loading");
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (phase === "loading" && fromPath.current !== pathname) setPhase("done");
  }, [pathname, phase]);

  useEffect(() => {
    if (phase !== "loading") return;
    const trickle = setInterval(() => setProgress((p) => p + (CEILING - p) * 0.12), TRICKLE_MS);
    const giveUp = setTimeout(() => setPhase("done"), GIVE_UP_MS);
    return () => {
      clearInterval(trickle);
      clearTimeout(giveUp);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "done") return;
    setProgress(1);
    const reset = setTimeout(() => {
      fromPath.current = null;
      setPhase("idle");
      setProgress(0);
    }, FINISH_MS);
    return () => clearTimeout(reset);
  }, [phase]);

  if (phase === "idle") return null;
  const done = phase === "done";

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[1000] h-[3px] origin-left bg-orange shadow-[0_0_8px_rgba(217,83,30,0.55)]"
        style={{
          transform: `scaleX(${progress})`,
          opacity: done ? 0 : 1,
          transition: done
            ? "transform 200ms ease-out, opacity 200ms ease 200ms"
            : "transform 250ms ease-out",
        }}
      />
      {!done && (
        // Sits just under the nav bar; fades in late so quick, prefetched hops don't flash it.
        <div
          role="status"
          className="pointer-events-none fixed left-1/2 z-[95] -translate-x-1/2 animate-[fadeIn_200ms_ease-out_250ms_both] rounded-full border border-rule bg-paper p-2 shadow-[0_6px_18px_rgba(13,30,56,0.18)]"
          style={{ top: "calc(var(--nav-offset, 0px) + 12px)" }}
        >
          <span className="block size-5 animate-spin rounded-full border-[2.5px] border-navy/15 border-t-orange" />
          <span className="sr-only">Loading page…</span>
        </div>
      )}
    </>
  );
}

export default function NavigationProgress() {
  // usePathname suspends while prerendering routes with unknown params (e.g. /admin/attendance/[eventId]).
  return (
    <Suspense fallback={null}>
      <Indicator />
    </Suspense>
  );
}
