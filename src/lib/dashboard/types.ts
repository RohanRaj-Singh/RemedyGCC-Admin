/**
 * Strict, server-matched TypeScript shape for the Super Admin dashboard
 * `DashboardSummary` payload returned by
 * `GET /api/super-admin/dashboard/summary`.
 *
 * Every metric on the dashboard maps to a field on this type. If the field
 * does not exist here, it does not render on the dashboard. This is the
 * single source of truth — do not invent metrics that aren't represented.
 *
 * Source attribution (no invented numbers — see plan §2):
 *   - readyForBilling / blocked / readyToPay: derived from `/api/super-admin/reimbursements`
 *   - awaitingOrgPayment / paidThisMonth: `/api/super-admin/invoices`
 *   - blockedByBank: split from `to_be_paid` by bank-account presence
 *   - invoicesOver7Days: split from awaitingOrgPayment by issue age (informational only)
 *   - recent: merged tail from invoices (issued/paid) + payments + to_be_paid queue
 *   - context.organizationsActive: `/api/super-admin/tenants/stats`
 *     (PA2-C: the four status counts come from indexed `countDocuments` in
 *     `getTenantStatusCounts`; the branding/submission aggregates still use
 *     the tenant list)
 *   - context.clinicsActive: direct `db.clinics.countDocuments({ status: "active" })`
 *   - context.employeesActive: `/api/super-admin/employees?status=active` (uses response.total)
 *   - context.notificationsUnread: `/api/super-admin/notifications/unread-count`
 *
 * The 14-day "overdue" payment metric was deliberately removed by the prior
 * audit (it was never an agreed business rule). Aging is surfaced as
 * informational only (`invoicesOver7Days`).
 */

export interface StageCounts {
  count: number;
  amount: number;
}

export interface WorkflowStages {
  /** `approved` claims with no invoice linkage. */
  readyForBilling: StageCounts;
  /** Invoices with `status === "issued"`. */
  awaitingOrgPayment: StageCounts;
  /** `to_be_paid` claims with complete bank details. */
  readyToPay: StageCounts;
  /** `to_be_paid` claims missing bank details (Phase-6 `missing_bank`). */
  blocked: StageCounts;
  /** Invoices `status === "paid"` paid within the current month. */
  paidThisMonth: StageCounts;
}

export interface Attention {
  /** Same set as `workflow.blocked` (split out for the Attention panel). */
  blockedByBank: StageCounts;
  /** Informational only — no verdict. Never drives an action. */
  invoicesOver7Days: StageCounts;
}

export type RecentActivityItem =
  | {
      kind: 'invoice_issued';
      id: string;
      number: string;
      tenantName: string;
      amount: number;
      at: string; // ISO
    }
  | {
      kind: 'invoice_paid';
      id: string;
      number: string;
      tenantName: string;
      amount: number;
      at: string;
    }
  | {
      kind: 'payment_recorded';
      id: string;
      claimId: string;
      clinicName: string;
      amount: number;
      at: string;
    }
  | {
      kind: 'claim_ready';
      id: string;
      claimNumber: string;
      employeeName: string;
      amount: number;
      at: string;
    };

export interface OperationalContext {
  organizationsActive: number;
  clinicsActive: number;
  employeesActive: number;
  notificationsUnread: number;
}

export interface DashboardSummary {
  /** ISO timestamp the server composed this payload. */
  generatedAt: string;
  workflow: WorkflowStages;
  attention: Attention;
  /** Newest first, max 12 items. */
  recent: RecentActivityItem[];
  context: OperationalContext;
  /**
   * Pre-computed top organizations by amount of money in flight
   * (issued invoices + to_be_paid claims). Empty array if no work in
   * flight. The composition lives on the server so the dashboard
   * does not re-derive it on every render.
   */
  concentration: import('./grouping').OrgWorkRow[];
}