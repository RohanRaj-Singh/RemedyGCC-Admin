'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Loader2, Send, CheckCircle, XCircle, HelpCircle, MessageSquare } from 'lucide-react';

interface ClaimRequest {
  requestId: string;
  subject: string;
  details: string;
  status: 'pending' | 'approved' | 'rejected' | 'more_info' | 'converted_to_chat';
  requester: { role: string; id: string; name: string };
  decisionNote?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  pending: { label: 'Pending', class: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', class: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', class: 'bg-red-100 text-red-700' },
  more_info: { label: 'Needs more info', class: 'bg-blue-100 text-blue-700' },
  converted_to_chat: { label: 'Converted to chat', class: 'bg-purple-100 text-purple-700' },
};

interface ClaimRequestsProps {
  claimId: string;
  /** Base URL for the claim's requests, e.g. `/api/super-admin/reimbursements/{id}/requests`. */
  apiBase: string;
  canCreate?: boolean;
  canDecide?: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ClaimRequests({
  claimId,
  apiBase,
  canCreate = false,
  canDecide = false,
}: ClaimRequestsProps) {
  const [requests, setRequests] = useState<ClaimRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSubject, setNewSubject] = useState('');
  const [newDetails, setNewDetails] = useState('');
  const [creating, setCreating] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch(apiBase);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests ?? []);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [apiBase]);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 30_000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const handleCreate = useCallback(async () => {
    const subject = newSubject.trim();
    const details = newDetails.trim();
    if (!subject || !details || creating) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, details }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to create request.');
      }
      setNewSubject('');
      setNewDetails('');
      await fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create request.');
    } finally {
      setCreating(false);
    }
  }, [newSubject, newDetails, creating, apiBase, fetchRequests]);

  const handleDecide = useCallback(
    async (requestId: string, action: string) => {
      if (decidingId) return;
      setDecidingId(requestId);
      setError('');
      try {
        const res = await fetch(`${apiBase}/${requestId}/decide`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, note: notes[requestId]?.trim() || undefined }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to update request.');
        }
        await fetchRequests();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update request.');
      } finally {
        setDecidingId(null);
      }
    },
    [decidingId, notes, apiBase, fetchRequests],
  );

  return (
    <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border)' }}>
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
          Requests
        </h3>
      </div>

      <div className="space-y-3">
        {loading && (
          <p className="py-6 text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Loading requests…
          </p>
        )}
        {!loading && requests.length === 0 && (
          <p className="py-6 text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
            No requests yet.
          </p>
        )}

        {requests.map((req) => {
          const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
          return (
            <div key={req.requestId} className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--secondary)' }}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {req.subject}
                </span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cfg.class}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap" style={{ color: 'var(--muted-foreground)' }}>
                {req.details}
              </p>
              <p className="mt-1 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                {req.requester.name} · {formatDate(req.createdAt)}
              </p>

              {req.decisionNote && (
                <p className="mt-2 rounded-lg border bg-white p-2 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                  <span className="font-semibold">Decision:</span> {req.decisionNote}
                </p>
              )}

              {req.status === 'pending' && canDecide && (
                <div className="mt-3">
                  <textarea
                    value={notes[req.requestId] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [req.requestId]: e.target.value }))}
                    rows={2}
                    placeholder="Note (optional)…"
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--secondary)', color: 'var(--foreground)' }}
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => handleDecide(req.requestId, 'approved')} disabled={decidingId !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                      {decidingId === req.requestId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button type="button" onClick={() => handleDecide(req.requestId, 'more_info')} disabled={decidingId !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                      <HelpCircle className="w-3.5 h-3.5" />
                      Ask for more info
                    </button>
                    <button type="button" onClick={() => handleDecide(req.requestId, 'rejected')} disabled={decidingId !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                    <button type="button" onClick={() => handleDecide(req.requestId, 'converted_to_chat')} disabled={decidingId !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Convert to chat
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {canCreate && (
        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
            New request
          </p>
          <input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="Subject — e.g. Pre-approval for assessment"
            className="mb-2 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--secondary)', color: 'var(--foreground)' }}
          />
          <textarea
            value={newDetails}
            onChange={(e) => setNewDetails(e.target.value)}
            rows={2}
            placeholder="Details — e.g. Can we do this assessment?"
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--secondary)', color: 'var(--foreground)' }}
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newSubject.trim() || !newDetails.trim()}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send request
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
