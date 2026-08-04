'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, CheckCircle2, Send, Archive, Download, Printer, AlertCircle,
} from 'lucide-react';
import PrintableInvoice from '@/components/financial/PrintableInvoice';

interface LineItem {
  claimId: string;
  claimNumber?: string;
  clinicName?: string;
  amount: number;
  sessionCount?: number;
  serviceDate?: string;
  bankAccountNumber?: string;
  bankName?: string;
}

interface InvoiceDetail {
  invoiceId: string;
  invoiceNumber: string;
  tenantId: string;
  period: { from: string; to: string };
  status: 'draft' | 'generated' | 'issued' | 'paid' | 'archived';
  generatedBy: string;
  generatedAt: string;
  issuedAt?: string;
  paidAt?: string;
  totalAmount: number;
  lineItems: LineItem[];
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  generated: { label: 'Generated', cls: 'bg-blue-100 text-blue-700' },
  issued: { label: 'Issued', cls: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700' },
  archived: { label: 'Archived', cls: 'bg-slate-100 text-slate-600' },
};


export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const invoiceId = params.id;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/invoices/${invoiceId}`);
      if (!res.ok) throw new Error('Invoice not found.');
      const data: InvoiceDetail = await res.json();
      setInvoice(data);
      // Resolve the organization display name.
      try {
        const tRes = await fetch('/api/super-admin/tenants');
        const tenants = await tRes.json();
        const tenant = Array.isArray(tenants) ? tenants.find((t: { id: string; name: string }) => t.id === data.tenantId) : null;
        setOrgName(tenant?.name ?? data.tenantId);
      } catch {
        setOrgName(data.tenantId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice.');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => { void load(); }, [load]);

  async function runAction(action: 'issue' | 'pay' | 'archive') {
    if (!invoiceId) return;
    setActionLoading(true);
    setActionError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/super-admin/invoices/${invoiceId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setActionError(body?.error ?? 'Action failed.');
        return;
      }
      if (action === 'issue') setSuccess('Invoice issued. Awaiting company payment.');
      else if (action === 'pay') setSuccess('Payment received. Linked claims moved to Payments.');
      else setSuccess('Invoice archived.');
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <button onClick={() => router.push('/invoices')} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Invoices
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error || 'Invoice not found.'}</div>
      </div>
    );
  }

  const sc = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.draft;
  const isIssued = invoice.status === 'issued';
  const canArchive = invoice.status === 'paid' || invoice.status === 'draft' || invoice.status === 'generated';
  const canIssue = invoice.status === 'draft' || invoice.status === 'generated';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <button onClick={() => router.push('/invoices')} className="print-hide inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Back to Invoices
        </button>

        <div className="print-hide flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-teal-700">Vendor Invoice</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1 font-mono">{invoice.invoiceNumber}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{orgName ?? invoice.tenantId}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-xl border px-4 py-2 text-sm font-semibold ${sc.cls}`}>{sc.label}</span>
          </div>
        </div>

        {success && (
          <div className="print-hide flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}
        {actionError && (
          <div className="print-hide flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{actionError}</p>
          </div>
        )}

        {/* Actions — excluded from the PDF (print-hide) */}
        <div className="print-hide flex flex-wrap items-center gap-2">
          {canIssue && (
            <button onClick={() => runAction('issue')} disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              <Send className="h-4 w-4" /> Issue Invoice
            </button>
          )}
          {isIssued && (
            <button onClick={() => runAction('pay')} disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              <CheckCircle2 className="h-4 w-4" /> Mark Paid
            </button>
          )}
          {canArchive && (
            <button onClick={() => runAction('archive')} disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              <Archive className="h-4 w-4" /> Archive
            </button>
          )}
          <a href={`/api/super-admin/invoices/${invoice.invoiceId}/export`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <Download className="h-4 w-4" /> Export CSV
          </a>
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            <Printer className="h-4 w-4" /> Download PDF
          </button>
        </div>

        {/* The vendor invoice document — printable PDF template */}
        <PrintableInvoice
          invoiceNumber={invoice.invoiceNumber}
          status={invoice.status}
          tenantId={invoice.tenantId}
          orgName={orgName ?? undefined}
          period={invoice.period}
          generatedAt={invoice.generatedAt}
          issuedAt={invoice.issuedAt}
          paidAt={invoice.paidAt}
          totalAmount={invoice.totalAmount}
          lineItems={invoice.lineItems.map((i) => ({
            claimNumber: i.claimNumber,
            clinicName: i.clinicName,
            amount: i.amount,
            sessionCount: i.sessionCount,
            serviceDate: i.serviceDate,
          }))}
        />
      </div>
    </div>
  );
}
