import { HOME_ADMIN_NAV_LINKS, SiteNavSkeleton } from "@/components/NavigationHeader";
import { Skeleton, SkeletonFrame, SkeletonPage, SkeletonText } from "@/components/Skeleton";

// Shaped like AdminContent: page title over the grid of module cards.
export default function AdminLoading() {
  return (
    <>
      <SiteNavSkeleton pathname="/admin" links={HOME_ADMIN_NAV_LINKS} />
      <SkeletonPage label="Loading the admin console…">
        <div className="mb-8">
          <Skeleton className="mb-2.5 h-3 w-40" />
          <Skeleton className="h-[var(--fs-display)] w-96 max-w-full" />
          <Skeleton className="mt-3.5 h-3 w-72 max-w-full" />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {Array.from({ length: 3 }, (_, index) => (
            <SkeletonFrame key={index} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="size-11 rounded-none" />
                <Skeleton className="h-5 w-20 rounded-none" />
              </div>
              <div className="mt-1">
                <Skeleton className="mb-2.5 h-5 w-48" />
                <SkeletonText lines={2} />
              </div>
              <Skeleton className="mt-2 h-3 w-28" />
            </SkeletonFrame>
          ))}
        </div>
      </SkeletonPage>
    </>
  );
}
