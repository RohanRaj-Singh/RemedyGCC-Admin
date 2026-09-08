'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, MessageSquare, CheckCircle2, XCircle, HelpCircle, MessagesSquare,
  RefreshCw, AlertTriangle, ChevronRight, User, Building2, Heart,
} from 'lucide-react';
import FinancialExceptionBanner from '@/components/financial/FinancialExceptionBanner';
import { FinancialTableSkeleton } from '@/components/financial/FinancialSkeleton';
import { formatDate } from '@/lib/financial/format';

// ── Types (mirror of `GET /api/super-admin/requests/[requestId]`) ───────────

type RequestStatus = 'pending' | 'approved' | 'rejected' | 'more_info' | 'converted_to_chat';
type RequesterRole = 'employee' | 'clinic' | 'tenantAdmin';

interface RequestDoc {
  requestId: string;
  tenantId: string;
  claimId: string;
  claimNumber?: string;
  subject: string;
  body: string;
  status: RequestStatus;
  requester?: { role?: RequesterRole; name?: string };
  responder?: { role?: RequesterRole; name?: string };
  resolutionNote?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ClaimDetails {
  reimbursementId: string;
  claimNumber?: string;
  status?: string;
  amount?: number | null;
  organizationName?: string | null;
  clinicName?: string | null;
  employeeName?: string | null;
  createdAt?: string | null;
}

interface DetailResponse {
  request: RequestDoc;
  claimDetails: ClaimDetails | null;
}

type Decision = 'approved' | 'rejected' | 'more_info' | 'converted_to_chat';

const DECISION_META: Record<Decision, { label: string; tone: string; icon: typeof CheckCircle2; helper: string }> = {
  approved: {
    label: 'Approve',
    tone: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    icon: CheckCircle2,
    helper: 'Mark this request as approved. The claim remains in its current state.',
  },
  rejected: {
    label: 'Reject',
    tone: 'bg-rose-600 hover:bg-rose-700 text-white',
    icon: XCircle,
    helper: 'Reject the request. The claim remains in its current state.',
  },
  more_info: {
    label: 'Ask for more info',
    tone: 'bg-sky-600 hover:bg-sky-700 text-white',
    icon: HelpCircle,
    helper: 'Ask the requester for more information before deciding.',
  },
  converted_to_chat: {
    label: 'Move to chat',
    tone: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    icon: MessagesSquare,
    helper: 'Convert this request into a chat thread on the claim.',
  },
};

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  more_info: 'Needs more info',
  converted_to_chat: 'Moved to chat',
};

