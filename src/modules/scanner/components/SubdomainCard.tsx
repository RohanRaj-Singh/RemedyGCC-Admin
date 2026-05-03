'use client';

import { ArrowRight, ChevronDown, MessageSquareText, Plus, Trash2 } from 'lucide-react';
import { Subdomain } from '../types';
import { getSubdomainMetrics } from '../utils/metrics';

interface SubdomainCardProps {
  subdomain: Subdomain;
  index: number;
  parentWeight: number;
  selected?: boolean;
  disabled?: boolean;
  canRemove: boolean;
  onSelect: (subdomainId: string) => void;
  onChange: (subdomain: Subdomain) => void;
  onRemove: (subdomainId: string) => void;
  onOpenQuestions?: () => void;
}

export function SubdomainCard({
  subdomain,
  index,
  parentWeight,
  selected = false,
  disabled = false,
  canRemove,
  onSelect,
  onChange,
  onRemove,
  onOpenQuestions,
}: SubdomainCardProps) {
  const metrics = getSubdomainMetrics(subdomain);
  const balanceLabel = metrics.balance.overflow > 0
    ? `${metrics.balance.overflow}% over`
    : `${metrics.balance.remaining}% remaining`;

  return (
    <div
      className={`rounded-[1.6rem] border bg-white p-5 shadow-sm transition ${
        selected
          ? 'border-primary shadow-[0_18px_40px_-30px_rgba(9,83,51,0.55)]'
          : 'border-gray-200'
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <button
          type="button"
          onClick={() => onSelect(subdomain.id)}
          className="flex-1 text-left"
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            <span>Subdomain {index + 1}</span>
            {selected && <ChevronDown className="h-4 w-4 text-primary" />}
          </div>
          <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px]">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                Name
              </label>
              <input
                value={subdomain.name.en}
                disabled={disabled}
                onChange={(event) =>
                  onChange({
                    ...subdomain,
                    name: { ...subdomain.name, en: event.target.value },
                  })
                }
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
                placeholder="Name in English"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                Arabic Name
              </label>
              <input
                value={subdomain.name.ar}
                dir="rtl"
                disabled={disabled}
                onChange={(event) =>
                  onChange({
                    ...subdomain,
                    name: { ...subdomain.name, ar: event.target.value },
                  })
                }
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
                placeholder="Name in Arabic"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                Weight
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={parentWeight}
                  disabled={disabled}
                  value={subdomain.weight}
                  onChange={(event) =>
                    onChange({
                      ...subdomain,
                      weight: Number(event.target.value),
                    })
                  }
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 pr-10 text-sm font-semibold text-gray-900 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">
                  %
                </span>
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          disabled={disabled || !canRemove}
          onClick={() => onRemove(subdomain.id)}
          className="inline-flex items-center justify-center rounded-xl border border-transparent p-3 text-gray-400 transition hover:border-red-100 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Remove subdomain"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 font-medium text-gray-700">
            <MessageSquareText className="h-4 w-4 text-primary" />
            <span>Question Weight</span>
          </div>
          <div className="font-semibold text-gray-900">
            {metrics.questionWeightTotal} / {subdomain.weight}%
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
          <div
            className={`h-full rounded-full ${
              metrics.balance.isExact ? 'bg-emerald-500' : metrics.balance.overflow > 0 ? 'bg-rose-500' : 'bg-amber-500'
            }`}
            style={{
              width: `${Math.min((metrics.questionWeightTotal / Math.max(subdomain.weight || 1, 1)) * 100, 100)}%`,
            }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
          <span>{metrics.questionCount} questions</span>
          <span>{metrics.followUpCount} follow-up questions</span>
          <span>{metrics.balance.isExact ? 'balanced' : balanceLabel}</span>
        </div>
      </div>

      {selected && (
        <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/[0.03] p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Question preview</div>
              <div className="mt-1 text-sm text-gray-600">
                Questions appear as smaller cards inside this subdomain in the next step.
              </div>
            </div>
            {onOpenQuestions && (
              <button
                type="button"
                onClick={onOpenQuestions}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-primary shadow-sm transition hover:text-primary/80"
              >
                Edit Questions
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {subdomain.questions.slice(0, 3).map((question, questionIndex) => (
              <div
                key={question.id}
                className="rounded-xl border border-white bg-white px-4 py-3 text-sm text-gray-700 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-gray-900">
                    {question.text.en || `Question ${questionIndex + 1}`}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{question.weight}%</span>
                    {question.isFollowUp && (
                      <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-700">
                        follow-up
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {subdomain.questions.length > 3 && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Plus className="h-4 w-4" />
                <span>{subdomain.questions.length - 3} more questions in this subdomain</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
