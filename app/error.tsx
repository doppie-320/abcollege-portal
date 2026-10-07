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

    return(
        <main className="errorWrap">
            <div className="tick-frame errorCard">
                <span className="tick-bl" />
                <span className="tick-br" />

                <div className="errorIcon">!</div>
                <span className="eyebrow">SOMETHING WENT WRONG</span>
                <h2>We couldn&apos;t load this page</h2>
                <p className="errorSub">
                    This might be a temporary problem. Try again, or head back to the home page.
                </p>

                {/* Real messages only in dev; production server errors are generic anyway. */}
                {process.env.NODE_ENV === "development" && error.message && (
                    <p className="mono errorDetail">{error.message}</p>
                )}

                <div className="errorActions">
                    <button type="button" className="btn primary" onClick={() => retry()}>
                        Try again
                    </button>
                    <Link href="/home" className="btn ghost">
                        Go home
                    </Link>
                </div>

                {error.digest && <p className="mono errorDigest">Error ID: {error.digest}</p>}
            </div>

            <style jsx>{`
                .errorWrap {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px 16px;
                }

                .errorCard {
                    width: 100%;
                    max-width: 440px;
                    padding: 36px 32px 28px;
                    text-align: center;
                    animation: fadeInUp 0.4s ease backwards;
                }

                .errorIcon {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    background: var(--orange);
                    color: var(--white);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: 'Space Grotesk', sans-serif;
                    font-weight: 700;
                    font-size: 22px;
                    margin: 0 auto 18px;
                    animation: popIn 0.2s ease 0.15s backwards;
                }

                .errorSub {
                    color: var(--ink-soft);
                    font-size: 14px;
                }

                .errorDetail {
                    font-size: 12px;
                    color: var(--orange);
                    background: rgba(217, 83, 30, 0.08);
                    border: 1px solid var(--orange);
                    padding: 10px 12px;
                    text-align: left;
                    overflow-wrap: anywhere;
                }

                .errorActions {
                    display: flex;
                    gap: 10px;
                    margin-top: 8px;
                }

                .errorActions :global(.btn) {
                    flex: 1;
                }

                .errorDigest {
                    font-size: 11px;
                    color: var(--ink-soft);
                    margin: 18px 0 0;
                }

                @media (max-width: 480px) {
                    .errorCard {
                        padding: 28px 20px 22px;
                    }

                    .errorActions {
                        flex-direction: column;
                    }
                }
            `}</style>
        </main>
    );
}
