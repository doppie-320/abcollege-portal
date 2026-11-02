import { SiteNavSkeleton } from "@/components/NavigationHeader";
import { Skeleton, SkeletonFrame, SkeletonPage, SkeletonPageHeader, SkeletonText } from "@/components/Skeleton";
import { BLUEPRINT_GRID } from "@/app/attendance/ui";

// Shaped like ProfileContent: the student card beside the GWA calculator.
export default function ProfileLoading() {
  return (
    <>
      <SiteNavSkeleton pathname="/profile" />
      <SkeletonPage label="Loading your profile…">
        <SkeletonPageHeader title="w-72" actions={1} />

        <div className="mb-6 grid grid-cols-[540px_minmax(0,1fr)] items-start gap-6 max-[900px]:grid-cols-1">
          <SkeletonFrame className="p-0">
            <div className={`h-28 rounded-t-[5px] border-b-[3px] border-orange bg-navy px-5 pt-4 ${BLUEPRINT_GRID}`}>
              <Skeleton dark className="h-2.5 w-24" />
            </div>
            <div className="px-5 pb-5">
              <div className="-mt-16 flex items-start gap-6 max-[480px]:flex-col max-[480px]:gap-3">
                <Skeleton className="size-32 shrink-0 rounded-full ring-4 ring-paper" />
                <div className="min-w-0 flex-1 pt-[72px] max-[480px]:pt-0">
                  <Skeleton className="mb-3 h-6 w-48 max-w-full" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-rule bg-rule-soft max-[480px]:grid-cols-1">
                {["", "", "col-span-2 max-[480px]:col-span-1", "col-span-2 max-[480px]:col-span-1"].map((span, index) => (
                  <div key={index} className={`bg-paper px-4 py-3 ${span}`}>
                    <Skeleton className="mb-2 h-2.5 w-16" />
                    <Skeleton className="h-3.5 w-3/5" />
                  </div>
                ))}
              </div>
            </div>
          </SkeletonFrame>

          <SkeletonFrame>
            <Skeleton className="mb-2 h-5 w-40" />
            <Skeleton className="mb-5 h-3 w-3/4" />
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="mb-3 flex gap-3">
                <Skeleton className="h-9 flex-1 rounded-[5px]" />
                <Skeleton className="h-9 w-20 rounded-[5px]" />
              </div>
            ))}
            <SkeletonText lines={2} className="mt-5" />
          </SkeletonFrame>
        </div>
      </SkeletonPage>
    </>
  );
}
