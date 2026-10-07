"use client";

import Image from "next/image";
import Link from "next/link";
import { ViewTransition, useCallback, useLayoutEffect, useRef, type MouseEvent } from "react";
import { usePathname } from "next/navigation";
import UserMenu from "./UserMenu";
import { navTransition } from "@/lib/navigation";

const NAV_LINKS = [
  { href: "/home", label: "Home" },
  { href: "/calendar", label: "Calendar" },
  { href: "/attendance", label: "Attendance" },
  { href: "/suggestions", label: "Suggestion Box" },
] as const;

type Bar = { left: number; width: number };

// Where the active-tab underline was last drawn. The header remounts with every
// page, so this carries the position over for the new header to slide it from.
let lastBar: Bar | null = null;

// Plain left clicks only: modified clicks open a new tab and don't navigate here.
function isPlainClick(e: MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

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
  const navRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  const linkFor = useCallback(
    (href: string) => navRef.current?.querySelector<HTMLElement>(`a[href="${href}"]`) ?? null,
    [],
  );

  // Moves the underline under `link` (sliding unless `animate` is false), or hides
  // it when this page has no tab (profile) or the nav is hidden (phones).
  const placeBar = useCallback((link: HTMLElement | null, animate: boolean) => {
    const bar = barRef.current;
    if (!bar) return;
    if (!link || link.offsetWidth === 0) {
      bar.style.opacity = "0";
      lastBar = null;
      return;
    }
    if (!animate) bar.style.transition = "none";
    bar.style.transform = `translateX(${link.offsetLeft}px)`;
    bar.style.width = `${link.offsetWidth}px`;
    bar.style.opacity = "1";
    if (!animate) {
      bar.getBoundingClientRect(); // Commit the jump before restoring the transition.
      bar.style.transition = "";
    }
    lastBar = { left: link.offsetLeft, width: link.offsetWidth };
  }, []);

  useLayoutEffect(() => {
    const bar = barRef.current;
    const from = lastBar;
    // Start where the previous page left the underline, then slide to this page's tab.
    if (bar && from) {
      bar.style.transition = "none";
      bar.style.transform = `translateX(${from.left}px)`;
      bar.style.width = `${from.width}px`;
      bar.style.opacity = "1";
      bar.getBoundingClientRect();
      bar.style.transition = "";
    }
    placeBar(linkFor(pathname), from !== null);
    navRef.current?.setAttribute("data-bar-ready", "");

    const onResize = () => placeBar(linkFor(pathname), false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pathname, placeBar, linkFor]);

  // Slide on click rather than when the next page arrives, so the tab responds immediately.
  function onTabClick(e: MouseEvent<HTMLAnchorElement>, href: string) {
    if (isPlainClick(e)) placeBar(linkFor(href), true);
  }

  return (
    // Same name on every page, so React pairs the old and new header and
    // globals.css holds it still while the page content slides underneath.
    <ViewTransition name="site-header" share="anchored" default="none">
      <header className="site-header">
        <Link
          href="/home"
          className="brand text-base"
          transitionTypes={navTransition(pathname, "/home")}
          onClick={(e) => onTabClick(e, "/home")}
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
        <nav className="main-nav" ref={navRef}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              transitionTypes={navTransition(pathname, link.href)}
              onClick={(e) => onTabClick(e, link.href)}
              aria-current={pathname === link.href ? "page" : undefined}
              className={pathname === link.href ? "current" : undefined}
            >
              {link.label}
            </Link>
          ))}
          <span ref={barRef} className="nav-bar" aria-hidden />
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
    </ViewTransition>
  );
}