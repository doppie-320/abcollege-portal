"use client";

import AvatarEditor, {
  AvatarEditButton,
  AvatarRemoveButton,
} from "./AvatarEditor";
import GwaCalculator from "./GwaCalculator";
import SiteNav from "@/components/NavigationHeader";
import type { Profile } from "@/lib/auth";

type ProfileContentProps = {
  profile: Profile;
};

export default function ProfileContent({ profile }: ProfileContentProps) {
  const hasEmail = profile.email !== "—";

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
        <div className="mb-6">
          <h1 className="mb-1 text-[30px] leading-none">Student Profile</h1>
          <p className="mb-0 text-xs text-ink-soft">
            Your student record and a scratchpad for working out your GWA.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-[540px_1fr] items-start gap-6 max-[900px]:grid-cols-1">
          {/* The attendance page links here ("/profile#qr") for students who lost their offline QR. */}
          <section id="qr" className="tick-frame animate-fade-in-up">
            <span className="tick-bl" />
            <span className="tick-br" />

            <AvatarEditor
              userId={profile.id}
              initials={profile.initials}
              name={profile.name}
              avatarUrl={profile.avatarUrl}
            >
              <div className="min-w-0">
                <h2 className="mb-2 text-2xl [overflow-wrap:anywhere]">
                  {profile.name}
                </h2>
                <div className="mb-4 flex flex-wrap gap-1.5">
                  <span className="tag orange">{profile.program}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AvatarEditButton />
                  <AvatarRemoveButton />
                </div>
              </div>
            </AvatarEditor>

            <ul className="mt-4 mb-4 list-none divide-y divide-rule-soft overflow-hidden rounded-[6px] border border-rule bg-paper">
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
          
          {/* // QR CODE SHALL BE PLACED HERE */}

          </section>


          <section className="tick-frame animate-fade-in-up [animation-delay:0.08s]">
            <span className="tick-bl" />
            <span className="tick-br" />
            <GwaCalculator />
          </section>

        </div>


      </div>
    </>
  );
}
