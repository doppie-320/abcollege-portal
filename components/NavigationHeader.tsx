"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import UserMenu from "./UserMenu";

export type NavLink = {
  href: string;
  label: string;
};

const NAV_LINKS: readonly NavLink[] = [
  { href: "/home", label: "Home" },
  { href: "#", label: "Calendar" },
  { href: "#", label: "Attendance" },
  { href: "#", label: "Suggestion Box" },
];

type SiteNavProps = {
  initials: string;
  name: string;
  userId: string;
  avatarUrl: string;
  isProfilePage?: boolean;
  links?: readonly NavLink[];
  brandHref?: string;
};

export default function SiteNav({
  initials,
  name,
  userId,
  avatarUrl,
  isProfilePage = false,
  links = NAV_LINKS,
  brandHref = "/home",
}: SiteNavProps) {
  const pathname = usePathname();

  return (
    <>
      <header className="site-header">
        <Link href={brandHref} className="brand text-base">
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
          {links.map((link) => (
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