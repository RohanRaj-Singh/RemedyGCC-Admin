'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Edit,
  Eye,
  FileText,
  Globe,
  Loader2,
  Palette,
  Play,
  Send,
  Settings,
  Shield,
  ShieldOff,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import type { Tenant } from '@/modules/tenant/types';
import { tenantService } from '@/services/tenant-service';
import { BrandingPreviewCard } from '@/components/tenants';
import { getTenantHostname } from '@/modules/tenant/utils';
import { TenantDashboardAccessPanel } from '@/modules/tenant/components';

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface StatusConfig {
  label: string;
  description: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  iconBg: string;
  iconColor: string;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  draft: {
    label: 'Draft',
    description: 'Your survey is being set up.',
    badge: 'Draft Setup',
    badgeColor: '#b45309',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    iconBg: 'rgba(245, 158, 11, 0.15)',
    iconColor: '#d97706',
  },
  active: {
    label: 'Live',
    description: 'Your survey is collecting responses.',
    badge: 'Live',
    badgeColor: '#15803d',
    badgeBg: 'rgba(34, 197, 94, 0.15)',
    iconBg: 'rgba(34, 197, 94, 0.15)',
    iconColor: '#16a34a',
  },
  disabled: {
    label: 'Disabled',
    description: 'Survey is paused. All data is preserved.',
    badge: 'Disabled',
    badgeColor: '#64748b',
    badgeBg: 'rgba(100, 116, 139, 0.15)',
    iconBg: 'rgba(100, 116, 139, 0.15)',
    iconColor: '#64748b',
  },
  archived: {
    label: 'Archived',
    description: 'Survey is closed for record-keeping.',
    badge: 'Archived',
    badgeColor: '#6b7280',
    badgeBg: 'rgba(107, 114, 128, 0.12)',
    iconBg: 'rgba(107, 114, 128, 0.12)',
    iconColor: '#6b7280',
  },
};

function getNextAction(tenant: Tenant | null): { message: string; action?: string; complete: boolean } | null {
  if (!tenant) return null;
  if (tenant.status === 'archived') return null;

  if (!tenant.draftScannerId) {
    return { message: 'Connect a survey scanner to define your questions.', action: 'Add Scanner', complete: false };
  }
  if (!tenant.draftAttributeTemplateId) {
    return { message: 'Connect an attribute template to structure responses.', action: 'Add Template', complete: false };
  }
  if (tenant.status === 'draft') {
    return { message: 'Your survey is ready to go live!', action: 'Go Live', complete: false };
  }
  if (tenant.status === 'disabled') {
    return { message: 'Re-enable your survey to collect responses again.', action: 'Re-enable', complete: false };
  }
  if (tenant.status === 'active') {
    return { message: 'Your survey is live and collecting responses.', complete: true };
  }
  return null;
}

