import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "404 - Page Not Found",
  description: "The page you are looking for does not exist.",
};

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body>
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-6">
          {/* Giant transparent backdrop */}
          <div
            aria-hidden="true"
            className="font-display pointer-events-none absolute inset-0 flex items-center justify-center leading-none font-bold tracking-tighter text-navy-deep/[0.08] select-none"
          >
            <span className="text-[52vw] whitespace-nowrap sm:text-[36vw] lg:text-[30rem]">
              404
            </span>
          </div>

          {/* Foreground content */}
          <div className="relative z-10 w-full max-w-md animate-fade-in-up text-center">
            <h1 className="font-display mb-3 text-5xl font-medium tracking-tight text-ink">
              Page Not Found
            </h1>
            <p className="mx-auto mb-8 max-w-sm text-sm text-ink-soft">
              The link you followed may be broken, or the page may have moved.
              Check the URL or head back home.
            </p>

            {/* Plain <a> tags: global-not-found bypasses the app router,
                so next/link client-side transitions don't fire here. */}
            <div className="flex items-center justify-center gap-3 max-sm:flex-col">
              <a href="/home" className="btn">
                Go Home <span aria-hidden="true">&rarr;</span>
              </a>
              <a href="/login" className="btn ghost">
                Back to login
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
