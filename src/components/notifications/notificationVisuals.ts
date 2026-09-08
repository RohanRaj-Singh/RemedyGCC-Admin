import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Inbox,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Receipt,
  Send,
  Snowflake,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * Mirrors `tenantapp/src/server/db/documents.ts` `NotificationType` union.
 * Keep in sync if the tenantapp adds new types.
 */
export type NotificationType =
  | 'claim_approved'
  | 'claim_rejected'
  | 'claim_frozen'
  | 'claim_paid'
  | 'claim_payment_queued'
  | 'claim_in_progress'
  | 'claim_submitted'
  | 'claim_resubmitted'
  | 'progress_update_sent'
  | 'claim_message'
  | 'claim_request'
  | 'invoice_generated'
  | 'payment_recorded'
  | 'document_uploaded'
  | 'reminder'
  | 'general';

interface Visual {
  Icon: LucideIcon;
  /** Foreground color (text + icon). */
  color: string;
  /** Background tint class. */
  bgClass: string;
  /** Border ring color class. */
  ringClass: string;
}

const FALLBACK: Visual = {
  Icon: Inbox,
  color: 'text-slate-700',
  bgClass: 'bg-slate-50',
  ringClass: 'ring-slate-200',
};

/**
 * Map a notification type to its icon + accent color. Used by NotificationBell
 * and (potentially) other surfaces (toasts, list views) for visual consistency.
 */
export function visualForType(type: NotificationType | string | undefined): Visual {
  switch (type) {
    case 'claim_approved':
      return {
        Icon: CheckCircle2,
        color: 'text-emerald-700',
        bgClass: 'bg-emerald-50',
        ringClass: 'ring-emerald-200',
      };
    case 'claim_rejected':
      return {
        Icon: AlertCircle,
        color: 'text-red-700',
        bgClass: 'bg-red-50',
        ringClass: 'ring-red-200',
      };
    case 'claim_frozen':
      return {
        Icon: Snowflake,
        color: 'text-sky-700',
        bgClass: 'bg-sky-50',
        ringClass: 'ring-sky-200',
      };
    case 'claim_paid':
    case 'claim_payment_queued':
      return {
        Icon: Wallet,
        color: 'text-emerald-700',
        bgClass: 'bg-emerald-50',
        ringClass: 'ring-emerald-200',
      };
    case 'claim_in_progress':
    case 'claim_submitted':
    case 'claim_resubmitted':
      return {
        Icon: Clock,
        color: 'text-amber-700',
        bgClass: 'bg-amber-50',
        ringClass: 'ring-amber-200',
      };
    case 'progress_update_sent':
      return {
        Icon: Megaphone,
        color: 'text-violet-700',
        bgClass: 'bg-violet-50',
        ringClass: 'ring-violet-200',
      };
    case 'claim_message':
      return {
        Icon: MessageCircle,
        color: 'text-blue-700',
        bgClass: 'bg-blue-50',
        ringClass: 'ring-blue-200',
      };
    case 'claim_request':
      return {
        Icon: MessageSquare,
        color: 'text-primary',
        bgClass: 'bg-primary/5',
        ringClass: 'ring-primary/20',
      };
    case 'invoice_generated':
      return {
        Icon: Receipt,
        color: 'text-emerald-700',
        bgClass: 'bg-emerald-50',
        ringClass: 'ring-emerald-200',
      };
    case 'payment_recorded':
      return {
        Icon: CreditCard,
        color: 'text-emerald-700',
        bgClass: 'bg-emerald-50',
        ringClass: 'ring-emerald-200',
      };
    case 'document_uploaded':
      return {
        Icon: FileText,
        color: 'text-slate-700',
        bgClass: 'bg-slate-50',
        ringClass: 'ring-slate-200',
      };
    case 'reminder':
      return {
        Icon: Send,
        color: 'text-slate-600',
        bgClass: 'bg-slate-50',
        ringClass: 'ring-slate-200',
      };
    default:
      return FALLBACK;
  }
}

/** Friendly label for a notification type. Used as a small chip in the UI. */
export function labelForType(type: NotificationType | string | undefined): string {
  switch (type) {
    case 'claim_approved':
      return 'Approved';
    case 'claim_rejected':
      return 'Rejected';
    case 'claim_frozen':
      return 'Frozen';
    case 'claim_paid':
      return 'Paid';
    case 'claim_payment_queued':
      return 'Payment queued';
    case 'claim_in_progress':
      return 'In progress';
    case 'claim_submitted':
      return 'Submitted';
    case 'claim_resubmitted':
      return 'Resubmitted';
    case 'progress_update_sent':
      return 'Update';
    case 'claim_message':
      return 'Message';
    case 'claim_request':
      return 'Request';
    case 'invoice_generated':
      return 'Invoice';
    case 'payment_recorded':
      return 'Payment';
    case 'document_uploaded':
      return 'Document';
    case 'reminder':
      return 'Reminder';
    default:
      return 'Update';
  }
}
