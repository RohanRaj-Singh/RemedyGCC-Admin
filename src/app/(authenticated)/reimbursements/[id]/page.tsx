'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2, ExternalLink, Eye, EyeOff, Printer } from 'lucide-react';
import PrintableClaimReceipt from '@/components/financial/PrintableClaimReceipt';
import FinancialRecordLink from '@/components/financial/FinancialRecordLink';
import FinancialNextAction from '@/components/financial/FinancialNextAction';
import ClaimTimeline from '@/components/claims/ClaimTimeline';
import FinancialTimeline from '@/components/claims/FinancialTimeline';
import { ClaimChat } from '@/components/claims/ClaimChat';
import { formatCurrency } from '@/lib/financial/format';
import { billingEligibilityMeta } from '@/lib/financial/eligibility';
import {
  CLAIM_STATUS_DISPLAY,
  CLAIM_STATUS_TONE,
  INVOICE_STATUS_DISPLAY,
  type ClaimStatus,
  type InvoiceStatus,
} from '@/lib/financial/status';

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
  status: 'pending' | 'in_progress' | 'approved' | 'to_be_paid' | 'rejected' | 'frozen' | 'paid';
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  history?: ClaimHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  /** Funding invoice linkage (read-time join — never a claim status). */
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  invoiceStatus?: string | null;
}

const STATUS_DESCRIPTION: Record<ClaimStatus, string> = {
  pending: 'Waiting for tenant review.',
  in_progress: 'Being reviewed by the tenant.',
  approved: 'Approved by the tenant.',
  to_be_paid: 'Ready to pay. Queued for payout in the Payments workspace.',
  rejected: 'Not approved by the tenant.',
  frozen: 'Temporarily on hold by the tenant.',
  paid: 'Paid to the employee.',
};

