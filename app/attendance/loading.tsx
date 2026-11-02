import { SiteNavSkeleton } from "@/components/NavigationHeader";
import {
  Skeleton,
  SkeletonEventRows,
  SkeletonFrame,
  SkeletonPage,
  SkeletonPageHeader,
  SkeletonPanelHeader,
  SkeletonStatStrip,
} from "@/components/Skeleton";
import { BLUEPRINT_GRID } from "./ui";

// Shaped like the student view of the attendance page (most visitors): the pass beside their history.
export default function AttendanceLoading() {
  return (
    <>
      <SiteNavSkeleton pathname="/attendance" />
      <SkeletonPage label="Loading your attendance pass…">
        <SkeletonPageHeader title="w-56" />

        <div className="grid grid-cols-[380px_minmax(0,1fr)] items-start gap-6 max-[900px]:grid-cols-1">
          <SkeletonFrame className="p-0">
            <div className={`rounded-t-[5px] border-b-[3px] border-orange bg-navy px-5 py-4 ${BLUEPRINT_GRID}`}>
              <div className="mb-3 flex items-center justify-between">
                <Skeleton dark className="h-2.5 w-28" />
                <Skeleton dark className="h-2.5 w-10" />
              </div>
              <div className="flex items-center gap-3.5">
                <Skeleton dark className="size-12 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <Skeleton dark className="mb-2 h-4 w-40" />
                  <Skeleton dark className="mb-1.5 h-3 w-24" />
                  <Skeleton dark className="h-2.5 w-32" />
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center px-5 pt-7 pb-5">
              <Skeleton className="aspect-square w-full max-w-[240px] rounded-lg" />
              <Skeleton className="mt-5 h-3 w-40" />
              <Skeleton className="mt-4 h-[38px] w-full rounded-lg" />
            </div>
          </SkeletonFrame>

          <SkeletonFrame className="p-0">
            <SkeletonPanelHeader />
            <SkeletonStatStrip />
            <div className="border-t border-rule-soft">
              <SkeletonEventRows count={4} />
            </div>
          </SkeletonFrame>
        </div>
      </SkeletonPage>
    </>
  );
}
