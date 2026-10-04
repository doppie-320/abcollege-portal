"use client";

import { useMemo, useState } from "react";
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

export default function UserAccountReview({ profile, applicants }: UserAccountReviewProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(applicants[0]?.id ?? null);
  const [decisions, setDecisions] = useState<Record<string, ApplicantStatus>>({});

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

  const selected = visible.find((applicant) => applicant.id === selectedId) ?? visible[0] ?? null;
  const selectedStatus = selected ? statusOf(selected) : null;

  function decide(status: ApplicantStatus) {
    if (!selected) return;
    setDecisions((prev) => ({ ...prev, [selected.id]: status }));
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

        <div className="grid grid-cols-[440px_1fr] items-start gap-6 max-[980px]:grid-cols-1">
          <section className="tick-frame animate-fade-in-up p-0">
            <span className="tick-bl" />
            <span className="tick-br" />

            <div className="border-b border-rule-soft px-4 py-3">
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
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, ID, email, program"
                autoComplete="off"
                className="mb-0 py-2 text-[13px] outline-none focus:outline-none focus:ring-0 shadow-none"
              />
              <p className="mono mt-2 mb-0 text-[10px] text-ink-soft">
                {visible.length} of {applicants.length} shown
              </p>
            </div>

            {visible.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-ink-soft">
                No applicants match &ldquo;{query.trim()}&rdquo;.
              </p>
            ) : (
              <ul className="m-0 max-h-[520px] list-none overflow-y-auto">
                {visible.map((applicant) => {
                  const isSelected = applicant.id === selected?.id;
                  const status = statusOf(applicant);

                  return (
                    <li key={applicant.id}>
                      <button
                        type="button"
                        aria-current={isSelected ? "true" : undefined}
                        onClick={() => setSelectedId(applicant.id)}
                        className={`flex w-full cursor-pointer items-center gap-3 border-b border-rule-soft px-4 py-3 text-left transition-colors duration-150 ease-in-out last:border-b-0 focus-visible:outline-2 focus-visible:outline-(--grey) focus-visible:-outline-offset-[2px] ${isSelected
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
            )}
          </section>

          <section className="tick-frame animate-fade-in-up [animation-delay:0.08s]">
            <span className="tick-bl" />
            <span className="tick-br" />

            {selected ? (
              <>
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
                  <span className={`tag rounded-lg ${selectedStatus === "pending" ? "orange" : ""}`}>
                    {selectedStatus && STATUS_LABELS[selectedStatus]}
                  </span>
                </div>

                <span className="eyebrow">SUBMITTED DETAILS</span>

                <ul className="mb-3 list-none divide-y divide-rule-soft overflow-hidden rounded-[6px] border border-rule bg-paper">
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

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule-soft pt-4">
                  <span className="mono text-[11px] text-ink-soft left">
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

                  <button
                    type="button"
                    className="btn font-normal rounded-lg ghost border-[#b3261e] px-2 py-1 text-sm text-[#b3261e] hover:bg-[rgba(205,79,60,0.08)]"
                    onClick={() => decide("declined")}
                  >
                    Reject
                  </button>

                </div>
              </>
            ) : (
              <div className="py-12 text-center">
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