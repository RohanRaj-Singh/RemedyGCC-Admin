'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Check,
  FileText,
  Globe,
  Layout,
  Loader2,
  Palette,
  Save,
  Settings,
  Sparkles,
} from 'lucide-react';
import type { BrandingConfig, TenantSetupOption, TenantStatus } from '@/modules/tenant/types';
import { getAllTemplates } from '@/modules/attribute-template/service';
import { getScanners } from '@/modules/scanner/service';
import { BrandingPanel, BrandingPreviewCard } from '@/components/tenants';
import { getTenantHostname, getTenantHostnameSuffix } from '@/modules/tenant/utils';
import { tenantService } from '@/services/tenant-service';

interface TenantRuntimeConfig {
  scannerSummary: {
    version: string;
    questionCount: number;
    categoryCount: number;
  };
  submissionCount: number;
}

interface TenantData {
  id: string;
  name: string;
  subdomain: string;
  status: TenantStatus;
  draftScannerId: string | null;
  draftAttributeTemplateId: string | null;
  branding: Partial<BrandingConfig> | null;
  activeRuntimeConfig?: TenantRuntimeConfig | null;
}

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', icon: Settings, desc: 'Your survey is being set up.' },
  active: { label: 'Live', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', icon: Sparkles, desc: 'Your survey is collecting responses.' },
  disabled: { label: 'Paused', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', icon: Settings, desc: 'Survey is paused. All data is preserved.' },
  archived: { label: 'Archived', color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.1)', icon: FileText, desc: 'Survey is closed for record-keeping.' },
};

export default function EditTenantPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [draftScannerId, setDraftScannerId] = useState<string | null>(null);
  const [draftAttributeTemplateId, setDraftAttributeTemplateId] = useState<string | null>(null);
  const [branding, setBranding] = useState<Partial<BrandingConfig>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const [scannerOptions, setScannerOptions] = useState<TenantSetupOption[]>([]);
  const [attributeTemplateOptions, setAttributeTemplateOptions] = useState<TenantSetupOption[]>([]);

  // Track original values for change detection
  const [originalValues, setOriginalValues] = useState({
    name: '',
    subdomain: '',
    draftScannerId: null as string | null,
    draftAttributeTemplateId: null as string | null,
    branding: {} as Partial<BrandingConfig>,
  });

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [scanners, templates, tenantResult] = await Promise.all([
          getScanners(),
          getAllTemplates(),
          tenantService.getById(tenantId),
        ]);

        if (!isMounted) return;

        if (tenantResult.error || !tenantResult.data) {
          setError(tenantResult.error || 'Tenant not found');
          return;
        }

        const t = tenantResult.data;
        setTenant(t as TenantData);
        setName(t.name);
        setSubdomain(t.subdomain);
        setDraftScannerId(t.draftScannerId);
        setDraftAttributeTemplateId(t.draftAttributeTemplateId);
        setBranding(t.branding || {});

        setOriginalValues({
          name: t.name,
          subdomain: t.subdomain,
          draftScannerId: t.draftScannerId,
          draftAttributeTemplateId: t.draftAttributeTemplateId,
          branding: t.branding || {},
        });

        setScannerOptions(scanners.map(s => ({ id: s.id, label: s.name.en || s.id, description: s.description?.en })));
        setAttributeTemplateOptions(templates.map(tmpl => ({ id: tmpl.id, label: tmpl.name, description: tmpl.description })));
      } catch (e) {
        if (isMounted) setError('Failed to load survey data.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void loadData();
    return () => { isMounted = false; };
  }, [tenantId]);

  // Detect changes
  useEffect(() => {
    const brandingChanged = JSON.stringify(branding) !== JSON.stringify(originalValues.branding);
    const otherChanged = name !== originalValues.name || subdomain !== originalValues.subdomain ||
      draftScannerId !== originalValues.draftScannerId || draftAttributeTemplateId !== originalValues.draftAttributeTemplateId;
    setHasChanges(brandingChanged || otherChanged);
  }, [name, subdomain, draftScannerId, draftAttributeTemplateId, branding, originalValues]);

  const handleSave = useCallback(async () => {
    if (!tenant) return;
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const slug = subdomain.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const { data: updated, error: updateError } = await tenantService.update(tenant.id, {
        name: name.trim(),
        slug,
        subdomain: subdomain.trim().toLowerCase(),
        draftScannerId,
        draftAttributeTemplateId,
        branding,
      });

      if (updateError || !updated) throw new Error(updateError || 'Failed to save.');

      setTenant({ ...tenant, name: name.trim(), subdomain: subdomain.trim().toLowerCase(), draftScannerId, draftAttributeTemplateId, branding });
      setOriginalValues({ name: name.trim(), subdomain: subdomain.trim().toLowerCase(), draftScannerId, draftAttributeTemplateId, branding });
      setSuccessMessage('Changes saved successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  }, [tenant, name, subdomain, draftScannerId, draftAttributeTemplateId, branding]);

  const handleStatusChange = useCallback(async (newStatus: TenantStatus) => {
    if (!tenant) return;
    try {
      setIsUpdatingStatus(true);
      setError(null);

      const { data, error: updateError } = await tenantService.update(tenant.id, { status: newStatus });
      if (updateError || !data) throw new Error(updateError || 'Failed to update status.');

      setTenant({ ...tenant, status: newStatus });
      setSuccessMessage(newStatus === 'disabled' ? 'Survey paused successfully.' : newStatus === 'active' ? 'Survey resumed successfully.' : 'Survey archived.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [tenant]);

  const handleGoLive = useCallback(async () => {
    if (!tenant) return;
    try {
      setIsSaving(true);
      setError(null);

      const { data, error: publishError } = await tenantService.publishRuntime(tenant.id, true);
      if (publishError || !data) throw new Error(publishError || 'Failed to go live.');

      setTenant({ ...tenant, status: 'active', activeRuntimeConfig: data.tenant.activeRuntimeConfig });
      setSuccessMessage('Your survey is now live!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to go live.');
    } finally {
      setIsSaving(false);
    }
  }, [tenant]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <h2 className="text-xl font-semibold">Survey Not Found</h2>
        <p className="text-muted-foreground mt-2 mb-6">The requested survey could not be found.</p>
        <Link href="/tenants" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
          <ArrowLeft className="h-4 w-4" />Back to Surveys
        </Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[tenant.status];
  const StatusIcon = statusCfg.icon;
  const canGoLive = draftScannerId && draftAttributeTemplateId && tenant.status === 'draft';
  const isLive = tenant.status === 'active';
  const isArchived = tenant.status === 'archived';

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <Link href={`/tenants/${tenant.id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />Back to Survey
        </Link>
        <h1 className="text-2xl font-bold">Edit Survey</h1>
        <p className="text-muted-foreground mt-1">Update your survey configuration and settings.</p>
      </div>

      {/* Status Banner */}
      <div className="mb-8 rounded-2xl border p-6" style={{ backgroundColor: statusCfg.bg, borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: statusCfg.color, color: '#fff' }}>
              <StatusIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{tenant.name}</span>
                <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: statusCfg.color, color: '#fff' }}>
                  {statusCfg.label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{statusCfg.desc}</p>
            </div>
          </div>
          <div className="flex gap-3">
            {tenant.status === 'draft' && (
              <button
                onClick={handleGoLive}
                disabled={!canGoLive || isSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all disabled:opacity-40"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Go Live
              </button>
            )}
            {tenant.status === 'active' && (
              <button
                onClick={() => handleStatusChange('disabled')}
                disabled={isUpdatingStatus}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium border transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Pause Survey
              </button>
            )}
            {tenant.status === 'disabled' && (
              <button
                onClick={() => handleStatusChange('active')}
                disabled={isUpdatingStatus}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                <Sparkles className="h-4 w-4" />Resume Survey
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error / Success Messages */}
      {error && (
        <div className="mb-6 rounded-lg p-4 text-sm font-medium" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-6 rounded-lg p-4 text-sm font-medium" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
          {successMessage}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        {/* Left Column - Configuration */}
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Basic Information</h2>
                <p className="text-sm text-muted-foreground">Survey name and address</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Survey Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isArchived}
                  className="w-full px-4 py-3 rounded-xl border text-lg disabled:opacity-50"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Survey Address</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    disabled={isLive || isArchived}
                    className="flex-1 px-4 py-3 rounded-xl border text-lg disabled:opacity-50"
                    style={{ borderColor: 'var(--border)' }}
                  />
                  <span className="text-muted-foreground text-sm">{getTenantHostnameSuffix()}</span>
                </div>
                {isLive && <p className="text-xs text-muted-foreground mt-2">Subdomain is locked while survey is live.</p>}
              </div>
            </div>
          </div>

          {/* Survey Setup */}
          <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                <Layout className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Survey Setup</h2>
                <p className="text-sm text-muted-foreground">Questions and response structure</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Survey Scanner</label>
                <p className="text-xs text-muted-foreground mb-3">The questions and assessment structure for this survey.</p>
                <select
                  value={draftScannerId || ''}
                  onChange={(e) => setDraftScannerId(e.target.value || null)}
                  disabled={isArchived}
                  className="w-full px-4 py-3 rounded-xl border disabled:opacity-50"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <option value="">Select a scanner...</option>
                  {scannerOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}{opt.description ? ` - ${opt.description}` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Response Template</label>
                <p className="text-xs text-muted-foreground mb-3">How responses are structured and attributed.</p>
                <select
                  value={draftAttributeTemplateId || ''}
                  onChange={(e) => setDraftAttributeTemplateId(e.target.value || null)}
                  disabled={isArchived}
                  className="w-full px-4 py-3 rounded-xl border disabled:opacity-50"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <option value="">Select a template...</option>
                  {attributeTemplateOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}{opt.description ? ` - ${opt.description}` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Branding */}
          <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)' }}>
                <Palette className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Survey Branding</h2>
                <p className="text-sm text-muted-foreground">Customize how your survey looks</p>
              </div>
            </div>

            <BrandingPanel branding={branding} onChange={setBranding} title="" showPreviewSection={false} />
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving || isArchived || !hasChanges}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all disabled:opacity-40"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Right Column - Preview & Info */}
        <div className="space-y-6">
          <BrandingPreviewCard
            branding={branding}
            title="Brand Preview"
            description="This is how your survey will appear to respondents."
          />

          {/* Live Survey Info */}
          {tenant.activeRuntimeConfig && (
            <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}>
              <h3 className="text-lg font-semibold mb-4">Live Survey Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scanner Version</span>
                  <span className="font-medium">{tenant.activeRuntimeConfig.scannerSummary.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Questions</span>
                  <span className="font-medium">{tenant.activeRuntimeConfig.scannerSummary.questionCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Categories</span>
                  <span className="font-medium">{tenant.activeRuntimeConfig.scannerSummary.categoryCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submissions</span>
                  <span className="font-medium">{tenant.activeRuntimeConfig.submissionCount}</span>
                </div>
              </div>
            </div>
          )}

          {/* URL Info */}
          <div className="rounded-xl border p-5" style={{ backgroundColor: 'hsl(0 0% 98%)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 mb-3">
              <Globe className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              <h3 className="font-semibold">Survey URL</h3>
            </div>
            <p className="text-lg font-medium" style={{ color: 'var(--foreground)' }}>{getTenantHostname(tenant.subdomain)}</p>
            {isLive && <p className="text-xs text-muted-foreground mt-2">This URL is currently accessible to respondents.</p>}
          </div>

          {/* Actions (for non-draft) */}
          {tenant.status !== 'draft' && (
            <div className="rounded-xl border p-5" style={{ backgroundColor: 'hsl(0 0% 98%)', borderColor: 'var(--border)' }}>
              <h3 className="font-semibold mb-4">Survey Actions</h3>
              <div className="space-y-2">
                {tenant.status === 'active' && (
                  <button
                    onClick={() => handleStatusChange('disabled')}
                    disabled={isUpdatingStatus}
                    className="w-full text-left px-4 py-2 rounded-lg border text-sm transition-colors hover:bg-red-50"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    Pause Survey
                  </button>
                )}
                {tenant.status === 'disabled' && (
                  <button
                    onClick={() => handleStatusChange('active')}
                    disabled={isUpdatingStatus}
                    className="w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    Resume Survey
                  </button>
                )}
                {tenant.status !== 'archived' && (
                  <button
                    onClick={() => handleStatusChange('archived')}
                    disabled={isUpdatingStatus}
                    className="w-full text-left px-4 py-2 rounded-lg border text-sm transition-colors hover:bg-red-50"
                    style={{ borderColor: 'var(--border)', color: '#dc2626' }}
                  >
                    Archive Survey
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
