'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Globe,
  Layout,
  Loader2,
  Palette,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import type { BrandingConfig, TenantSetupOption } from '@/modules/tenant/types';
import { getAllTemplates } from '@/modules/attribute-template/service';
import { getScanners } from '@/modules/scanner/service';
import { tenantService } from '@/services/tenant-service';
import { BrandingPanel, BrandingPreviewCard } from '@/components/tenants';

interface Step {
  id: number;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  { id: 1, title: 'Basic Info', description: 'Name and address for your survey' },
  { id: 2, title: 'Survey Setup', description: 'Choose scanner and template' },
  { id: 3, title: 'Branding', description: 'Customize the look and feel' },
  { id: 4, title: 'Review', description: 'Confirm your settings' },
];

// Reserved subdomains that cannot be used
const RESERVED_SUBDOMAINS = new Set([
  'admin', 'api', 'www', 'app', 'dashboard', 'root', 'system', 'support',
  'mail', 'auth', 'login', 'signup', 'register', 'about', 'contact',
  'help', 'docs', 'documentation', 'blog', 'status', 'staging', 'test',
  'demo', 'dev', 'development', 'prod', 'production', 'static', 'assets',
]);

// Normalize subdomain: lowercase, hyphens, no special chars
function normalizeSubdomain(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// Validate subdomain format
function isValidSubdomain(value: string): boolean {
  const normalized = normalizeSubdomain(value);
  return normalized.length >= 3 && normalized.length <= 63 && /^[a-z09][a-z0-9-]*[a-z0-9]$/.test(normalized);
}

// Check if subdomain is reserved
function isReservedSubdomain(value: string): boolean {
  return RESERVED_SUBDOMAINS.has(normalizeSubdomain(value));
}

export default function NewTenantPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [subdomainManualEdit, setSubdomainManualEdit] = useState(false);
  const [subdomainStatus, setSubdomainStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'reserved'>('idle');
  const [draftScannerId, setDraftScannerId] = useState<string | null>(null);
  const [draftAttributeTemplateId, setDraftAttributeTemplateId] = useState<string | null>(null);
  const [branding, setBranding] = useState<Partial<BrandingConfig>>({});

  const [scannerOptions, setScannerOptions] = useState<TenantSetupOption[]>([]);
  const [attributeTemplateOptions, setAttributeTemplateOptions] = useState<TenantSetupOption[]>([]);

  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load scanner and template options
  useEffect(() => {
    let isMounted = true;
    async function loadOptions() {
      try {
        const [scanners, templates] = await Promise.all([getScanners(), getAllTemplates()]);
        if (!isMounted) return;
        setScannerOptions(scanners.map(s => ({ id: s.id, label: s.name.en || s.id, description: s.description?.en })));
        setAttributeTemplateOptions(templates.map(t => ({ id: t.id, label: t.name, description: t.description })));
      } catch (e) {
        if (isMounted) setError('Failed to load options.');
      } finally {
        if (isMounted) setIsLoadingOptions(false);
      }
    }
    void loadOptions();
    return () => { isMounted = false; };
  }, []);

  // Auto-generate subdomain from name (only if not manually edited)
  useEffect(() => {
    if (name && !subdomainManualEdit) {
      const generated = normalizeSubdomain(name);
      if (generated !== subdomain) {
        setSubdomain(generated);
        // Reset validation when auto-generating
        if (generated.length >= 3) {
          validateSubdomain(generated);
        }
      }
    }
  }, [name, subdomainManualEdit]);

  // Validate subdomain availability
  const validateSubdomain = useCallback(async (value: string) => {
    const normalized = normalizeSubdomain(value);

    // Check format
    if (!isValidSubdomain(normalized)) {
      setSubdomainStatus('invalid');
      return;
    }

    // Check reserved
    if (isReservedSubdomain(normalized)) {
      setSubdomainStatus('reserved');
      return;
    }

    // Check availability
    setSubdomainStatus('checking');
    try {
      const { data, error: checkError } = await tenantService.checkSubdomainAvailability(normalized);
      if (checkError) {
        setSubdomainStatus('idle');
        return;
      }
      setSubdomainStatus(data?.available ? 'available' : 'taken');
    } catch {
      setSubdomainStatus('idle');
    }
  }, []);

  // Debounced subdomain validation
  const handleSubdomainChange = useCallback((value: string) => {
    const normalized = normalizeSubdomain(value);
    setSubdomain(normalized);
    setSubdomainManualEdit(true);

    // Clear previous timeout
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    // Debounce validation
    if (normalized.length >= 3) {
      checkTimeoutRef.current = setTimeout(() => {
        validateSubdomain(normalized);
      }, 500);
    } else {
      setSubdomainStatus('idle');
    }
  }, [validateSubdomain]);

  const canProceed = () => {
    if (currentStep === 1) {
      return name.trim().length > 0 && subdomain.trim().length >= 3 && subdomainStatus !== 'taken' && subdomainStatus !== 'reserved' && subdomainStatus !== 'invalid';
    }
    if (currentStep === 2) return draftScannerId !== null && draftAttributeTemplateId !== null;
    return true;
  };

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleCreate = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const slug = normalizeSubdomain(subdomain);
      const { data: tenant, error: createError } = await tenantService.create({
        name: name.trim(),
        slug,
        subdomain: slug,
        status: 'draft',
        draftScannerId,
        draftAttributeTemplateId,
        branding,
      });
      if (createError || !tenant) throw new Error(createError || 'Failed to create.');
      router.push(`/tenants/${tenant.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tenant');
    } finally {
      setIsLoading(false);
    }
  };

  // Subdomain status UI
  const getSubdomainStatusUI = () => {
    if (subdomainStatus === 'idle' || subdomain.length < 3) return null;

    const statusConfig = {
      checking: { icon: Loader2, class: 'text-blue-600', message: 'Checking availability...' },
      available: { icon: Check, class: 'text-green-600', message: 'This subdomain is available.' },
      taken: { icon: XCircle, class: 'text-red-600', message: 'This subdomain is already in use. Choose another.' },
      invalid: { icon: AlertCircle, class: 'text-amber-600', message: 'Subdomains may only contain lowercase letters, numbers, and hyphens.' },
      reserved: { icon: XCircle, class: 'text-red-600', message: 'This subdomain is reserved and cannot be used.' },
    };

    const config = statusConfig[subdomainStatus];
    const Icon = config.icon;

    return (
      <div className={`flex items-center gap-2 mt-2 text-sm ${config.class}`}>
        <Icon className={`h-4 w-4 ${subdomainStatus === 'checking' ? 'animate-spin' : ''}`} />
        <span>{config.message}</span>
      </div>
    );
  };

  if (isLoadingOptions) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/tenants" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />Back to Tenants
        </Link>
        <h1 className="text-2xl font-bold">Create New Survey</h1>
        <p className="text-muted-foreground mt-1">Set up a new survey workspace for collecting responses.</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-between mb-10 px-4">
        {STEPS.map((step, idx) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                  step.id < currentStep
                    ? 'bg-green-500 text-white'
                    : step.id === currentStep
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {step.id < currentStep ? <CheckCircle2 className="w-5 h-5" /> : step.id}
              </div>
              <span className={`text-xs mt-2 font-medium ${step.id <= currentStep ? 'text-foreground' : 'text-gray-400'}`}>
                {step.title}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`w-16 h-0.5 mx-2 ${step.id < currentStep ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg p-4 text-sm font-medium" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          {error}
        </div>
      )}

      {/* Step Content */}
      <div className="rounded-2xl border p-8" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Basic Information</h2>
                <p className="text-sm text-muted-foreground">Give your survey a name and address</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Survey Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Health Solutions"
                className="w-full px-4 py-3 rounded-xl border text-lg"
                style={{ borderColor: 'var(--border)' }}
              />
              <p className="text-xs text-muted-foreground mt-2">This is for your reference - respondents won't see it.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Survey Address</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={subdomain}
                    onChange={(e) => handleSubdomainChange(e.target.value)}
                    placeholder="acme-health-solutions"
                    className="w-full px-4 py-3 rounded-xl border text-lg pr-10"
                    style={{ borderColor: subdomainStatus === 'taken' || subdomainStatus === 'reserved' || subdomainStatus === 'invalid' ? '#dc2626' : 'var(--border)' }}
                  />
                  {subdomainStatus === 'available' && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-600" />
                  )}
                </div>
                <span className="text-muted-foreground text-sm whitespace-nowrap">.remedygcc.com</span>
              </div>
              {getSubdomainStatusUI()}
              <p className="text-xs text-muted-foreground mt-2">
                {subdomainManualEdit
                  ? 'Edit the address as needed. It will be locked after going live.'
                  : 'Address is auto-generated from your survey name. Edit it if needed.'}
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Survey Setup */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                <Layout className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Survey Setup</h2>
                <p className="text-sm text-muted-foreground">Choose the structure for your survey</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Survey Scanner</label>
              <p className="text-xs text-muted-foreground mb-3">Choose the questions and assessment structure for this survey.</p>
              <select
                value={draftScannerId || ''}
                onChange={(e) => setDraftScannerId(e.target.value || null)}
                className="w-full px-4 py-3 rounded-xl border"
                style={{ borderColor: 'var(--border)' }}
              >
                <option value="">Select a scanner...</option>
                {scannerOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}{opt.description ? ` - ${opt.description}` : ''}</option>
                ))}
              </select>
              {scannerOptions.length === 0 && (
                <p className="text-sm mt-2" style={{ color: '#b45309' }}>No scanners available. Create one in the Scanner section first.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Response Template</label>
              <p className="text-xs text-muted-foreground mb-3">Choose how responses will be structured and attributed.</p>
              <select
                value={draftAttributeTemplateId || ''}
                onChange={(e) => setDraftAttributeTemplateId(e.target.value || null)}
                className="w-full px-4 py-3 rounded-xl border"
                style={{ borderColor: 'var(--border)' }}
              >
                <option value="">Select a template...</option>
                {attributeTemplateOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}{opt.description ? ` - ${opt.description}` : ''}</option>
                ))}
              </select>
              {attributeTemplateOptions.length === 0 && (
                <p className="text-sm mt-2" style={{ color: '#b45309' }}>No templates available. Create one in the Attribute Templates section first.</p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Branding - Fully Interactive */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)' }}>
                <Palette className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Survey Branding</h2>
                <p className="text-sm text-muted-foreground">Customize how your survey looks to respondents</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              {/* Interactive Branding Panel */}
              <div>
                <BrandingPanel
                  branding={branding}
                  onChange={setBranding}
                  title="Customize Appearance"
                  showPreviewSection={false}
                />
              </div>

              {/* Live Preview */}
              <div>
                <BrandingPreviewCard
                  branding={branding}
                  title="Live Preview"
                  description="This is how your survey will appear to respondents. Changes update instantly."
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)' }}>
                <Sparkles className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Review & Create</h2>
                <p className="text-sm text-muted-foreground">Confirm your settings before creating</p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Globe className="h-4 w-4" />Survey Address</div>
                <div className="text-lg font-semibold">{subdomain}.remedygcc.com</div>
              </div>
              <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Users className="h-4 w-4" />Scanner</div>
                <div className="text-lg font-semibold">{scannerOptions.find(s => s.id === draftScannerId)?.label || 'Not selected'}</div>
              </div>
              <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Layout className="h-4 w-4" />Template</div>
                <div className="text-lg font-semibold">{attributeTemplateOptions.find(t => t.id === draftAttributeTemplateId)?.label || 'Not selected'}</div>
              </div>
              {(branding?.appName || branding?.primaryColor) && (
                <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Palette className="h-4 w-4" />Branding</div>
                  <div className="text-lg font-semibold">{branding.appName || 'Default theme'}</div>
                  {branding.primaryColor && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: branding.primaryColor }} />
                      <span className="text-sm text-muted-foreground">{branding.primaryColor}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={currentStep === 1 ? () => router.push('/tenants') : handleBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium"
          style={{ border: '1px solid var(--border)' }}
        >
          <ArrowLeft className="h-4 w-4" />{currentStep === 1 ? 'Cancel' : 'Back'}
        </button>

        {currentStep < 4 ? (
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all disabled:opacity-40"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            Create Survey
          </button>
        )}
      </div>
    </div>
  );
}