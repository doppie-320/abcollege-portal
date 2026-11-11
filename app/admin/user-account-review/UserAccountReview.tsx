"use client";

import { settle } from "@/lib/actionResult";
import { decideApplicant, type Decision } from "./actions";
import { useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import SiteNav, { ADMIN_MENU_LINKS, HOME_ADMIN_NAV_LINKS } from "@/components/NavigationHeader";
import RejectDialog, { type RejectMode } from "./RejectDialog";
import ApplicantAvatar from "./ApplicantAvatar";
import {
  APPLICANT_PAGE_SIZE,
  STATUS_LABELS,
  applicantBirthday,
  applicantName,
  applicantQueryHref,
  formatSubmittedDate,
  type ApplicantCounts,
  type ApplicantFilter,
  type ApplicantPage,
  type ApplicantQuery,
  type ApplicantStatus,
} from "@/lib/applicants-db";
import type { Profile } from "@/lib/auth";
import { toast } from "@/components/Toaster";

type UserAccountReviewProps = ApplicantPage & {
  profile: Profile;
  query: ApplicantQuery;
};

/** How long typing in the search box waits before asking the server. */
const SEARCH_DEBOUNCE_MS = 300;

type StatusFilter = ApplicantFilter;

/** The page's applicants and counts as the server sent them, plus decisions still in flight. */
type ReviewView = Pick<ApplicantPage, "applicants" | "total" | "counts">;

/** A decision shown before the server confirms it. "deleted" is an immediate reject. */
type PendingDecision = {
  id: string;
  status: ApplicantStatus | "deleted";
  rejectDate?: string;
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accept", label: "Accepted" },
  { value: "reject", label: "Rejected" },
];

/** One colour per status, shared by the badges, stat strip and filter chips. */
const STATUS_STYLES: Record<ApplicantStatus, { dot: string; text: string; border: string }> = {
  pending: { dot: "bg-orange", text: "text-orange", border: "border-orange/40" },
  accept: { dot: "bg-blue", text: "text-blue", border: "border-blue/40" },
  reject: { dot: "bg-[#b3261e]", text: "text-[#b3261e]", border: "border-[#b3261e]/40" },
};

/** Shared by both panels so the list and the detail card always line up. */
const PANEL_HEIGHT = "h-[clamp(515px,calc(100vh-300px),640px)]";

/** Shared footer bar so both panels' dividers and controls sit on the same line. */
const FOOTER_BAR = "flex h-14 shrink-0 items-center gap-3 border-t border-rule-soft";

/** Faint blueprint grid laid over the navy banner. */
const BLUEPRINT_GRID =
  "[background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:24px_24px]";

/** Applies a decision to the page before the server's re-render arrives. */
function applyDecision(view: ReviewView, decision: PendingDecision, filter: StatusFilter): ReviewView {
  const target = view.applicants.find((applicant) => applicant.id === decision.id);
  // Already gone from this page (the server's re-render got here first).
  if (!target) return view;

  const counts: ApplicantCounts = { ...view.counts };
  counts[target.status] = Math.max(0, counts[target.status] - 1);
  if (decision.status !== "deleted") counts[decision.status]++;

  const stays = decision.status !== "deleted" && (filter === "all" || filter === decision.status);
  if (!stays) {
    return {
      applicants: view.applicants.filter((applicant) => applicant.id !== decision.id),
      total: Math.max(0, view.total - 1),
      counts,
    };
  }

  const status = decision.status as ApplicantStatus;
  return {
    applicants: view.applicants.map((applicant) =>
      applicant.id === decision.id
        ? { ...applicant, status, rejectDate: decision.rejectDate ?? applicant.rejectDate }
        : applicant,
    ),
    total: view.total,
    counts,
  };
}

export default function UserAccountReview({
  profile,
  query,
  applicants,
  total,
  page,
  counts: serverCounts,
  failed,
}: UserAccountReviewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const statusFilter = query.filter;
  const [searchInput, setSearchInput] = useState(query.search);
  // The search this page last asked for, and the last one the server answered.
  const [requestedSearch, setRequestedSearch] = useState(query.search);
  const [shownSearch, setShownSearch] = useState(query.search);
  const [isNavigating, startNavigation] = useTransition();
  const [, startDecision] = useTransition();
  const [view, addPendingDecision] = useOptimistic<ReviewView, PendingDecision>(
    { applicants, total, counts: serverCounts },
    (current, decision) => applyDecision(current, decision, statusFilter),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [pendingReject, setPendingReject] = useState<RejectMode | null>(null);
  const rejectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rejectOpen) return;

    function onDocMouseDown(e: MouseEvent) {
      if (rejectRef.current && !rejectRef.current.contains(e.target as Node)) setRejectOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setRejectOpen(false);
    }

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [rejectOpen]);

  const { applicants: pageApplicants, counts } = view;
  const allCount = counts.pending + counts.accept + counts.reject;
  const reviewed = counts.accept + counts.reject;
  const reviewedPct = allCount ? Math.round((reviewed / allCount) * 100) : 0;

  const pageCount = Math.max(1, Math.ceil(view.total / APPLICANT_PAGE_SIZE));
  const pageStart = page * APPLICANT_PAGE_SIZE;

  const selected =
    pageApplicants.find((applicant) => applicant.id === selectedId) ?? pageApplicants[0] ?? null;
  const selectedStatus = selected?.status ?? null;

  // Filtering, searching and paging all happen on the server; the URL holds
  // what's shown so it survives a reload and the back button.
  function navigate(next: Partial<ApplicantQuery>) {
    const target = { ...query, search: searchInput, ...next };
    setRequestedSearch(target.search.trim());
    setSelectedId(null);
    startNavigation(() => router.replace(applicantQueryHref(pathname, target), { scroll: false }));
  }

  // The search changed without this page asking (the back button): show it in
  // the box, or the debounce below would send the old text straight back.
  if (query.search !== shownSearch) {
    setShownSearch(query.search);
    if (query.search !== requestedSearch) {
      setRequestedSearch(query.search);
      setSearchInput(query.search);
    }
  }

  // Search once typing pauses rather than on every key.
  useEffect(() => {
    if (searchInput.trim() === query.search) return;
    const timer = setTimeout(() => navigate({ search: searchInput, page: 0 }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // navigate changes every render; the timer only cares about the input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, query.search]);

  function goToPage(next: number) {
    navigate({ page: Math.min(Math.max(next, 0), pageCount - 1) });
  }

  function onStatusFilterChange(value: StatusFilter) {
    navigate({ filter: value, page: 0 });
  }

  function clearSearch() {
    setSearchInput("");
    navigate({ search: "", page: 0 });
  }

  // Decisions show at once. The action re-renders the page from the server when
  // it saves; if it fails, the optimistic change falls away and a toast says so.
  function decide(status: ApplicantStatus, rejectDate?: string) {
    const target = selected;
    if (!target) return;
    const name = applicantName(target);
    const decision: Decision =
      status === "accept" ? "accept" : rejectDate ? "reject" : "reject-immediate";
    const pending: PendingDecision = {
      id: target.id,
      status: decision === "reject-immediate" ? "deleted" : status,
      rejectDate,
    };

    // When the applicant leaves this list, select whoever takes their place.
    const leaves =
      pending.status === "deleted" || (statusFilter !== "all" && statusFilter !== pending.status);
    if (leaves) {
      const index = pageApplicants.findIndex((applicant) => applicant.id === target.id);
      const neighbour = pageApplicants[index + 1] ?? pageApplicants[index - 1] ?? null;
      setSelectedId(neighbour?.id ?? null);
    }

    startDecision(async () => {
      addPendingDecision(pending);
      const result = await settle(decideApplicant(target.id, decision));

      if (result.error) {
        console.error("Error saving applicant decision:", result.error);
        setSelectedId(target.id);
        toast(
          status === "accept"
            ? `Couldn't accept ${name}'s application. Please try again.`
            : `Couldn't reject ${name}'s application. Please try again.`,
        );
      }
      warnIfEmailFailed(result, name, target.email);
    });
  }

  function requestReject(mode: RejectMode) {
    setRejectOpen(false);
    setPendingReject(mode);
  }

  // The dialog closes at once; decide() undoes the change if the server refuses it.
  function confirmReject() {
    const mode = pendingReject;
    setPendingReject(null);
    if (mode === "delayed") void decide("reject", new Date().toISOString());
    else void decide("reject");
  }

  return (
    <>
      <SiteNav
        initials={profile.initials}
        name={profile.name}
        userId={profile.id}
        avatarUrl={profile.avatarUrl}
        links={HOME_ADMIN_NAV_LINKS}
        menuLinks={ADMIN_MENU_LINKS}
      />

      <div className="page-wrap">
        <div className="mb-6 flex flex-wrap items-stretch justify-between gap-x-8 gap-y-5">
          <div className="flex flex-col justify-between">
            <div>
              <span className="eyebrow page-eyebrow">SOE HUB / ADMIN PANEL</span>
              <h1 className="page-title">User Account Review</h1>
            </div>
            <p className="mt-3.5 mb-0 text-xs text-ink-soft">
              {allCount} registration
              {allCount === 1 ? "" : "s"} on file. Select an applicant to review the
              details they applied with.
            </p>
          </div>

          {/* ───────── Stat strip + review progress ───────── */}
          <div className="tick-frame animate-fade-in w-full p-0 sm:w-[380px]">
            <span className="tick-bl" />
            <span className="tick-br" />

            <dl className="grid grid-cols-3 divide-x divide-rule-soft">
              {(Object.keys(STATUS_LABELS) as ApplicantStatus[]).map((status) => (
                <div key={status} className="px-4 pt-3 pb-2.5">
                  <dt className="mono mb-1 flex items-center gap-1.5 text-[10px] tracking-[0.08em] text-ink-soft uppercase">
                    <span className={`size-1.5 rounded-full ${STATUS_STYLES[status].dot}`} />
                    {STATUS_LABELS[status]}
                  </dt>
                  <dd className="font-display text-[length:var(--fs-stat-sm)] leading-none font-semibold text-navy-deep tabular-nums">
                    {counts[status]}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="border-t border-rule-soft px-4 pt-2 pb-3">
              <div className="mono mb-1.5 flex justify-between text-[10px] tracking-[0.06em] text-ink-soft uppercase">
                <span>Review progress</span>
                <span className="tabular-nums">
                  {reviewed}/{allCount} &middot; {reviewedPct}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Applications reviewed"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={reviewedPct}
                className="h-1.5 overflow-hidden rounded-full bg-vellum-2"
              >
                <div
                  className="h-full rounded-full bg-orange transition-[width] duration-500 ease-out"
                  style={{ width: `${reviewedPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[440px_1fr] items-stretch gap-6 max-[980px]:grid-cols-1">
          {/* ───────── Left panel: applicant list ───────── */}
          <section className={`tick-frame animate-fade-in-up flex flex-col p-0 ${PANEL_HEIGHT}`}>
            <span className="tick-bl" />
            <span className="tick-br" />

            <div className="shrink-0 border-b border-rule-soft px-4 py-3">
              <label
                htmlFor="applicant-search"
                className="mono mb-2 block text-[10px] tracking-[0.08em] text-ink-soft uppercase"
              >
                Search applicants
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft">
                  <Icon name="search" />
                </span>
                <input
                  id="applicant-search"
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Name, ID, email, program"
                  autoComplete="off"
                  className="mb-0 py-2 pr-8 pl-9 text-[13px] outline-none focus:outline-none focus:ring-0 shadow-none rounded-lg"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label="Clear search"
                    className="animate-pop-in absolute top-1/2 right-2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-ink-soft transition-colors duration-150 hover:bg-[rgba(0,0,0,0.06)] hover:text-navy-deep"
                  >
                    <Icon name="x" size={12} />
                  </button>
                )}
              </div>
              <div
                role="group"
                aria-label="Filter applicants by status"
                className="mt-2.5 flex flex-wrap gap-1.5"
              >
                {STATUS_FILTERS.map((filter) => {
                  const isActive = statusFilter === filter.value;
                  const count =
                    filter.value === "all" ? allCount : counts[filter.value];
                  return (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => onStatusFilterChange(filter.value)}
                      aria-pressed={isActive}
                      className={`mono flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] tracking-[0.04em] uppercase transition-colors duration-150 ease-in-out focus-visible:outline-2 focus-visible:outline-(--grey) focus-visible:-outline-offset-[2px] ${
                        isActive
                          ? "border-navy bg-navy text-white"
                          : "border-rule bg-transparent text-ink-soft hover:bg-[rgba(0,0,0,0.05)] hover:text-navy-deep"
                      }`}
                    >
                      {filter.value !== "all" && (
                        <span className={`size-1.5 rounded-full ${STATUS_STYLES[filter.value].dot}`} />
                      )}
                      {filter.label}
                      <span
                        className={`rounded px-1 tabular-nums ${
                          isActive ? "bg-white/15" : "bg-vellum-2 text-ink-soft"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mono mt-2 mb-0 text-[10px] text-ink-soft">
                {view.total} of {allCount} shown
              </p>
            </div>

            {pageApplicants.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
                <span className="flex size-11 items-center justify-center rounded-full border border-dashed border-rule bg-vellum text-ink-soft">
                  <Icon name={query.search ? "search" : "inbox"} size={18} />
                </span>
                <p className="mb-0 text-[13px] text-ink-soft">
                  {failed ? (
                    "Couldn't load applicants. Refresh the page to try again."
                  ) : query.search ? (
                    <>
                      No applicants match &ldquo;{query.search}&rdquo;
                      {statusFilter !== "all" && (
                        <>
                          {" "}
                          in{" "}
                          {STATUS_FILTERS.find((f) => f.value === statusFilter)?.label.toLowerCase()}
                        </>
                      )}
                      .
                    </>
                  ) : statusFilter !== "all" ? (
                    <>
                      No {STATUS_FILTERS.find((f) => f.value === statusFilter)?.label.toLowerCase()}{" "}
                      applicants.
                    </>
                  ) : (
                    "No applicants on file."
                  )}
                </p>
              </div>
            ) : (
              <>
                <ul
                  aria-busy={isNavigating}
                  className={`m-0 min-h-0 flex-1 list-none overflow-y-auto transition-opacity duration-150 ${
                    isNavigating ? "opacity-60" : ""
                  }`}
                >
                  {pageApplicants.map((applicant, index) => {
                    const isSelected = applicant.id === selected?.id;
                    const status = applicant.status;

                    return (
                      <li
                        key={applicant.id}
                        className="animate-fade-in"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <button
                          type="button"
                          aria-current={isSelected ? "true" : undefined}
                          onClick={() => setSelectedId(applicant.id)}
                          className={`group flex w-full cursor-pointer items-center gap-3 border-b border-rule-soft px-4 py-3 text-left transition-[background-color,box-shadow] duration-150 ease-in-out last:border-b-0 focus-visible:outline-2 focus-visible:outline-(--grey) focus-visible:-outline-offset-[2px] ${
                            isSelected
                              ? "bg-[#e6f3ff] shadow-[inset_3px_0_0_var(--orange)]"
                              : "bg-transparent hover:bg-[rgba(0,0,0,0.04)] hover:shadow-[inset_3px_0_0_var(--rule)]"
                          }`}
                        >
                          <ApplicantAvatar
                            applicant={applicant}
                            size={36}
                            className={`mono flex size-9 shrink-0 items-center justify-center rounded-full border border-navy text-[12px] font-semibold transition-colors duration-150 ${
                              isSelected ? "bg-navy text-white" : "bg-vellum text-navy-deep"
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-semibold text-navy-deep">
                              {applicantName(applicant)}
                            </span>
                            <span className="mono block truncate text-[11px] text-ink-soft">
                              {applicant.studentId} &middot; {applicant.program}
                            </span>
                          </span>
                          <StatusBadge status={status} />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {/* Footer */}
                <div className={`${FOOTER_BAR} justify-between px-4`}>
                  <span className="mono text-[10px] text-ink-soft">
                    Showing {pageStart + 1}&ndash;{Math.min(pageStart + APPLICANT_PAGE_SIZE, view.total)} of{" "}
                    {view.total}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn ghost px-2 py-1 text-xs rounded-lg"
                      onClick={() => goToPage(page - 1)}
                      disabled={page === 0}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="btn ghost px-2 py-1 text-xs rounded-lg"
                      onClick={() => goToPage(page + 1)}
                      disabled={page >= pageCount - 1}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* ───────── Right panel: applicant details ───────── */}
          <section
            className={`tick-frame animate-fade-in-up flex flex-col p-0 [animation-delay:0.08s] ${PANEL_HEIGHT}`}
          >
            <span className="tick-bl" />
            <span className="tick-br" />

            {selected ? (
              <>
                {/* Identity banner */}
                <div
                  className={`shrink-0 rounded-t-[5px] border-b-[3px] border-orange bg-navy px-6 py-5 max-[480px]:px-4 max-[480px]:py-4 ${BLUEPRINT_GRID}`}
                >
                  <div
                    key={selected.id}
                    className="animate-fade-in flex items-center justify-between gap-4 max-[480px]:flex-wrap max-[480px]:gap-3"
                  >
                    <div className="flex min-w-0 items-center gap-4 max-[480px]:w-full max-[480px]:gap-3">
                      <ApplicantAvatar
                        applicant={selected}
                        size={56}
                        className="mono flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-paper bg-vellum text-[17px] font-semibold text-navy-deep shadow-[0_0_0_4px_rgba(217,83,30,0.35)] max-[480px]:size-11 max-[480px]:text-sm"
                      />
                      <div className="min-w-0">
                        <h2 className="mb-1 text-xl text-paper [overflow-wrap:anywhere]">
                          {applicantName(selected)}
                        </h2>
                        <p className="mono mb-0 text-[11px] text-navy-tint">
                          Applied {formatSubmittedDate(selected.submittedAt)} &middot;{" "}
                          {selected.studentId}
                        </p>
                      </div>
                    </div>
                    {selectedStatus && (
                      <div className="max-[480px]:ml-14">
                        <StatusBadge status={selectedStatus} live />
                      </div>
                    )}
                  </div>
                </div>

                {/* Scrollable body */}
                <div key={selected.id} className="animate-fade-in min-h-0 flex-1 overflow-y-auto p-6 max-[480px]:p-4">
                  <span className="eyebrow">SUBMITTED DETAILS</span>

                  <ul className="mb-3 list-none divide-y divide-rule-soft overflow-hidden rounded-lg border border-rule bg-paper">
                    <DetailRow icon="user" label="First name" value={selected.firstName} />
                    <DetailRow icon="user" label="Last name" value={selected.lastName} />
                    <DetailRow
                      icon="mail"
                      label="Email address"
                      value={selected.email}
                      href={selected.email === "—" ? undefined : `mailto:${selected.email}`}
                    />
                    <DetailRow icon="layers" label="Year level" value={selected.yearLevel} />
                    <DetailRow icon="calendar" label="Birthday" value={applicantBirthday(selected)} />
                    <DetailRow icon="id" label="Student ID" value={selected.studentId} mono />
                    <DetailRow icon="cap" label="Program" value={selected.program} />
                  </ul>

                  <p className="mono mb-0 text-[11px] text-ink-soft">
                    Birthday is optional &mdash; applicants may leave it blank when signing up.
                  </p>
                </div>

                {/* Footer */}
                <div className={`${FOOTER_BAR} px-6 max-[480px]:h-auto max-[480px]:gap-2 max-[480px]:px-4 max-[480px]:py-3`}>
                  {selectedStatus !== "accept" && (
                    <button
                      type="button"
                      className="ml-auto btn rounded-lg primary px-2.5 py-1 text-sm font-normal max-[480px]:min-h-11 max-[480px]:min-w-0 max-[480px]:flex-1 max-[480px]:px-2 max-[480px]:text-xs"
                      onClick={() => void decide("accept")}
                    >
                      <Icon name="check" />
                      Accept application
                    </button>
                  )}

                  <div
                    className={`relative shrink-0 max-[480px]:min-w-0 max-[480px]:flex-1 ${
                      selectedStatus === "accept" ? "ml-auto" : ""
                    }`}
                    ref={rejectRef}
                  >
                    <button
                      type="button"
                      className="btn font-normal rounded-lg ghost border-[#b3261e] px-2 py-1 text-sm text-[#b3261e] hover:bg-[rgba(205,79,60,0.08)] max-[480px]:min-h-11 max-[480px]:w-full max-[480px]:text-xs"
                      onClick={() => setRejectOpen((v) => !v)}
                      aria-haspopup="menu"
                      aria-expanded={rejectOpen}
                    >
                      Reject
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className={`transition-transform duration-150 ${
                          rejectOpen ? "rotate-180" : ""
                        }`}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>

                    {rejectOpen && (
                      <div
                        role="menu"
                        aria-label="Reject options"
                        className="animate-pop-in absolute right-0 bottom-full z-20 mb-1.5 w-max min-w-[240px] origin-bottom-right rounded-lg border border-rule bg-paper p-1 shadow-[0_10px_24px_rgba(13,30,56,0.16)]"
                      >
                        <RejectOption
                          icon="clock"
                          title="Reject"
                          hint="Account auto-deletes in 7 days"
                          onClick={() => requestReject("delayed")}
                        />
                        <RejectOption
                          icon="trash"
                          title="Reject immediately"
                          hint="No grace period"
                          onClick={() => requestReject("immediate")}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <span className="flex size-12 items-center justify-center rounded-full border border-dashed border-rule bg-vellum text-ink-soft">
                  <Icon name="user" size={20} />
                </span>
                <div>
                  <p className="mono mb-1 text-[11px] text-ink-soft">NO APPLICANT SELECTED</p>
                  <p className="mb-0 text-[13px] text-ink-soft">
                    Pick a name from the list to see the details they applied with.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {pendingReject && selected && (
        <RejectDialog
          mode={pendingReject}
          applicant={selected}
          onCancel={() => setPendingReject(null)}
          onConfirm={confirmReject}
        />
      )}
    </>
  );
}

function warnIfEmailFailed(result: object, name: string, email: string) {
  if ("emailFailed" in result && result.emailFailed) {
    toast(`Decision saved, but the email to ${name} could not send. Please contact them at ${email}.`);
  }
}

function StatusBadge({ status, live = false }: { status: ApplicantStatus; live?: boolean }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`mono inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-paper px-2 py-0.5 text-[10.5px] whitespace-nowrap ${style.border} ${style.text}`}
    >
      <span className="relative flex size-1.5">
        {live && status === "pending" && (
          <span
            className={`absolute inline-flex size-full animate-ping rounded-full opacity-75 ${style.dot}`}
          />
        )}
        <span className={`relative inline-flex size-1.5 rounded-full ${style.dot}`} />
      </span>
      {STATUS_LABELS[status]}
    </span>
  );
}

type RejectOptionProps = {
  icon: IconName;
  title: string;
  hint: string;
  onClick: () => void;
};

function RejectOption({ icon, title, hint, onClick }: RejectOptionProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full cursor-pointer items-start gap-2.5 rounded-md border-none bg-transparent px-2.5 py-2 text-left transition-colors duration-150 ease-in-out hover:bg-[rgba(205,79,60,0.08)]"
    >
      <span className="mt-0.5 text-[#b3261e]">
        <Icon name={icon} />
      </span>
      <span>
        <span className="block text-[13px] leading-snug text-[#b3261e]">{title}</span>
        <span className="mono block text-[10.5px] text-ink-soft">{hint}</span>
      </span>
    </button>
  );
}

type DetailRowProps = {
  icon: IconName;
  label: string;
  value: string;
  mono?: boolean;
  href?: string;
};

function DetailRow({ icon, label, value, mono = false, href }: DetailRowProps) {
  return (
    <li className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] transition-colors duration-150 hover:bg-vellum/40 ${href ? "max-[480px]:flex-wrap max-[480px]:gap-y-1" : ""}`}>
      <span className="flex shrink-0 items-center gap-2.5 text-ink-soft">
        <span className="flex size-6 items-center justify-center rounded-md bg-vellum text-navy">
          <Icon name={icon} size={13} />
        </span>
        {label}
      </span>
      {href ? (
        <a
          href={href}
          className="min-w-0 text-right font-semibold text-blue [overflow-wrap:anywhere] hover:text-navy hover:underline max-[480px]:ml-[34px] max-[480px]:w-[calc(100%-34px)] max-[480px]:text-left"
        >
          {value}
        </a>
      ) : (
        <strong
          className={`min-w-0 text-right font-semibold [overflow-wrap:anywhere] ${mono ? "font-mono" : ""}`}
        >
          {value}
        </strong>
      )}
    </li>
  );
}

const ICON_PATHS = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  inbox: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  user: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  mail: (
    <>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  layers: (
    <>
      <path d="m12 2 10 5-10 5L2 7l10-5Z" />
      <path d="m2 12 10 5 10-5" />
      <path d="m2 17 10 5 10-5" />
    </>
  ),
  calendar: (
    <>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  id: (
    <>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <circle cx="8" cy="12" r="2" />
      <path d="M14 10h4M14 14h4" />
    </>
  ),
  cap: (
    <>
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  trash: <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />,
} satisfies Record<string, ReactNode>;

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
