"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js, which lets phones install the attendance pages as apps
 * and shows an offline page instead of the browser's error screen. Browsers only
 * allow service workers on HTTPS (or localhost), so on a LAN dev URL this does nothing.
 */
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  }, []);

  return null;
}
