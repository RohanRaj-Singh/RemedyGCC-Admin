'use client';

import { useState, useEffect, useCallback } from 'react';
  import { useParams, useRouter, useSearchParams } from 'next/navigation';
  import { ArrowLeft, Loader2 } from 'lucide-react';
import PrintableInvoice from '@/components/financial/PrintableInvoice';
import BillingActionBar from '@/components/financial/BillingActionBar';
import InvoiceStatusCallout from '@/components/financial/InvoiceStatusCallout';
import SuccessBanner from '@/components/financial/SuccessBanner';
  import FinancialExceptionBanner from '@/components/financial/FinancialExceptionBanner';
  import FinancialRecordLink from '@/components/financial/FinancialRecordLink';
  import ConfirmActionDialog from '@/components/financial/ConfirmActionDialog';
  import { formatCurrency, formatDate } from '@/lib/financial/format';
  import { type InvoiceStatus } from '@/lib/financial/status';
  import { useTenants } from '@/context/TenantsProvider';

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
  status: InvoiceStatus;
  generatedBy: string;
  generatedAt: string;
  issuedAt?: string;
  paidAt?: string;
  totalAmount: number;
  lineItems: LineItem[];
}

type ConfirmAction = 'issue' | 'pay' | 'archive';

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const invoiceId = params.id;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [successLink, setSuccessLink] = useState<{ href: string; label: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<ConfirmAction | null>(null);
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
  // `?created=1` is appended by the Claims page when Generate Invoice redirects
  // here. It is a one-shot signal — the banner shows once, then the param is
  // stripped so a manual back/refresh does not keep re-showing it.
  const [justCreated, setJustCreated] = useState(searchParams.get('created') === '1');

  // PA2-A item 4: org name resolution now comes from shared TenantsProvider
  // instead of refetching the full tenant list every time an invoice detail
  // page mounts. The shared cache is populated when (authenticated)/layout
  // mounts, so orgName is available synchronously after the cache resolves.
  const { tenants: tenantOptions } = useTenants();

  const load = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/invoices/${invoiceId}`);
      if (!res.ok) throw new Error('Invoice not found.');
      const data: InvoiceDetail = await res.json();
      setInvoice(data);
      const tenant = tenantOptions.find((t) => t.id === data.tenantId);
      setOrgName(tenant?.name ?? data.tenantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice.');
    } finally {
      setLoading(false);
    }
  }, [invoiceId, tenantOptions]);

  useEffect(() => {
    void load();
  }, [load]);

  // Consume the one-shot `?created=1` signal: show the banner once, then clear
  // the in-memory flag so a back/refresh does not keep re-displaying it. The
  // query param itself is left in the URL (harmless) — the flag is the gate.
  useEffect(() => {
    if (justCreated) {
      const timer = window.setTimeout(() => setJustCreated(false), 4000);
      return () => window.clearTimeout(timer);
    }
  }, [justCreated]);

  async function runConfirmedAction() {
    if (!invoiceId || !pendingAction || !invoice) return;
    const actionKey = pendingAction;
    setActionLoadingKey(actionKey);
    setActionError(null);
    setSuccess(null);
    setSuccessLink(null);
    try {
      const res = await fetch(`/api/super-admin/invoices/${invoiceId}/${actionKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setActionError(body?.error ?? 'Action failed.');
        return;
      }
      const claimCount = invoice.lineItems.length;
      if (actionKey === 'issue') {
        setSuccess(`Invoice ${invoice.invoiceNumber} issued. Awaiting organization payment.`);
      } else if (actionKey === 'pay') {
        setSuccess(
          `Invoice ${invoice.invoiceNumber} paid. ${claimCount} claim${claimCount === 1 ? '' : 's'} ${claimCount === 1 ? 'is' : 'are'} now ready for payout.`,
        );
        setSuccessLink({ href: '/payments', label: 'Go To Payments' });
      } else {
        setSuccess(`Invoice ${invoice.invoiceNumber} archived.`);
      }
      setPendingAction(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setActionLoadingKey(null);
    }
  }

  function exportCsv() {
    window.open(`/api/super-admin/invoices/${invoiceId}/export`, '_blank');
  }

  function downloadPdf() {
    window.print();
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

  const canIssue = invoice.status === 'draft';
  const canMarkPaid = invoice.status === 'issued';
  const canArchive = invoice.status === 'draft' || invoice.status === 'paid';

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
        </div>

        {/* Status callout — the single authority for invoice state, its
            operational meaning, and what to do next. The action bar below is
            the single host for actions; this callout is guidance-only. */}
        <div className="print-hide">
          <InvoiceStatusCallout
            status={invoice.status}
            claimCount={invoice.lineItems.length}
            actionLabel={invoice.status === 'issued' ? 'View Outstanding Invoices' : undefined}
            actionHref={invoice.status === 'issued' ? '/invoices?status=issued' : undefined}
            secondaryAction={
              invoice.status === 'issued'
                ? { label: 'View payments', href: '/payments' }
                : undefined
            }
          />
        </div>

        {success && <SuccessBanner message={success} action={successLink} />}
        {justCreated && invoice && (
          <SuccessBanner
            message={`Invoice ${invoice.invoiceNumber} created. ${invoice.lineItems.length} claim${invoice.lineItems.length === 1 ? '' : 's'} ready to review.`}
          />
        )}
        {actionError && (
          <FinancialExceptionBanner
            title="Action failed"
            exceptions={[actionError]}
            onDismiss={() => setActionError(null)}
          />
        )}

        {/* Actions — state-dependent primary action + exports. Excluded from PDF. */}
        <div className="print-hide overflow-hidden rounded-xl border border-gray-200">
          <BillingActionBar
            status={invoice.status}
            canIssue={canIssue}
            canMarkPaid={canMarkPaid}
            canArchive={canArchive}
            onIssue={canIssue ? () => setPendingAction('issue') : undefined}
            onMarkPaid={canMarkPaid ? () => setPendingAction('pay') : undefined}
            onArchive={canArchive ? () => setPendingAction('archive') : undefined}
            onExportCsv={exportCsv}
            onDownloadPdf={downloadPdf}
            loadingKey={actionLoadingKey}
          />
        </div>

        {/* Billed claims — traceable to claim detail (screen-only) */}
        <div className="print-hide overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Billed Claims</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {invoice.lineItems.length} claim{invoice.lineItems.length === 1 ? '' : 's'} on this invoice ·{' '}
              {formatCurrency(invoice.totalAmount)} total
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {invoice.lineItems.map((item) => (
              <div key={item.claimId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <FinancialRecordLink
                    kind="claim"
                    href={`/reimbursements/${item.claimId}`}
                    reference={item.claimNumber ?? item.claimId}
                  />
                  {item.clinicName && (
                    <p className="mt-0.5 text-xs text-gray-500">{item.clinicName}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="hidden text-xs text-gray-400 sm:inline">
                    {formatDate(item.serviceDate)}
                  </span>
                  <span className="font-medium tabular-nums text-gray-900">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
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

      <ConfirmActionDialog
        open={pendingAction !== null}
        title={pendingAction ? buildConfirmTitle(pendingAction, invoice) : ''}
        description={pendingAction ? buildConfirmDescription(pendingAction, invoice) : ''}
        confirmLabel={pendingAction ? buildConfirmLabel(pendingAction) : ''}
        tone={pendingAction === 'archive' ? 'warning' : 'success'}
        loading={actionLoadingKey !== null}
        onConfirm={runConfirmedAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}

function buildConfirmTitle(action: ConfirmAction, invoice: InvoiceDetail): string {
  switch (action) {
    case 'issue':
      return 'Issue invoice?';
    case 'pay':
      return 'Record organization payment?';
    case 'archive':
      return 'Archive invoice?';
  }
}

function buildConfirmDescription(action: ConfirmAction, invoice: InvoiceDetail): string {
  const amount = formatCurrency(invoice.totalAmount);
  const num = invoice.invoiceNumber;
  const claimCount = invoice.lineItems.length;
  switch (action) {
    case 'issue':
      return `Issue ${num} for ${amount}? It becomes payable to the organization and shows as outstanding in A/R.`;
    case 'pay':
      return `Mark ${num} as paid. ${claimCount} claim${claimCount === 1 ? '' : 's'} will move to the payout queue.`;
    case 'archive':
      return `Archive ${num}? An archived invoice can no longer be paid or issued.`;
  }
}

function buildConfirmLabel(action: ConfirmAction): string {
  switch (action) {
    case 'issue':
      return 'Issue Invoice';
    case 'pay':
      return 'Mark Paid';
    case 'archive':
      return 'Archive';
  }
}
