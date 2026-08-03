'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Megaphone, Info, Loader2, Send } from 'lucide-react';

interface ChatMessage {
  messageId: string;
  type: 'message' | 'official_update' | 'system';
  participant: { role: string; id: string; name: string };
  body: string;
  createdAt: string;
}

interface ClaimChatProps {
  claimId: string;
  /** Base URL for the claim's messages, e.g. `/api/super-admin/reimbursements/{id}/messages`. */
  apiBase: string;
  readOnly?: boolean;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ClaimChat({ claimId, apiBase, readOnly = true }: ClaimChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(
    async (markRead: boolean) => {
      try {
        const res = await fetch(apiBase);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages ?? []);
        }
      } catch {
        /* ignore */
      }
      setLoading(false);
      if (markRead) {
        try {
          await fetch(`${apiBase}/read`, { method: 'POST' });
        } catch {
          /* ignore */
        }
      }
    },
    [apiBase],
  );

  useEffect(() => {
    fetchMessages(true);
    const interval = setInterval(() => fetchMessages(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to send message.');
      }
      setText('');
      await fetchMessages(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }, [text, sending, apiBase, fetchMessages]);

  return (
    <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border)' }}>
      <div className="mb-3 flex items-center gap-2">
        <MessageSquare className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
          Chat
        </h3>
      </div>

      <div
        ref={listRef}
        className="max-h-80 space-y-3 overflow-y-auto rounded-lg border p-3"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--secondary)' }}
      >
        {loading && (
          <p className="py-6 text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Loading messages…
          </p>
        )}
        {!loading && messages.length === 0 && (
          <p className="py-6 text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
            No messages yet on this claim.
          </p>
        )}
        {messages.map((msg) => {
          if (msg.type === 'official_update') {
            return (
              <div key={msg.messageId} className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <Megaphone className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    Official update
                  </span>
                  <span className="ml-auto text-[11px] text-blue-400">
                    {msg.participant.name} · {formatTime(msg.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.body}</p>
              </div>
            );
          }
          if (msg.type === 'system') {
            return (
              <div key={msg.messageId} className="flex justify-center">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px]"
                  style={{ backgroundColor: 'var(--secondary)', color: 'var(--muted-foreground)' }}
                >
                  <Info className="w-3 h-3" />
                  {msg.body}
                  <span style={{ color: 'var(--muted-foreground)' }}>· {formatTime(msg.createdAt)}</span>
                </span>
              </div>
            );
          }
          return (
            <div key={msg.messageId} className="rounded-lg bg-white p-3 shadow-sm border" style={{ borderColor: 'var(--border)' }}>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                  {msg.participant.name}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                  {formatTime(msg.createdAt)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>
                {msg.body}
              </p>
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div className="mt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter inserts a newline
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            placeholder="Write a message…"
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--secondary)',
              color: 'var(--foreground)',
            }}
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !text.trim()}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
