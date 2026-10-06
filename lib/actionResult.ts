export type ActionResult = {
    success?: boolean;
    error?: string;
    fieldErrors?: Record<string, string>
};