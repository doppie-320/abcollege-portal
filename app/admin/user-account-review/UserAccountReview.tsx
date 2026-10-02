"use client";

import Link from "next/link";
import SiteNav from "@/components/NavigationHeader";
import type { Profile } from "@/lib/auth";

type UserAccountReviewProps = {
  profile: Profile;
};

export default function UserAccountReview({ profile }: UserAccountReviewProps) {
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
            Pending registrations will be listed here.
          </p>
        </div>

        <section className="tick-frame animate-fade-in-up">
          <span className="tick-bl" />
          <span className="tick-br" />
          <span className="eyebrow">COMING NEXT</span>
          <h2 className="mb-1 text-xl">Request list goes here</h2>
          <p className="mb-0 text-[13px] text-ink-soft">
            The request table, filters, and approve/decline actions will be
            built in a follow-up task.
          </p>
        </section>
      </div>
    </>
  );
}
