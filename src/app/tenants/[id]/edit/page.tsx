'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Tenant, TenantStatus, BrandingConfig } from '@/modules/tenant/types';
import { getTenantById, updateTenant } from '@/modules/tenant/service';
import { TenantForm } from '@/modules/tenant/components';
import { BrandingPanel, BrandingPreviewCard } from '@/components/tenants';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function EditTenantPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.id as string;
  
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branding, setBranding] = useState<Partial<BrandingConfig>>({});
  const brandingRef = useRef(branding);

  useEffect(() => {
    brandingRef.current = branding;
  }, [branding]);

  const loadTenant = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getTenantById(tenantId);
      
      if (!data) {
        setError('Tenant not found');
        return;
      }
      
      setTenant(data);
      setBranding(data.branding || {});
    } catch (err) {
      setError('Failed to load tenant');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadTenant();
  }, [loadTenant]);

  const handleSubmit = useCallback(async (data: {
    name: string;
    subdomain: string;
    status: TenantStatus;
  }) => {
    try {
      setIsSaving(true);
      setError(null);
      
      await updateTenant(tenantId, {
        name: data.name,
        status: data.status,
        branding: brandingRef.current,
      });
      
      router.push('/tenants');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tenant');
    } finally {
      setIsSaving(false);
    }
  }, [router, tenantId]);

  const handleScannerAssign = useCallback(async (scannerId: string | null) => {
    try {
      setIsSaving(true);
      setError(null);
      
      await updateTenant(tenantId, {
        assignedScannerId: scannerId,
      });
      
      await loadTenant();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign scanner');
    } finally {
      setIsSaving(false);
    }
  }, [loadTenant, tenantId]);

  const handleCancel = useCallback(() => {
    router.push('/tenants');
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
        <span className="ml-3" style={{ color: 'var(--foreground)' }}>Loading tenant...</span>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Tenant Not Found</h2>
        <p style={{ color: 'var(--muted-foreground)' }} className="mb-4">The tenant you're looking for doesn't exist.</p>
        <Link
          href="/tenants"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors"
          style={{ 
            backgroundColor: 'var(--primary)', 
            color: 'var(--primary-foreground)' 
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tenants
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link
          href="/tenants"
          className="inline-flex items-center gap-2 transition-colors"
          style={{ color: 'var(--foreground)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tenants
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Edit Tenant</h1>
        <p style={{ color: 'var(--muted-foreground)' }} className="mt-1">Update tenant details and branding</p>
      </div>

      {error && (
        <div 
          className="mb-6 p-4 rounded-lg border text-sm"
          style={{ 
            backgroundColor: 'hsl(0 84% 60% / 0.1)', 
            borderColor: 'var(--destructive)', 
            color: 'var(--destructive)' 
          }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_340px] xl:grid-cols-[minmax(0,1.35fr)_360px] gap-6 items-start">
        <div className="space-y-6">
          <div 
            className="rounded-xl border shadow-sm p-6"
            style={{ 
              backgroundColor: 'var(--background)', 
              borderColor: 'var(--border)' 
            }}
          >
            <TenantForm
              tenant={tenant}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isLoading={isSaving}
              error={null}
              currentScannerId={tenant.assignedScannerId}
              currentScannerName={tenant.assignedScannerName}
              onAssignScanner={handleScannerAssign}
            />
          </div>

          <BrandingPanel
            branding={branding}
            onChange={setBranding}
            title="Branding Configuration"
            showPreviewSection={false}
          />
        </div>

        <div className="relative hidden lg:block self-start">
          <div
            className="lg:fixed lg:top-4 lg:w-[340px] xl:w-[360px] lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
            style={{ right: '2rem' }}
          >
            <BrandingPreviewCard
              branding={branding}
              title="Tenant Preview"
              description="Keep this in view while editing the form and branding settings."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
