'use client';

import Link from 'next/link';
import { AlertTriangle, Building2, Edit, Link2, Trash2 } from 'lucide-react';
import type { Tenant } from '../types';
import { getTenantHostname, getTenantStatusMeta } from '../utils';
import {
  getReadableTextColor,
  resolveBrandingConfig,
} from '@/types/branding';

interface TenantListProps {
  tenants: Tenant[];
  onDelete?: (id: string) => void;
  isDeleting?: string | null;
}

const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string }> = {
  draft: { bg: 'rgba(245, 158, 11, 0.12)', color: '#92400e', dot: '#d97706' },
  active: { bg: 'rgba(34, 197, 94, 0.12)', color: '#166534', dot: '#16a34a' },
  disabled: { bg: 'rgba(148, 163, 184, 0.18)', color: '#475569', dot: '#64748b' },
  archived: { bg: 'rgba(82, 82, 91, 0.16)', color: '#3f3f46', dot: '#52525b' },
};

export function TenantList({ tenants, onDelete, isDeleting }: TenantListProps) {
  if (tenants.length === 0) {
    return (
      <div className="py-16 text-center">
        <div
          className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl"
          style={{ backgroundColor: 'var(--muted)' }}
        >
          <Building2 className="h-10 w-10" style={{ color: 'var(--muted-foreground)' }} />
        </div>
        <h3 className="mb-2 text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          No tenants found
        </h3>
        <p className="text-base" style={{ color: 'var(--muted-foreground)' }}>
          Create your first tenant to start the draft-to-publish flow.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px]">
        <thead>
          <tr
            className="border-b-2"
            style={{ borderColor: 'var(--border)', backgroundColor: 'hsl(0 0% 98%)' }}
          >
            {['Tenant', 'Slug', 'Status', 'Runtime Config', 'Publishing', 'Actions'].map((heading) => (
              <th
                key={heading}
                className="px-5 py-4 text-left text-sm font-bold uppercase tracking-wide"
                style={{ color: 'var(--foreground)' }}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {tenants.map((tenant) => {
            const resolvedBranding = resolveBrandingConfig(tenant.branding);
            const status = STATUS_STYLES[tenant.status];
            const statusMeta = getTenantStatusMeta(tenant.status);
            const canDelete =
              tenant.status === 'draft' && !tenant.activeRuntimeConfigId && Boolean(onDelete);

            return (
              <tr
                key={tenant.id}
                className="border-b transition-all duration-150 hover:bg-slate-50/80"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold shadow-sm"
                      style={{
                        background: resolvedBranding.gradients.brandGradient,
                        color: getReadableTextColor(resolvedBranding.primaryColor),
                      }}
                    >
                      {tenant.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                        {tenant.name}
                      </div>
                      <div className="mt-0.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        Created {new Date(tenant.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                </td>

                <td className="px-5 py-4">
                  <code
                    className="rounded-md px-3 py-1.5 text-sm font-medium"
                    style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                  >
                    {getTenantHostname(tenant.slug)}
                  </code>
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.dot }} />
                    <span
                      className="inline-flex rounded-lg px-3 py-1.5 text-sm font-semibold"
                      style={{ backgroundColor: status.bg, color: status.color }}
                    >
                      {statusMeta.label}
                    </span>
                  </div>
                  <p className="mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {statusMeta.description}
                  </p>
                </td>

                <td className="px-5 py-4">
                  {tenant.activeRuntimeConfig ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                          {tenant.activeRuntimeConfig.runtimeConfigId}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {tenant.activeRuntimeConfig.versionRefs.scannerVersionId} / {tenant.activeRuntimeConfig.versionRefs.attributeTemplateVersionId}
                      </p>
                    </div>
                  ) : (
                    <span className="text-sm font-medium italic" style={{ color: 'var(--muted-foreground)' }}>
                      No active runtime config
                    </span>
                  )}
                </td>

                <td className="px-5 py-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {tenant.publishingReadiness?.hasPendingChanges
                        ? 'Pending publish'
                        : 'In sync'}
                    </p>
                    {(tenant.brandingWarnings?.length ?? 0) > 0 && (
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4" style={{ color: '#b45309' }} />
                        <span className="text-xs" style={{ color: '#92400e' }}>
                          {tenant.brandingWarnings?.length} runtime fallback warning{tenant.brandingWarnings?.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    )}
                  </div>
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/tenants/${tenant.id}/edit`}
                      className="rounded-lg p-2.5 transition-all duration-150 hover:scale-105"
                      title="Edit tenant"
                      style={{ color: 'var(--muted-foreground)', backgroundColor: 'var(--muted)' }}
                    >
                      <Edit className="h-4.5 w-4.5" />
                    </Link>
                    <button
                      onClick={() => onDelete?.(tenant.id)}
                      disabled={!canDelete || isDeleting === tenant.id}
                      className="rounded-lg p-2.5 transition-all duration-150 hover:scale-105 disabled:cursor-not-allowed"
                      title={
                        canDelete
                          ? 'Delete draft tenant'
                          : 'Only draft tenants without runtime configs can be deleted'
                      }
                      style={{
                        color:
                          !canDelete || isDeleting === tenant.id
                            ? 'var(--muted-foreground)'
                            : 'hsl(0 70% 50%)',
                        backgroundColor:
                          isDeleting === tenant.id
                            ? 'hsl(0 84% 60% / 0.1)'
                            : 'var(--muted)',
                        opacity: canDelete ? 1 : 0.55,
                      }}
                    >
                      {isDeleting === tenant.id ? (
                        <span
                          className="h-4.5 w-4.5 animate-spin rounded-full border-2"
                          style={{ borderColor: 'var(--destructive)', borderTopColor: 'transparent' }}
                        />
                      ) : (
                        <Trash2 className="h-4.5 w-4.5" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
