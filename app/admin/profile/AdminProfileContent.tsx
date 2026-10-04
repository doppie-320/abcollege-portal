"use client";

import Link from "next/link";
import AvatarEditor, {
  AvatarEditButton,
  AvatarRemoveButton,
} from "@/app/profile/AvatarEditor";
import SiteNav from "@/components/NavigationHeader";
import type { Profile } from "@/lib/auth";

type AdminProfileContentProps = {
  profile: Profile;
};

const UNKNOWN = "—";

export default function AdminProfileContent({ profile }: AdminProfileContentProps) {
  const hasEmail = profile.email !== UNKNOWN;
  const role = profile.role.trim();
  const roleBadge = role || "Council admin";

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
        isProfilePage
      />

      <div className="page-wrap">
        <div className="mb-6">
          <Link
            href="/admin"
            className="mono mb-3 inline-block text-[11px] text-blue no-underline hover:underline"
          >
            &larr; Back to admin console
          </Link>
          <h1 className="mb-1 text-[30px] leading-none">My Profile</h1>
          <p className="mb-0 text-xs text-ink-soft">
            The council account you review student registrations with.
          </p>
        </div>

        <section className="tick-frame animate-fade-in-up max-w-[620px]">
          <span className="tick-bl" />
          <span className="tick-br" />

          <AvatarEditor
            userId={profile.id}
            initials={profile.initials}
            name={profile.name}
            avatarUrl={profile.avatarUrl}
            eyebrow="COUNCIL CARD"
          >
            <div className="min-w-0">
              <h2 className="mb-2 text-2xl [overflow-wrap:anywhere]">{profile.name}</h2>
              <div className="mb-4 flex flex-wrap gap-1.5">
                <span className="tag orange">{roleBadge}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AvatarEditButton />
                <AvatarRemoveButton />
              </div>
            </div>
          </AvatarEditor>

          <ul className="mt-4 mb-0 list-none divide-y divide-rule-soft overflow-hidden rounded-[6px] border border-rule bg-paper">
            <DetailRow label="Full name" value={profile.name} />
            <DetailRow label="Role" value={role || UNKNOWN} />
            <DetailRow
              label="Email"
              value={profile.email}
              href={hasEmail ? `mailto:${profile.email}` : undefined}
            />
            <DetailRow label="Account type" value="SOE Council — Administrator" />
          </ul>

          <p className="mono mt-4 mb-0 text-[11px] text-ink-soft">
            Only a council officer can reach this page. Your name and role come from your
            account record.
          </p>
        </section>
      </div>
    </>
  );
}

type DetailRowProps = {
  label: string;
  value: string;
  href?: string;
};

function DetailRow({ label, value, href }: DetailRowProps) {
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
        <strong className="text-right font-semibold [overflow-wrap:anywhere]">{value}</strong>
      )}
    </li>
  );
}