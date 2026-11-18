import type { Metadata } from "next";
import SiteNav, { ADMIN_MENU_LINKS, HOME_ADMIN_NAV_LINKS } from "@/components/NavigationHeader";
import { getProfile, isAdmin, needsMFA } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

export const instant = false;

export const metadata: Metadata = {
  title: "About — SOE Hub",
};

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
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="font-display text-3xl font-semibold text-ink">About</h1>
        <p className="mt-4 text-ink-soft">The About page is under construction.</p>
      </main>
    </>
  );
}
