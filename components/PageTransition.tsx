import { ViewTransition, type ReactNode } from "react";

// Animates a page in and out during navigation. Wrap each page's content in
// page.tsx, not a layout: layouts persist across navigations, so enter/exit
// would never fire there. The animations live in globals.css.
//
// Links tagged "nav-forward" / "nav-back" (see lib/navigation.ts) slide; any
// other navigation (browser back, redirects) crossfades. Links tagged "in-page"
// (e.g. the calendar's month arrows) skip it, so only the parts of the page that
// name their own transitions animate. Updates within a page, like the refresh
// after a server action, don't animate.
const PAGE_CLASSES = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  // "none" wins over any other matching type.
  "in-page": "none",
  default: "page-fade",
};

export default function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={PAGE_CLASSES} exit={PAGE_CLASSES} default="none">
      {children}
    </ViewTransition>
  );
}
