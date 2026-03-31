'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TenantStatus, BrandingConfig } from '@/modules/tenant/types';
import { createTenant } from '@/modules/tenant/service';
import { TenantForm } from '@/modules/tenant/components';
import { BrandingPanel } from '@/components/tenants';
import { ArrowLeft } from 'lucide-react';

export default function NewTenantPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branding, setBranding] = useState<Partial<BrandingConfig>>({});

  const handleSubmit = async (data: {
    name: string;
    subdomain: string;
    status: TenantStatus;
  }) => {
    try {
      setIsLoading(true);
      setError(null);
      
      await createTenant({
        name: data.name,
        subdomain: data.subdomain,
        status: data.status,
        branding,
      });
      
      router.push('/tenants');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tenant');
    } finally {
      setIsLoading(false);
    }
  };

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
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Create New Tenant</h1>
        <p style={{ color: 'var(--muted-foreground)' }} className="mt-1">Add a new organization to your platform</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div 
            className="rounded-xl border shadow-sm p-6"
            style={{ 
              backgroundColor: 'var(--background)', 
              borderColor: 'var(--border)' 
            }}
          >
            <TenantForm
              onSubmit={handleSubmit}
              onCancel={() => router.push('/tenants')}
              isLoading={isLoading}
              error={error}
            />
          </div>
        </div>

        <div>
          <BrandingPanel
            branding={branding}
            onChange={setBranding}
            title="Branding Configuration"
          />
        </div>
      </div>
    </div>
  );
}