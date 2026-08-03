'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  History,
  Loader2,
  Save,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import { budgetService } from '@/services/budget-service';
import type {
  BudgetHistoryEntry,
  BudgetOverview,
} from '@/services/budget-service';

interface BudgetOverridePanelProps {
  tenantId: string;
}

function formatCurrency(amount: number): string {
  return `OMR ${amount.toFixed(3)}`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const TYPE_CONFIG: Record<BudgetHistoryEntry['type'], { label: string; badge: string }> = {
  created: { label: 'Created', badge: 'bg-emerald-100 text-emerald-700' },
  topup: { label: 'Top-up', badge: 'bg-blue-100 text-blue-700' },
  adjust: { label: 'Adjust', badge: 'bg-slate-100 text-slate-600' },
  override: { label: 'Override', badge: 'bg-amber-100 text-amber-700' },
};

function OverviewStat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1.5 text-lg font-bold ${
          emphasis ? 'text-teal-700' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function BudgetOverridePanel({ tenantId }: BudgetOverridePanelProps) {
  const [overview, setOverview] = useState<BudgetOverview | null>(null);
  const [history, setHistory] = useState<BudgetHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const [formState, setFormState] = useState({
    totalAmount: '',
    reason: '',
    year: String(currentYear),
  });

  const loadBudget = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [overviewResult, historyResult] = await Promise.all([
        budgetService.getOverview(tenantId),
        budgetService.getHistory(tenantId),
      ]);

      if (overviewResult.error || !overviewResult.data) {
        throw new Error(overviewResult.error || 'Unable to load budget overview.');
      }

      setOverview(overviewResult.data);
      setHistory(historyResult.data?.history ?? []);

      // Keep the override form in sync with the year being displayed.
      setFormState((current) => ({
        ...current,
        year: String(overviewResult.data?.year ?? currentYear),
      }));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load budget information.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, currentYear]);

  useEffect(() => {
    void loadBudget();
  }, [loadBudget]);

  async function handleOverride(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const totalAmount = Number(formState.totalAmount);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      setError('Enter a valid budget ceiling greater than zero.');
      return;
    }

    const year = Number(formState.year);
    if (!Number.isFinite(year) || year < 2000 || year > 2200) {
      setError('Enter a valid year.');
      return;
    }

    try {
      setIsSaving(true);
      const result = await budgetService.override(tenantId, {
        totalAmount,
        year,
        reason: formState.reason.trim() || undefined,
      });

      if (result.error || !result.data) {
        throw new Error(result.error || 'Unable to override the budget.');
      }

      setOverview(result.data);
      setFormState((current) => ({
        ...current,
        totalAmount: '',
        reason: '',
        year: String(result.data?.year ?? year),
      }));
      setSuccessMessage('Budget ceiling updated successfully.');

      // Refresh the audit trail to include the new override entry.
      const historyResult = await budgetService.getHistory(tenantId);
      setHistory(historyResult.data?.history ?? []);
    } catch (overrideError) {
      setError(
        overrideError instanceof Error
          ? overrideError.message
          : 'Unable to override the budget.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section
        className="rounded-2xl border p-6"
        style={{ backgroundColor: '#fff', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading budget information
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border p-6"
      style={{ backgroundColor: '#fff', borderColor: 'var(--border)' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-teal-700" />
            Annual Budget
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Budget ceiling for {overview?.year ?? currentYear}. Override is
            restricted to super admins and is recorded in the audit trail.
          </p>
        </div>

        {overview && (
          <div
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              overview.budgetExceeded
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {overview.budgetExceeded ? 'Budget Exceeded' : 'Within Budget'}
          </div>
        )}
      </div>

      {error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {overview ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewStat
            label="Total Ceiling"
            value={formatCurrency(overview.totalAmount)}
            emphasis
          />
          <OverviewStat
            label="Reserved"
            value={formatCurrency(overview.reservedAmount)}
          />
          <OverviewStat
            label="Committed"
            value={formatCurrency(overview.committedAmount)}
          />
          <OverviewStat
            label="Available"
            value={formatCurrency(overview.availableAmount)}
          />
        </div>
      ) : null}

      {overview?.budgetExceeded ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            Reserved + committed spending has exceeded the annual ceiling. Use
            the override below to raise the ceiling.
          </p>
        </div>
      ) : null}

      {/* Override form */}
      <form
        onSubmit={handleOverride}
        className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          <p className="text-sm font-semibold text-slate-800">Override Budget</p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label
              className="mb-2 block text-sm font-medium text-slate-700"
              htmlFor="budget-override-amount"
            >
              New Ceiling (OMR)
            </label>
            <input
              id="budget-override-amount"
              type="number"
              inputMode="decimal"
              min="0.001"
              step="0.001"
              value={formState.totalAmount}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  totalAmount: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              placeholder="12000.000"
              required
              disabled={isSaving}
            />
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-medium text-slate-700"
              htmlFor="budget-override-year"
            >
              Year
            </label>
            <input
              id="budget-override-year"
              type="number"
              min="2000"
              max="2200"
              value={formState.year}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  year: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              required
              disabled={isSaving}
            />
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-medium text-slate-700"
              htmlFor="budget-override-reason"
            >
              Reason (optional)
            </label>
            <input
              id="budget-override-reason"
              type="text"
              value={formState.reason}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              placeholder="Client added more funding"
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? 'Overriding...' : 'Override Budget'}
          </button>
        </div>
      </form>

      {/* History */}
      <div className="mt-6">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500" />
          <h4 className="text-sm font-semibold text-slate-800">
            Budget History
          </h4>
        </div>

        {history.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No budget history entries yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Ceiling
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Actor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {history.map((entry) => {
                  const typeConfig = TYPE_CONFIG[entry.type] ?? TYPE_CONFIG.adjust;
                  return (
                    <tr key={entry.historyId} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeConfig.badge}`}
                        >
                          {typeConfig.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        {formatCurrency(entry.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatCurrency(entry.beforeTotal)} →{' '}
                        {formatCurrency(entry.afterTotal)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {entry.actorId}
                        <span className="ml-1 text-slate-400">
                          ({entry.actorRole})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {entry.reason || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
