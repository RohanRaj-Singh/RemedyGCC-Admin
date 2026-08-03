/**
 * Budget service wrapper backed by local Next.js API routes (which proxy to
 * the Tenant App with the shared admin API key).
 */

import type { ApiResponse } from './api-client';

const BUDGET_API_BASE = '/api/super-admin/budgets';

export interface BudgetOverview {
  year: number;
  totalAmount: number;
  reservedAmount: number;
  committedAmount: number;
  paidAmount: number;
  availableAmount: number;
  budgetExceeded: boolean;
}

export interface BudgetHistoryEntry {
  historyId: string;
  tenantId: string;
  year: number;
  type: 'created' | 'topup' | 'adjust' | 'override';
  amount: number;
  beforeTotal: number;
  afterTotal: number;
  reason?: string;
  actorId: string;
  actorRole: string;
  createdAt: string;
}

export interface BudgetHistoryFilters {
  type?: string;
  skip?: number;
  limit?: number;
}

export interface BudgetOverrideInput {
  totalAmount: number;
  year?: number;
  reason?: string;
}

async function request<T>(
  input: string,
  init: RequestInit = {},
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(input, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

    const payload = (await response.json().catch(() => null)) as
      | T
      | { error?: { message?: string } | string }
      | null;

    if (!response.ok) {
      const errorPayload = payload as { error?: { message?: string } | string } | null;
      const message =
        typeof errorPayload?.error === 'string'
          ? errorPayload.error
          : errorPayload?.error?.message
            || `Request failed with ${response.status}.`;

      return {
        data: null,
        error: message,
      };
    }

    return {
      data: payload as T,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred.',
    };
  }
}

class BudgetService {
  /**
   * Fetch the annual budget overview for a tenant. Defaults to the current
   * year on the Tenant App when no year is supplied.
   */
  async getOverview(
    tenantId: string,
    year?: number,
  ): Promise<ApiResponse<BudgetOverview>> {
    const params = new URLSearchParams();
    if (year !== undefined) {
      params.set('year', String(year));
    }
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return request<BudgetOverview>(`${BUDGET_API_BASE}/${tenantId}${suffix}`);
  }

  /**
   * Fetch the budget history for a tenant (newest first).
   */
  async getHistory(
    tenantId: string,
    filters: BudgetHistoryFilters = {},
  ): Promise<ApiResponse<{ history: BudgetHistoryEntry[] }>> {
    const params = new URLSearchParams();
    if (filters.type) {
      params.set('type', filters.type);
    }
    if (filters.skip !== undefined) {
      params.set('skip', String(filters.skip));
    }
    if (filters.limit !== undefined) {
      params.set('limit', String(filters.limit));
    }
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return request<{ history: BudgetHistoryEntry[] }>(
      `${BUDGET_API_BASE}/${tenantId}/history${suffix}`,
    );
  }

  /**
   * Override the annual budget ceiling. The Tenant App writes an `override`
   * budget-history entry and returns the refreshed overview.
   */
  async override(
    tenantId: string,
    input: BudgetOverrideInput,
  ): Promise<ApiResponse<BudgetOverview>> {
    return request<BudgetOverview>(
      `${BUDGET_API_BASE}/${tenantId}/override`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  }
}

export const budgetService = new BudgetService();
