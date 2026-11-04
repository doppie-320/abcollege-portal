import { useSyncExternalStore } from "react";
import type { NavLink } from "@/components/NavigationHeader";

/** What SiteNav last showed, so SiteNavSkeleton can look the same while the next page loads. */
export type RememberedNav = {
  links?: readonly NavLink[];
  user: {
    initials: string;
    name: string;
    nameOverride?: string;
    userId: string;
    avatarUrl: string;
    profileHref?: string;
    profileLabel?: string;
    menuLinks?: readonly NavLink[];
  };
};

// Only ever written from an effect, which never runs on the server, so one
// visitor's nav can't reach another's through this module.
let remembered: RememberedNav | null = null;

export function rememberNav(nav: RememberedNav) {
  // A tab-less page (the admin profile) says nothing about the next page's tabs.
  remembered = { ...nav, links: nav.links?.length ? nav.links : remembered?.links };
}

/** Logging in happens without a page reload, so this has to be cleared between users. */
export function forgetNav() {
  remembered = null;
}

// Nothing to subscribe to: the value only changes when a real SiteNav is on screen, not a skeleton.
const subscribe = () => () => {};

/** Null on the server and while hydrating, so a full page load still gets the placeholder chip. */
export function useRememberedNav() {
  return useSyncExternalStore(
    subscribe,
    () => remembered,
    () => null,
  );
}
