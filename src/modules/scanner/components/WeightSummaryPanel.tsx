'use client';

import { AlertTriangle, CheckCircle2, CircleOff, Layers3, MessageSquareText, Shapes } from 'lucide-react';
import { Category, ValidationIssue } from '../types';
import { getCategoryMetrics, getScannerCounts, getSubdomainMetrics, getWeightBalance, sumWeights } from '../utils/metrics';

interface WeightSummaryPanelProps {
  categories: Category[];
  issues: ValidationIssue[];
  selectedCategoryId?: string;
  selectedSubdomainId?: string;
}

function progressWidth(total: number, target: number) {
  if (target <= 0) {
    return 0;
  }

  return Math.min((total / target) * 100, 100);
}

function toneForBalance(total: number, target: number) {
  if (total === target) {
    return {
      bar: 'bg-emerald-500',
      chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }

  if (total > target) {
    return {
      bar: 'bg-rose-500',
      chip: 'bg-rose-50 text-rose-700 border-rose-200',
    };
  }

  return {
    bar: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
  };
}

function WeightRow({
  label,
  total,
  target,
}: {
  label: string;
  total: number;
  target: number;
}) {
  const balance = getWeightBalance(total, target);
  const tone = toneForBalance(total, target);

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-gray-700">{label}</div>
        <div className="text-sm font-semibold text-gray-900">
          {total} / {target}%
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div
          className={`h-full rounded-full ${tone.bar}`}
          style={{ width: `${progressWidth(total, target)}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <span className={`rounded-full border px-2.5 py-1 font-semibold ${tone.chip}`}>
          {balance.isExact
            ? 'Balanced'
            : balance.overflow > 0
              ? `${balance.overflow}% overflow`
              : `${balance.remaining}% remaining`}
        </span>
      </div>
    </div>
  );
}

export function WeightSummaryPanel({
  categories,
  issues,
  selectedCategoryId,
  selectedSubdomainId,
}: WeightSummaryPanelProps) {
  const blockingIssues = issues.filter((issue) => issue.blocking);
  const counts = getScannerCounts(categories);
  const scannerTotal = sumWeights(categories);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const selectedSubdomain = selectedCategory?.subdomains.find((subdomain) => subdomain.id === selectedSubdomainId);
  const categoryMetrics = selectedCategory ? getCategoryMetrics(selectedCategory) : null;
  const subdomainMetrics = selectedSubdomain ? getSubdomainMetrics(selectedSubdomain) : null;

  return (
    <div className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
            Scanner Summary
          </div>
          <h3 className="mt-2 text-xl font-semibold text-gray-900">At a glance</h3>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${
          blockingIssues.length === 0
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-rose-50 text-rose-700'
        }`}>
          {blockingIssues.length === 0 ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <span>{blockingIssues.length === 0 ? 'Ready to publish' : 'Needs attention'}</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            <Layers3 className="h-3.5 w-3.5 text-primary" />
            <span>Categories</span>
          </div>
          <div className="mt-3 text-2xl font-semibold text-gray-900">{counts.categoryCount}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            <Shapes className="h-3.5 w-3.5 text-primary" />
            <span>Subdomains</span>
          </div>
          <div className="mt-3 text-2xl font-semibold text-gray-900">{counts.subdomainCount}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            <MessageSquareText className="h-3.5 w-3.5 text-primary" />
            <span>Questions</span>
          </div>
          <div className="mt-3 text-2xl font-semibold text-gray-900">{counts.questionCount}</div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <WeightRow label="Scanner weight" total={scannerTotal} target={100} />
        {selectedCategory && categoryMetrics && (
          <WeightRow
            label={`${selectedCategory.name.en || `Category ${selectedCategory.slot}`} subdomains`}
            total={categoryMetrics.subdomainWeightTotal}
            target={selectedCategory.weight}
          />
        )}
        {selectedSubdomain && subdomainMetrics && (
          <WeightRow
            label={`${selectedSubdomain.name.en || 'Selected subdomain'} questions`}
            total={subdomainMetrics.questionWeightTotal}
            target={selectedSubdomain.weight}
          />
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-gray-900">Quick issues</div>
          <div className="text-xs text-gray-500">{blockingIssues.length} blocking</div>
        </div>

        {blockingIssues.length === 0 ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            <span>All required weights and hierarchy rules are satisfied.</span>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {blockingIssues.slice(0, 5).map((issue) => (
              <div
                key={`${issue.code}-${issue.path}-${issue.entityId ?? 'root'}`}
                className="rounded-xl border border-white bg-white px-3 py-3"
              >
                <div className="flex items-start gap-3">
                  <CircleOff className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-500" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{issue.message}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-gray-400">
                      {issue.level.replace('-', ' ')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
