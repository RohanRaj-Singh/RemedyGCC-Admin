/**
 * Invoice generation request + pre-generation review summary.
 *
 * The generate contract is frozen: one invoice = one organization = many claims,
 * selected explicitly (never by date range). `buildGenerateRequest` mirrors the
 * exact body the admin proxy forwards to the tenant app (`{ tenantId, claimIds }`).
 */

export interface GenerateRequest {
  tenantId: string;
  claimIds: string[];
}

export interface InvoiceReviewSummary {
  orgId: string;
  orgName: string;
  claimCount: number;
  clinicCount: number;
  totalAmount: number;
}

export function buildGenerateRequest(tenantId: string, claimIds: string[]): GenerateRequest {
  return { tenantId, claimIds };
}

export function buildInvoiceReviewSummary(
  orgId: string,
  orgName: string,
  selected: Array<{ clinicName?: string | null; amount: number }>,
): InvoiceReviewSummary {
  const clinics = new Set(selected.map((c) => c.clinicName).filter(Boolean));
  const totalAmount = selected.reduce((sum, c) => sum + c.amount, 0);
  return {
    orgId,
    orgName,
    claimCount: selected.length,
    clinicCount: clinics.size,
    totalAmount,
  };
}