export default function RequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const requestId = String(((params as any).requestId ?? '') as string);

  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState<Decision | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/super-admin/requests/${encodeURIComponent(requestId)}`,
      );
      if (res.status === 404) {
        setError('This request could not be found. It may have been deleted.');
        setData(null);
        return;
      }
      if (!res.ok) throw new Error('Failed to load request details.');
      const payload: DetailResponse = await res.json();
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => { void load(); }, [load]);

  const submitDecision = useCallback(async (decision: Decision) => {
    setSubmitting(decision);
    setActionError(null);
    setActionSuccess(null);
    try {
      const body: { decision: Decision; notes?: string } = { decision };
      if (notes.trim()) body.notes = notes.trim();
      const res = await fetch(
        `/api/super-admin/decide?requestId=${encodeURIComponent(requestId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? `Request failed with ${res.status}`);
      }
      const updated: DetailResponse = await res.json();
      setData(updated);
      setNotes('');
      setActionSuccess(
        decision === 'converted_to_chat'
          ? 'Request moved to chat. A chat thread has been started on the claim.'
          : `Request ${STATUS_LABEL[decision as RequestStatus].toLowerCase()}.`,
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Decision failed.');
    } finally {
      setSubmitting(null);
    }
  }, [requestId, notes]);

  if (loading && !data) {
    return (
      <div className="px-8 py-8">
        <FinancialTableSkeleton rows={6} columns={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-8 py-8">
        <Link href="/requests" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Back to Requests
        </Link>
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { request: r, claimDetails } = data;
  const isPending = r.status === 'pending';

  return (
    <div className="px-8 py-8 max-w-4xl">
      {/* Breadcrumb */}
      <Link
        href="/requests"
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Requests
      </Link>

      {/* Header */}
      <header className="mt-4 mb-6">
        <div className="flex items-start gap-3">
          <MessageSquare className="h-6 w-6 text-gray-700 mt-1" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900 truncate">{r.subject}</h1>
            <p className="mt-1 text-xs text-gray-500">
              Request {r.requestId} · raised {formatDate(r.createdAt)}
            </p>
          </div>
          <span className="text-xs font-medium text-gray-600">
            Status: {STATUS_LABEL[r.status]}
          </span>
        </div>
      </header>

      {/* Action result banners */}
      {actionSuccess && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <FinancialExceptionBanner
          title="Could not record your decision"
          exceptions={[actionError]}
          compact
        />
      )}

      {/* Body */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Left: Request body */}
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Message</h2>
          <p className="whitespace-pre-wrap text-sm leading-6 text-gray-800">{r.body}</p>

          {r.resolutionNote && (
            <div className="mt-6 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-700">Response note</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{r.resolutionNote}</p>
              {r.responder?.name && (
                <p className="mt-1 text-xs text-gray-500">— {r.responder.name}</p>
              )}
            </div>
          )}
        </section>

        {/* Right: Context */}
        <aside className="space-y-4">
          <ContextCard title="Claim">
            {claimDetails ? (
              <Link
                href={`/reimbursements/${encodeURIComponent(claimDetails.reimbursementId)}`}
                className="group block rounded-lg border border-gray-200 p-3 hover:border-gray-300"
              >
                <p className="text-sm font-medium text-gray-900 group-hover:underline">
                  {claimDetails.claimNumber ?? claimDetails.reimbursementId}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {claimDetails.status ?? '—'}
                </p>
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  {claimDetails.organizationName && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3 w-3 text-gray-400" />
                      {claimDetails.organizationName}
                    </div>
                  )}
                  {claimDetails.clinicName && (
                    <div className="flex items-center gap-1.5">
                      <Heart className="h-3 w-3 text-gray-400" />
                      {claimDetails.clinicName}
                    </div>
                  )}
                  {claimDetails.employeeName && (
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3 text-gray-400" />
                      {claimDetails.employeeName}
                    </div>
                  )}
                </div>
                <ChevronRight className="mt-2 h-4 w-4 text-gray-400" />
              </Link>
            ) : (
              <p className="text-sm text-gray-500">
                The linked claim could not be loaded. The Request can still be acted on.
              </p>
            )}
          </ContextCard>

          <ContextCard title="Requester">
            {r.requester?.name ? (
              <>
                <p className="text-sm font-medium text-gray-900">{r.requester.name}</p>
                {r.requester.role && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {r.requester.role === 'employee'
                      ? 'Employee'
                      : r.requester.role === 'clinic'
                      ? 'Clinic'
                      : 'Tenant admin'}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">Unknown</p>
            )}
          </ContextCard>

          <ContextCard title="Timeline">
            <ul className="space-y-1 text-xs text-gray-600">
              <li>Raised · {formatDate(r.createdAt)}</li>
              <li>Last update · {formatDate(r.updatedAt)}</li>
            </ul>
          </ContextCard>
        </aside>
      </div>

      {/* Decision panel */}
      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Decision</h2>
          {!isPending && (
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          )}
        </div>

        {!isPending ? (
          <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
            <AlertTriangle className="h-4 w-4 text-gray-500 mt-0.5" />
            <div>
              <p className="font-medium">This request has already been decided.</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Status: {STATUS_LABEL[r.status]}
                {r.updatedAt ? ` · ${formatDate(r.updatedAt)}` : ''}
              </p>
            </div>
          </div>
        ) : (
          <>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Note (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="A short note for the requester (visible in their notification)…"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(Object.keys(DECISION_META) as Decision[]).map((d) => {
                const meta = DECISION_META[d];
                const Icon = meta.icon;
                const isThisSubmitting = submitting === d;
                const isOtherSubmitting = submitting !== null && submitting !== d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => void submitDecision(d)}
                    disabled={isOtherSubmitting}
                    title={meta.helper}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${meta.tone}`}
                  >
                    <Icon className="h-4 w-4" />
                    {isThisSubmitting ? 'Recording…' : meta.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Decisions are routed through the authoritative Request service. They do not modify
              the claim, invoice, or payment workflow.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function ContextCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{title}</p>
      {children}
    </div>
  );
}