'use client';

// ── Claim Payment Receipt — printable PDF template ──────────────────────────
// A compact financial receipt for a claim: what was approved and how it was
// settled. Rendered print-only on the Claim Detail page ("Download Receipt").

interface PrintableClaimReceiptProps {
  claimNumber?: string;
  reimbursementId: string;
  employeeName?: string;
  clinicName?: string;
  amount?: number;
  serviceDate?: string;
  sessionCount?: number;
  sessionTypes?: string[];
  status?: string;
  invoiceNumber?: string;
  invoiceId?: string;
  paymentReference?: string;
  paymentClaimId?: string;
  paymentStatus?: string;
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function fmtCurrency(n?: number) {
  if (n === undefined) return '—';
  return `OMR ${n.toFixed(3)}`;
}

export default function PrintableClaimReceipt({
  claimNumber,
  reimbursementId,
  employeeName,
  clinicName,
  amount,
  serviceDate,
  sessionCount,
  sessionTypes,
  status,
  invoiceNumber,
  invoiceId,
  paymentReference,
  paymentClaimId,
  paymentStatus,
}: PrintableClaimReceiptProps) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Claim #', value: claimNumber || reimbursementId },
    { label: 'Employee', value: employeeName || '—' },
    { label: 'Clinic', value: clinicName || '—' },
    { label: 'Service Date', value: fmtDate(serviceDate) },
    {
      label: 'Sessions',
      value: sessionCount ? `${sessionCount}${sessionTypes?.length ? ` (${sessionTypes.join(', ')})` : ''}` : '—',
    },
    { label: 'Claim Status', value: status ? status.replace(/_/g, ' ') : '—' },
  ];

  return (
    <div className="print-area bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Brand header */}
      <div className="bg-primary text-white px-8 py-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-lg font-bold tracking-wide">REMEDY HEALTHCARE GROUP</p>
          <p className="text-xs text-white/70">Healthcare Reimbursement Services</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold uppercase tracking-widest">Payment Receipt</p>
          <p className="text-xs text-white/70">Claim {claimNumber || ''}</p>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        <div className="flex flex-wrap justify-between gap-6">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-400">PAID TO</p>
            <p className="text-sm font-bold text-gray-900">{employeeName || '—'}</p>
            <p className="text-xs text-gray-500">{clinicName || '—'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-gray-400">AMOUNT</p>
            <p className="text-2xl font-bold text-gray-900">{fmtCurrency(amount)}</p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
              <span className="text-xs text-gray-400">{r.label}</span>
              <span className="text-gray-900 text-right capitalize">{r.value}</span>
            </div>
          ))}
        </div>

        {/* Financial settlement */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 mb-2">Financial Settlement</p>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-emerald-600">Invoice</p>
              {invoiceNumber ? (
                <a href={`/invoices/${invoiceId}`} className="font-mono font-semibold text-emerald-800">{invoiceNumber}</a>
              ) : (
                <p className="text-emerald-800">—</p>
              )}
            </div>
            <div>
              <p className="text-xs text-emerald-600">Payment</p>
              {paymentReference ? (
                <a href={`/payments/${paymentClaimId}`} className="font-mono font-semibold text-emerald-800">{paymentReference}</a>
              ) : (
                <p className="text-emerald-800">—</p>
              )}
            </div>
            <div>
              <p className="text-xs text-emerald-600">Status</p>
              <p className="font-semibold text-emerald-800">{paymentStatus === 'paid' ? 'Paid' : paymentStatus === 'to_be_paid' ? 'Queued for payout' : '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex flex-wrap justify-between gap-2">
        <span>Remedy Healthcare Group · Claim Payment Receipt</span>
        <span className="font-mono">{claimNumber || reimbursementId}</span>
      </div>
    </div>
  );
}
