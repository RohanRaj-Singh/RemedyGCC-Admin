'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Tenant, TenantStatus } from '@/modules/tenant/types';
import { TenantList } from '@/modules/tenant/components';
import { tenantService } from '@/services/tenant-service';
import { Plus, Search, Filter, Loader2, Building2, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TenantStats {
  totalTenants: number;
  draftTenants?: number;
  activeTenants: number;
  disabledTenants?: number;
  archivedTenants?: number;
  activeRuntimeConfigs?: number;
  totalSubmissions?: number;
  tenantsByBranding: {
    custom: number;
    default: number;
    withWarnings?: number;
  };
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenantStatus | 'all'>('all');

  useEffect(() => {
    void Promise.all([loadTenants(), loadStats()]);
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const { data, error: loadError } = await tenantService.getAll();
      if (loadError || !data) {
        throw new Error(loadError || 'Failed to load tenants.');
      }

      setTenants(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data, error: loadError } = await tenantService.getDashboardStats();
      if (loadError || !data) {
        throw new Error(loadError || 'Failed to load tenant stats.');
      }

      setStats(data);
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  };

  const handleDelete = async (id: string) => {
    const tenant = tenants.find((entry) => entry.id === id);
    if (!tenant) {
      return;
    }

    const confirmationText = window.prompt(
      `Type "${tenant.slug}" to delete this draft tenant permanently.`,
      '',
    );

    if (!confirmationText) {
      return;
    }

    try {
      setDeletingId(id);
      const { error: deleteError } = await tenantService.delete(id, confirmationText);
      if (deleteError) {
        throw new Error(deleteError);
      }

      await Promise.all([loadTenants(), loadStats()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tenant');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch =
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase())
      || tenant.slug.toLowerCase().includes(searchQuery.toLowerCase())
      || tenant.subdomain.toLowerCase().includes(searchQuery.toLowerCase())
      || (tenant.activeRuntimeConfigId || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const cardStyle = 'rounded-xl p-4 border shadow-sm';
  const inputStyle = 'w-full px-4 py-2.5 rounded-lg border border-[var(--input)] focus:ring-2 focus:ring-[var(--ring)] focus:border-[var(--ring)] outline-none transition-all';
  const selectStyle = 'px-4 py-2.5 rounded-lg border border-[var(--input)] focus:ring-2 focus:ring-[var(--ring)] focus:border-[var(--ring)] outline-none transition-all';
  const iconButtonStyle = 'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors';

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--primary)' }} />
        <span className="ml-3" style={{ color: 'var(--foreground)' }}>
          Loading tenants...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            Tenants
          </h1>
          <p className="mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Manage tenant setup, publishing, and live survey status.
          </p>
        </div>
        <Link
          href="/tenants/new"
          className={iconButtonStyle}
          style={{
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
          }}
        >
          <Plus className="h-5 w-5" />
          Add Tenant
        </Link>
      </div>

      {stats && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className={cardStyle} style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: 'hsl(212 100% 50% / 0.1)' }}
              >
                <Building2 className="h-5 w-5" style={{ color: 'hsl(212 100% 50%)' }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                  {stats.totalTenants}
                </p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Total Tenants
                </p>
              </div>
            </div>
          </div>
          <div className={cardStyle} style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: 'hsl(142 76% 36% / 0.1)' }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                  {stats.activeTenants}
                </p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Live Survey
                </p>
              </div>
            </div>
          </div>
          <div className={cardStyle} style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)' }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#d97706' }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                  {stats.draftTenants || 0}
                </p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Draft Setup
                </p>
              </div>
            </div>
          </div>
          <div className={cardStyle} style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: 'rgba(148, 163, 184, 0.18)' }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#64748b' }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                  {stats.disabledTenants || 0}
                </p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Disabled
                </p>
              </div>
            </div>
          </div>
          <div className={cardStyle} style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: 'rgba(82, 82, 91, 0.12)' }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#52525b' }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                  {stats.archivedTenants || 0}
                </p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Archived
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {stats?.tenantsByBranding && (
        <div className={cardStyle} style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
          <div className="mb-3 flex items-center gap-2">
            <Palette className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>
              Branding Status
            </h3>
          </div>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-violet-500" />
              <span style={{ color: 'var(--foreground)' }}>
                <strong>{stats.tenantsByBranding.custom || 0}</strong> Custom Branding
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-gray-400" />
              <span style={{ color: 'var(--foreground)' }}>
                <strong>{stats.tenantsByBranding.default || 0}</strong> Runtime Defaults
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-amber-500" />
              <span style={{ color: 'var(--foreground)' }}>
                <strong>{stats.tenantsByBranding.withWarnings || 0}</strong> Fallback Warnings
              </span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{
            backgroundColor: 'hsl(0 84% 60% / 0.1)',
            borderColor: 'var(--destructive)',
            color: 'var(--destructive)',
          }}
        >
          {error}
        </div>
      )}

      <div
        className="flex items-center gap-4 rounded-xl border p-4 shadow-sm"
        style={{
          backgroundColor: 'var(--background)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2"
            style={{ color: 'var(--muted-foreground)' }}
          />
          <input
            type="text"
            placeholder="Search tenants..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className={cn(inputStyle, 'pl-10')}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" style={{ color: 'var(--muted-foreground)' }} />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as TenantStatus | 'all')}
            className={selectStyle}
            style={{ color: 'var(--foreground)', backgroundColor: 'var(--background)' }}
          >
            <option value="all">All Status</option>
            <option value="draft">Draft Setup</option>
            <option value="active">Live Survey</option>
            <option value="disabled">Disabled</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-xl border shadow-sm"
        style={{
          backgroundColor: 'var(--background)',
          borderColor: 'var(--border)',
        }}
      >
        <TenantList
          tenants={filteredTenants}
          onDelete={handleDelete}
          isDeleting={deletingId}
        />
      </div>

      {filteredTenants.length === 0 && !loading && (
        <div className="py-12 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--muted)' }}
          >
            <Building2 className="h-8 w-8" style={{ color: 'var(--muted-foreground)' }} />
          </div>
          <h3 className="mb-1 text-lg font-medium" style={{ color: 'var(--foreground)' }}>
            No tenants found
          </h3>
          <p className="mb-4" style={{ color: 'var(--muted-foreground)' }}>
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create your first tenant to get started'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <Link
              href="/tenants/new"
              className={iconButtonStyle}
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
              }}
            >
              <Plus className="h-5 w-5" />
              Add Tenant
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
