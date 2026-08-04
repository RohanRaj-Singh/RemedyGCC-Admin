'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import PrintablePayment from '@/components/financial/PrintablePayment';

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
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/super-admin/payments/${claimId}`);
        if (!res.ok) throw new Error('Payment not found.');
        setDetail(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load payment.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [claimId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !detail?.paymentRecord) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <button onClick={() => router.push('/payments')} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Payments
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error || 'Payment not found.'}</div>
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
            <p className="text-sm font-medium uppercase tracking-wide text-purple-700">Payment Detail</p>
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
          paidBy={pr.paidBy}
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
