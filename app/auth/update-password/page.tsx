export const instant = false;

import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import UpdatePasswordForm from "./UpdatePasswordForm";
import { isRecoverySession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Set a New Password — SOE Student Portal",
};

export default async function UpdatePasswordPage() {
  // Only reachable from a reset link, so a signed-in session left open on a shared
  // computer can't be used to change the password here.
  const supabase = await createClient();
  if (!(await isRecoverySession(supabase))) redirect("/login");

  return (
    <div className="split">
      <div className="promo">
        <div className="brand">
          <Image
            src="/logo.svg"
            alt="Andres Bonifacio College School of Engineering logo"
            width={40}
            height={40}
            className="seal"
          />
          <span className="brandText">SOE HUB</span>
        </div>
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
        <UpdatePasswordForm />
      </div>
    </div>
  );
}
