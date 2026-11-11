export type ApplicantStatus = "pending" | "accept" | "reject";

export type Applicant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  /** Public URL of the profile picture, or "" when they haven't set one. */
  avatarUrl: string;
  yearLevel: string;
  birthday?: string;
  studentId: string;
  program: string;
  status: ApplicantStatus;
  rejectDate: string;
  submittedAt: string;
};

export const STATUS_LABELS: Record<ApplicantStatus, string> = {
  pending: "Pending",
  accept: "Accepted",
  reject: "Rejected",
};

export type ApplicantFilter = "all" | ApplicantStatus;

export type ApplicantCounts = Record<ApplicantStatus, number>;

/** What the review page is showing: the filter chip, the search box and the page (0-based). */
export type ApplicantQuery = {
  filter: ApplicantFilter;
  search: string;
  page: number;
};

/** One page of applicants, plus the totals the stat strip and filter chips need. */
export type ApplicantPage = {
  applicants: Applicant[];
  /** How many applicants match the filter and search, across every page. */
  total: number;
  /** The page actually shown, which is the last one when the URL asked past it. */
  page: number;
  counts: ApplicantCounts;
  /** The database read failed; the page renders empty with a message. */
  failed: boolean;
};

export const APPLICANT_PAGE_SIZE = 10;

const DEFAULT_FILTER: ApplicantFilter = "pending";
const FILTERS: readonly ApplicantFilter[] = ["all", "pending", "accept", "reject"];
const MAX_SEARCH_LENGTH = 100;

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Reads ?status=, ?q= and ?page= (1-based) from the review page's URL. */
export function parseApplicantQuery(params: SearchParams): ApplicantQuery {
  const status = firstParam(params.status);
  const page = Number.parseInt(firstParam(params.page) ?? "", 10);

  return {
    filter: FILTERS.find((filter) => filter === status) ?? DEFAULT_FILTER,
    search: (firstParam(params.q) ?? "").trim().slice(0, MAX_SEARCH_LENGTH),
    page: Number.isFinite(page) && page > 1 ? page - 1 : 0,
  };
}

/** The review page's URL for a query, leaving out the defaults. */
export function applicantQueryHref(pathname: string, query: ApplicantQuery): string {
  const params = new URLSearchParams();
  if (query.filter !== DEFAULT_FILTER) params.set("status", query.filter);
  const search = query.search.trim().slice(0, MAX_SEARCH_LENGTH);
  if (search) params.set("q", search);
  if (query.page > 0) params.set("page", String(query.page + 1));

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

const UNKNOWN = "—";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function applicantName(applicant: Applicant): string {
  return `${applicant.firstName} ${applicant.lastName}`.trim() || UNKNOWN;
}

export function applicantInitials(applicant: Applicant): string {
  return `${applicant.firstName.charAt(0)}${applicant.lastName.charAt(0)}`.toUpperCase() || "?";
}

export function applicantBirthday(applicant: Applicant): string {
  return applicant.birthday?.trim() || UNKNOWN;
}

export function formatSubmittedDate(iso: string): string {
  const date = new Date(iso);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}
