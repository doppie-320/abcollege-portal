// Shared shapes and rules for the suggestion box. Used by the page and the mock store;
// the Supabase version should keep these exports so the UI doesn't have to change.

export const SUGGESTION_CATEGORIES = ["ACADEMIC", "FACILITIES", "EVENTS", "COUNCIL", "OTHER"] as const;

export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<SuggestionCategory, string> = {
  ACADEMIC: "Academic",
  FACILITIES: "Facilities",
  EVENTS: "Events",
  COUNCIL: "Council",
  OTHER: "Other",
};

export const CATEGORY_HINTS: Record<SuggestionCategory, string> = {
  ACADEMIC: "Classes, schedules, requirements",
  FACILITIES: "Rooms, labs, equipment",
  EVENTS: "Activities, sportsfest, seminars",
  COUNCIL: "How the SOE council runs",
  OTHER: "Anything else on your mind",
};

export const MIN_TITLE_LENGTH = 4;
export const MAX_TITLE_LENGTH = 80;
export const MIN_BODY_LENGTH = 10;
export const MAX_BODY_LENGTH = 1000;

export type SuggestionAuthor = {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string;
};

export type Suggestion = {
  id: string;
  category: SuggestionCategory;
  title: string;
  body: string;
  /**
   * Kept even when anonymous so the author can still edit or delete it.
   * The backend must never send it (or `author`) to admins for anonymous rows.
   */
  authorId: string;
  /** Null when posted anonymously and viewed by someone other than the author. */
  author: SuggestionAuthor | null;
  anonymous: boolean;
  createdAt: string;
  /** Set once the author edits it. */
  updatedAt: string | null;
};

export type SuggestionInput = {
  id?: string;
  category: SuggestionCategory;
  title: string;
  body: string;
  anonymous: boolean;
};

export function validateSuggestion(
  input: SuggestionInput,
): { input: SuggestionInput } | { fieldErrors: Record<string, string> } {
  const title = input.title.trim();
  const body = input.body.trim();
  const fieldErrors: Record<string, string> = {};

  if (!SUGGESTION_CATEGORIES.includes(input.category)) fieldErrors.category = "Pick a category.";

  if (!title) fieldErrors.title = "Give your suggestion a title.";
  else if (title.length < MIN_TITLE_LENGTH) fieldErrors.title = `Use at least ${MIN_TITLE_LENGTH} characters.`;
  else if (title.length > MAX_TITLE_LENGTH) fieldErrors.title = `Keep it under ${MAX_TITLE_LENGTH} characters.`;

  if (!body) fieldErrors.body = "Tell the council what you have in mind.";
  else if (body.length < MIN_BODY_LENGTH) fieldErrors.body = `Add a bit more detail (at least ${MIN_BODY_LENGTH} characters).`;
  else if (body.length > MAX_BODY_LENGTH) fieldErrors.body = `Keep it under ${MAX_BODY_LENGTH} characters.`;

  if (Object.keys(fieldErrors).length) return { fieldErrors };
  return { input: { ...input, title, body: body.replace(/\n{3,}/g, "\n\n") } };
}

export function formatRelative(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
