import { SiteNavSkeleton } from "@/components/NavigationHeader";
import { Skeleton, SkeletonFrame, SkeletonPage } from "@/components/Skeleton";

// Shaped like AdminProfileContent: the council card with its detail rows. Same tab-less bar as the real page.
export default function AdminProfileLoading() {
  return (
    <>
      <SiteNavSkeleton pathname="/admin/profile" links={[]} brandHref="/admin" />
      <SkeletonPage label="Loading your profile…">
        <div className="mb-6">
          <Skeleton className="mb-2 h-[var(--fs-section)] w-56" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>

        <SkeletonFrame className="max-w-[620px]">
          <Skeleton className="mb-3 h-3 w-24" />
          <div className="flex items-start gap-6 max-[480px]:flex-col max-[480px]:gap-3">
            <Skeleton className="size-32 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 pt-2">
              <Skeleton className="mb-3 h-6 w-48 max-w-full" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>

          <div className="mt-4 divide-y divide-rule-soft overflow-hidden rounded-[6px] border border-rule bg-paper">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex justify-between gap-3 px-3.5 py-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-40" />
              </div>
            ))}
          </div>
        </SkeletonFrame>
      </SkeletonPage>
    </>
  );
}
