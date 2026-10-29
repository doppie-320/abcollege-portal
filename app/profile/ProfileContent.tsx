"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import AvatarEditor from "./AvatarEditor";
import GwaCalculator from "./GwaCalculator";
import SiteNav from "@/components/NavigationHeader";
import { BLUEPRINT_GRID, Frame, Icon, PageHeader, type IconName } from "@/app/attendance/ui";
import type { Profile } from "@/lib/auth";

const UNKNOWN = "—";

type ProfileContentProps = {
  profile: Profile;
};

export default function ProfileContent({ profile }: ProfileContentProps) {
  const hasEmail = profile.email !== UNKNOWN;
  const hasStudentId = profile.studentId !== UNKNOWN;

  return (
    <>
      <SiteNav
        initials={profile.initials}
        name={profile.name}
        userId={profile.id}
        avatarUrl={profile.avatarUrl}
        isProfilePage
      />

      <div className="page-wrap">
        <PageHeader
          eyebrow="SOE HUB / PROFILE"
          title="Student Profile"
          description="Your student record and a scratchpad for working out your GWA."
          actions={
            <Link href="/attendance" className="btn ghost rounded-lg px-4 py-2 text-[13.5px]">
              <Icon name="qr" />
              Attendance pass
            </Link>
          }
        />

        <div className="mb-6 grid grid-cols-[540px_minmax(0,1fr)] items-start gap-6 max-[900px]:grid-cols-1">
          {/* ───────── Student card ───────── */}
          <Frame className="animate-fade-in-up p-0">
            <div
              className={`relative h-28 overflow-hidden rounded-t-[5px] border-b-[3px] border-orange bg-navy px-5 pt-4 ${BLUEPRINT_GRID}`}
            >
              <div className="relative z-10 flex items-center justify-between">
                <span className="mono text-[10px] tracking-[0.12em] text-navy-tint uppercase">Student card</span>
                {hasStudentId && (
                  <span className="mono text-[10px] tracking-[0.12em] text-navy-tint tabular-nums">
                    {profile.studentId}
                  </span>
                )}
              </div>
              {/* Oversized initials as a watermark, like the idle-page backdrops. */}
              <span
                aria-hidden="true"
                className="font-display pointer-events-none absolute -right-2 -bottom-7 text-[104px] leading-none font-bold tracking-tighter text-paper/[0.07] select-none"
              >
                {profile.initials}
              </span>
            </div>

            <div className="px-5 pb-5">
              {/* Pulls the picture up so it straddles the banner's orange rule. */}
              <div className="-mt-16">
                <AvatarEditor
                  userId={profile.id}
                  initials={profile.initials}
                  name={profile.name}
                  avatarUrl={profile.avatarUrl}
                  eyebrow={null}
                >
                  <div className="min-w-0 pt-[72px]">
                    <h2 className="mb-2 text-[length:var(--fs-card)] leading-tight [overflow-wrap:anywhere]">{profile.name}</h2>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.program !== UNKNOWN && <span className="tag orange">{profile.program}</span>}
                      {profile.yearLevel !== UNKNOWN && <span className="tag">{profile.yearLevel}</span>}
                    </div>
                  </div>
                </AvatarEditor>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-rule bg-rule-soft max-[480px]:grid-cols-1">
                <Detail icon="id" label="Student ID">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono tracking-[0.04em] tabular-nums">{profile.studentId}</span>
                    {hasStudentId && <CopyButton value={profile.studentId} label="student ID" />}
                  </span>
                </Detail>
                <Detail icon="calendar" label="Year level">
                  {profile.yearLevel}
                </Detail>
                <Detail icon="cap" label="Program" wide>
                  {profile.program}
                </Detail>
                <Detail icon="mail" label="Email" wide>
                  {hasEmail ? (
                    <a className="text-blue no-underline hover:text-navy hover:underline" href={`mailto:${profile.email}`}>
                      {profile.email}
                    </a>
                  ) : (
                    profile.email
                  )}
                </Detail>
              </dl>

              {/* // QR CODE SHALL BE PLACED HERE */}
            </div>
          </Frame>

          <Frame className="animate-fade-in-up [animation-delay:0.08s]">
            <GwaCalculator />
          </Frame>
        </div>
      </div>
    </>
  );
}

function Detail({
  icon,
  label,
  wide = false,
  children,
}: {
  icon: IconName;
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 bg-paper px-4 py-3 transition-colors hover:bg-vellum/40 ${wide ? "col-span-2 max-[480px]:col-span-1" : ""}`}>
      <dt className="mono mb-1 flex items-center gap-1.5 text-[10px] tracking-[0.08em] text-ink-soft uppercase">
        <span className="text-orange">
          <Icon name={icon} size={11} />
        </span>
        {label}
      </dt>
      <dd className="text-[14px] font-semibold text-navy-deep [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

const COPIED_MS = 1600;

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard is blocked (e.g. insecure origin); the ID is still selectable.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied" : `Copy ${label}`}
      aria-label={copied ? "Copied" : `Copy ${label}`}
      className={`flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border transition ${
        copied
          ? "border-blue/40 bg-blue/10 text-blue"
          : "border-transparent text-ink-soft hover:border-rule hover:bg-paper hover:text-navy"
      }`}
    >
      {copied ? (
        <span key="copied" className="animate-pop-in motion-reduce:animate-none">
          <Icon name="check" size={13} />
        </span>
      ) : (
        <CopyIcon />
      )}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="13" height="13" x="9" y="9" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
