"use client";

import Image from "next/image";
import Link from "next/link";
import GwaCalculator from "./GwaCalculator";
import { logout } from "./actions";
import type { Profile } from "@/lib/auth";

type ProfileContentProps = {
  profile: Profile;
};

export default function ProfileContent({ profile }: ProfileContentProps) {
  const hasEmail = profile.email !== "—";

  return (
    <>
      <header className="site-header">
        <Link href="/home" className="brand text-base">
          <Image
            src="/logo.png"
            alt="Andres Bonifacio College seal"
            width={28}
            height={28}
            className="size-7 shrink-0 object-contain"
          />
          SOE HUB
        </Link>
        <nav className="main-nav">
          <Link href="/home">Home</Link>
          <Link href="#">Calendar</Link>
          <Link href="#">Attendance</Link>
          <Link href="#">Suggestion Box</Link>
          <Link href="#">Transparency Reports</Link>
        </nav>
        <span className="user-chip cursor-default">
          <span className="dot">{profile.initials}</span> {profile.name}
        </span>
      </header>
      <div className="header-accent" />

      <div className="page-wrap">
        <div className="mb-6">
          <h1 className="mb-1 text-[30px] leading-none">Welcome, {profile.name}</h1>
          <p className="mb-0 text-xs text-ink-soft">
            Your student record and a scratchpad for working out your GWA.
          </p>
        </div>
    
        <div className="mb-6 grid grid-cols-[360px_1fr] items-start gap-6 max-[900px]:grid-cols-1">
          <section className="tick-frame animate-fade-in-up">
            <span className="tick-bl" />
            <span className="tick-br" />

            <div className="flex items-center gap-4">
              <div
                aria-hidden="true"
                className="flex size-16 shrink-0 items-center justify-center rounded-full border border-navy-tint bg-blue font-display text-[22px] font-semibold text-paper"
              >
                {profile.initials}
              </div>
              <div className="min-w-0">
                <h2 className="mb-2 text-xl [overflow-wrap:anywhere]">
                  {profile.name}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  <span className="tag">{profile.program}</span>
                  <span className="tag orange">{profile.yearLevel}</span>
                </div>
              </div>
            </div>

            <hr className="my-3.5 border-0 border-t border-rule" />

            <ul className="mb-4 list-none divide-y divide-rule-soft overflow-hidden rounded-[6px] border border-rule bg-paper">
              <li className="flex justify-between gap-3 px-3.5 py-2.5 text-[13px]">
                <span className="shrink-0 text-ink-soft">Full name</span>
                <strong className="text-right font-semibold [overflow-wrap:anywhere]">
                  {profile.name}
                </strong>
              </li>
              <li className="flex justify-between gap-3 px-3.5 py-2.5 text-[13px]">
                <span className="shrink-0 text-ink-soft">Student ID</span>
                <strong className="text-right font-mono font-semibold [overflow-wrap:anywhere]">
                  {profile.studentId}
                </strong>
              </li>
              <li className="flex justify-between gap-3 px-3.5 py-2.5 text-[13px]">
                <span className="shrink-0 text-ink-soft">Program</span>
                <strong className="text-right font-semibold [overflow-wrap:anywhere]">
                  {profile.program}
                </strong>
              </li>
              <li className="flex justify-between gap-3 px-3.5 py-2.5 text-[13px]">
                <span className="shrink-0 text-ink-soft">Year level</span>
                <strong className="text-right font-semibold [overflow-wrap:anywhere]">
                  {profile.yearLevel}
                </strong>
              </li>
              <li className="flex justify-between gap-3 px-3.5 py-2.5 text-[13px]">
                <span className="shrink-0 text-ink-soft">Email</span>
                {hasEmail ? (
                  <a
                    className="text-right font-semibold text-blue [overflow-wrap:anywhere] hover:text-navy hover:underline"
                    href={`mailto:${profile.email}`}
                  >
                    {profile.email}
                  </a>
                ) : (
                  <strong className="text-right font-semibold">
                    {profile.email}
                  </strong>
                )}
              </li>
            </ul>

            <p className="mb-0 text-xs text-ink-soft">
              These details come from your sign-up record. Ask the SOE secretariat
              to correct anything that looks wrong.
            </p>
          </section>

          <section className="tick-frame animate-fade-in-up [animation-delay:0.08s]">
            <span className="tick-bl" />
            <span className="tick-br" />
            <GwaCalculator />
          </section>
        </div>

        <section className="tick-frame flex flex-wrap items-center justify-between gap-5">
          <span className="tick-bl" />
          <span className="tick-br" />
          <div>
            <h4 className="mb-0.5 text-sm">Signed in</h4>
            <p className="mb-0 text-[12.5px] text-ink-soft">
              Logging out ends this session on this device.
            </p>
          </div>
          <form action={logout}>
            <button type="submit" className="btn ghost px-5 py-2.5 text-[13px]">
              Log out
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
