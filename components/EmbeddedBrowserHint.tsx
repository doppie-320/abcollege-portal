"use client";

import { useSyncExternalStore } from "react";

// Apps that open links in their own built-in browser. Google refuses to sign in
// from those (error 403 disallowed_useragent), and the person never gets back to
// the portal to see an error of ours. "; wv)" marks any Android WebView.
const EMBEDDED_BROWSER_RE =
  /FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger|Instagram|\bLine\/|musical_ly|BytedanceWebview|Snapchat|Twitter|; wv\)/i;

function subscribe() {
  // The user agent never changes while the page is open.
  return () => {};
}

function isEmbeddedBrowser() {
  return EMBEDDED_BROWSER_RE.test(navigator.userAgent);
}

/** Shown under a Google button when the page is open in an app's built-in browser. */
export default function EmbeddedBrowserHint() {
  // false on the server and during hydration, then the real answer.
  const embedded = useSyncExternalStore(subscribe, isEmbeddedBrowser, () => false);
  if (!embedded) return null;

  return (
    <p className="embeddedHint" role="note">
      Google sign-in doesn&apos;t work in this app&apos;s built-in browser. Tap the{" "}
      <strong>⋯</strong> menu and choose <strong>Open in browser</strong> (or open this
      page in Chrome or Safari), then continue with Google.
      <style jsx>{`
        .embeddedHint {
          font-size: 12.5px;
          line-height: 1.5;
          color: var(--ink-soft);
          background: var(--vellum-2);
          border: 1px solid #c9bfa0;
          border-radius: 6px;
          padding: 8px 10px;
          margin: 10px 0 0;
        }
      `}</style>
    </p>
  );
}
