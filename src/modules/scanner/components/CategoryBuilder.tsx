'use client';

import { AlertTriangle, CheckCircle2, Scale } from 'lucide-react';
import { Category } from '../types';
import { getWeightBalance, sumWeights } from '../utils/metrics';
import { CategoryCard } from './CategoryCard';

interface CategoryBuilderProps {
  categories: Category[];
  selectedCategoryId?: string;
  disabled?: boolean;
  onSelectCategory: (categoryId: string) => void;
  onCategoryChange: (category: Category) => void;
}

export function CategoryBuilder({
  categories,
  selectedCategoryId,
  disabled = false,
  onSelectCategory,
  onCategoryChange,
}: CategoryBuilderProps) {
  const totalWeight = sumWeights(categories);
  const balance = getWeightBalance(totalWeight, 100);

  return (
    <div className="space-y-5">
      <div className="rounded-[1.75rem] border border-gray-200 bg-gray-50 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              <Scale className="h-3.5 w-3.5 text-primary" />
              <span>Category Weights</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-gray-900">Five fixed categories</h3>
            <p className="mt-1 text-sm text-gray-600">
              These top-level cards cannot be added or removed. Set the category names,
              polarity, and weights so the scanner total reaches exactly 100%.
            </p>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${
              balance.isExact
                ? 'bg-emerald-50 text-emerald-700'
                : balance.overflow > 0
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-amber-50 text-amber-700'
            }`}
          >
            {balance.isExact ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <span>
              {balance.isExact
                ? 'Balanced at 100%'
                : balance.overflow > 0
                  ? `${balance.overflow}% over 100%`
                  : `${balance.remaining}% remaining`}
            </span>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-gray-700">Scanner category total</span>
            <span className="font-semibold text-gray-900">{totalWeight} / 100%</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${
                balance.isExact
                  ? 'bg-emerald-500'
                  : balance.overflow > 0
                    ? 'bg-rose-500'
                    : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(totalWeight, 100)}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500">
            <span>Exactly 5 categories required</span>
            <span>
              {balance.isExact
                ? 'Ready for subdomains'
                : balance.overflow > 0
                  ? `${balance.overflow}% overflow`
                  : `${balance.remaining}% still unassigned`}
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1180px] grid-flow-col auto-cols-[minmax(220px,1fr)] gap-4">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              selected={category.id === selectedCategoryId}
              disabled={disabled}
              onSelect={onSelectCategory}
              onChange={onCategoryChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
