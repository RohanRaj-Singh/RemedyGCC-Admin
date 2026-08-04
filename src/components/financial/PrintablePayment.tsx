'use client';

// ── Payment Advice — printable PDF template ─────────────────────────────────
// Records a clinic payout for a claim. Rendered as an A4-styled paper document
// on the Payment Detail page; "Download PDF" prints it via window.print.

interface PrintablePaymentProps {
  paymentReference?: string;
  paymentStatus: 'to_be_paid' | 'paid';
  amount?: number;
  paidAt?: string;
  paidBy?: string;
  bankReference?: string;
  notes?: string;
  invoiceNumber?: string;
  invoiceId?: string;
  queuedAt?: string;
  claim?: {
    claimNumber?: string;
    employeeName?: string;
    clinicName?: string;
    serviceDate?: string;
    sessionCount?: number;
    sessionTypes?: string[];
    bankAccountNumber?: string;
    bankName?: string;
  } | null;
  tenantName?: string;
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function fmtCurrency(n?: number) {
  if (n === undefined) return '—';
  return `OMR ${n.toFixed(3)}`;
}

function maskAccount(account?: string) {
  if (!account) return '—';
  if (account.length <= 4) return `••••${account}`;
  return `•••• ${account.slice(-4)}`;
}

export default function PrintablePayment({
  paymentReference,
  paymentStatus,
  amount,
  paidAt,
  paidBy,
  bankReference,
  notes,
  invoiceNumber,
  invoiceId,
  queuedAt,
  claim,
  tenantName,
}: PrintablePaymentProps) {
  const isPaid = paymentStatus === 'paid';
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Payment Ref', value: paymentReference || '—' },
    { label: 'Claim #', value: claim?.claimNumber || '—' },
    { label: 'Employee', value: claim?.employeeName || '—' },
    { label: 'Clinic', value: claim?.clinicName || '—' },
    { label: 'Service Date', value: fmtDate(claim?.serviceDate) },
    {
      label: 'Sessions',
      value: claim?.sessionCount ? `${claim.sessionCount}${claim.sessionTypes?.length ? ` (${claim.sessionTypes.join(', ')})` : ''}` : '—',
    },
    { label: 'Paid To (Bank)', value: claim?.bankName || '—' },
    { label: 'Account', value: maskAccount(claim?.bankAccountNumber) },
    { label: 'Funding Invoice', value: invoiceNumber ? `${invoiceNumber}` : 'Not invoice-funded' },
    { label: 'Bank Reference', value: bankReference || '—' },
    { label: 'Paid By', value: isPaid ? paidBy || '—' : '—' },
    { label: 'Paid Date', value: isPaid ? fmtDate(paidAt) : '—' },
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
          <p className="text-xl font-bold uppercase tracking-widest">Payment Advice</p>
          <p className="text-xs text-white/70">Status: {isPaid ? 'Paid' : 'To Be Paid'}</p>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Meta + amount */}
        <div className="flex flex-wrap justify-between gap-6">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-400">PAYMENT #</p>
            <p className="text-sm font-bold font-mono text-gray-900">{paymentReference || '—'}</p>
            <p className="text-xs text-gray-500">Organization: {tenantName || '—'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-gray-400">AMOUNT</p>
            <p className="text-2xl font-bold text-gray-900">{fmtCurrency(amount)}</p>
            <p className="text-xs text-gray-500">Queued {fmtDate(queuedAt)}</p>
          </div>
        </div>

        {/* Claim snapshot — the legal reimbursement record being settled */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">Claim Snapshot</p>
          <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
                <span className="text-xs text-gray-400">{r.label}</span>
                <span className="text-gray-900 text-right">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-gray-700">Queued {fmtDate(queuedAt)}</span>
          </div>
          <span className="text-gray-300">→</span>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-gray-200'}`} />
            <span className={`text-xs ${isPaid ? 'text-gray-700' : 'text-gray-400'}`}>Paid {fmtDate(paidAt)}</span>
          </div>
        </div>

        {notes && (
          <p className="text-xs text-gray-500 whitespace-pre-wrap border-t border-gray-100 pt-3">Notes: {notes}</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex flex-wrap justify-between gap-2">
        <span>Remedy Healthcare Group · Clinic Payout</span>
        <span className="font-mono">{paymentReference || ''}</span>
      </div>
    </div>
  );
}
