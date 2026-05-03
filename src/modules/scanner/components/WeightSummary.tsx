'use client';

import { Category } from '../types';

interface WeightSummaryProps {
  categories: Category[];
  selectedCategoryId?: string;
  selectedSubdomainId?: string;
}

function sumWeights(items: Array<{ weight: number }>) {
  return items.reduce((total, item) => total + item.weight, 0);
}

function statusTone(isValid: boolean) {
  return isValid
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-amber-200 bg-amber-50 text-amber-700';
}

export function WeightSummary({
  categories,
  selectedCategoryId,
  selectedSubdomainId,
}: WeightSummaryProps) {
  const scannerTotal = sumWeights(categories);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const selectedSubdomain = selectedCategory?.subdomains.find(
    (subdomain) => subdomain.id === selectedSubdomainId
  );

  const subdomainTotal = selectedCategory ? sumWeights(selectedCategory.subdomains) : 0;
  const questionTotal = selectedSubdomain ? sumWeights(selectedSubdomain.questions) : 0;

  const rows = [
    {
      label: 'Scanner total',
      value: scannerTotal,
      target: 100,
      isValid: scannerTotal === 100,
    },
    selectedCategory && {
      label: `${selectedCategory.name.en || `Category ${selectedCategory.slot}`} subdomains`,
      value: subdomainTotal,
      target: selectedCategory.weight,
      isValid: subdomainTotal === selectedCategory.weight,
    },
    selectedSubdomain && {
      label: `${selectedSubdomain.name.en || 'Selected subdomain'} questions`,
      value: questionTotal,
      target: selectedSubdomain.weight,
      isValid: questionTotal === selectedSubdomain.weight,
    },
  ].filter(Boolean) as Array<{
    label: string;
    value: number;
    target: number;
    isValid: boolean;
  }>;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Weight Summary
      </h3>

      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className={`rounded-xl border px-3 py-3 text-sm ${statusTone(row.isValid)}`}
          >
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium">{row.label}</span>
              <span className="font-semibold">
                {row.value} / {row.target}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
