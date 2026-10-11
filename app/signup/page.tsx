export const instant = false;

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SignupForm from "./SignupForm";

import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign Up — SOE Student Portal",
};

type GoogleMetadata = {
  given_name?: string;
  family_name?: string;
  full_name?: string;
  name?: string;
};

// Same order as the on_user_register trigger: Google's given/family name if
// present, otherwise first word of the full name vs. the rest.
function splitGoogleName(metadata: GoogleMetadata) {
  const firstName = metadata.given_name?.trim() ?? "";
  const lastName = metadata.family_name?.trim() ?? "";
  if (firstName || lastName) return { firstName, lastName };

  const [first = "", ...rest] = (metadata.full_name ?? metadata.name ?? "").trim().split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") };
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = createPublicClient();
  const authClient = await createClient();
  const { error: oauthError } = await searchParams;

  const [{ data: courses, error: coursesError },  { data: yearLevels, error: yearLevelErrors }] =
    await Promise.all([
      supabase
        .from("courses")
        .select("id, name")
        .order("name"),

      supabase
        .from("yearlevels")
        .select("id, name")
        .order("name")
    ]);

  if(coursesError || yearLevelErrors) {
    throw new Error("Failed to load signup options.");
  }

  // Coming back from "Sign up with Google": the auth user exists, but the
  // student details haven't been filled in yet.
  const { data: { user } } = await authClient.auth.getUser();
  let googleUser = null;

  if (user?.app_metadata?.provider === "google") {
    const { data: student } = await authClient
      .from("students")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!student) {
      googleUser = {
        email: user.email ?? "",
        ...splitGoogleName((user.user_metadata ?? {}) as GoogleMetadata),
      };
    }
  }

  return (
    <div className="split">
      <div className="promo">
        <Link href="/" className="brand">
          <Image
            src="/logo.png"
            alt="Andres Bonifacio College seal"
            width={40}
            height={40}
            className="seal"
          />
          <span className="brandText">SOE HUB</span>
        </Link>
        <div>
          <h1>SOE&apos;s HUB</h1>
          <p className="sub">
            Announcements, transparency reports, attendance, and everything
            else the School of Engineering student council needs you to see, all
            in one place.
          </p>
        </div>
        <div className="footMono">SCHOOL OF ENGINEERING</div>
      </div>

      <div className="formside">
        <SignupForm 
          courses = { courses ?? [] }
          yearLevels = { yearLevels ?? [] }
          googleUser = { googleUser }
          oauthFailed = { oauthError === "oauth-failed" }
        />
      </div>
    </div>
  );
}
