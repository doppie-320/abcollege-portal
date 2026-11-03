import Image from "next/image";

// Shown by the signed-in sections' loading.tsx files while the page's data is
// on its way from the database. It prerenders into the static shell, so the
// nav bar and page outline appear the moment a page is opened, instead of a
// blank screen until every query has finished.

function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-vellum-2 ${className}`} />;
}

function Card({ lines }: { lines: number }) {
  return (
    <div className="rounded-lg border border-rule-soft bg-paper p-5">
      <Bar className="mb-4 h-4 w-1/3" />
      {Array.from({ length: lines }, (_, index) => (
        <Bar key={index} className={`mb-3 h-3 ${index === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

export default function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page">
      <div className="site-nav-bar">
        <header className="site-header">
          <span className="brand text-base">
            <Image src="/logo.svg" alt="" width={28} height={28} className="size-7 shrink-0 object-contain" />
            SOE HUB
          </span>
        </header>
      </div>

      <div className="page-wrap">
        <Bar className="mb-3 h-3 w-48" />
        <Bar className="mb-3 h-8 w-72 max-w-full" />
        <Bar className="mb-8 h-3 w-96 max-w-full" />

        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <Card lines={5} />
          <Card lines={3} />
        </div>
      </div>
    </div>
  );
}
