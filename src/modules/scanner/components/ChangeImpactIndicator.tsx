'use client';

import { AlertCircle, Info, ShieldCheck, Zap } from 'lucide-react';
import type { ChangeImpact } from '../utils/change-impact';

interface ChangeImpactIndicatorProps {
  impacts: ChangeImpact[];
  responseCount: number;
}

export function ChangeImpactIndicator({
  impacts,
  responseCount,
}: ChangeImpactIndicatorProps) {
  if (impacts.length === 0) {
    return null;
  }

  const safeCount = impacts.filter(i => i.type === 'safe').length;
  const additiveCount = impacts.filter(i => i.type === 'additive').length;
  const breakingCount = impacts.filter(i => i.type === 'breaking').length;

  // If there are breaking changes and responses exist, show warning
  const hasBlockingIssues = breakingCount > 0 && responseCount > 0;

  return (
    <div className={`rounded-xl p-4 ${
      hasBlockingIssues
        ? 'bg-red-50 border border-red-200'
        : additiveCount > 0
          ? 'bg-green-50 border border-green-200'
          : 'bg-gray-50 border border-gray-200'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        {hasBlockingIssues ? (
          <>
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="font-semibold text-red-800">Breaking Changes Detected</span>
          </>
        ) : additiveCount > 0 ? (
          <>
            <Zap className="h-5 w-5 text-green-600" />
            <span className="font-semibold text-green-800">Safe Additive Changes</span>
          </>
        ) : (
          <>
            <ShieldCheck className="h-5 w-5 text-gray-600" />
            <span className="font-semibold text-gray-800">Minor Changes</span>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        {safeCount > 0 && (
          <span className="flex items-center gap-1 text-blue-700 bg-blue-100 px-2 py-1 rounded-lg">
            <Info className="h-3.5 w-3.5" />
            {safeCount} safe (metadata/order)
          </span>
        )}
        {additiveCount > 0 && (
          <span className="flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded-lg">
            <Zap className="h-3.5 w-3.5" />
            {additiveCount} additive
          </span>
        )}
        {breakingCount > 0 && (
          <span className="flex items-center gap-1 text-red-700 bg-red-100 px-2 py-1 rounded-lg">
            <AlertCircle className="h-3.5 w-3.5" />
            {breakingCount} breaking
          </span>
        )}
      </div>

      {responseCount > 0 && hasBlockingIssues && (
        <p className="mt-3 text-sm text-red-700">
          This scanner has {responseCount} submission{responseCount !== 1 ? 's' : ''}.
          Breaking changes are blocked to protect historical data.
        </p>
      )}

      {responseCount > 0 && !hasBlockingIssues && additiveCount > 0 && (
        <p className="mt-3 text-sm text-green-700">
          These changes are safe to make even with existing submissions.
        </p>
      )}
    </div>
  );
}