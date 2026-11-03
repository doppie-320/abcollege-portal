import { HOME_ADMIN_NAV_LINKS, SiteNavSkeleton } from "@/components/NavigationHeader";
import { Skeleton, SkeletonFrame, SkeletonPage, SkeletonPeopleRows, SkeletonText } from "@/components/Skeleton";

// Shaped like UserAccountReview: title beside the status tally, then the applicant list beside the details panel.
export default function UserAccountReviewLoading() {
  return (
    <>
      <SiteNavSkeleton pathname="/admin/user-account-review" links={HOME_ADMIN_NAV_LINKS} />
      <SkeletonPage label="Loading registrations…">
        <div className="mb-6 flex flex-wrap items-stretch justify-between gap-x-8 gap-y-5">
          <div className="flex flex-col justify-between">
            <div>
              <Skeleton className="mb-2.5 h-3 w-40" />
              <Skeleton className="h-[var(--fs-display)] w-[28rem] max-w-full" />
            </div>
            <Skeleton className="mt-3.5 h-3 w-80 max-w-full" />
          </div>

          <SkeletonFrame className="w-full p-0 sm:w-[380px]">
            <div className="grid grid-cols-3 divide-x divide-rule-soft">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="px-4 pt-3 pb-2.5">
                  <Skeleton className="mb-2 h-2.5 w-14" />
                  <Skeleton className="h-[var(--fs-stat-sm)] w-8" />
                </div>
              ))}
            </div>
            <div className="border-t border-rule-soft px-4 pt-2 pb-3">
              <Skeleton className="mb-2 h-2.5 w-full" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          </SkeletonFrame>
        </div>

        <div className="grid grid-cols-[440px_1fr] items-stretch gap-6 max-[980px]:grid-cols-1">
          <SkeletonFrame className="flex h-[clamp(515px,calc(100vh-300px),640px)] flex-col p-0">
            <div className="shrink-0 border-b border-rule-soft px-4 py-3">
              <Skeleton className="mb-2 h-2.5 w-28" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-6 w-20 rounded-md" />
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <SkeletonPeopleRows count={7} />
            </div>
          </SkeletonFrame>

          <SkeletonFrame className="flex flex-col gap-5 max-[980px]:hidden">
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 shrink-0 rounded-full" />
              <div className="flex-1">
                <Skeleton className="mb-2.5 h-5 w-52" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index}>
                  <Skeleton className="mb-2 h-2.5 w-16" />
                  <Skeleton className="h-3.5 w-4/5" />
                </div>
              ))}
            </div>
            <SkeletonText lines={2} />
          </SkeletonFrame>
        </div>
      </SkeletonPage>
    </>
  );
}
