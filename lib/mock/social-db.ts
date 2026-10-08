// Temporary in-memory mock of what will eventually be Supabase tables
// (posts, tags, admin authors, comments, reactions). Swap these functions
// for real Supabase queries once the schema exists — callers only depend
// on the exported functions/types, not on this file's internals.

export type TagKey = "finance" | "event" | "academic" | "transparency" | "general";

export type Tag = {
  key: TagKey;
  label: string;
};

export type Person = {
  id: string;
  name: string;
  initials: string;
};

export type AdminAuthor = Person & {
  role: string;
};

export type Comment = {
  id: string;
  authorId: string;
  body: string;
  postedAt: string;
};

export type MediaImage = { src: string; alt: string };

export type Media =
  | { type: "images"; items: MediaImage[] }
  | { type: "video"; label: string; duration: string };

export type Announcement = {
  id: string;
  tag: TagKey;
  authorId: string;
  postedAt: string;
  title: string;
  body: string;
  media?: Media;
  reactedBy: string[];
  comments: Comment[];
};

export const CURRENT_USER: Person = { id: "u-juan", name: "Juan Dela Cruz", initials: "JD" };

const TAGS: Tag[] = [
  { key: "finance", label: "Finance" },
  { key: "event", label: "Event" },
  { key: "academic", label: "Academic" },
  { key: "transparency", label: "Transparency" },
  { key: "general", label: "General" },
];

const ADMINS: Record<string, AdminAuthor> = {
  "a-reyes": { id: "a-reyes", name: "Coun. Mika Reyes", role: "SOE Council — Treasurer", initials: "MR" },
  "a-santos": { id: "a-santos", name: "Coun. Paolo Santos", role: "SOE Council — Events", initials: "PS" },
  "a-cruz": { id: "a-cruz", name: "Coun. Beth Cruz", role: "SOE Council — Academics", initials: "BC" },
  "a-lim": { id: "a-lim", name: "Coun. Ivan Lim", role: "SOE Council — Secretary", initials: "IL" },
};

const STUDENTS: Record<string, Person> = {
  "u-juan": CURRENT_USER,
  "u-maria": { id: "u-maria", name: "Maria Santos", initials: "MS" },
  "u-carlo": { id: "u-carlo", name: "Carlo Ramos", initials: "CR" },
  "u-anna": { id: "u-anna", name: "Anna Dizon", initials: "AD" },
  "u-leo": { id: "u-leo", name: "Leo Fernandez", initials: "LF" },
};

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}
function daysAgo(d: number) {
  return hoursAgo(d * 24);
}

