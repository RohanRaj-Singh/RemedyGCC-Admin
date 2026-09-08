'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, AlertCircle } from 'lucide-react';
import PrintablePayment from '@/components/financial/PrintablePayment';
import FinancialEmptyState from '@/components/financial/FinancialEmptyState';

interface PaymentRecord {
  paymentRecordId: string;
  tenantId: string;
  claimId: string;
  invoiceId?: string;
  clinicId?: string;
  clinicName?: string;
  amount: number;
  status: 'to_be_paid' | 'paid';
  paymentReference?: string;
  bankReference?: string;
  notes?: string;
  paidAt?: string;
  /** Operator-entered transfer date (the actual payout date). */
  paymentDate?: string;
  paidBy?: string;
  method?: string;
  createdAt: string;
  updatedAt: string;
}

interface ClaimSnapshot {
  reimbursementId: string;
  claimNumber?: string;
  employeeName?: string;
  clinicId?: string;
  clinicName?: string;
  amount?: number;
  sessionCount?: number;
  sessionTypes?: string[];
  serviceDate?: string;
  bankAccountNumber?: string;
  bankName?: string;
  status?: string;
}

interface PaymentDetailResponse {
  paymentRecord: PaymentRecord | null;
  claim: ClaimSnapshot | null;
  invoiceNumber?: string;
  tenantName?: string;
}

export default function PaymentDetailPage() {
  const router = useRouter();
  const params = useParams<{ claimId: string }>();
  const claimId = params.claimId;

  const [detail, setDetail] = useState<PaymentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!claimId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/super-admin/payments/${claimId}`);
        if (!res.ok) throw new Error('Payment not found.');
        const body = await res.json();
        if (!cancelled) setDetail(body);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load payment.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [claimId]);

  if (loading) {
    return <PaymentDetailSkeleton />;
  }

  if (error || !detail?.paymentRecord) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
          <button onClick={() => router.push('/payments')} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" /> Back to Payments
          </button>
          <FinancialEmptyState
            icon={<AlertCircle className="h-6 w-6" />}
            title="Payment not found"
            description={error || 'This payment record does not exist or could not be loaded.'}
            action={{ label: 'Back to Payments', onClick: () => router.push('/payments') }}
          />
        </div>
      </div>
    );
  }

  const { paymentRecord: pr, claim } = detail;
  const isPaid = pr.status === 'paid';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <button onClick={() => router.push('/payments')} className="print-hide inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Back to Payments
        </button>

        <div className="print-hide flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-teal-700">Payment Detail</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1 font-mono">{pr.paymentReference ?? pr.paymentRecordId}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{detail.tenantName ?? pr.tenantId}{claim?.clinicName ? ` · ${claim.clinicName}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-xl border px-4 py-2 text-sm font-semibold ${isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
              {isPaid ? 'Paid' : 'To Be Paid'}
            </span>
          </div>
        </div>

        {/* Actions — excluded from the PDF (print-hide) */}
        <div className="print-hide flex flex-wrap items-center gap-2">
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            <Printer className="h-4 w-4" /> Download PDF
          </button>
        </div>

        {/* The payment advice document — printable PDF template */}
        <PrintablePayment
          paymentReference={pr.paymentReference}
          paymentStatus={pr.status}
          amount={pr.amount ?? claim?.amount}
          paidAt={pr.paidAt}
          paymentDate={pr.paymentDate}
          paidBy={pr.paidBy}
          method={pr.method}
          bankReference={pr.bankReference}
          notes={pr.notes}
          invoiceNumber={detail.invoiceNumber}
          invoiceId={pr.invoiceId}
          queuedAt={pr.createdAt}
          tenantName={detail.tenantName}
          claim={{
            claimNumber: claim?.claimNumber,
            employeeName: claim?.employeeName,
            clinicName: claim?.clinicName,
            serviceDate: claim?.serviceDate,
            sessionCount: claim?.sessionCount,
            sessionTypes: claim?.sessionTypes,
            bankAccountNumber: claim?.bankAccountNumber,
            bankName: claim?.bankName,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Localized skeleton — mirrors the detail page shape so the layout doesn't jump
 * when the payment record arrives.
 */
function PaymentDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="h-3 w-28 animate-pulse rounded bg-gray-200" />
            <div className="h-7 w-64 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-48 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="h-9 w-24 animate-pulse rounded-xl bg-gray-200" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded-lg bg-gray-200" />
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="h-20 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
