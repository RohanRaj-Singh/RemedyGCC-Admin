'use client';

/**
 * Localized skeletons for the financial tables and summary cards — preserve the
 * layout while data loads, avoiding full-page spinners and layout shifts.
 */

export function FinancialTableSkeleton({
  rows = 5,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
        <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="divide-y divide-gray-50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-gray-200" />
            {Array.from({ length: columns }).map((_, j) => (
              <div key={j} className="h-3.5 flex-1 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FinancialSummarySkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-6 w-24 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}