const STATUS_TONE_CLASS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  to_be_paid: 'bg-orange-50 text-orange-700 border-orange-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  frozen: 'bg-sky-50 text-sky-700 border-sky-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function ReimbursementDetailPage() {
  const router = useRouter();
  const params = useParams();
  const claimId = params.id as string;

  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  // Light financial linkage: funding invoice + payment reference (best-effort).
  const [paymentLink, setPaymentLink] = useState<{
    invoiceId?: string;
    invoiceNumber?: string;
    paymentReference?: string;
    paymentStatus?: string;
  } | null>(null);

  useEffect(() => {
    if (!claimId) return;
    const fetchClaim = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/super-admin/reimbursements/${claimId}`);
        if (!res.ok) throw new Error('Claim not found.');
        const found = await res.json();
        setClaim(found);
        // Best-effort: does this claim have a payment record (queued or paid)?
        try {
          const pRes = await fetch(`/api/super-admin/payments/${claimId}`);
          if (pRes.ok) {
            const p = await pRes.json();
            if (p?.paymentRecord) {
              setPaymentLink({
                invoiceId: p.paymentRecord.invoiceId,
                invoiceNumber: p.invoiceNumber,
                paymentReference: p.paymentRecord.paymentReference,
                paymentStatus: p.paymentRecord.status,
              });
            }
          }
        } catch {
          // Ignore — linkage is best-effort.
        }
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

  const statusLabel = CLAIM_STATUS_DISPLAY[claim.status as ClaimStatus];
  const statusTone = CLAIM_STATUS_TONE[claim.status as ClaimStatus];
  const statusClass = STATUS_TONE_CLASS[claim.status] ?? 'bg-gray-50 text-gray-700 border-gray-200';
  const statusDescription = STATUS_DESCRIPTION[claim.status as ClaimStatus];

  // Billing position — derived from the claim status + its invoice linkage
  // (read-time join already present on the claim payload; no new query). This
  // is the SAME derivation used by the Claims list's Billing column
  // (`BillingEligibilityBadge`), so the detail page can never describe an
  // already-invoiced claim as if it were still waiting to be billed.
  const billing = billingEligibilityMeta(claim.status as ClaimStatus, {
    invoiceId: claim.invoiceId ?? null,
    invoiceNumber: claim.invoiceNumber ?? null,
    invoiceStatus: claim.invoiceStatus ?? null,
  });
  const invoiceRef = claim.invoiceNumber ?? claim.invoiceId ?? 'the funding invoice';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 print:hidden">
        <button onClick={() => router.push('/reimbursements')} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Back to Claims
        </button>

        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-teal-700">Claim Detail</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">{claim.employeeName}</h1>
          </div>
          <div className={`rounded-xl border px-4 py-2 flex items-center gap-2 ${statusClass}`}>
            <span className="text-sm font-semibold">{statusLabel}</span>
          </div>
        </div>

        <div className="print-hide flex items-center gap-2">
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            <Printer className="h-4 w-4" /> Download Receipt (PDF)
          </button>
        </div>

        {statusDescription && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">{statusDescription}</div>
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
            <ClaimTimeline history={claim.history} showActorId />
          </div>
        )}

        {/* Financial Timeline — payment-pipeline milestones (financial oversight) */}
        {claim.history && claim.history.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <FinancialTimeline
              history={claim.history}
              invoiceId={claim.invoiceId ?? undefined}
              invoiceNumber={claim.invoiceNumber ?? undefined}
            />
          </div>
        )}

        {/* Notes */}
        {claim.notes && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Notes</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{claim.notes}</p>
          </div>
        )}

        {/* Chat — read-only oversight */}
        <ClaimChat
          claimId={claim.reimbursementId}
          apiBase={`/api/super-admin/reimbursements/${claim.reimbursementId}/messages`}
          readOnly
        />

        {/* Super Admin next-step guidance — driven by the same billing-position
            derivation as the Claims list's Billing column. Every message states
            the claim's actual financial position and one clear next step. */}
        {(() => {
          switch (billing.key) {
            case 'ready_for_invoicing':
              return (
                <FinancialNextAction
                  tone="success"
                  title="Ready for billing."
                  description="This claim is approved and not yet on an invoice. Select it on the Claims page to generate an invoice."
                  action={{ href: '/reimbursements', label: 'Go to Claims' }}
                />
              );
            case 'invoiced_draft':
              return (
                <FinancialNextAction
                  tone="info"
                  title="On a draft invoice."
                  description={`This claim is on ${invoiceRef}. The invoice has not been sent to the organization yet — issue it to make it payable.`}
                  action={{ href: `/invoices/${claim.invoiceId}`, label: 'View Invoice' }}
                />
              );
            case 'invoiced_issued':
              return (
                <FinancialNextAction
                  tone="info"
                  title="Awaiting organization payment."
                  description={`This claim is on ${invoiceRef}. The organization still owes payment for it — record the payment once it arrives.`}
                  action={{ href: `/invoices/${claim.invoiceId}`, label: 'View Invoice' }}
                />
              );
            case 'invoiced_paid':
            case 'ready_for_payout':
              return (
                <FinancialNextAction
                  tone="warning"
                  title="Ready to pay."
                  description="This claim is funded and queued for payout. Record the claimant/clinic payment in the Payments workspace."
                  action={{ href: '/payments', label: 'Go to Payments' }}
                />
              );
            case 'invoiced_archived':
              return (
                <FinancialNextAction
                  tone="info"
                  title="On an archived invoice."
                  description={`This claim is on ${invoiceRef}, which can no longer be issued or paid.`}
                  action={{ href: `/invoices/${claim.invoiceId}`, label: 'View Invoice' }}
                />
              );
            case 'paid':
              return (
                <FinancialNextAction
                  tone="success"
                  title="Financial process complete."
                  description="This claim has been paid. The approved workflow (approved → invoiced → paid) is finished for this claim."
                  action={{ href: '/payments', label: 'View Payment History' }}
                />
              );
            default:
              return null;
          }
        })()}

        {/* Financial linkage — funding invoice (authoritative from claim payload) + payment reference */}
        {(claim.invoiceId || paymentLink?.paymentReference) && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Financial</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-gray-400">Funding Invoice</p>
                {claim.invoiceId ? (
                  <FinancialRecordLink
                    kind="invoice"
                    href={`/invoices/${claim.invoiceId}`}
                    reference={claim.invoiceNumber}
                  />
                ) : (
                  <p className="mt-0.5 text-sm text-gray-400">—</p>
                )}
                {claim.invoiceStatus && (
                  <p className="mt-1 text-xs capitalize text-gray-500">
                    {INVOICE_STATUS_DISPLAY[claim.invoiceStatus as InvoiceStatus] ?? claim.invoiceStatus.replace(/_/g, ' ')}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">Payment</p>
                {paymentLink?.paymentReference ? (
                  <FinancialRecordLink
                    kind="payment"
                    href={`/payments/${claimId}`}
                    reference={paymentLink.paymentReference}
                  />
                ) : (
                  <p className="mt-0.5 text-sm text-gray-400">—</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">Payment Status</p>
                <p className="mt-0.5 text-sm font-medium text-gray-900">
                  {paymentLink?.paymentStatus === 'paid'
                    ? 'Paid'
                    : paymentLink?.paymentStatus
                      ? 'Queued for payout'
                      : '—'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Claim Payment Receipt — printable PDF (only rendered on print) */}
      <div className="hidden print:block">
        <PrintableClaimReceipt
          claimNumber={claim.claimNumber}
          reimbursementId={claim.reimbursementId}
          employeeName={claim.employeeName}
          clinicName={claim.clinicName}
          amount={claim.amount}
          serviceDate={claim.serviceDate}
          sessionCount={claim.sessionCount}
          sessionTypes={claim.sessionTypes}
          status={claim.status}
          invoiceNumber={claim.invoiceNumber ?? undefined}
          invoiceId={claim.invoiceId ?? undefined}
          paymentReference={paymentLink?.paymentReference}
          paymentClaimId={claim.reimbursementId}
          paymentStatus={paymentLink?.paymentStatus}
        />
      </div>
    </div>
  );
}
