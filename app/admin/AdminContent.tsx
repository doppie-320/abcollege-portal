"use client";

import Link from "next/link";
import SiteNav from "@/components/NavigationHeader";
import type { Profile } from "@/lib/auth";

type AdminModule = {
  href: string;
  title: string;
  description: string;
  tag: string;
  icon: "review";
};

const ADMIN_MODULES: readonly AdminModule[] = [
  {
    href: "/admin/user-account-review",
    title: "User Account Review",
    description:
      "Check pending registrations and approve or decline student accounts.",
    tag: "Pending",
    icon: "review",
  },
];

type AdminContentProps = {
  profile: Profile;
};

export default function AdminContent({ profile }: AdminContentProps) {
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
      />

      <div className="page-wrap">
        <div className="mb-8">
          <span className="eyebrow">SOE HUB / ADMIN PANEL</span>
          <h1 className="mb-1 text-[30px] leading-none">Admin Console</h1>
          <p className="mb-0 text-xs text-ink-soft">
            Council tools for managing the SOE Hub portal.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {ADMIN_MODULES.map((module, index) => (
            <Link
              key={module.href}
              href={module.href}
              className="tick-frame animate-fade-in-up group flex flex-col gap-3 no-underline transition-all duration-150 hover:-translate-x-px hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue" style={{ animationDelay: `${index * 70}ms` }}
            >
              <span className="tick-bl" />
              <span className="tick-br" />

              <div className="flex items-start justify-between gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center border border-navy bg-vellum text-navy-deep">
                  <ModuleIcon name={module.icon} />
                </span>
                <span className="tag orange">{module.tag}</span>
              </div>

              <div className="mt-1">
                <h2 className="mb-1 text-xl">{module.title}</h2>
                <p className="mb-0 text-[13px] text-ink-soft">
                  {module.description}
                </p>
              </div>

              <span className="mt-auto flex items-center gap-2 pt-2 font-mono text-[11px] text-blue">
                Open module
                <span className="transition-transform duration-150 group-hover:translate-x-1">
                  &rarr;
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

function ModuleIcon({ name }: { name: AdminModule["icon"] }) {
  if (name === "review") {
    return (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      </svg>
    );
  }

  return null;
}
