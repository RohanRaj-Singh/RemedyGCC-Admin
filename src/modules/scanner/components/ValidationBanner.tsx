'use client';

import { AlertTriangle, CheckCircle2, CircleOff } from 'lucide-react';
import { ValidationIssue } from '../types';

interface ValidationBannerProps {
  issues: ValidationIssue[];
}

export function ValidationBanner({ issues }: ValidationBannerProps) {
  const blockingIssues = issues.filter((issue) => issue.blocking);
  const categoryIssues = blockingIssues.filter((issue) => issue.level === 'category').length;
  const subdomainIssues = blockingIssues.filter((issue) => issue.level === 'subdomain').length;
  const questionIssues = blockingIssues.filter((issue) => issue.level === 'question').length;

  if (blockingIssues.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white p-3 text-emerald-600 shadow-sm">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-emerald-800">Publish rules are satisfied</div>
              <div className="mt-1 text-sm text-emerald-700">
                The hierarchy and weight totals are currently valid across all levels.
              </div>
            </div>
          </div>
          <div className="inline-flex rounded-full bg-white px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm">
            Ready to publish
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white p-3 text-rose-600 shadow-sm">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-rose-800">
              {blockingIssues.length} blocking issue(s) must be resolved before publish
            </div>
            <div className="mt-1 text-sm text-rose-700">
              Fix the items below to complete the scanner hierarchy and balance all weights.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm">
            {categoryIssues} category
          </div>
          <div className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm">
            {subdomainIssues} subdomain
          </div>
          <div className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm">
            {questionIssues} question
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {blockingIssues.slice(0, 6).map((issue) => (
          <div
            key={`${issue.code}-${issue.path}-${issue.entityId ?? 'root'}`}
            className="rounded-2xl border border-rose-100 bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <CircleOff className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-500" />
              <div>
                <div className="text-sm font-medium text-gray-900">{issue.message}</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                  {issue.level.replace('-', ' ')}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
