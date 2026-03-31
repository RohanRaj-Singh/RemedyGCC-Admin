'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tenant, TenantStatus, BrandingConfig } from '@/modules/tenant/types';
import { getAllTenants, deleteTenant, getTenantStats, updateTenant } from '@/modules/tenant/service';
import { TenantList } from '@/modules/tenant/components';
import { BrandingDialog } from '@/components/tenants/BrandingDialog';
import { BrandingEditor } from '@/components/tenants/BrandingEditor';
import { Plus, Search, Filter, Loader2, Building2, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TenantStats {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  byBranding: Record<string, number>;
}

export default function TenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenantStatus | 'all'>('all');

  const [brandingDialogOpen, setBrandingDialogOpen] = useState(false);
  const [selectedTenantForBranding, setSelectedTenantForBranding] = useState<Tenant | null>(null);

  useEffect(() => {
    loadTenants();
    loadStats();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const data = await getAllTenants();
      setTenants(data);
      setError(null);
    } catch (err) {
      setError('Failed to load tenants');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await getTenantStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tenant? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(id);
      await deleteTenant(id);
      await loadTenants();
      await loadStats();
    } catch (err) {
      setError('Failed to delete tenant');
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditBranding = (tenant: Tenant) => {
    setSelectedTenantForBranding(tenant);
    setBrandingDialogOpen(true);
  };

  const handleSaveBranding = async (branding: Partial<BrandingConfig>) => {
    if (!selectedTenantForBranding) return;

    try {
      await updateTenant(selectedTenantForBranding.id, { branding });
      await loadTenants();
      setBrandingDialogOpen(false);
      setSelectedTenantForBranding(null);
    } catch (err) {
      console.error('Failed to update branding', err);
      throw err;
    }
  };

  const handleCloseBrandingDialog = () => {
    setBrandingDialogOpen(false);
    setSelectedTenantForBranding(null);
  };

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = 
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.subdomain.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const cardStyle = 'rounded-xl p-4 border shadow-sm';
  const inputStyle = 'w-full px-4 py-2.5 rounded-lg border border-[var(--input)] focus:ring-2 focus:ring-[var(--ring)] focus:border-[var(--ring)] outline-none transition-all';
  const selectStyle = 'px-4 py-2.5 rounded-lg border border-[var(--input)] focus:ring-2 focus:ring-[var(--ring)] focus:border-[var(--ring)] outline-none transition-all';
  const iconButtonStyle = 'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
        <span className="ml-3" style={{ color: 'var(--foreground)' }}>Loading tenants...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Tenants</h1>
          <p className="mt-1" style={{ color: 'var(--muted-foreground)' }}>Manage your multi-tenant organizations</p>
        </div>
        <Link
          href="/tenants/new"
          className={iconButtonStyle}
          style={{ 
            backgroundColor: 'var(--primary)', 
            color: 'var(--primary-foreground)' 
          }}
        >
          <Plus className="w-5 h-5" />
          Add Tenant
        </Link>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className={cardStyle} style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'hsl(212 100% 50% / 0.1)' }}
              >
                <Building2 className="w-5 h-5" style={{ color: 'hsl(212 100% 50%)' }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{stats.total}</p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Total Tenants</p>
              </div>
            </div>
          </div>
          <div className={cardStyle} style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'hsl(142 76% 36% / 0.1)' }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{stats.active}</p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Active</p>
              </div>
            </div>
          </div>
          <div className={cardStyle} style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'var(--muted)' }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--muted-foreground)' }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{stats.inactive}</p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Inactive</p>
              </div>
            </div>
          </div>
          <div className={cardStyle} style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'hsl(0 84% 60% / 0.1)' }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--destructive)' }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{stats.suspended}</p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Suspended</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {stats?.byBranding && (
        <div className={cardStyle} style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Palette className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Branding Stats</h3>
          </div>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-violet-500" />
              <span style={{ color: 'var(--foreground)' }}>
                <strong>{stats.byBranding.custom || 0}</strong> Custom Branding
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span style={{ color: 'var(--foreground)' }}>
                <strong>{stats.byBranding.default || 0}</strong> Default Branding
              </span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div 
          className="p-4 rounded-lg border text-sm"
          style={{ 
            backgroundColor: 'hsl(0 84% 60% / 0.1)', 
            borderColor: 'var(--destructive)', 
            color: 'var(--destructive)' 
          }}
        >
          {error}
        </div>
      )}

      <div 
        className="flex items-center gap-4 p-4 rounded-xl border shadow-sm"
        style={{ 
          backgroundColor: 'var(--background)', 
          borderColor: 'var(--border)' 
        }}
      >
        <div className="flex-1 relative">
          <Search 
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" 
            style={{ color: 'var(--muted-foreground)' }} 
          />
          <input
            type="text"
            placeholder="Search tenants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(inputStyle, "pl-10")}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TenantStatus | 'all')}
            className={selectStyle}
            style={{ color: 'var(--foreground)', backgroundColor: 'var(--background)' }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      <div 
        className="rounded-xl border shadow-sm overflow-hidden"
        style={{ 
          backgroundColor: 'var(--background)', 
          borderColor: 'var(--border)' 
        }}
      >
        <TenantList 
          tenants={filteredTenants} 
          onDelete={handleDelete}
          isDeleting={deletingId}
        />
      </div>

      {filteredTenants.length === 0 && !loading && (
        <div className="text-center py-12">
          <div 
            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--muted)' }}
          >
            <Building2 className="w-8 h-8" style={{ color: 'var(--muted-foreground)' }} />
          </div>
          <h3 className="text-lg font-medium mb-1" style={{ color: 'var(--foreground)' }}>No tenants found</h3>
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
                color: 'var(--primary-foreground)' 
              }}
            >
              <Plus className="w-5 h-5" />
              Add Tenant
            </Link>
          )}
        </div>
      )}

      <BrandingDialog
        open={brandingDialogOpen}
        onClose={handleCloseBrandingDialog}
        title={`Edit Branding - ${selectedTenantForBranding?.name || ''}`}
      >
        {selectedTenantForBranding && (
          <BrandingEditor
            branding={selectedTenantForBranding.branding}
            onSave={handleSaveBranding}
            onCancel={handleCloseBrandingDialog}
          />
        )}
      </BrandingDialog>
    </div>
  );
}