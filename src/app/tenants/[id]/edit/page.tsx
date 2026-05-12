'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  BrandingConfig,
  RuntimeConfigOption,
  Tenant,
  TenantPublishingPreview,
  TenantSetupOption,
  TenantStatus,
} from '@/modules/tenant/types';
import { getAllTemplates } from '@/modules/attribute-template/service';
import { getScanners } from '@/modules/scanner/service';
import { TenantForm, TenantPublishingPanel } from '@/modules/tenant/components';
import { BrandingPanel, BrandingPreviewCard } from '@/components/tenants';
import { tenantService } from '@/services/tenant-service';
import { ArrowLeft, Loader2, RadioTower } from 'lucide-react';

export default function EditTenantPage() {
  const formId = 'tenant-edit-form';
  const params = useParams();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branding, setBranding] = useState<Partial<BrandingConfig>>({});
  const [runtimeConfigs, setRuntimeConfigs] = useState<RuntimeConfigOption[]>([]);
  const [publishPreview, setPublishPreview] = useState<TenantPublishingPreview | null>(null);
  const [scannerOptions, setScannerOptions] = useState<TenantSetupOption[]>([]);
  const [attributeTemplateOptions, setAttributeTemplateOptions] = useState<TenantSetupOption[]>([]);

  const loadPublishingState = useCallback(async (currentTenantId: string) => {
    const [runtimeConfigResult, previewResult] = await Promise.all([
      tenantService.getRuntimeConfigOptions(currentTenantId),
      tenantService.getPublishingPreview(currentTenantId),
    ]);

    if (runtimeConfigResult.error) {
      throw new Error(runtimeConfigResult.error);
    }
    if (previewResult.error) {
      throw new Error(previewResult.error);
    }

    setRuntimeConfigs(runtimeConfigResult.data ?? []);
    setPublishPreview(previewResult.data ?? null);
  }, []);

  const loadSetupOptions = useCallback(async () => {
    const [scanners, templates] = await Promise.all([
      getScanners(),
      getAllTemplates(),
    ]);

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
  }, []);

  const loadTenant = useCallback(async () => {
    try {
      setIsLoading(true);
      const [{ data, error: tenantError }] = await Promise.all([
        tenantService.getById(tenantId),
        loadSetupOptions(),
      ]);

      if (tenantError || !data) {
        setError(tenantError || 'Tenant not found');
        return;
      }

      setTenant(data);
      setBranding(data.branding || {});
      await loadPublishingState(data.id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenant');
    } finally {
      setIsLoading(false);
    }
  }, [loadPublishingState, loadSetupOptions, tenantId]);

  useEffect(() => {
    void loadTenant();
  }, [loadTenant]);

  const handleSubmit = useCallback(async (data: {
    name: string;
    slug: string;
    subdomain: string;
    status: TenantStatus;
    draftScannerId: string | null;
    draftAttributeTemplateId: string | null;
  }) => {
    try {
      setIsSaving(true);
      setError(null);

      const { data: updatedTenant, error: updateError } = await tenantService.update(tenantId, {
        name: data.name,
        slug: data.slug,
        subdomain: data.subdomain,
        status: data.status,
        draftScannerId: data.draftScannerId,
        draftAttributeTemplateId: data.draftAttributeTemplateId,
        branding,
      });

      if (updateError || !updatedTenant) {
        throw new Error(updateError || 'Failed to save tenant draft.');
      }

      setTenant(updatedTenant);
      setBranding(updatedTenant.branding || {});
      await loadPublishingState(updatedTenant.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tenant draft.');
    } finally {
      setIsSaving(false);
    }
  }, [branding, loadPublishingState, tenantId]);

  const handlePublish = useCallback(async () => {
    try {
      setIsPublishing(true);
      setError(null);
      const { data, error: publishError } = await tenantService.publishRuntime(tenantId, true);

      if (publishError || !data) {
        throw new Error(publishError || 'Failed to publish survey.');
      }

      setTenant(data.tenant);
      setBranding(data.tenant.branding || {});
      await loadPublishingState(data.tenant.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish survey.');
    } finally {
      setIsPublishing(false);
    }
  }, [loadPublishingState, tenantId]);

  const handleActivate = useCallback(async (runtimeConfigId: string) => {
    try {
      setActivatingId(runtimeConfigId);
      setError(null);

      const { data, error: activateError } = await tenantService.activateRuntimeConfig(
        tenantId,
        runtimeConfigId,
      );

      if (activateError || !data) {
        throw new Error(activateError || 'Failed to update the live survey.');
      }

      setTenant(data);
      setBranding(data.branding || {});
      await loadPublishingState(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update the live survey.');
    } finally {
      setActivatingId(null);
    }
  }, [loadPublishingState, tenantId]);

  const handleStatusChange = useCallback(async (status: TenantStatus) => {
    if (!tenant) {
      return;
    }

    try {
      setIsUpdatingStatus(true);
      setError(null);

      const { data, error: updateError } = await tenantService.update(tenant.id, { status });
      if (updateError || !data) {
        throw new Error(updateError || 'Failed to update survey access.');
      }

      setTenant(data);
      setBranding(data.branding || {});
      await loadPublishingState(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update survey access.');
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [loadPublishingState, tenant]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--primary)' }} />
        <span className="ml-3" style={{ color: 'var(--foreground)' }}>
          Loading tenant...
        </span>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Tenant Not Found
        </h2>
        <p style={{ color: 'var(--muted-foreground)' }} className="mb-4">
          The tenant you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/tenants"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-colors"
          style={{
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tenants
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/tenants/${tenant.id}`}
          className="inline-flex items-center gap-2 transition-colors"
          style={{ color: 'var(--foreground)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tenant Details
        </Link>

        <Link
          href="/tenants"
          className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: 'var(--muted-foreground)' }}
        >
          All Tenants
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          Edit Tenant
        </h1>
        <p style={{ color: 'var(--muted-foreground)' }} className="mt-1">
          Update the tenant, choose the survey setup, customize the branding, then publish when you are ready to go live.
        </p>
      </div>

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

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
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
              tenant={tenant}
              scannerOptions={scannerOptions}
              attributeTemplateOptions={attributeTemplateOptions}
              onSubmit={handleSubmit}
              onCancel={() => void loadTenant()}
              isLoading={isSaving}
              error={null}
            />
          </div>

          <BrandingPanel
            branding={branding}
            onChange={setBranding}
            title="Survey Branding"
            showPreviewSection={false}
          />

          <TenantPublishingPanel
            tenant={tenant}
            preview={publishPreview}
            runtimeConfigs={runtimeConfigs}
            onPublish={handlePublish}
            onActivate={handleActivate}
            onDisable={() => void handleStatusChange('disabled')}
            onReactivate={() => void handleStatusChange('active')}
            onArchive={() => void handleStatusChange('archived')}
            isPublishing={isPublishing}
            activatingId={activatingId}
            isUpdatingStatus={isUpdatingStatus}
          />
        </div>

        <div className="space-y-6">
          <BrandingPreviewCard
            branding={branding}
            title="Brand Preview"
            description="Preview how the live survey theme will appear to respondents."
          />

          <div
            className="rounded-xl border p-5 shadow-sm"
            style={{ backgroundColor: 'hsl(0 0% 98%)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'rgba(15, 118, 110, 0.1)' }}
              >
                <RadioTower className="h-4 w-4" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                  Business Workflow
                </h3>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Follow this order to get the survey live safely.
                </p>
              </div>
            </div>

            <ol className="mt-4 space-y-3 text-sm" style={{ color: 'var(--foreground)' }}>
              {[
                'Create or update the tenant details.',
                'Choose the scanner.',
                'Choose the attribute template.',
                'Customize the branding.',
                'Publish the survey.',
                'The survey becomes live for respondents.',
              ].map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                    style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                  >
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {tenant.activeRuntimeConfig && (
            <div
              className="rounded-xl border p-5 shadow-sm"
              style={{ backgroundColor: 'hsl(0 0% 98%)', borderColor: 'var(--border)' }}
            >
              <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                Live Survey Summary
              </h3>
              <div className="mt-4 space-y-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                <p>Scanner version: <strong style={{ color: 'var(--foreground)' }}>{tenant.activeRuntimeConfig.scannerSummary.version}</strong></p>
                <p>Questions: <strong style={{ color: 'var(--foreground)' }}>{tenant.activeRuntimeConfig.scannerSummary.questionCount}</strong></p>
                <p>Categories: <strong style={{ color: 'var(--foreground)' }}>{tenant.activeRuntimeConfig.scannerSummary.categoryCount}</strong></p>
                <p>Historical submissions: <strong style={{ color: 'var(--foreground)' }}>{tenant.activeRuntimeConfig.submissionCount}</strong></p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className="flex justify-end gap-3 border-t pt-6"
        style={{ borderColor: 'var(--border)' }}
      >
        <button
          type="button"
          onClick={() => void loadTenant()}
          className="rounded-lg px-6 py-2.5 font-medium transition-colors"
          style={{
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
            backgroundColor: 'transparent',
          }}
        >
          Reset Changes
        </button>
        <button
          type="submit"
          form={formId}
          disabled={isSaving || tenant.status === 'archived'}
          className="rounded-lg px-6 py-2.5 font-medium transition-colors"
          style={{
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
            opacity: isSaving || tenant.status === 'archived' ? 0.55 : 1,
            cursor: isSaving || tenant.status === 'archived' ? 'not-allowed' : 'pointer',
          }}
        >
          {isSaving ? 'Saving...' : 'Save Tenant'}
        </button>
      </div>
    </div>
  );
}
