import { SiteNavSkeleton } from "@/components/NavigationHeader";
import {
  Skeleton,
  SkeletonFrame,
  SkeletonPage,
  SkeletonPageHeader,
  SkeletonPeopleRows,
  SkeletonStatStrip,
} from "@/components/Skeleton";
import { BLUEPRINT_GRID } from "../ui";

// Shaped like Scanner: the camera panel beside the session tally and recent scans.
export default function ScanLoading() {
  return (
    <>
      <SiteNavSkeleton pathname="/attendance/scan" />
      <SkeletonPage label="Loading the scanner…">
        <SkeletonPageHeader back title="w-72" />

        <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-6 max-[980px]:grid-cols-1">
          <SkeletonFrame className="p-0">
            <div className="border-b border-rule-soft px-5 py-4">
              <Skeleton className="mb-2 h-2.5 w-20" />
              <Skeleton className="h-10 w-full rounded-[5px]" />
              <div className="mt-2.5 flex items-center gap-3">
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-2.5 w-40" />
              </div>
            </div>
            <div className="p-5">
              <div className={`min-h-[280px] rounded-lg border border-navy-deep bg-navy-deep ${BLUEPRINT_GRID}`} />
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-[38px] flex-1 rounded-lg" />
                <Skeleton className="h-[38px] w-32 rounded-lg" />
              </div>
            </div>
          </SkeletonFrame>

          <div className="flex flex-col gap-6">
            <SkeletonFrame className="p-0">
              <div className="border-b border-rule-soft px-5 py-3.5">
                <Skeleton className="h-4 w-32" />
              </div>
              <SkeletonStatStrip count={2} columns="grid-cols-2" />
            </SkeletonFrame>
            <SkeletonFrame className="p-0">
              <div className="border-b border-rule-soft px-5 py-3.5">
                <Skeleton className="h-4 w-28" />
              </div>
              <SkeletonPeopleRows count={3} />
            </SkeletonFrame>
          </div>
        </div>
      </SkeletonPage>
    </>
  );
}
