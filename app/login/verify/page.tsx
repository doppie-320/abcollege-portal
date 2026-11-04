import type { Metadata } from "next";
import Image from "next/image";
import VerifyForm from "./VerifyForm";

export const metadata: Metadata = {
  title: "Verify Your Email — SOE Student Portal",
};

// Frontend only: the real address will come from the login attempt.
const PLACEHOLDER_EMAIL = "student@gmail.com";

export default function VerifyPage() {
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
        <VerifyForm email={PLACEHOLDER_EMAIL} />
      </div>
    </div>
  );
}
