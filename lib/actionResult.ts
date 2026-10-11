export type ActionResult = {
    success?: boolean;
    error?: string;
    /** Extra context for `error`, e.g. the account status on login. */
    status?: string;
    fieldErrors?: Record<string, string>
};