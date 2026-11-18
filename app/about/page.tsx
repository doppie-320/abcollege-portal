import type { Metadata } from "next";
import SiteNav, { ADMIN_MENU_LINKS, HOME_ADMIN_NAV_LINKS } from "@/components/NavigationHeader";
import { getProfile, isAdmin, needsMFA } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

export const instant = false;

export const metadata: Metadata = {
  title: "About — SOE Hub",
};

const sections = [
  {
    name: "Home",
    description: "A central place for announcements and a quick look at upcoming events and birthdays.",
    usage: "Select Home in the navigation bar to check the latest information and see what is coming up.",
  },
  {
    name: "Calendar",
    description: "The calendar brings together school events and birthdays in a monthly view.",
    usage: "Select Calendar, browse to a month, and choose a date to see its events and celebrants.",
  },
  {
    name: "Attendance",
    description: "The attendance section provides your student pass and attendance history for events.",
    usage: "Select Attendance to view your pass and present its QR code to authorized event staff for check-in. You can also review your attendance history there.",
  },
  {
    name: "Suggestion Box",
    description: "A planned space for sharing suggestions with the student council.",
    usage: "This feature is not available yet. Check the navigation bar for updates when it becomes available.",
  },
  {
    name: "User Account Review",
    description: "An admin-only area for reviewing student account requests.",
    usage: "Admins can select User Account Review in the navigation bar to inspect requests and accept or reject them.",
  },
];

export default async function AboutPage() {
  let preview = false;
  if (process.env.NODE_ENV === "development") {
    if (!hasEnvVars) {
      preview = true;
    } else {
      const supabase = await createClient();
      const { data } = await supabase.auth.getClaims();
      preview = !data?.claims?.sub || await needsMFA(supabase);
    }
  }

  const profile = preview ? null : await getProfile();
  const admin = profile ? await isAdmin() : false;

  return (
    <>
      <SiteNav
        initials={profile?.initials ?? "P"}
        name={profile?.name ?? "Local preview"}
        userId={profile?.id ?? ""}
        avatarUrl={profile?.avatarUrl ?? ""}
        links={admin || preview ? HOME_ADMIN_NAV_LINKS : undefined}
        menuLinks={admin || preview ? ADMIN_MENU_LINKS : undefined}
      />
      <main className="page-wrap">
        <header>
          <span className="eyebrow page-eyebrow">SOE HUB / ABOUT THE PORTAL</span>
          <h1 className="page-title">What is SOE Hub?</h1>
          <div className="mt-[14px] border-t border-rule" aria-hidden="true" />
          <p className="mt-4 max-w-3xl leading-7 text-ink-soft">
            SOE Hub is the School of Engineering student portal, bringing announcements,
            events, attendance, and other student council resources together in one place.
          </p>
        </header>

        <section className="pt-8" aria-labelledby="features-heading">
          <h2 id="features-heading" className="font-display text-2xl font-semibold text-ink">Explore SOE Hub</h2>
          <p className="mt-2 text-ink-soft">Here is what each section does and how to use it.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {sections.map((section, index) => (
              <article key={section.name} className="tick-frame row-span-6 grid grid-rows-subgrid gap-y-0 p-4">
                <span className="tick-bl" aria-hidden="true" />
                <span className="tick-br" aria-hidden="true" />
                <span className="eyebrow page-eyebrow">SECTION / {String(index + 1).padStart(2, "0")}</span>
                <h3 className="font-display text-base font-semibold text-ink">{section.name}</h3>
                <p className="mt-2 text-[13px] leading-5 text-ink-soft">{section.description}</p>
                <hr className="hairline" />
                <h4 className="text-xs font-semibold text-ink">How to use it</h4>
                <p className="mt-1 text-[13px] leading-5 text-ink-soft">{section.usage}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
