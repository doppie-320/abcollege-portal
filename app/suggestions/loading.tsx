import { SiteNavSkeleton } from "@/components/NavigationHeader";
import { Skeleton, SkeletonFrame, SkeletonHero, SkeletonPage, SkeletonText } from "@/components/Skeleton";

// Shaped like SuggestionsContent: hero beside the drop box, then toolbar, category chips and the card board.
export default function SuggestionsLoading() {
  return (
    <>
      <SiteNavSkeleton pathname="/suggestions" />
      <SkeletonPage label="Loading the suggestion box…">
        <div className="mb-7 grid grid-cols-[minmax(0,1fr)_340px] items-stretch gap-7 max-[900px]:grid-cols-1 max-[520px]:mb-5 max-[520px]:gap-5">
          <div className="flex flex-col">
            <SkeletonHero title="w-72" />
            <div className="mt-auto grid grid-cols-[repeat(2,minmax(0,220px))] gap-3 pt-[18px] max-[520px]:grid-cols-2 max-[520px]:gap-2">
              {Array.from({ length: 2 }, (_, index) => (
                <div key={index} className="rounded-[6px] border border-rule bg-paper px-3.5 pt-2.5 pb-[11px]">
                  <Skeleton className="mb-2 h-[var(--fs-stat)] w-12" />
                  <Skeleton className="h-2.5 w-24 max-w-full" />
                </div>
              ))}
            </div>
          </div>
          <SkeletonFrame className="flex flex-col items-center gap-4 text-center max-[900px]:flex-row max-[900px]:text-left">
            <Skeleton className="h-20 w-24 shrink-0 rounded-md" />
            <div className="flex w-full flex-col items-center gap-2 max-[900px]:items-start">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-full max-w-60" />
            </div>
            <Skeleton className="h-[38px] w-full shrink-0 rounded-md max-[900px]:w-44" />
          </SkeletonFrame>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-7 max-[900px]:grid-cols-1">
          <div className="min-w-0">
            <SkeletonFrame className="mb-3.5 flex items-center justify-between gap-3 px-5 py-3">
              <Skeleton className="h-9 w-full max-w-[320px] rounded-[5px]" />
              <div className="flex shrink-0 gap-2.5">
                <Skeleton className="h-9 w-28 rounded-[5px] max-[520px]:hidden" />
                <Skeleton className="h-9 w-20 rounded-[5px]" />
              </div>
            </SkeletonFrame>

            <div className="mb-5 flex flex-wrap gap-2">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-8 w-24 rounded-full" />
              ))}
            </div>

            <div className="mb-4 flex items-center gap-2.5">
              <Skeleton className="size-7 rounded-md" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="ml-auto h-3 w-20" />
            </div>
            <div className="grid grid-cols-2 gap-x-[18px] gap-y-6 max-[640px]:grid-cols-1">
              {Array.from({ length: 4 }, (_, index) => (
                <SkeletonFrame key={index}>
                  <div className="mb-4 flex items-center justify-between">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                  <Skeleton className="mb-3 h-4 w-4/5" />
                  <SkeletonText lines={3} />
                  <div className="mt-5 flex items-center gap-2">
                    <Skeleton className="size-7 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </SkeletonFrame>
              ))}
            </div>
          </div>

          <SkeletonFrame className="max-[900px]:hidden">
            <Skeleton className="mb-4 h-4 w-28" />
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="mb-3 flex items-center justify-between last:mb-0">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-6" />
              </div>
            ))}
          </SkeletonFrame>
        </div>
      </SkeletonPage>
    </>
  );
}
