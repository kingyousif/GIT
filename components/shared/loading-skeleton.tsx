import { Skeleton } from '@/components/ui/skeleton';

export function LoadingCardGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-card-border bg-card p-6 shadow-soft">
          <Skeleton className="mb-4 h-4 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export function LoadingTable() {
  return (
    <div className="space-y-3 rounded-2xl border border-card-border bg-card p-6 shadow-soft">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}
