'use client';

// ── Invoice Package — printable multi-invoice PDF ───────────────────────────
// An ORGANIZATION deliverable: a cover page followed by every selected
// invoice as a full, page-separated document. The package is a delivery
// convenience ONLY — it is not a financial document, creates no records, and
// never changes invoice state. Each invoice keeps its complete identity
// (number, status, period, line items, total) so the organization can
// distinguish every invoice. "Download PDF" prints via window.print; the
// print CSS emits one clean page-set per invoice (break-after-page).

import PrintableInvoice, { type PrintableInvoiceProps } from './PrintableInvoice';
import { INVOICE_STATUS_DISPLAY } from '@/lib/financial/status';
import { formatCurrency, formatDate } from '@/lib/financial/format';

interface PrintableInvoicePackageProps {
  orgName: string;
  tenantId: string;
  generatedAt: string;
  invoices: PrintableInvoiceProps[];
}

export default function PrintableInvoicePackage({
  orgName,
  tenantId,
  generatedAt,
  invoices,
}: PrintableInvoicePackageProps) {
  const total = invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);

  return (
    <div className="space-y-6 print:space-y-0">
      {/* Cover page */}
      <div className="print-area break-after-page rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="bg-primary px-8 py-6 text-white">
          <p className="text-lg font-bold tracking-wide">REMEDY</p>
          <p className="text-xs text-white/70">Healthcare Reimbursement Services</p>
          <p className="mt-4 text-xl font-bold uppercase tracking-widest">Organization Billing Package</p>
        </div>

        <div className="space-y-6 px-8 py-6">
          <div className="flex flex-wrap justify-between gap-6">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-400">ORGANIZATION</p>
              <p className="text-sm font-bold text-gray-900">{orgName}</p>
              <p className="text-xs font-mono text-gray-500">Tenant: {tenantId}</p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-xs font-medium text-gray-400">PACKAGE GENERATED</p>
              <p className="text-sm font-semibold text-gray-900">{formatDate(generatedAt)}</p>
              <p className="text-xs text-gray-500">Invoices included: {invoices.length}</p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Invoices in this package</p>
            <table className="w-full text-left text-sm">
              <tbody>
                {invoices.map((invoice, index) => (
                  <tr key={invoice.invoiceNumber} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2 pr-2 text-gray-500">{index + 1}</td>
                    <td className="py-2 pr-2 font-mono text-xs text-gray-900">{invoice.invoiceNumber}</td>
                    <td className="py-2 pr-2 text-gray-600">
                      {INVOICE_STATUS_DISPLAY[invoice.status as keyof typeof INVOICE_STATUS_DISPLAY] ?? invoice.status}
                    </td>
                    <td className="py-2 text-right font-medium text-gray-900">{formatCurrency(invoice.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Package total</td>
                  <td className="pt-3 text-right text-base font-bold text-gray-900">{formatCurrency(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-xs text-gray-500">
            This package is a delivery convenience. Each invoice remains an individual financial document with its own number and total.
          </p>
        </div>

        <div className="border-t border-gray-200 bg-gray-50 px-8 py-4 text-xs text-gray-500">
          Remedy · Healthcare Reimbursement Services · Billing package for {orgName}
        </div>
      </div>

      {/* Each invoice as its own full document, page-separated */}
      {invoices.map((invoice, index) => (
        <div key={invoice.invoiceNumber} className={index < invoices.length - 1 ? 'break-after-page' : undefined}>
          <PrintableInvoice {...invoice} />
        </div>
      ))}
    </div>
  );
}