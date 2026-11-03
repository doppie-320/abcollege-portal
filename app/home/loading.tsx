import { SiteNavSkeleton } from "@/components/NavigationHeader";
import { Skeleton, SkeletonFrame, SkeletonHero, SkeletonPage, SkeletonPost, SkeletonText } from "@/components/Skeleton";

// Shaped like HomeContent: hero, then the feed beside the birthdays and countdown cards.
export default function HomeLoading() {
  return (
    <>
      <SiteNavSkeleton pathname="/home" />
      <SkeletonPage label="Loading the bulletin board…">
        <SkeletonHero title="w-96" className="mb-7" />

        <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-7 max-[900px]:grid-cols-1">
          <div className="min-w-0">
            <SkeletonFrame className="mb-5 flex items-center justify-between gap-3 px-5 py-3">
              <Skeleton className="h-9 w-full max-w-[320px] rounded-[5px]" />
              <Skeleton className="h-9 w-[140px] shrink-0 rounded-[5px] max-[519px]:w-20" />
            </SkeletonFrame>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5 rounded-t-lg border border-b-navy border-rule bg-paper px-5 py-[11px]">
                <Skeleton className="size-7 rounded-md" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="ml-auto h-3 w-16" />
              </div>
              <SkeletonPost />
              <SkeletonPost />
            </div>
          </div>

          <aside className="flex flex-col gap-6 max-[900px]:hidden">
            {[3, 2].map((rows, index) => (
              <SkeletonFrame key={index}>
                <Skeleton className="mb-4 h-4 w-32" />
                {Array.from({ length: rows }, (_, row) => (
                  <div key={row} className="mb-3 flex items-center gap-3 last:mb-0">
                    <Skeleton className="size-9 shrink-0 rounded-full" />
                    <SkeletonText lines={2} className="flex-1" />
                  </div>
                ))}
              </SkeletonFrame>
            ))}
          </aside>
        </div>
      </SkeletonPage>
    </>
  );
}
