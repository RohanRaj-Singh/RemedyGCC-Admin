'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type {
  BrandingConfig,
  TenantSetupOption,
  TenantStatus,
} from '@/modules/tenant/types';
import { getAllTemplates } from '@/modules/attribute-template/service';
import { getScanners } from '@/modules/scanner/service';
import { TenantForm } from '@/modules/tenant/components';
import { BrandingPanel } from '@/components/tenants';
import { tenantService } from '@/services/tenant-service';
import { ArrowLeft } from 'lucide-react';

export default function NewTenantPage() {
  const formId = 'tenant-create-form';
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branding, setBranding] = useState<Partial<BrandingConfig>>({});
  const [scannerOptions, setScannerOptions] = useState<TenantSetupOption[]>([]);
  const [attributeTemplateOptions, setAttributeTemplateOptions] = useState<TenantSetupOption[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadOptions() {
      try {
        setIsLoadingOptions(true);
        const [scanners, templates] = await Promise.all([
          getScanners(),
          getAllTemplates(),
        ]);

        if (!isMounted) {
          return;
        }

        setScannerOptions(
          scanners.map((scanner) => ({
            id: scanner.id,
            label: scanner.name.en || scanner.id,
            description: scanner.description?.en,
          })),
        );
        setAttributeTemplateOptions(
          templates.map((template) => ({
            id: template.id,
            label: template.name,
            description: template.description,
          })),
        );
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load setup options.',
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingOptions(false);
        }
      }
    }

    void loadOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (data: {
    name: string;
    slug: string;
    subdomain: string;
    status: TenantStatus;
    draftScannerId: string | null;
    draftAttributeTemplateId: string | null;
  }) => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: tenant, error: createError } = await tenantService.create({
        name: data.name,
        slug: data.slug,
        subdomain: data.subdomain,
        status: data.status,
        draftScannerId: data.draftScannerId,
        draftAttributeTemplateId: data.draftAttributeTemplateId,
        branding,
      });

      if (createError || !tenant) {
        throw new Error(createError || 'Failed to create tenant.');
      }

      router.push(`/tenants/${tenant.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tenant');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <Link
          href="/tenants"
          className="inline-flex items-center gap-2 transition-colors"
          style={{ color: 'var(--foreground)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tenants
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          Create Tenant
        </h1>
        <p style={{ color: 'var(--muted-foreground)' }} className="mt-1">
          Create the tenant, choose the survey setup, customize the branding, and publish when the survey is ready to go live.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div
            className="rounded-xl border p-6 shadow-sm"
            style={{
              backgroundColor: 'var(--background)',
              borderColor: 'var(--border)',
            }}
          >
            <TenantForm
              formId={formId}
              showActions={false}
              onSubmit={handleSubmit}
              onCancel={() => router.push('/tenants')}
              isLoading={isLoading || isLoadingOptions}
              error={error}
              scannerOptions={scannerOptions}
              attributeTemplateOptions={attributeTemplateOptions}
            />
          </div>
        </div>

        <div>
          <BrandingPanel
            branding={branding}
            onChange={setBranding}
            title="Survey Branding"
          />
        </div>
      </div>

      <div
        className="mt-6 flex justify-end gap-3 border-t pt-6"
        style={{ borderColor: 'var(--border)' }}
      >
        <button
          type="button"
          onClick={() => router.push('/tenants')}
          className="rounded-lg px-6 py-2.5 font-medium transition-colors"
          style={{
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
            backgroundColor: 'transparent',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          form={formId}
          disabled={isLoading || isLoadingOptions}
          className="rounded-lg px-6 py-2.5 font-medium transition-colors"
          style={{
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
            opacity: isLoading || isLoadingOptions ? 0.55 : 1,
            cursor: isLoading || isLoadingOptions ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? 'Creating...' : 'Create Tenant'}
        </button>
      </div>
    </div>
  );
}
