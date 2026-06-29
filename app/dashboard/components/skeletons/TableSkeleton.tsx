export function TableSkeleton() {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-gray-900/80 sm:p-6">
      <div className="animate-pulse space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-4 w-full rounded bg-gray-200 dark:bg-white/10"
          />
        ))}
      </div>
    </div>
  );
}
