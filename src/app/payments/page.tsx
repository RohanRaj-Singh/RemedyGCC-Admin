'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, AlertCircle, Banknote, Landmark, CheckCircle2, RefreshCw, Wallet,
} from 'lucide-react';
import type { Clinic } from '@/modules/clinic/types';

interface PaymentQueueClaim {
  reimbursementId: string;
  claimNumber?: string;
  amount: number;
}

interface PaymentQueueGroup {
  clinicId: string | null;
  clinicName: string | null;
  totalAmount: number;
  count: number;
  claims: PaymentQueueClaim[];
}

interface PaymentQueueResponse {
  groups: PaymentQueueGroup[];
  total: number;
}

function formatCurrency(amount: number) {
  return `OMR ${amount.toFixed(3)}`;
}

/**
 * Look up a clinic's payout details by ID or slug. Claims denormalize
 * `clinicId`/`clinicName`; the admin clinic directory keys by `id` and `slug`.
 */
function resolveClinic(
  group: PaymentQueueGroup,
  byId: Map<string, Clinic>,
  bySlug: Map<string, Clinic>,
): Clinic | null {
  if (!group.clinicId) return null;
  return byId.get(group.clinicId) ?? bySlug.get(group.clinicId) ?? null;
}

export default function PaymentsPage() {
  const [groups, setGroups] = useState<PaymentQueueGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processingGroup, setProcessingGroup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [queueRes, clinicsRes] = await Promise.all([
        fetch('/api/super-admin/payments'),
        fetch('/api/super-admin/clinics'),
      ]);
      if (!queueRes.ok) throw new Error('Failed to load the payment queue.');
      const queueData: PaymentQueueResponse = await queueRes.json();
      setGroups(queueData.groups ?? []);
      setTotal(queueData.total ?? 0);

      if (clinicsRes.ok) {
        const clinicData: Clinic[] = await clinicsRes.json();
        setClinics(clinicData ?? []);
      } else {
        setClinics([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { byId, bySlug } = useMemo(() => {
    const idMap = new Map<string, Clinic>();
    const slugMap = new Map<string, Clinic>();
    for (const clinic of clinics) {
      idMap.set(clinic.id, clinic);
      slugMap.set(clinic.slug, clinic);
    }
    return { byId: idMap, bySlug: slugMap };
  }, [clinics]);

  const totalAmount = useMemo(
    () => groups.reduce((sum, g) => sum + g.totalAmount, 0),
    [groups],
  );

  const processGroup = async (group: PaymentQueueGroup) => {
    const claimIds = group.claims.map((c) => c.reimbursementId);
    if (claimIds.length === 0) return;
    setProcessing(true);
    setProcessingGroup(group.clinicId ?? '__no_clinic__');
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/super-admin/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimIds }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Payout failed.');
      }
      const data = await res.json();
      setSuccess(`Paid ${data.processed} claim${data.processed === 1 ? '' : 's'} for ${group.clinicName ?? 'unknown clinic'}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setProcessing(false);
      setProcessingGroup(null);
    }
  };

  const processAll = async () => {
    setProcessing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/super-admin/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimIds: [] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Payout failed.');
      }
      const data = await res.json();
      setSuccess(`Processed ${data.processed} payout${data.processed === 1 ? '' : 's'}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setProcessing(false);
    }
  };

  const hasQueue = total > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
                <Wallet className="h-6 w-6 text-emerald-700" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Payment Queue</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Approved claims queued for payout, grouped by clinic.
                </p>
              </div>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary banner */}
        {!loading && !error && hasQueue && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-800">
                  {total} claim{total === 1 ? '' : 's'} ready for payout
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Total payout: {formatCurrency(totalAmount)}
                </p>
              </div>
              <button
                onClick={processAll}
                disabled={processing}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                <Banknote className="h-4 w-4" />
                {processing ? 'Processing...' : 'Process All Payouts'}
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && !hasQueue && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Banknote className="w-10 h-10 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No claims queued for payment</p>
            <p className="text-sm text-gray-400 mt-1">
              Approved claims enter the queue when a tenant generates an invoice or a super admin queues them for payout.
            </p>
          </div>
        )}

        {/* Clinic payout groups */}
        {!loading && !error && hasQueue && (
          <div className="grid gap-5 lg:grid-cols-2">
            {groups.map((group) => {
              const clinic = resolveClinic(group, byId, bySlug);
              const groupKey = group.clinicId ?? '__no_clinic__';
              const isProcessingGroup = processing && processingGroup === groupKey;
              return (
                <div key={groupKey} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Landmark className="h-4 w-4 text-gray-400 shrink-0" />
                          <h2 className="truncate text-sm font-semibold text-gray-900">
                            {group.clinicName ?? 'No Clinic'}
                          </h2>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {group.count} claim{group.count === 1 ? '' : 's'} &middot; {formatCurrency(group.totalAmount)}
                        </p>
                      </div>
                      <button
                        onClick={() => processGroup(group)}
                        disabled={processing}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        <Banknote className="h-3.5 w-3.5" />
                        {isProcessingGroup ? 'Processing...' : 'Process Payout'}
                      </button>
                    </div>
                  </div>

                  <div className="px-5 py-4 space-y-4">
                    {/* Bank details */}
                    <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-4 py-3">
                      {clinic?.bankName || clinic?.bankAccountNumber ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium text-gray-400">Bank Name</p>
                            <p className="mt-0.5 text-sm font-medium text-gray-900">
                              {clinic?.bankName || '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-400">Bank Account</p>
                            <p className="mt-0.5 font-mono text-sm text-gray-900">
                              {clinic?.bankAccountNumber || '—'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">
                          No bank details configured for this clinic. Add Bank Name / Bank Account Number in the clinic profile.
                        </p>
                      )}
                    </div>

                    {/* Claim list */}
                    <ul className="space-y-1.5">
                      {group.claims.map((claim) => (
                        <li key={claim.reimbursementId} className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-mono text-xs font-semibold text-gray-700 truncate">
                            {claim.claimNumber ?? claim.reimbursementId}
                          </span>
                          <span className="font-medium text-gray-900 shrink-0">{formatCurrency(claim.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
