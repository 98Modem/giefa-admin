const barHeights = [38, 62, 45, 78, 54, 88, 66, 72, 50, 69, 57, 82];

export function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
      </div>

      {/* Chart Area */}
      <div className="flex h-60 items-end gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-md bg-gray-200"
            style={{
              height: `${barHeights[i]}%`,
            }}
          />
        ))}
      </div>

      {/* Footer labels */}
      <div className="mt-4 flex justify-between">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-3 w-10 animate-pulse rounded bg-gray-200"
          />
        ))}
      </div>
    </div>
  );
}
