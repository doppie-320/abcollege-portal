// Temporary in-browser mock of the future `suggestions` table. Swap these functions for
// Supabase calls (or server actions) once the schema exists — the page only depends on
// the exported functions and the types in lib/suggestions.ts.
//
// What the real backend has to enforce, which this mock only imitates:
// - students can only read, edit and delete their own suggestions
// - admins can read every suggestion and delete any of them
// - for anonymous rows, admins must never receive the author's id or name

import type { Suggestion, SuggestionAuthor, SuggestionInput } from "@/lib/suggestions";

type StoredSuggestion = Omit<Suggestion, "author"> & { author: SuggestionAuthor };

const STUDENTS: Record<string, SuggestionAuthor> = {
  "u-maria": { id: "u-maria", name: "Maria Santos", initials: "MS", avatarUrl: "" },
  "u-carlo": { id: "u-carlo", name: "Carlo Ramos", initials: "CR", avatarUrl: "" },
  "u-anna": { id: "u-anna", name: "Anna Dizon", initials: "AD", avatarUrl: "" },
  "u-leo": { id: "u-leo", name: "Leo Fernandez", initials: "LF", avatarUrl: "" },
  "u-bea": { id: "u-bea", name: "Bea Villanueva", initials: "BV", avatarUrl: "" },
};

/** Simulated round trip, so the optimistic UI behaves like it will against Supabase. */
const LATENCY_MS = 350;

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function seed(viewer: SuggestionAuthor): StoredSuggestion[] {
  return [
    {
      id: "mine-1",
      category: "FACILITIES",
      title: "More outlets in the 3rd floor study area",
      body: "Most of the tables near the windows have no outlets, so everyone crowds the two by the stairs. Even a few power strips would help a lot during finals week.",
      authorId: viewer.id,
      author: viewer,
      anonymous: false,
      createdAt: hoursAgo(5),
      updatedAt: null,
    },
    {
      id: "s-1",
      category: "ACADEMIC",
      title: "Post lab schedules a week earlier",
      body: "We only find out our lab slots two or three days before, which makes it hard for working students to adjust shifts.",
      authorId: "u-maria",
      author: STUDENTS["u-maria"],
      anonymous: false,
      createdAt: hoursAgo(9),
      updatedAt: null,
    },
    {
      id: "s-2",
      category: "COUNCIL",
      title: "Monthly breakdown of where org dues go",
      body: "A simple monthly summary on the Transparency tag would make paying dues feel less like a black box. Doesn't need receipts, just totals per activity.",
      authorId: "u-carlo",
      author: STUDENTS["u-carlo"],
      anonymous: true,
      createdAt: hoursAgo(20),
      updatedAt: hoursAgo(18),
    },
    {
      id: "mine-2",
      category: "EVENTS",
      title: "Esports bracket for Engineering Days",
      body: "A lot of us would join a Mobile Legends or Valorant bracket per block. It could run in the AVR on the last day while the talent night is being set up.",
      authorId: viewer.id,
      author: viewer,
      anonymous: true,
      createdAt: hoursAgo(30),
      updatedAt: null,
    },
    {
      id: "s-3",
      category: "FACILITIES",
      title: "Fix the aircon in Room 402",
      body: "It's been leaking onto the back row for two weeks. We've been moving chairs every class.",
      authorId: "u-anna",
      author: STUDENTS["u-anna"],
      anonymous: false,
      createdAt: hoursAgo(52),
      updatedAt: null,
    },
    {
      id: "s-4",
      category: "EVENTS",
      title: "Career talk with alumni from the industry",
      body: "Graduating students would really benefit from hearing how alumni landed their first engineering jobs, what the board exam review was like, and which certifications actually matter.",
      authorId: "u-leo",
      author: STUDENTS["u-leo"],
      anonymous: false,
      createdAt: hoursAgo(80),
      updatedAt: null,
    },
    {
      id: "s-5",
      category: "OTHER",
      title: "Water refill station near the canteen",
      body: "Buying bottled water every day adds up. A refill station would cut plastic waste too.",
      authorId: "u-bea",
      author: STUDENTS["u-bea"],
      anonymous: true,
      createdAt: hoursAgo(130),
      updatedAt: null,
    },
    {
      id: "s-6",
      category: "ACADEMIC",
      title: "Shared reviewer drive per subject",
      body: "Upper years could drop their old reviewers and notes in a council-run drive, sorted by subject code.",
      authorId: "u-maria",
      author: STUDENTS["u-maria"],
      anonymous: false,
      createdAt: hoursAgo(200),
      updatedAt: null,
    },
  ];
}

// Lives only in the browser tab: changes last until a full reload, like a scratch database.
let store: { viewerId: string; rows: StoredSuggestion[] } | null = null;

function rowsFor(viewer: SuggestionAuthor): StoredSuggestion[] {
  // During server rendering each request gets a fresh copy, so no visitor sees another's edits.
  if (typeof window === "undefined") return seed(viewer);
  if (!store || store.viewerId !== viewer.id) store = { viewerId: viewer.id, rows: seed(viewer) };
  return store.rows;
}

/** What `viewer` is allowed to see, newest first, with anonymous authors hidden from everyone else. */
function visibleTo(rows: StoredSuggestion[], viewer: SuggestionAuthor, isAdmin: boolean): Suggestion[] {
  return rows
    .filter((row) => isAdmin || row.authorId === viewer.id)
    .map((row) => {
      const own = row.authorId === viewer.id;
      if (row.anonymous && !own) return { ...row, authorId: "", author: null };
      return { ...row };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function wait() {
  return new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
}

export function fetchSuggestions(viewer: SuggestionAuthor, isAdmin: boolean): Suggestion[] {
  return visibleTo(rowsFor(viewer), viewer, isAdmin);
}

export async function createSuggestion(viewer: SuggestionAuthor, input: SuggestionInput): Promise<Suggestion> {
  await wait();
  const row: StoredSuggestion = {
    id: `sg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category: input.category,
    title: input.title,
    body: input.body,
    authorId: viewer.id,
    author: viewer,
    anonymous: input.anonymous,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  rowsFor(viewer).unshift(row);
  return { ...row };
}

export async function updateSuggestion(viewer: SuggestionAuthor, input: SuggestionInput): Promise<Suggestion> {
  await wait();
  const row = rowsFor(viewer).find((item) => item.id === input.id);
  if (!row || row.authorId !== viewer.id) throw new Error("You can only edit your own suggestions.");
  Object.assign(row, {
    category: input.category,
    title: input.title,
    body: input.body,
    anonymous: input.anonymous,
    updatedAt: new Date().toISOString(),
  });
  return { ...row };
}

export async function deleteSuggestion(viewer: SuggestionAuthor, isAdmin: boolean, id: string): Promise<void> {
  await wait();
  const rows = rowsFor(viewer);
  const index = rows.findIndex((item) => item.id === id);
  if (index === -1) throw new Error("That suggestion no longer exists.");
  if (!isAdmin && rows[index].authorId !== viewer.id) throw new Error("You can only delete your own suggestions.");
  rows.splice(index, 1);
}
