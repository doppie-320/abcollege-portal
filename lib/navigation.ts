// Left-to-right order of the main pages, matching the header nav (profile sits
// last, in the user menu). Page transitions slide in the direction of travel.
const PAGE_ORDER = ["/home", "/calendar", "/attendance", "/suggestions", "/profile"];

// Transition types for a <Link transitionTypes> from `from` to `to`, or
// undefined (a plain crossfade) when either page isn't in the order.
export function navTransition(from: string, to: string): string[] | undefined {
  const fromIndex = PAGE_ORDER.indexOf(from);
  const toIndex = PAGE_ORDER.indexOf(to.split(/[?#]/)[0]);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return undefined;
  return [toIndex > fromIndex ? "nav-forward" : "nav-back"];
}
