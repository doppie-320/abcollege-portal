export type ActionResult = {
    success?: boolean;
    error?: string;
    /** Extra context for `error`, e.g. the account status on login. */
    status?: string;
    fieldErrors?: Record<string, string>
};
export const OFFLINE_ERROR = "Couldn't reach the server. Check your connection and try again.";

/**
 * Awaits a server action, turning a dropped connection into an ordinary error result.
 * Optimistic updates have already closed their dialog by then, so a thrown error would
 * otherwise land on the error page instead of a toast.
 */
export async function settle<T>(action: Promise<T>): Promise<T | { error: string; data?: undefined }> {
    try {
        return await action;
    } catch (cause) {
        console.error("[action] request failed:", cause);
        return { error: OFFLINE_ERROR };
    }
}
