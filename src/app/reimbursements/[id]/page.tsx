'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2, FileText, ExternalLink, Clock, CheckCircle, XCircle, Snowflake, Eye, EyeOff, Banknote } from 'lucide-react';

interface ClaimHistoryEntry {
  status: string;
  actorId: string;
  actorRole: 'employee' | 'tenantAdmin';
  note?: string;
  timestamp: string;
}

interface Claim {
  reimbursementId: string;
  claimNumber?: string;
  tenantId: string;
  tenantName?: string;
  employeeId: string;
  employeeName: string;
  clinicId?: string;
  clinicName?: string;
  amount: number;
  description: string;
  receiptUrl?: string;
  receiptHash?: string;
  serviceDate?: string;
  sessionCount?: number;
  sessionTypes?: string[];
  sessionFor?: string;
  sessionForOther?: string;
  contactCountryCode?: string;
  contactNumber?: string;
  bankAccountNumber?: string;
  bankName?: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'frozen' | 'paid';
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  history?: ClaimHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; description: string; icon: React.ReactNode; color: string }> = {
  pending: {
    label: 'Pending',
    description: 'Waiting for tenant review.',
    icon: <Clock className="h-5 w-5" />,
    color: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  in_progress: {
    label: 'In Progress',
    description: 'Being reviewed by the tenant.',
    icon: <Clock className="h-5 w-5" />,
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  approved: {
    label: 'Approved',
    description: 'Approved by the tenant.',
    icon: <CheckCircle className="h-5 w-5" />,
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  rejected: {
    label: 'Rejected',
    description: 'Not approved by the tenant.',
    icon: <XCircle className="h-5 w-5" />,
    color: 'bg-red-50 text-red-700 border-red-200',
  },
  frozen: {
    label: 'Frozen',
    description: 'Temporarily on hold by the tenant.',
    icon: <Snowflake className="h-5 w-5" />,
    color: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  paid: {
    label: 'Paid',
    description: 'Paid to the employee.',
    icon: <CheckCircle className="h-5 w-5" />,
    color: 'bg-purple-50 text-purple-700 border-purple-200',
  },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatCurrency(amount: number) {
  return `OMR ${amount.toFixed(3)}`;
}

export default function ReimbursementDetailPage() {
  const router = useRouter();
  const params = useParams();
  const claimId = params.id as string;

  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    if (!claimId) return;
    const fetchClaim = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/super-admin/reimbursements?id=${claimId}`);
        if (!res.ok) throw new Error('Claim not found.');
        const data = await res.json();
        // The detail endpoint returns array — find the matching claim
        const found = (data.claims ?? []).find((c: Claim) => c.reimbursementId === claimId);
        if (!found) throw new Error('Claim not found.');
        setClaim(found);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load claim.');
      } finally {
        setLoading(false);
      }
    };
    fetchClaim();
  }, [claimId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <button onClick={() => router.push('/reimbursements')} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Claims
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error || 'Claim not found.'}</div>
      </div>
    );
  }

  const sc = STATUS_CONFIG[claim.status] ?? STATUS_CONFIG.pending;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <button onClick={() => router.push('/reimbursements')} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Back to Claims
        </button>

        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-teal-700">Claim Detail</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">{claim.employeeName}</h1>
          </div>
          <div className={`rounded-xl border px-4 py-2 flex items-center gap-2 ${sc.color}`}>
            {sc.icon}
            <span className="text-sm font-semibold">{sc.label}</span>
          </div>
        </div>

        {sc.description && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">{sc.description}</div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Claim Information</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-400">Reference Number</p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-gray-900">{claim.claimNumber ?? claim.reimbursementId}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">Claim ID</p>
                <p className="mt-0.5 font-mono text-xs text-gray-500 break-all">{claim.reimbursementId}</p>
              </div>
              {claim.serviceDate && (
                <div>
                  <p className="text-xs font-medium text-gray-400">Service Date</p>
                  <p className="mt-0.5 text-sm text-gray-700">{claim.serviceDate}</p>
                </div>
              )}
              {claim.clinicName && (
                <div>
                  <p className="text-xs font-medium text-gray-400">Clinic</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">{claim.clinicName}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-gray-400">Amount</p>
                <p className="mt-0.5 text-2xl font-bold text-gray-900">{formatCurrency(claim.amount)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">Description</p>
                <p className="mt-0.5 text-sm text-gray-700">{claim.description}</p>
              </div>
              {claim.receiptUrl && (
                <div>
                  <p className="text-xs font-medium text-gray-400">Receipt</p>
                  <button
                    type="button"
                    onClick={() => setShowReceipt(!showReceipt)}
                    className="mt-0.5 inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    {showReceipt ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showReceipt ? 'Hide Receipt' : 'View Receipt'}
                  </button>
                  {showReceipt && (
                    <div className="mt-3 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                      {claim.receiptUrl?.toLowerCase().endsWith('.pdf') ? (
                        <iframe
                          src={`/api/super-admin/receipts/${claim.reimbursementId}`}
                          className="w-full h-[500px] border-0"
                          title="Receipt preview"
                        />
                      ) : (
                        <img
                          src={`/api/super-admin/receipts/${claim.reimbursementId}`}
                          alt="Receipt"
                          className="w-full h-auto max-h-[500px] object-contain"
                        />
                      )}
                      <div className="flex items-center justify-between px-4 py-2 bg-white border-t border-gray-200">
                        <span className="text-xs text-gray-400">Secure preview</span>
                        <a
                          href={`/api/super-admin/receipts/${claim.reimbursementId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open in new tab
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {claim.receiptHash && (
                <div>
                  <p className="text-xs font-medium text-gray-400">Receipt Fingerprint</p>
                  <p className="mt-0.5 font-mono text-xs text-gray-500 break-all">{claim.receiptHash.slice(0, 16)}&hellip;</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Employee & Tenant</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-400">Employee</p>
                <p className="mt-0.5 text-sm font-medium text-gray-900">{claim.employeeName}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">Tenant</p>
                <p className="mt-0.5 text-sm text-gray-700">{claim.tenantName || claim.tenantId}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">Submitted</p>
                <p className="mt-0.5 text-sm text-gray-700">{formatDate(claim.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">Last Updated</p>
                <p className="mt-0.5 text-sm text-gray-700">{formatDate(claim.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Session & Contact Details */}
        {(claim.sessionCount !== undefined || claim.sessionTypes !== undefined ||
          claim.sessionFor !== undefined || claim.contactNumber !== undefined ||
          claim.bankAccountNumber !== undefined) && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Session &amp; Contact Details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {claim.sessionCount !== undefined && (
                <div>
                  <p className="text-xs font-medium text-gray-400">Number of Sessions</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">{claim.sessionCount}</p>
                </div>
              )}
              {claim.sessionTypes && claim.sessionTypes.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-400">Session Types</p>
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    {claim.sessionTypes.map((t) => (
                      <span key={t} className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {claim.sessionFor && (
                <div>
                  <p className="text-xs font-medium text-gray-400">Session For</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900 capitalize">
                    {claim.sessionFor === 'myself' ? 'Myself' : claim.sessionFor === 'family_member' ? 'Family member' : claim.sessionForOther || claim.sessionFor}
                  </p>
                </div>
              )}
              {claim.contactNumber && (
                <div>
                  <p className="text-xs font-medium text-gray-400">Contact Number</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">{claim.contactCountryCode ?? ''} {claim.contactNumber}</p>
                </div>
              )}
              {claim.bankAccountNumber && (
                <div>
                  <p className="text-xs font-medium text-gray-400">Bank Account</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">{claim.bankAccountNumber}</p>
                </div>
              )}
              {claim.bankName && (
                <div>
                  <p className="text-xs font-medium text-gray-400">Bank Name</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">{claim.bankName}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Claim History — single source of truth for review activity */}
        {claim.history && claim.history.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Claim History</h3>
            <ol className="relative border-l border-gray-200 ml-2 space-y-4">
              {claim.history.map((entry, i) => (
                <li key={i} className="pl-5 relative">
                  <span className={`absolute -left-1.5 top-1 h-3 w-3 rounded-full border-2 border-white ${
                    entry.status === 'approved' ? 'bg-emerald-500' :
                    entry.status === 'rejected' ? 'bg-red-500' :
                    entry.status === 'in_progress' ? 'bg-blue-500' :
                    entry.status === 'frozen'   ? 'bg-sky-500' :
                    entry.status === 'paid'     ? 'bg-purple-500' :
                    'bg-amber-500'
                  }`} />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      entry.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                      entry.status === 'rejected' ? 'bg-red-50 text-red-700' :
                      entry.status === 'in_progress' ? 'bg-blue-50 text-blue-700' :
                      entry.status === 'frozen'   ? 'bg-sky-50 text-sky-700' :
                      entry.status === 'paid'     ? 'bg-purple-50 text-purple-700' :
                      'bg-amber-50 text-amber-700'
                    }`}>
                      {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {entry.actorRole === 'employee' ? 'Employee' : `Reviewer (${entry.actorId})`}
                    </span>
                    <span className="text-xs text-gray-400">&middot; {formatDate(entry.timestamp)}</span>
                  </div>
                  {entry.note && <p className="mt-1 text-xs text-gray-600">{entry.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Super Admin Actions */}
        {claim.status === 'approved' && (
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-purple-800">Approve Payout</h3>
                <p className="mt-0.5 text-xs text-purple-600">
                  This claim is approved by the tenant and ready for payment. Mark as paid to complete the lifecycle.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/super-admin/reimbursements/${claim.reimbursementId}/pay`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                    });
                    if (res.ok) window.location.reload();
                  } catch { /* ignore */ }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700 transition"
              >
                <Banknote className="h-4 w-4" />
                Mark as Paid
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
