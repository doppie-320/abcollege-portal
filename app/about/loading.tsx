import { SiteNavSkeleton } from "@/components/NavigationHeader";

export default function AboutLoading() {
  return (
    <>
      <SiteNavSkeleton pathname="/about" />
      <main className="mx-auto max-w-4xl px-6 py-12" aria-busy="true">
        Loading About…
      </main>
    </>
  );
}
