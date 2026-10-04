"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/NavigationHeader";
import {
  STATUS_LABELS,
  applicantBirthday,
  applicantInitials,
  applicantName,
  formatSubmittedDate,
  type Applicant,
  type ApplicantStatus,
} from "@/lib/mock/applicants-db";
import type { Profile } from "@/lib/auth";

type UserAccountReviewProps = {
  profile: Profile;
  applicants: Applicant[];
};

const PAGE_SIZE = 10;

/** Shared by both panels so the list and the detail card always line up. */
const PANEL_HEIGHT = "h-[clamp(515px,calc(100vh-300px),640px)]";

/** Shared footer bar so both panels' dividers and controls sit on the same line. */
const FOOTER_BAR = "flex h-14 shrink-0 items-center gap-3 border-t border-rule-soft";

export default function UserAccountReview({ profile, applicants }: UserAccountReviewProps) {
  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(applicants[0]?.id ?? null);
  const [decisions, setDecisions] = useState<Record<string, ApplicantStatus>>({});
  const [rejectOpen, setRejectOpen] = useState(false);
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
    return decisions[applicant.id] ?? applicant.status;
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return applicants;

    return applicants.filter((applicant) =>
      [
        applicant.firstName,
        applicant.lastName,
        applicant.email,
        applicant.studentId,
        applicant.program,
        applicant.yearLevel,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [applicants, query]);

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

  function decide(status: ApplicantStatus) {
    if (!selected) return;
    setDecisions((prev) => ({ ...prev, [selected.id]: status }));
  }

  function reject() {
    setRejectOpen(false);
    decide("declined");
  }

  return (
    <>
      <SiteNav
        initials={profile.initials}
        name={profile.name}
        userId={profile.id}
        avatarUrl={profile.avatarUrl}
        links={[]}
        brandHref="/admin"
      />

      <div className="page-wrap">
        <div className="mb-6">
          <Link
            href="/admin"
            className="mono mb-3 inline-block text-[11px] text-blue no-underline hover:underline"
          >
            &larr; Back to admin console
          </Link>
          <h1 className="mb-1 text-[30px] leading-none">User Account Review</h1>
          <p className="mb-0 text-xs text-ink-soft">
            {applicants.length} registration{applicants.length === 1 ? "" : "s"} on file. Select an
            applicant to review the details they applied with.
          </p>
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
              <input
                id="applicant-search"
                type="text"
                value={query}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Name, ID, email, program"
                autoComplete="off"
                className="mb-0 py-2 text-[13px] outline-none focus:outline-none focus:ring-0 shadow-none rounded-lg"
              />
              <p className="mono mt-2 mb-0 text-[10px] text-ink-soft">
                {visible.length} of {applicants.length} shown
              </p>
            </div>

            {visible.length === 0 ? (
              <p className="flex flex-1 items-center justify-center px-4 py-10 text-center text-[13px] text-ink-soft">
                No applicants match &ldquo;{query.trim()}&rdquo;.
              </p>
            ) : (
              <>
                <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto">
                  {paged.map((applicant) => {
                    const isSelected = applicant.id === selected?.id;
                    const status = statusOf(applicant);

                    return (
                      <li key={applicant.id}>
                        <button
                          type="button"
                          aria-current={isSelected ? "true" : undefined}
                          onClick={() => setSelectedId(applicant.id)}
                          className={`flex w-full cursor-pointer items-center gap-3 border-b border-rule-soft px-4 py-3 text-left transition-colors duration-150 ease-in-out last:border-b-0 focus-visible:outline-2 focus-visible:outline-(--grey) focus-visible:-outline-offset-[2px] ${
                            isSelected
                              ? "bg-[#e6f3ff]"
                              : "bg-transparent hover:bg-[rgba(0,0,0,0.04)]"
                          }`}
                        >
                          <span className="mono flex size-9 shrink-0 items-center justify-center rounded-full border border-navy bg-vellum text-[12px] font-semibold text-navy-deep">
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
                          <span className={`tag rounded-lg ${status === "pending" ? "orange" : ""}`}>
                            {STATUS_LABELS[status]}
                          </span>
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
                {/* Scrollable body (carries the padding the section used to have) */}
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="mono flex size-12 shrink-0 items-center justify-center border border-navy rounded-full bg-vellum text-[15px] font-semibold text-navy-deep">
                        {applicantInitials(selected)}
                      </span>
                      <div className="min-w-0">
                        <h2 className="mb-1 text-xl [overflow-wrap:anywhere]">
                          {applicantName(selected)}
                        </h2>
                        <p className="mono mb-0 text-[11px] text-ink-soft">
                          Applied {formatSubmittedDate(selected.submittedAt)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`tag rounded-lg ${selectedStatus === "pending" ? "orange" : ""}`}
                    >
                      {selectedStatus && STATUS_LABELS[selectedStatus]}
                    </span>
                  </div>

                  <span className="eyebrow">SUBMITTED DETAILS</span>

                  <ul className="mb-3 list-none divide-y divide-rule-soft overflow-hidden rounded-lg border border-rule bg-paper">
                    <DetailRow label="First name" value={selected.firstName} />
                    <DetailRow label="Last name" value={selected.lastName} />
                    <DetailRow
                      label="Email address"
                      value={selected.email}
                      href={selected.email === "—" ? undefined : `mailto:${selected.email}`}
                    />
                    <DetailRow label="Year level" value={selected.yearLevel} />
                    <DetailRow label="Birthday" value={applicantBirthday(selected)} />
                    <DetailRow label="Student ID" value={selected.studentId} mono />
                    <DetailRow label="Program" value={selected.program} />
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
                    className="ml-auto btn rounded-lg primary px-2 py-1 text-sm font-normal"
                    onClick={() => decide("approved")}
                  >
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
                        className="animate-pop-in absolute right-0 top-full z-20 mt-1.5 w-max min-w-[216px] origin-top-right rounded-lg border border-rule bg-paper p-1 shadow-[0_10px_24px_rgba(13,30,56,0.16)]"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={reject}
                          className="block w-full cursor-pointer rounded-md border-none bg-transparent px-2.5 py-2 text-left text-[13px] leading-snug text-[#b3261e] transition-colors duration-150 ease-in-out hover:bg-[rgba(205,79,60,0.08)]"
                        >
                          Reject (auto delete in 7 days)
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={reject}
                          className="block w-full cursor-pointer rounded-md border-none bg-transparent px-2.5 py-2 text-left text-[13px] leading-snug text-[#b3261e] transition-colors duration-150 ease-in-out hover:bg-[rgba(205,79,60,0.08)]"
                        >
                          Reject (immediate)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col justify-center p-6 text-center">
                <p className="mono mb-1 text-[11px] text-ink-soft">NO APPLICANT SELECTED</p>
                <p className="mb-0 text-[13px] text-ink-soft">
                  Pick a name from the list to see the details they applied with.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

type DetailRowProps = {
  label: string;
  value: string;
  mono?: boolean;
  href?: string;
};

function DetailRow({ label, value, mono = false, href }: DetailRowProps) {
  return (
    <li className="flex justify-between gap-3 px-3.5 py-2.5 text-[13px]">
      <span className="shrink-0 text-ink-soft">{label}</span>
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