let announcements: Announcement[] = [
  {
    id: "p1",
    tag: "finance",
    authorId: "a-reyes",
    postedAt: hoursAgo(2),
    title: "Org dues balance reminder — ₱150",
    body: "Students with an outstanding balance for AY 2026–2027 have until Oct 15 to settle at the SOE office before fines apply.",
    reactedBy: ["u-maria", "u-carlo"],
    comments: [{ id: "c1", authorId: "u-anna", body: "Is GCash payment accepted?", postedAt: hoursAgo(1) }],
  },
  {
    id: "p2",
    tag: "event",
    authorId: "a-santos",
    postedAt: daysAgo(1),
    title: "Engineering Days 2026 registration is open",
    body: "Sign up for the sportsfest and talent night lineups through your block representative. Slots are first come, first served.",
    media: { type: "images", items: [{ src: "/promo-bg.png", alt: "Engineering Days 2026 banner" }] },
    reactedBy: ["u-maria", "u-carlo", "u-anna", "u-leo", "u-juan"],
    comments: [],
  },
  {
    id: "p5",
    tag: "event",
    authorId: "a-santos",
    postedAt: hoursAgo(20),
    title: "Sportsfest opening ceremony photo dump",
    body: "A few shots from this morning's opening ceremony — the full album drops once the official photographer sends theirs over.",
    media: {
      type: "images",
      items: [
        { src: "/promo-bg.png", alt: "Opening ceremony banner" },
        { src: "/Background-Mobile.png", alt: "Crowd at the opening ceremony" },
        { src: "/logo.png", alt: "SOE seal flag" },
        { src: "/promo-bg.png", alt: "Block teams lining up" },
        { src: "/Background-Mobile.png", alt: "Closing huddle" },
      ],
    },
    reactedBy: ["u-maria", "u-leo"],
    comments: [],
  },
  {
    id: "p6",
    tag: "finance",
    authorId: "a-reyes",
    postedAt: hoursAgo(30),
    title: "Dues collection receipts for this week",
    body: "Scanned copies of the official receipts issued at the SOE office, for transparency. Keep your own copy for reference.",
    media: {
      type: "images",
      items: [
        { src: "/promo-bg.png", alt: "Receipt batch 1" },
        { src: "/Background-Mobile.png", alt: "Receipt batch 2" },
      ],
    },
    reactedBy: ["u-carlo"],
    comments: [],
  },
  {
    id: "p3",
    tag: "academic",
    authorId: "a-cruz",
    postedAt: daysAgo(3),
    title: "Midterm requirements deadline moved to Oct 20",
    body: "Department heads approved a one-week extension following the class suspensions last week. Submit through your respective faculty.",
    reactedBy: ["u-leo"],
    comments: [
      { id: "c2", authorId: "u-carlo", body: "Finally, thank you!", postedAt: daysAgo(2) },
      { id: "c3", authorId: "u-maria", body: "Does this apply to lab requirements too?", postedAt: daysAgo(2) },
    ],
  },
  {
    id: "p7",
    tag: "academic",
    authorId: "a-cruz",
    postedAt: daysAgo(4),
    title: "CAD workshop turnout was great",
    body: "Thanks to everyone who joined this week's CAD workshop — here are a few shots from the session.",
    media: {
      type: "images",
      items: [
        { src: "/promo-bg.png", alt: "Workshop room setup" },
        { src: "/Background-Mobile.png", alt: "Students working on CAD models" },
        { src: "/logo.png", alt: "Certificates handed out" },
      ],
    },
    reactedBy: ["u-maria", "u-anna", "u-leo"],
    comments: [{ id: "c4", authorId: "u-anna", body: "When's the next one?", postedAt: daysAgo(3) }],
  },
  {
    id: "p4",
    tag: "transparency",
    authorId: "a-lim",
    postedAt: daysAgo(5),
    title: "General assembly minutes now posted",
    body: "Catch up on what was discussed at last week's GA — filed under the Transparency tag.",
    media: { type: "video", label: "GA_recording.mp4", duration: "42:10" },
    reactedBy: [],
    comments: [],
  },
];

export function fetchTags(): Tag[] {
  return TAGS;
}

export function fetchAnnouncements(): Announcement[] {
  return announcements.map((a) => ({ ...a, reactedBy: [...a.reactedBy], comments: [...a.comments] }));
}

export function getPerson(id: string): Person {
  return ADMINS[id] ?? STUDENTS[id] ?? { id, name: "Unknown", initials: "?" };
}

export function getAdmin(id: string): AdminAuthor | undefined {
  return ADMINS[id];
}

export function toggleReaction(postId: string, userId: string): Announcement[] {
  announcements = announcements.map((a) => {
    if (a.id !== postId) return a;
    const hasReacted = a.reactedBy.includes(userId);
    return {
      ...a,
      reactedBy: hasReacted ? a.reactedBy.filter((id) => id !== userId) : [...a.reactedBy, userId],
    };
  });
  return fetchAnnouncements();
}

export function addComment(postId: string, userId: string, body: string): Announcement[] {
  const comment: Comment = {
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    authorId: userId,
    body,
    postedAt: new Date().toISOString(),
  };
  announcements = announcements.map((a) => (a.id === postId ? { ...a, comments: [...a.comments, comment] } : a));
  return fetchAnnouncements();
}

export function formatRelativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
