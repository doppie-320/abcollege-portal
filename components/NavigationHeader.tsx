"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import UserMenu from "./UserMenu";

const NAV_LINKS = [
  { href: "/home", label: "Home" },
  { href: "#", label: "Calendar" },
  { href: "#", label: "Attendance" },
  { href: "#", label: "Suggestion Box" },
] as const;

type SiteNavProps = {
  initials: string;
  name: string;
  userId: string;
  avatarUrl: string;
  isProfilePage?: boolean;
};

export default function SiteNav({
  initials,
  name,
  userId,
  avatarUrl,
  isProfilePage = false,
}: SiteNavProps) {
  const pathname = usePathname();

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
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={pathname === link.href ? "current" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <UserMenu
          initials={initials}
          name={name}
          userId={userId}
          avatarUrl={avatarUrl}
          isProfilePage={isProfilePage}
        />
      </header>
      <div className="header-accent" />
    </>
  );
}