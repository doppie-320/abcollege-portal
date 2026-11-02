import { HOME_ADMIN_NAV_LINKS, SiteNavSkeleton } from "@/components/NavigationHeader";
import {
  SkeletonEventRows,
  SkeletonFrame,
  SkeletonPage,
  SkeletonPageHeader,
  SkeletonPanelHeader,
  SkeletonStatStrip,
} from "@/components/Skeleton";

// Shaped like the admin attendance page: the state tally over the list of events.
export default function AdminAttendanceLoading() {
  return (
    <>
      <SiteNavSkeleton pathname="/admin/attendance" links={HOME_ADMIN_NAV_LINKS} />
      <SkeletonPage label="Loading events…">
        <SkeletonPageHeader back title="w-72" actions={1} />

        <SkeletonFrame className="p-0">
          <SkeletonStatStrip count={4} columns="grid-cols-2 sm:grid-cols-4" />
        </SkeletonFrame>

        <SkeletonFrame className="mt-6 p-0">
          <SkeletonPanelHeader />
          <SkeletonEventRows count={6} />
        </SkeletonFrame>
      </SkeletonPage>
    </>
  );
}
