"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import UserMenu from "./UserMenu";

export type NavLink = {
  href: string;
  label: string;
};

/** Scroll distance (px) that counts as a deliberate move, so tiny jitters don't toggle the bar. */
const SCROLL_DOWN_THRESHOLD = 8;
const SCROLL_UP_THRESHOLD = 4;

/** Fired when a nav link (or the brand) is clicked while already on its page, so that page can reload its data. */
export const PAGE_RESELECT_EVENT = "site-nav:page-reselect";

const NAV_LINKS: readonly NavLink[] = [
  { href: "/home", label: "Home" },
  { href: "/calendar", label: "Calendar" },
  { href: "#", label: "Attendance" },
  { href: "#", label: "Suggestion Box" },
];

/** Tabs for admins on /home — standard links plus User Account Review. */
export const HOME_ADMIN_NAV_LINKS: readonly NavLink[] = [
  ...NAV_LINKS,
  { href: "/admin/user-account-review", label: "User Account Review" },
];

/** Extra entries shown in the profile dropdown, e.g. the admin console. */
export const ADMIN_MENU_LINKS: readonly NavLink[] = [
  { href: "/admin", label: "Admin console" },
];

type SiteNavProps = {
  initials: string;
  name: string;
  /** Replaces the user chip text, e.g. admins get "ADMIN" instead of their name. */
  nameOverride?: string;
  userId: string;
  avatarUrl: string;
  isProfilePage?: boolean;
  links?: readonly NavLink[];
  brandHref?: string;
  /** Overrides the user menu's profile entry so admins skip the student page. */
  profileHref?: string;
  profileLabel?: string;
  /** Extra entries shown in the profile dropdown (e.g. admin console). */
  menuLinks?: readonly NavLink[];
};

export default function SiteNav({
  initials,
  name,
  nameOverride,
  userId,
  avatarUrl,
  isProfilePage = false,
  links = NAV_LINKS,
  brandHref = "/home",
  profileHref,
  profileLabel,
  menuLinks
}: SiteNavProps) {
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Slide the bar away while scrolling down, bring it back as soon as the user scrolls up a bit.
  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;

    function update() {
      frame = 0;
      const y = window.scrollY;
      const barHeight = barRef.current?.offsetHeight ?? 0;
      setScrolled(y > 0);

      if (y <= barHeight) setHidden(false);
      else if (y - lastY > SCROLL_DOWN_THRESHOLD) setHidden(true);
      else if (lastY - y > SCROLL_UP_THRESHOLD) setHidden(false);
      else return;

      lastY = y;
    }

    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Lets sticky page content (e.g. the home sidebar) sit just below the bar while it's showing.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--nav-offset", hidden ? "0px" : `${barRef.current?.offsetHeight ?? 0}px`);
  }, [hidden]);

  useEffect(() => () => {
    document.documentElement.style.removeProperty("--nav-offset");
  }, []);

  // Clicking a link to the page you're already on would do nothing, so jump to the top and let the page refresh itself.
  function onLinkClick(e: MouseEvent<HTMLAnchorElement>, href: string) {
    if (pathname !== href || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.dispatchEvent(new Event(PAGE_RESELECT_EVENT));
  }

  return (
    <div ref={barRef} className={`site-nav-bar ${hidden ? "is-hidden" : ""} ${scrolled ? "is-scrolled" : ""}`}>
      <header className="site-header">
        <Link
          href={brandHref}
          className="brand text-base"
          onClick={(e) => onLinkClick(e, brandHref)}
        >
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
              onClick={(e) => onLinkClick(e, link.href)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <UserMenu
          initials={initials}
          name={name}
          nameOverride={nameOverride}
          userId={userId}
          avatarUrl={avatarUrl}
          isProfilePage={isProfilePage}
          profileHref={profileHref}
          profileLabel={profileLabel}
          menuLinks={menuLinks}
        />
      </header>
      <div className="header-accent" />
    </div>
  );
}