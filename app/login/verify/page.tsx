export const instant = false;

import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import VerifyForm from "./VerifyForm";
import { needsMFA } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Verify Your Email — SOE Student Portal",
};

export default async function VerifyPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub || !claims.email) redirect("/login");
  if (!(await needsMFA(supabase))) redirect("/home");

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
        <VerifyForm email={claims.email} />
      </div>
    </div>
  );
}