export default function TenantDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params?.id as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreSubdomain, setRestoreSubdomain] = useState('');

  const statusConfig = useMemo(() => {
    if (!tenant) return null;
    return STATUS_MAP[tenant.status] || STATUS_MAP.draft;
  }, [tenant]);

  const nextAction = useMemo(() => getNextAction(tenant), [tenant]);

  const canDelete = Boolean(tenant?.status === 'draft' && !tenant?.activeRuntimeConfigId);

  const loadTenant = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error: loadError } = await tenantService.getById(tenantId);
      if (loadError || !data) throw new Error(loadError || 'Tenant not found.');
      setTenant(data);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load tenant.');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { void loadTenant(); }, [loadTenant]);

  const handleGoLive = useCallback(async () => {
    if (!tenant) return;
    if (tenant.status === 'active') return;

    try {
      setIsActing(true);
      setError(null);
      setSuccessMessage(null);

      if (tenant.status === 'draft' || tenant.status === 'disabled') {
        if (!tenant.draftScannerId || !tenant.draftAttributeTemplateId) {
          setError('Please complete the survey setup before going live.');
          return;
        }
        const { error: publishError } = await tenantService.publishRuntime(tenant.id, true);
        if (publishError) throw new Error(publishError);
      }

      if (tenant.status === 'disabled') {
        const { error: updateError } = await tenantService.update(tenant.id, { status: 'active' });
        if (updateError) throw new Error(updateError);
      }

      await loadTenant();
      setSuccessMessage(tenant.status === 'disabled' ? 'Survey re-enabled successfully!' : 'Survey is now live!');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to go live.');
    } finally {
      setIsActing(false);
    }
  }, [tenant, loadTenant]);

  const updateStatus = useCallback(async (newStatus: Tenant['status']) => {
    if (!tenant) return;
    try {
      setIsActing(true);
      setError(null);
      setSuccessMessage(null);
      const { data, error: updateError } = await tenantService.update(tenant.id, { status: newStatus });
      if (updateError || !data) throw new Error(updateError || 'Failed to update.');
      setTenant(data);
      setSuccessMessage(newStatus === 'active' ? 'Survey is now live!' : 'Survey has been disabled.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to update status.');
    } finally {
      setIsActing(false);
    }
  }, [tenant]);

  const handleDelete = useCallback(async () => {
    if (!tenant) return;

    // Phase 1 — preview consequences
    const { data: consequences, error: previewError } = await tenantService.previewDelete(tenant.id);
    if (previewError || !consequences) {
      setError(previewError || 'Failed to prepare tenant deletion.');
      return;
    }

    // Build the consequence summary for the user
    const warnings: string[] = [];
    if (consequences.hasActiveSurvey) {
      warnings.push('Active live survey will be taken down');
    }
    if (consequences.submissionCount > 0) {
      warnings.push(`${consequences.submissionCount} submission(s) will be permanently deleted`);
    }
    if (consequences.runtimeConfigCount > 0) {
      warnings.push(`${consequences.runtimeConfigCount} published survey(s) will be deleted`);
    }
    if (consequences.hasBrandingAssets) {
      warnings.push('Branding assets (logo, background) will be removed');
    }

    const warningMessage = warnings.length > 0
      ? `\n\nWARNING — This will permanently delete:\n${warnings.map((w) => `  • ${w}`).join('\n')}\n\nTenant dashboard access users will also be removed.`
      : '';

    const slugInput = window.prompt(
      `Type "${consequences.slug}" to delete this tenant permanently.${warningMessage}`,
      '',
    );
    if (!slugInput || slugInput.trim() !== consequences.slug) return;

    // Phase 2 — execute deletion with explicit acknowledgement
    try {
      setIsActing(true);
      const { error: deleteError } = await tenantService.delete(tenant.id, {
        slug: consequences.slug,
        acknowledgeDataLoss: warnings.length > 0,
      });
      if (deleteError) throw new Error(deleteError);
      router.push('/tenants');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to delete.');
    } finally {
      setIsActing(false);
    }
  }, [router, tenant]);

  const handleArchive = useCallback(async () => {
    if (!tenant) return;
    try {
      setIsActing(true);
      const { error: archiveError } = await tenantService.archive(tenant.id);
      if (archiveError) throw new Error(archiveError);
      await loadTenant();
      setShowArchiveConfirm(false);
      setSuccessMessage('Survey has been archived.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to archive.');
    } finally {
      setIsActing(false);
    }
  }, [tenant, loadTenant]);

  const handleRestore = useCallback(async () => {
    if (!tenant) return;
    try {
      setIsActing(true);
      const subdomain = restoreSubdomain.trim() || undefined;
      const { error: restoreError } = await tenantService.restore(tenant.id, subdomain);
      if (restoreError) throw new Error(restoreError);
      await loadTenant();
      setShowRestoreConfirm(false);
      setRestoreSubdomain('');
      setSuccessMessage('Survey has been restored. Go live when ready.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to restore.');
    } finally {
      setIsActing(false);
    }
  }, [tenant, restoreSubdomain, loadTenant]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-xl font-semibold mb-2">Tenant Not Found</h2>
        <p className="text-muted-foreground mb-6">The requested tenant could not be found.</p>
        <Link href="/tenants" className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-medium" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
          <ArrowLeft className="h-4 w-4" />Back to Tenants
        </Link>
      </div>
    );
  }

  const isLive = tenant.status === 'active';
  const isReady = tenant.draftScannerId && tenant.draftAttributeTemplateId;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/tenants" className="p-2 rounded-lg transition-colors hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{tenant.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="h-4 w-4" />
              <span>{getTenantHostname(tenant.subdomain)}</span>
            </div>
          </div>
        </div>
        <Link href={`/tenants/${tenant.id}/edit`} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-colors hover:bg-gray-100">
          <Edit className="h-4 w-4" />Edit
        </Link>
      </div>

      {/* Status Banner */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: statusConfig?.iconBg }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'white' }}>
              {isLive ? (
                <Sparkles className="h-7 w-7" style={{ color: statusConfig?.iconColor }} />
              ) : (
                <Settings className="h-7 w-7" style={{ color: statusConfig?.iconColor }} />
              )}
            </div>
            <div>
              <span className="inline-flex rounded-full px-3 py-1 text-sm font-semibold" style={{ backgroundColor: statusConfig?.badgeBg, color: statusConfig?.badgeColor }}>
                {statusConfig?.badge}
              </span>
              <p className="mt-2 text-sm font-medium" style={{ color: '#374151' }}>{statusConfig?.description}</p>
            </div>
          </div>

          {tenant.status !== 'archived' && (
            <button
              onClick={() => void handleGoLive()}
              disabled={isActing || isLive || !isReady}
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: isLive ? '#6b7280' : 'var(--primary)', color: 'white' }}
            >
              {isActing ? <Loader2 className="h-5 w-5 animate-spin" /> : isLive ? <CheckCircle2 className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              {isLive ? 'Currently Live' : tenant.status === 'disabled' ? 'Re-enable' : 'Go Live'}
            </button>
          )}
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="rounded-lg p-4 text-sm font-medium" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#166534', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
          {successMessage}
        </div>
      )}
      {error && (
        <div className="rounded-lg p-4 text-sm font-medium" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          {error}
        </div>
      )}

      {/* Next Action Guidance */}
      {nextAction && !nextAction.complete && tenant.status !== 'archived' && (
        <div className="rounded-xl p-5 border" style={{ backgroundColor: '#fafafa', borderColor: '#e5e7eb' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
              <ChevronRight className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{nextAction.message}</p>
              {nextAction.action && (
                <p className="text-xs mt-1 text-muted-foreground">Use the Edit action to {nextAction.action.toLowerCase()}.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tenant.submissionCount}</p>
              <p className="text-sm text-muted-foreground">Responses</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
              <Sparkles className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{tenant.draftScanner?.label || 'Not set'}</p>
              <p className="text-sm text-muted-foreground">Scanner</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)' }}>
              <Palette className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{tenant.draftAttributeTemplate?.label || 'Not set'}</p>
              <p className="text-sm text-muted-foreground">Template</p>
            </div>
          </div>
        </div>
      </div>

      {/* Survey Preview */}
      <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Eye className="h-5 w-5" />Survey Preview
          </h3>
        </div>
        <BrandingPreviewCard branding={tenant.branding} title="" description="" />
      </div>

      <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />Subdomain Content
          </h3>
        </div>
        <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: 'hsl(0 0% 98%)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tenant Name</p>
          <p className="mt-3 text-sm leading-7 text-slate-700">{tenant.name}</p>
          {tenant.nameAr?.trim() && (
            <p className="mt-2 text-sm leading-7 text-slate-500" dir="rtl">{tenant.nameAr}</p>
          )}
        </div>
        <div className="rounded-xl border p-4" style={{ backgroundColor: 'hsl(0 0% 98%)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">About Us Intro</p>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            {tenant.content?.pages?.about?.intro?.en?.trim() || 'Using the default About page intro copy.'}
          </p>
          {tenant.content?.pages?.about?.intro?.ar?.trim() && (
            <p className="mt-2 text-sm leading-7 text-slate-500" dir="rtl">
              {tenant.content.pages.about.intro.ar}
            </p>
          )}
        </div>
      </div>

      {/* Operations - Separated */}
      <div className="rounded-2xl border p-6" style={{ backgroundColor: '#fafafa', borderColor: '#e5e7eb' }}>
        <h3 className="text-lg font-semibold mb-2">Operations</h3>
        <p className="text-sm text-muted-foreground mb-5">Manage the operational state of this survey.</p>

        <div className="flex flex-wrap gap-3">
          {isLive && (
            <button onClick={() => void updateStatus('disabled')} disabled={isActing} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium" style={{ backgroundColor: 'rgba(107, 114, 128, 0.1)', color: '#4b5563' }}>
              <ShieldOff className="h-4 w-4" />Pause Survey
            </button>
          )}
          {tenant.status === 'disabled' && (
            <button onClick={() => void handleGoLive()} disabled={isActing} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#15803d' }}>
              <Shield className="h-4 w-4" />Resume Survey
            </button>
          )}
          {(tenant.status === 'disabled' || tenant.status === 'draft') && (
            <button onClick={() => setShowArchiveConfirm(true)} disabled={isActing} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium" style={{ backgroundColor: 'rgba(107, 114, 128, 0.08)', color: '#4b5563' }}>
              <Send className="h-4 w-4" />Archive
            </button>
          )}
          {tenant.status === 'archived' && (
            <button onClick={() => setShowRestoreConfirm(true)} disabled={isActing} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#15803d' }}>
              <Play className="h-4 w-4" />Restore
            </button>
          )}
          {canDelete && (
            <button onClick={() => void handleDelete()} disabled={isActing} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}>
              <Trash2 className="h-4 w-4" />Delete
            </button>
          )}
        </div>
      </div>

      <TenantDashboardAccessPanel
        tenantId={tenant.id}
        tenantStatus={tenant.status}
      />

      {/* Archive Modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-3">Archive Survey?</h3>
            <p className="text-sm text-gray-600 mb-4">This will stop access and release the subdomain. All data is preserved.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowArchiveConfirm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={() => void handleArchive()} disabled={isActing} className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700 disabled:opacity-50">
                {isActing ? 'Archiving...' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Modal */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-3">Restore Survey</h3>
            <p className="text-sm text-gray-600 mb-4">Restore with a new subdomain (original may be taken).</p>
            <div className="mb-4">
              <input type="text" value={restoreSubdomain} onChange={(e) => setRestoreSubdomain(e.target.value)} placeholder="new-subdomain" className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowRestoreConfirm(false); setError(null); }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={() => void handleRestore()} disabled={isActing} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
                {isActing ? 'Restoring...' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
