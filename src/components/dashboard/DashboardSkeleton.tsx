'use client';

// ── Dashboard skeleton — per-section loading placeholders (PA4) ────────────
// Mirrors the new layout one-to-one so layout does not shift on load.
// Header + Refresh button row + Attention queue rows + Concentration
// rows + 5-cell workflow + activity buckets.

function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} aria-hidden="true" />;
}

export default function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-7">
      {/* Header + Refresh */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <Bar className="h-8 w-72" />
          <Bar className="h-4 w-96 max-w-full" />
        </div>
        <Bar className="mt-1 h-7 w-20" />
      </div>

      {/* Attention queue */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <Bar className="h-4 w-40" />
          <Bar className="h-3 w-12" />
        </div>
        <div className="flex flex-col gap-2">
          <Bar className="h-16 w-full" />
          <Bar className="h-16 w-full" />
        </div>
      </div>

      {/* Concentration */}
      <div className="flex flex-col gap-3">
        <Bar className="h-4 w-32" />
        <Bar className="h-20 w-full" />
        <Bar className="h-20 w-full" />
        <Bar className="h-20 w-full" />
      </div>

      {/* Workflow state */}
      <div className="flex flex-col gap-3">
        <Bar className="h-4 w-40" />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Bar key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>

      {/* Activity timeline */}
      <div className="flex flex-col gap-3">
        <Bar className="h-4 w-32" />
        <div className="flex flex-col gap-2">
          <Bar className="h-3 w-16" />
          <Bar className="h-12 w-full" />
          <Bar className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
