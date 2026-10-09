export const instant = false;

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import LoginForm from "./LoginForm";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_ERRORS } from "./messages";

export const metadata: Metadata = {
  title: "Log In — SOE Student Portal",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Signed in with a Google account that never requested one: the callback
  // kept the session so the form can offer to continue to sign-up.
  let noAccountEmail = "";
  if (error === "no-account") {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    noAccountEmail = user?.email ?? "";
  }

  // Force the user to the homepage if already logged in.
  // const supabase = await createClient();

  // const { data: { user }, } = await supabase.auth.getUser();

  // if (user) {
  //   redirect("/home");
  // }

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
        <LoginForm
          initialError={error ? LOGIN_ERRORS[error] ?? "" : ""}
          noAccountEmail={noAccountEmail}
        />
      </div>
    </div>
  );
}
