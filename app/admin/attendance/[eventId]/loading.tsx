import { HOME_ADMIN_NAV_LINKS, SiteNavSkeleton } from "@/components/NavigationHeader";
import {
  Skeleton,
  SkeletonFrame,
  SkeletonPage,
  SkeletonPageHeader,
  SkeletonPanelHeader,
  SkeletonPeopleRows,
  SkeletonStatStrip,
} from "@/components/Skeleton";

// Shaped like EventAttendance: tally, roster, then the manual record and scanner panels.
export default function EventAttendanceLoading() {
  return (
    <>
      <SiteNavSkeleton pathname="/admin/attendance" links={HOME_ADMIN_NAV_LINKS} />
      <SkeletonPage label="Loading event attendance…">
        <SkeletonPageHeader back title="w-80" actions={2} />

        <SkeletonFrame className="mb-6 p-0">
          <SkeletonStatStrip count={4} columns="grid-cols-2 sm:grid-cols-4" />
        </SkeletonFrame>

        <SkeletonFrame className="mb-6 p-0">
          <SkeletonPanelHeader />
          <div className="border-b border-rule-soft px-5 py-3">
            <Skeleton className="h-9 w-full max-w-xs rounded-[5px]" />
          </div>
          <SkeletonPeopleRows count={6} />
        </SkeletonFrame>

        <div className="grid grid-cols-2 items-start gap-6 max-[900px]:grid-cols-1">
          {[2, 3].map((rows, index) => (
            <SkeletonFrame key={index} className="p-0">
              <SkeletonPanelHeader meta={false} />
              <SkeletonPeopleRows count={rows} badge={false} />
            </SkeletonFrame>
          ))}
        </div>
      </SkeletonPage>
    </>
  );
}
