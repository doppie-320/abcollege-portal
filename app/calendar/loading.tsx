import { SiteNavSkeleton } from "@/components/NavigationHeader";
import { Skeleton, SkeletonFrame, SkeletonHero, SkeletonPage, SkeletonText } from "@/components/Skeleton";

/** Six weeks, like the real month grid. */
const CELLS = 42;

// Shaped like CalendarContent: hero with stats and Up Next, then the month beside the day agenda.
export default function CalendarLoading() {
  return (
    <>
      <SiteNavSkeleton pathname="/calendar" />
      <SkeletonPage label="Loading the calendar…">
        <div className="mb-7 grid grid-cols-[minmax(0,1fr)_320px] items-start gap-7 max-[900px]:grid-cols-1">
          <div>
            <SkeletonHero title="w-72" />
            <div className="mt-[18px] grid grid-cols-3 gap-3 max-[640px]:gap-2">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="rounded-[6px] border border-rule bg-paper px-3.5 pt-2.5 pb-[11px]">
                  <Skeleton className="mb-2 h-[var(--fs-stat)] w-12" />
                  <Skeleton className="h-2.5 w-20 max-w-full" />
                </div>
              ))}
            </div>
          </div>
          <SkeletonFrame>
            <Skeleton className="mb-3 h-3 w-20" />
            <Skeleton className="mb-2 h-5 w-4/5" />
            <SkeletonText lines={2} />
          </SkeletonFrame>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-7 max-[900px]:grid-cols-1">
          <SkeletonFrame className="min-w-0 p-0">
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 pt-5 pb-2.5 max-[640px]:px-3.5 max-[640px]:pt-3.5">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-9 w-40 rounded-md" />
            </div>
            <div className="flex gap-4 px-5 pb-3 max-[640px]:px-3.5">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-2.5 w-14" />
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px border-y border-rule-soft bg-rule-soft">
              {Array.from({ length: CELLS }, (_, index) => (
                <div key={index} className="min-h-[108px] bg-paper p-2 max-[640px]:min-h-[58px] max-[640px]:p-1">
                  <Skeleton className="ml-auto h-3 w-4 max-[640px]:mx-auto" />
                </div>
              ))}
            </div>
            <div className="px-5 py-4">
              <Skeleton className="mb-2 h-2.5 w-20" />
              <Skeleton className="h-5 w-48" />
            </div>
          </SkeletonFrame>

          <div className="flex flex-col gap-[22px]">
            {[3, 2].map((rows, index) => (
              <SkeletonFrame key={index}>
                <Skeleton className="mb-4 h-4 w-28" />
                {Array.from({ length: rows }, (_, row) => (
                  <SkeletonText key={row} lines={2} className="mb-4 last:mb-0" />
                ))}
              </SkeletonFrame>
            ))}
          </div>
        </div>
      </SkeletonPage>
    </>
  );
}
