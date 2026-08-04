'use client';

// ── Vendor Invoice — printable PDF template ─────────────────────────────────
// The invoice is REMEDY's document to the organization (client: "OUR invoice,
// addressed to the company"). Rendered as an A4-styled paper document on the
// Invoice Detail page; "Download PDF" prints it via window.print (print CSS
// hides the app chrome).

interface PrintableLineItem {
  claimNumber?: string;
  clinicName?: string;
  amount: number;
  sessionCount?: number;
  serviceDate?: string;
}

interface PrintableInvoiceProps {
  invoiceNumber: string;
  status: string;
  tenantId: string;
  orgName?: string;
  period: { from: string; to: string };
  generatedAt?: string;
  issuedAt?: string;
  paidAt?: string;
  totalAmount: number;
  lineItems: PrintableLineItem[];
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  generated: 'Generated',
  issued: 'Issued',
  paid: 'Paid',
  archived: 'Archived',
};

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtCurrency(n: number) {
  return `OMR ${n.toFixed(3)}`;
}

export default function PrintableInvoice({
  invoiceNumber,
  status,
  tenantId,
  orgName,
  period,
  generatedAt,
  issuedAt,
  paidAt,
  totalAmount,
  lineItems,
}: PrintableInvoiceProps) {
  return (
    <div className="print-area bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Brand header */}
      <div className="bg-primary text-white px-8 py-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-lg font-bold tracking-wide">REMEDY HEALTHCARE GROUP</p>
          <p className="text-xs text-white/70">Healthcare Reimbursement Services</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold uppercase tracking-widest">Vendor Invoice</p>
          <p className="text-xs text-white/70">Status: {STATUS_LABEL[status] ?? status}</p>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Document meta + Bill To */}
        <div className="flex flex-wrap justify-between gap-6">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-400">BILL TO</p>
            <p className="text-sm font-bold text-gray-900">{orgName || tenantId}</p>
            <p className="text-xs font-mono text-gray-500">Tenant: {tenantId}</p>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-xs font-medium text-gray-400">INVOICE #</p>
            <p className="text-sm font-bold font-mono text-gray-900">{invoiceNumber}</p>
            <p className="text-xs text-gray-500">Generated {fmtDate(generatedAt)}</p>
            <p className="text-xs text-gray-500">Issued {fmtDate(issuedAt)} · Paid {fmtDate(paidAt)}</p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-4 flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-400">BILLING PERIOD</p>
            <p className="text-sm font-semibold text-gray-900">
              {fmtDate(period.from)} — {fmtDate(period.to)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-gray-400">MATCHED BY</p>
            <p className="text-sm text-gray-700">Service date within period</p>
          </div>
        </div>

        {/* Line items */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">Approved Claims Billed</p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-2 font-medium">#</th>
                <th className="py-2 pr-2 font-medium">Claim #</th>
                <th className="py-2 pr-2 font-medium">Clinic</th>
                <th className="py-2 pr-2 font-medium">Service Date</th>
                <th className="py-2 pr-2 font-medium">Sessions</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 pr-2 text-gray-500">{i + 1}</td>
                  <td className="py-2 pr-2 font-mono text-xs text-gray-900">{item.claimNumber ?? '—'}</td>
                  <td className="py-2 pr-2 text-gray-700">{item.clinicName ?? '—'}</td>
                  <td className="py-2 pr-2 text-gray-600">{fmtDate(item.serviceDate)}</td>
                  <td className="py-2 pr-2 text-gray-600">{item.sessionCount ?? '—'}</td>
                  <td className="py-2 text-right font-medium text-gray-900">{fmtCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="pt-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Total</td>
                <td className="pt-3 text-right text-base font-bold text-gray-900">{fmtCurrency(totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex flex-wrap justify-between gap-2">
        <span>Remedy Healthcare Group · Healthcare Reimbursement Services</span>
        <span className="font-mono">Invoice {invoiceNumber}</span>
      </div>
    </div>
  );
}
