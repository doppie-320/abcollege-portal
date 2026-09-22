export const instant = false

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SignupForm from "./SignupForm";

import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign Up — SOE Student Portal",
};

export default async function SignupPage() {
  const supabase = await createClient();

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
        />
      </div>
    </div>
  );
}
