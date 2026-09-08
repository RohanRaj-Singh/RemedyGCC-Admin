/**
 * Hooks Barrel — Super Admin
 *
 * Only export hooks that are still imported. The legacy `useTenants` hook
 * (a per-component fetch against `tenantService.getAll()`) was removed in
 * PA5; consumers should use `useTenants` from `@/context/TenantsProvider`
 * instead, which is the single shared tenant cache mounted under
 * `(authenticated)/layout.tsx`.
 *
 * `useDashboard` and `useScanners` remain dead in the audit and are
 * scheduled for removal in a later phase.
 */

export { useDashboardSummary } from './useDashboardSummary';
