'use client';

import { ArrowRight, Layers3, Target } from 'lucide-react';
import { Category } from '../types';
import { getCategoryMetrics } from '../utils/metrics';

type CategoryCardVariant = 'editor' | 'selector';

interface CategoryCardProps {
  category: Category;
  variant?: CategoryCardVariant;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: (categoryId: string) => void;
  onChange?: (category: Category) => void;
}

function progressTone(isValid: boolean, isNegative: boolean) {
  if (isValid) {
    return 'bg-emerald-500';
  }

  return isNegative ? 'bg-rose-500' : 'bg-amber-500';
}

export function CategoryCard({
  category,
  variant = 'editor',
  selected = false,
  disabled = false,
  onSelect,
  onChange,
}: CategoryCardProps) {
  const metrics = getCategoryMetrics(category);
  const balanceLabel = metrics.balance.overflow > 0
    ? `${metrics.balance.overflow}% over`
    : `${metrics.balance.remaining}% remaining`;
  const baseTone = category.polarity === 'negative'
    ? 'from-rose-50 via-white to-white'
    : 'from-emerald-50 via-white to-white';

  if (variant === 'selector') {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(category.id)}
        className={`rounded-2xl border p-4 text-left transition ${
          selected
            ? 'border-primary bg-primary/5 shadow-sm'
            : 'border-gray-200 bg-white hover:border-primary/30'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
              Category {category.slot}
            </div>
            <div className="mt-2 font-semibold text-gray-900">
              {category.name.en || `Category ${category.slot}`}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {category.subdomains.length} subdomains, {metrics.questionCount} questions
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-gray-900">{category.weight}%</div>
            <div className={`mt-1 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
              category.polarity === 'negative'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              {category.polarity}
            </div>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${progressTone(metrics.balance.isExact, category.polarity === 'negative')}`}
            style={{
              width: `${Math.min((metrics.subdomainWeightTotal / Math.max(category.weight || 1, 1)) * 100, 100)}%`,
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>{metrics.subdomainWeightTotal} / {category.weight}%</span>
          <span>{metrics.balance.isExact ? 'balanced' : balanceLabel}</span>
        </div>
      </button>
    );
  }

  return (
    <div
      className={`rounded-[1.75rem] border bg-gradient-to-br p-5 shadow-sm transition ${
        selected
          ? 'border-primary shadow-[0_20px_45px_-28px_rgba(9,83,51,0.55)]'
          : 'border-gray-200'
      } ${baseTone}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            Category {category.slot}
          </div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
            <Layers3 className="h-3.5 w-3.5 text-primary" />
            <span>{category.subdomains.length} subdomains</span>
          </div>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${
          category.polarity === 'negative'
            ? 'bg-rose-100 text-rose-700'
            : 'bg-emerald-100 text-emerald-700'
        }`}>
          {category.polarity}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
            Category Name
          </label>
          <input
            value={category.name.en}
            disabled={disabled}
            onChange={(event) =>
              onChange?.({
                ...category,
                name: { ...category.name, en: event.target.value },
              })
            }
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
            placeholder="Name in English"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
            Arabic Name
          </label>
          <input
            value={category.name.ar}
            disabled={disabled}
            dir="rtl"
            onChange={(event) =>
              onChange?.({
                ...category,
                name: { ...category.name, ar: event.target.value },
              })
            }
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
            placeholder="Name in Arabic"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Weight
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={100}
                disabled={disabled}
                value={category.weight}
                onChange={(event) =>
                  onChange?.({
                    ...category,
                    weight: Number(event.target.value),
                  })
                }
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-10 text-sm font-semibold text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">
                %
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Polarity
            </label>
            <div className="grid grid-cols-2 rounded-2xl border border-gray-200 bg-white p-1">
              {(['positive', 'negative'] as const).map((polarity) => (
                <button
                  key={polarity}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    onChange?.({
                      ...category,
                      polarity,
                    })
                  }
                  className={`rounded-[1rem] px-3 py-2 text-sm font-medium transition ${
                    category.polarity === polarity
                      ? polarity === 'negative'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-emerald-100 text-emerald-700'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {polarity === 'positive' ? 'Positive' : 'Negative'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/80 bg-white/85 p-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 font-medium text-gray-700">
            <Target className="h-4 w-4 text-primary" />
            <span>Assigned subdomains</span>
          </div>
          <span className="font-semibold text-gray-900">
            {metrics.subdomainWeightTotal} / {category.weight}%
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${progressTone(metrics.balance.isExact, category.polarity === 'negative')}`}
            style={{
              width: `${Math.min((metrics.subdomainWeightTotal / Math.max(category.weight || 1, 1)) * 100, 100)}%`,
            }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>{metrics.subdomainCount} subdomains</span>
          <span>{metrics.balance.isExact ? 'Ready for next step' : balanceLabel}</span>
        </div>
        {onSelect && (
          <button
            type="button"
            onClick={() => onSelect(category.id)}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary transition hover:text-primary/80"
          >
            Manage subdomains
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
