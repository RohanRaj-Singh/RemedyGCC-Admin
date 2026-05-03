'use client';

import { ArrowRight, Plus, Shapes } from 'lucide-react';
import { Category, Subdomain } from '../types';
import { createEmptySubdomain } from '../utils/builder';
import { getCategoryMetrics } from '../utils/metrics';
import { SubdomainCard } from './SubdomainCard';

interface SubdomainBuilderProps {
  category?: Category;
  selectedSubdomainId?: string;
  disabled?: boolean;
  onSelectSubdomain: (subdomainId: string) => void;
  onCategoryChange: (category: Category) => void;
  onAdvanceToQuestions?: () => void;
}

export function SubdomainBuilder({
  category,
  selectedSubdomainId,
  disabled = false,
  onSelectSubdomain,
  onCategoryChange,
  onAdvanceToQuestions,
}: SubdomainBuilderProps) {
  if (!category) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
        Select a category first to manage its subdomains.
      </div>
    );
  }

  const activeCategory = category;
  const metrics = getCategoryMetrics(activeCategory);
  const selectedSubdomain = activeCategory.subdomains.find(
    (subdomain) => subdomain.id === selectedSubdomainId
  );

  function updateSubdomain(updatedSubdomain: Subdomain) {
    onCategoryChange({
      ...activeCategory,
      subdomains: activeCategory.subdomains.map((subdomain) =>
        subdomain.id === updatedSubdomain.id ? updatedSubdomain : subdomain
      ),
    });
  }

  function addSubdomain() {
    onCategoryChange({
      ...activeCategory,
      subdomains: [...activeCategory.subdomains, createEmptySubdomain(activeCategory.id)],
    });
  }

  function removeSubdomain(subdomainId: string) {
    if (activeCategory.subdomains.length === 1) {
      return;
    }

    onCategoryChange({
      ...activeCategory,
      subdomains: activeCategory.subdomains.filter((subdomain) => subdomain.id !== subdomainId),
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[1.75rem] border border-gray-200 bg-gray-50 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              <Shapes className="h-3.5 w-3.5 text-primary" />
              <span>Subdomain Layout</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-gray-900">
              {activeCategory.name.en || `Category ${activeCategory.slot}`}
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Add subdomains directly inside this category. Their combined weights must
              match the parent category exactly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`rounded-full px-3 py-2 text-xs font-semibold ${
                metrics.balance.isExact
                  ? 'bg-emerald-50 text-emerald-700'
                  : metrics.balance.overflow > 0
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-amber-50 text-amber-700'
              }`}
            >
              {metrics.subdomainWeightTotal} / {activeCategory.weight}% assigned
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={addSubdomain}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add Subdomain
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-gray-700">Subdomain weight</span>
            <span className="font-semibold text-gray-900">
              {metrics.subdomainWeightTotal} / {activeCategory.weight}%
            </span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${
                metrics.balance.isExact
                  ? 'bg-emerald-500'
                  : metrics.balance.overflow > 0
                    ? 'bg-rose-500'
                    : 'bg-amber-500'
              }`}
              style={{
                width: `${Math.min(
                  (metrics.subdomainWeightTotal / Math.max(activeCategory.weight || 1, 1)) * 100,
                  100
                )}%`,
              }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
            <span>{metrics.subdomainCount} subdomains</span>
            <span>{metrics.questionCount} questions</span>
            <span>
              {metrics.balance.isExact
                ? 'Ready for questions'
                : metrics.balance.overflow > 0
                  ? `${metrics.balance.overflow}% overflow`
                  : `${metrics.balance.remaining}% remaining`}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {activeCategory.subdomains.map((subdomain, index) => (
          <SubdomainCard
            key={subdomain.id}
            subdomain={subdomain}
            index={index}
            parentWeight={activeCategory.weight}
            selected={selectedSubdomain?.id === subdomain.id}
            disabled={disabled}
            canRemove={activeCategory.subdomains.length > 1}
            onSelect={onSelectSubdomain}
            onChange={updateSubdomain}
            onRemove={removeSubdomain}
            onOpenQuestions={onAdvanceToQuestions}
          />
        ))}
      </div>

      {selectedSubdomain && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onAdvanceToQuestions}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            Continue to Questions
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
