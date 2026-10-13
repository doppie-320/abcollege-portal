"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  CalendarDays,
  ClipboardCheck,
  House,
  Lightbulb,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import UserMenu from "./UserMenu";

export type NavIconKind = "home" | "calendar" | "attendance" | "suggestion" | "review";

export type NavLink = {
  href: string;
  label: string;
  icon?: NavIconKind;
};

const NAV_ICONS: Record<NavIconKind, LucideIcon> = {
  home: House,
  calendar: CalendarDays,
  attendance: ClipboardCheck,
  suggestion: Lightbulb,
  review: UserCheck,
};

/** Scroll distance (px) that counts as a deliberate move, so tiny jitters don't toggle the bar. */
const SCROLL_DOWN_THRESHOLD = 8;
const SCROLL_UP_THRESHOLD = 4;

/** Fired when a nav link (or the brand) is clicked while already on its page, so that page can reload its data. */
export const PAGE_RESELECT_EVENT = "site-nav:page-reselect";

const NAV_LINKS: readonly NavLink[] = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "#", label: "Attendance", icon: "attendance" },
  { href: "#", label: "Suggestion Box", icon: "suggestion" },
];

/** Tabs for admins on /home — standard links plus User Account Review. */
export const HOME_ADMIN_NAV_LINKS: readonly NavLink[] = [
  ...NAV_LINKS,
  { href: "/admin/user-account-review", label: "User Account Review", icon: "review" },
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
    <>
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
        <nav className="main-nav" aria-label="Primary">
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

    {/* Tablet / mobile: floating icon tab bar matching the rectangular tick-frame theme. */}
    <nav className="mobile-tabbar tick-frame" aria-label="Primary">
      <span className="tick-bl" aria-hidden="true" />
      <span className="tick-br" aria-hidden="true" />
      {links
        .filter((link) => link.icon)
        .map((link) => {
          const Icon = NAV_ICONS[link.icon as NavIconKind];
          const active = pathname === link.href;
          return (
            <Link
              key={link.label}
              href={link.href}
              aria-label={link.label}
              title={link.label}
              aria-current={active ? "page" : undefined}
              className={`mobile-tabbar-item${active ? " is-active" : ""}`}
              onClick={(e) => onLinkClick(e, link.href)}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
              <span className="mobile-tabbar-dot" aria-hidden="true" />
            </Link>
          );
        })}
    </nav>

    <style jsx global>{`
        .mobile-tabbar {
        display: none;
      }

      @media (max-width: 900px) {
        /* Desktop text tabs move into the floating bar. */
        .site-header .main-nav {
          display: none;
        }

        /* Keep page content clear of the floating bar. */
        body {
          padding-bottom: calc(84px + env(safe-area-inset-bottom, 0px));
        }

        .mobile-tabbar.tick-frame {
          display: flex;
          align-items: center;
          justify-content: space-around;
          gap: 4px;
          position: fixed;
          left: 50%;
          transform: translateX(-50%);
          bottom: calc(12px + env(safe-area-inset-bottom, 0px));
          z-index: 100;
          width: min(480px, calc(100% - 24px));
          /* Rectangular theme bar: override tick-frame padding but keep its
             6px radius + navy corner ticks. */
          padding: 4px 10px;
          background: var(--white);
          border: 1px solid #c9bfa0;
          border-radius: 6px;
          box-shadow:
            0 10px 30px rgba(13, 30, 56, 0.22),
            0 2px 8px rgba(13, 30, 56, 0.12);
        }

        .mobile-tabbar-item {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          flex: 1 1 0;
          min-width: 44px;
          min-height: 44px;
          padding: 8px 6px 8px;
          border-radius: 4px;
          color: var(--ink-soft);
          text-decoration: none;
          transition: color 0.15s ease, background-color 0.15s ease, transform 0.15s ease;
        }

        .mobile-tabbar-item:hover {
          color: var(--navy);
          background-color: rgba(19, 42, 77, 0.06);
        }

        .mobile-tabbar-item:active {
          transform: scale(0.94);
        }

        .mobile-tabbar-item:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 2px;
        }

        .mobile-tabbar-item.is-active {
          color: var(--navy);
          background: #E6F3FF;
        }

        .mobile-tabbar-item.is-active:hover {
          color: var(--navy);
          background: #D6EAFB;
        }

        /* Active rectangular pip echoing the desktop tab underline. */
        .mobile-tabbar-dot {
          width: 16px;
          height: 2px;
          border-radius: 1px;
          background: var(--orange);
          opacity: 0;
          transform: scale(0.5);
          transition: opacity 0.15s ease, transform 0.15s ease;
        }

        .mobile-tabbar-item.is-active .mobile-tabbar-dot {
          opacity: 1;
          transform: scale(1);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .mobile-tabbar-item,
        .mobile-tabbar-dot {
          transition: none;
        }
      }
    `}</style>
    </>
  );
}