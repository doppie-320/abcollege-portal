"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import SiteNav, { ADMIN_MENU_LINKS } from "@/components/NavigationHeader";
import ConfirmDialog from "@/app/home/ConfirmDialog";
import {
  STATUS_LABELS,
  applicantBirthday,
  applicantInitials,
  applicantName,
  formatSubmittedDate,
  type Applicant,
  type ApplicantStatus,
} from "@/lib/applicants-db";
import type { Profile } from "@/lib/auth";

type UserAccountReviewProps = {
  profile: Profile;
  applicants: Applicant[];
};

const PAGE_SIZE = 10;

type StatusFilter = "all" | ApplicantStatus;

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

type RejectMode = "delayed" | "immediate";

/** Shared by both panels so the list and the detail card always line up. */
const PANEL_HEIGHT = "h-[clamp(515px,calc(100vh-300px),640px)]";

/** Shared footer bar so both panels' dividers and controls sit on the same line. */
const FOOTER_BAR = "flex h-14 shrink-0 items-center gap-3 border-t border-rule-soft";

/** Faint blueprint grid laid over the navy banner. */
const BLUEPRINT_GRID =
  "[background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:24px_24px]";

export default function UserAccountReview({ profile, applicants }: UserAccountReviewProps) {
  const [reviewApplicants, setReviewApplicants] = useState(applicants);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(applicants[0]?.id ?? null);
  const [decisions, setDecisions] = useState<
    Record<string, Partial<Pick<Applicant, "status" | "rejectDate">>>
  >({});
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

  function statusOf(applicant: Applicant): ApplicantStatus {
    return decisions[applicant.id]?.status ?? applicant.status;
  }

  const counts = useMemo(() => {
    const tally: Record<ApplicantStatus, number> = { pending: 0, accept: 0, reject: 0 };
    for (const applicant of reviewApplicants) {
      tally[decisions[applicant.id]?.status ?? applicant.status]++;
    }
    return tally;
  }, [reviewApplicants, decisions]);

  const reviewed = counts.accept + counts.reject;
  const reviewedPct = reviewApplicants.length
    ? Math.round((reviewed / reviewApplicants.length) * 100)
    : 0;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return reviewApplicants.filter((applicant) => {
      const status = decisions[applicant.id]?.status ?? applicant.status;
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!needle) return true;
      return [
        applicant.firstName,
        applicant.lastName,
        applicant.email,
        applicant.studentId,
        applicant.program,
        applicant.yearLevel,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [reviewApplicants, query, statusFilter, decisions]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = Math.min(pageIndex, pageCount - 1);
  const pageStart = page * PAGE_SIZE;
  const paged = visible.slice(pageStart, pageStart + PAGE_SIZE);

  const selected = visible.find((applicant) => applicant.id === selectedId) ?? visible[0] ?? null;
  const selectedStatus = selected ? statusOf(selected) : null;

  function goToPage(next: number) {
    const target = Math.min(Math.max(next, 0), pageCount - 1);
    setPageIndex(target);
    setSelectedId(visible[target * PAGE_SIZE]?.id ?? null);
  }

  function onSearchChange(value: string) {
    setQuery(value);
    setPageIndex(0);
  }

  function onStatusFilterChange(value: StatusFilter) {
    setStatusFilter(value);
    setPageIndex(0);
  }

  async function decide(status: ApplicantStatus, rejectDate?: string) {
    const supabase = createClient();
    if (!selected) return;

    if (status === "reject" && !rejectDate) {
      const { error: rejectError } = await supabase.rpc("reject_user", {
        target_user: selected.id,
      });

      if (rejectError) throw rejectError;

      const remainingVisible = visible.filter((applicant) => applicant.id !== selected.id);
      const selectedIndex = visible.findIndex((applicant) => applicant.id === selected.id);
      const nextSelected =
        remainingVisible[Math.min(selectedIndex, remainingVisible.length - 1)] ?? null;
      const nextPageCount = Math.max(1, Math.ceil(remainingVisible.length / PAGE_SIZE));

      setReviewApplicants((prev) => prev.filter((applicant) => applicant.id !== selected.id));
      setDecisions((prev) => {
        const next = { ...prev };
        delete next[selected.id];
        return next;
      });
      setSelectedId(nextSelected?.id ?? null);
      setPageIndex((prev) => Math.min(prev, nextPageCount - 1));
      return;
    }

    const { error: decisionError } = await supabase
      .from("user_requests")
      .update({
        request_status: status,
        reject_date: rejectDate || null,
      })
      .eq("user_id", selected.id);

    if(decisionError) throw decisionError;

    setDecisions((prev) => ({
      ...prev,
      [selected.id]: { status, rejectDate },
    }));
  }

  function requestReject(mode: RejectMode) {
    setRejectOpen(false);
    setPendingReject(mode);
  }

  // Throws on failure so ConfirmDialog keeps the modal open and shows its error.
  async function confirmReject() {
    if (pendingReject === "delayed") await decide("reject", new Date().toISOString());
    else await decide("reject");
    setPendingReject(null);
  }

  return (
    <>
      <SiteNav
        initials={profile.initials}
        name={profile.name}
        userId={profile.id}
        avatarUrl={profile.avatarUrl}
        nameOverride="ADMIN"
        links={[]}
        brandHref="/admin"
        profileHref="/admin/profile"
        profileLabel="My profile"
        menuLinks={ADMIN_MENU_LINKS}
      />

      <div className="page-wrap">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div>
            <h1 className="mb-1 text-[30px] leading-none">User Account Review</h1>
            <p className="mb-0 text-xs text-ink-soft">
              {reviewApplicants.length} registration
              {reviewApplicants.length === 1 ? "" : "s"} on file. Select an applicant to review the
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
                  <dd className="font-display text-[26px] leading-none font-semibold text-navy-deep tabular-nums">
                    {counts[status]}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="border-t border-rule-soft px-4 pt-2 pb-3">
              <div className="mono mb-1.5 flex justify-between text-[10px] tracking-[0.06em] text-ink-soft uppercase">
                <span>Review progress</span>
                <span className="tabular-nums">
                  {reviewed}/{reviewApplicants.length} &middot; {reviewedPct}%
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
                  value={query}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Name, ID, email, program"
                  autoComplete="off"
                  className="mb-0 py-2 pr-8 pl-9 text-[13px] outline-none focus:outline-none focus:ring-0 shadow-none rounded-lg"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
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
                    filter.value === "all" ? reviewApplicants.length : counts[filter.value];
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
                {visible.length} of {reviewApplicants.length} shown
              </p>
            </div>

            {visible.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
                <span className="flex size-11 items-center justify-center rounded-full border border-dashed border-rule bg-vellum text-ink-soft">
                  <Icon name={query.trim() ? "search" : "inbox"} size={18} />
                </span>
                <p className="mb-0 text-[13px] text-ink-soft">
                  {query.trim() ? (
                    <>
                      No applicants match &ldquo;{query.trim()}&rdquo;
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
                <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto">
                  {paged.map((applicant, index) => {
                    const isSelected = applicant.id === selected?.id;
                    const status = statusOf(applicant);

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
                          <span
                            className={`mono flex size-9 shrink-0 items-center justify-center rounded-full border border-navy text-[12px] font-semibold transition-colors duration-150 ${
                              isSelected ? "bg-navy text-white" : "bg-vellum text-navy-deep"
                            }`}
                          >
                            {applicantInitials(applicant)}
                          </span>
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
                    Showing {pageStart + 1}&ndash;{Math.min(pageStart + PAGE_SIZE, visible.length)} of{" "}
                    {visible.length}
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
                  className={`shrink-0 rounded-t-[5px] border-b-[3px] border-orange bg-navy px-6 py-5 ${BLUEPRINT_GRID}`}
                >
                  <div
                    key={selected.id}
                    className="animate-fade-in flex items-center justify-between gap-4"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="mono flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-paper bg-vellum text-[17px] font-semibold text-navy-deep shadow-[0_0_0_4px_rgba(217,83,30,0.35)]">
                        {applicantInitials(selected)}
                      </span>
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
                    {selectedStatus && <StatusBadge status={selectedStatus} live />}
                  </div>
                </div>

                {/* Scrollable body */}
                <div key={selected.id} className="animate-fade-in min-h-0 flex-1 overflow-y-auto p-6">
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
                <div className={`${FOOTER_BAR} px-6`}>
                  <span className="mono text-[11px] text-ink-soft">
                    {selectedStatus === null || selectedStatus === "pending"
                      ? "No decision recorded yet."
                      : `Marked ${STATUS_LABELS[selectedStatus].toLowerCase()} — not saved yet.`}
                  </span>

                  <button
                    type="button"
                    className="ml-auto btn rounded-lg primary px-2.5 py-1 text-sm font-normal"
                    onClick={() => decide("accept")}
                  >
                    <Icon name="check" />
                    Accept application
                  </button>

                  <div className="relative shrink-0" ref={rejectRef}>
                    <button
                      type="button"
                      className="btn font-normal rounded-lg ghost border-[#b3261e] px-2 py-1 text-sm text-[#b3261e] hover:bg-[rgba(205,79,60,0.08)]"
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
        <ConfirmDialog
          tone={pendingReject === "immediate" ? "danger" : "warning"}
          title={
            pendingReject === "immediate" ? "Reject immediately?" : "Reject this application?"
          }
          message={
            pendingReject === "immediate" ? (
              <>
                <strong>{applicantName(selected)}</strong>&rsquo;s registration will be rejected
                right away, with no 7-day grace period. This can&rsquo;t be undone.
              </>
            ) : (
              <>
                <strong>{applicantName(selected)}</strong>&rsquo;s registration will be rejected
                and their account will be deleted automatically in 7 days.
              </>
            )
          }
          confirmLabel="Reject application"
          busyLabel="Rejecting…"
          errorMessage="Couldn't reject this application. Please try again."
          onCancel={() => setPendingReject(null)}
          onConfirm={confirmReject}
        />
      )}
    </>
  );
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
    <li className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] transition-colors duration-150 hover:bg-vellum/40">
      <span className="flex shrink-0 items-center gap-2.5 text-ink-soft">
        <span className="flex size-6 items-center justify-center rounded-md bg-vellum text-navy">
          <Icon name={icon} size={13} />
        </span>
        {label}
      </span>
      {href ? (
        <a
          href={href}
          className="text-right font-semibold text-blue [overflow-wrap:anywhere] hover:text-navy hover:underline"
        >
          {value}
        </a>
      ) : (
        <strong
          className={`text-right font-semibold [overflow-wrap:anywhere] ${mono ? "font-mono" : ""}`}
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
