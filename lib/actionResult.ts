export type ActionResult = {
    success?: boolean;
    error?: string;
    fieldErrors?: Record<string, string>
};

// For optimistic updates: turns an action that throws (offline, server crash)
// into a normal error result, so the caller has one failure path to roll back on.
export async function settle(action: Promise<ActionResult>, error: string): Promise<ActionResult> {
    try {
        return await action;
    } catch (cause) {
        console.error(cause);
        return { error };
    }
}
