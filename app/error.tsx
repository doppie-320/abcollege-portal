'use client'

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
    error, retry
}: {
    error: Error & { digest?: string }
    retry: () => void
}) {
    useEffect(() => {
        console.error(error);
    }, [error])

    // Same layout as global-not-found.tsx, so the two "something's off" pages match.
    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-6">
            {/* Giant transparent backdrop */}
            <div
                aria-hidden="true"
                className="font-display pointer-events-none absolute inset-0 flex items-center justify-center leading-none font-bold tracking-tighter text-navy-deep/[0.08] select-none"
            >
                <span className="text-[44vw] whitespace-nowrap sm:text-[30vw] lg:text-[26rem]">
                    Oops
                </span>
            </div>

            {/* Foreground content */}
            <div className="relative z-10 w-full max-w-md animate-fade-in-up text-center">
                <h1 className="font-display mb-3 text-5xl font-medium tracking-tight text-ink">
                    Something Went Wrong
                </h1>
                <p className="mx-auto mb-8 max-w-sm text-sm text-ink-soft">
                    We couldn&apos;t load this page. It might be a temporary problem, so try
                    again or head back home.
                </p>

                {/* Real messages only in dev; production server errors are generic anyway. */}
                {process.env.NODE_ENV === "development" && error.message && (
                    <p className="mono mx-auto mb-8 max-w-sm rounded-[5px] border border-orange bg-orange/[0.06] px-3 py-2.5 text-left text-xs [overflow-wrap:anywhere] text-orange">
                        {error.message}
                    </p>
                )}

                <div className="flex items-center justify-center gap-3 max-sm:flex-col">
                    <button type="button" className="btn" onClick={() => retry()}>
                        Try again
                    </button>
                    <Link href="/home" className="btn ghost">
                        Go home <span aria-hidden="true">&rarr;</span>
                    </Link>
                </div>

                {error.digest && (
                    <p className="mono mt-6 mb-0 text-[11px] text-ink-soft">
                        Error ID: <span className="select-all">{error.digest}</span>
                    </p>
                )}
            </div>
        </main>
    );
}
