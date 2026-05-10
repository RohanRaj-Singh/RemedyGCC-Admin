'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CopyPlus,
  Languages,
  ListTree,
  Save,
  Sparkles,
} from 'lucide-react';
import { AttributeTemplate } from '../../attribute-template/types';
import {
  createNewVersion,
  createScanner,
  getTemplateById,
  publishScanner,
  saveScannerDraft,
} from '../service';
import { ScannerDetail, ScannerStatus } from '../types';
import { createDefaultCategories, emptyText } from '../utils/builder';
import { FIXED_CATEGORIES } from '../constants/categories';
import { getCategoryMetrics, getScannerCounts, getSubdomainMetrics, sumWeights } from '../utils/metrics';
import { validateScannerDraft } from '../utils/validation';
import { StructureBuilder } from './StructureBuilder';
import { ContentBuilder } from './ContentBuilder';
import { WeightBuilder } from './WeightBuilder';
import { FloatingIssueButton } from './FloatingIssueButton';
import { StepNavigation } from './StepNavigation';
import { StickyHeader } from './StickyHeader';
import { TemplatePreview } from './TemplatePreview';
import { TemplateSelector } from './TemplateSelector';

interface ScannerFormProps {
  scanner?: ScannerDetail | null;
}

const steps = [
  {
    title: 'Basic Info',
    description: 'Name the scanner, describe the methodology, and attach the attribute template.',
  },
  {
    title: 'Structure',
    description: 'Build the subdomain hierarchy for the 5 fixed categories.',
  },
  {
    title: 'Content',
    description: 'Add multiple-choice questions to each subdomain.',
  },
  {
    title: 'Weights',
    description: 'Assign weights at the category, subdomain, and question levels.',
  },
  {
    title: 'Review & Publish',
    description: 'Check the full hierarchy, resolve blocking issues, and publish the version.',
  },
] as const;

export function ScannerForm({ scanner }: ScannerFormProps) {
  const router = useRouter();
  const [scannerId, setScannerId] = useState<string | null>(scanner?.id ?? null);
  const [status, setStatus] = useState<ScannerStatus>(scanner?.status ?? 'draft');
  const [name, setName] = useState(scanner?.name ?? emptyText());
  const [description, setDescription] = useState(scanner?.description ?? emptyText());
  const [attributeTemplateId, setAttributeTemplateId] = useState(
    scanner?.draftVersion?.attributeTemplateId
      ?? scanner?.publishedVersion?.attributeTemplateId
      ?? ''
  );
  const [categories, setCategories] = useState(() => {
    let initial = scanner?.draftVersion?.categories ?? scanner?.publishedVersion?.categories;
    if (!initial || initial.length !== 5) {
      initial = createDefaultCategories();
    } else {
      initial = initial.map((cat, i) => ({
        ...cat,
        name: { en: FIXED_CATEGORIES[i], ar: FIXED_CATEGORIES[i] }
      }));
    }
    return initial;
  });
  const [versions, setVersions] = useState(scanner?.versions ?? []);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(categories[0]?.id);
  const [selectedSubdomainId, setSelectedSubdomainId] = useState<string | undefined>(categories[0]?.subdomains[0]?.id);
  const [template, setTemplate] = useState<AttributeTemplate | null>(
    scanner?.draftVersion?.attributeTemplateSnapshot
      ?? scanner?.publishedVersion?.attributeTemplateSnapshot
      ?? null
  );
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDraftVersion = versions.some((version) => version.status === 'draft') || !scannerId;
  const hasResponses = versions.some((version) => version.responseCount > 0);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const selectedSubdomain = selectedCategory?.subdomains.find(
    (subdomain) => subdomain.id === selectedSubdomainId
  );
  const validation = validateScannerDraft(
    {
      name,
      description,
      attributeTemplateId,
      categories,
    },
    template
  );
  const blockingIssues = validation.issues.filter((issue) => issue.blocking);
  const counts = getScannerCounts(categories);
  const scannerWeight = sumWeights(categories);

  useEffect(() => {
    async function loadTemplate() {
      if (!attributeTemplateId) {
        setTemplate(null);
        return;
      }

      const result = await getTemplateById(attributeTemplateId);
      setTemplate(result);
    }

    void loadTemplate();
  }, [attributeTemplateId]);

  useEffect(() => {
    if (!selectedCategoryId || !categories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(categories[0]?.id);
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    const currentCategory = categories.find((category) => category.id === selectedCategoryId);
    if (!currentCategory) {
      setSelectedSubdomainId(undefined);
      return;
    }

    if (
      !selectedSubdomainId
      || !currentCategory.subdomains.some((subdomain) => subdomain.id === selectedSubdomainId)
    ) {
      setSelectedSubdomainId(currentCategory.subdomains[0]?.id);
    }
  }, [categories, selectedCategoryId, selectedSubdomainId]);

  function applyScannerDetail(detail: ScannerDetail) {
    setScannerId(detail.id);
    setStatus(detail.status);
    setName(detail.name);
    setDescription(detail.description ?? emptyText());
    setAttributeTemplateId(
      detail.draftVersion?.attributeTemplateId
        ?? detail.publishedVersion?.attributeTemplateId
        ?? ''
    );
    let nextCategories = detail.draftVersion?.categories ?? detail.publishedVersion?.categories;
    if (!nextCategories || nextCategories.length !== 5) {
      nextCategories = createDefaultCategories();
    } else {
      nextCategories = nextCategories.map((cat, i) => ({
        ...cat,
        name: { en: FIXED_CATEGORIES[i], ar: FIXED_CATEGORIES[i] }
      }));
    }
    setCategories(nextCategories);
    setVersions(detail.versions);
    setTemplate(
      detail.draftVersion?.attributeTemplateSnapshot
        ?? detail.publishedVersion?.attributeTemplateSnapshot
        ?? null
    );
  }

  async function persistDraft() {
    let nextScannerId = scannerId;

    if (!nextScannerId) {
      const created = await createScanner({
        name,
        description,
        attributeTemplateId,
      });
      nextScannerId = created.id;
      setScannerId(created.id);
    }

    const saved = await saveScannerDraft(nextScannerId, {
      name,
      description,
      attributeTemplateId,
      categories,
    });

    applyScannerDetail(saved);
    return saved;
  }

  async function handleSaveDraft() {
    setSaving(true);
    setError(null);

    try {
      const detail = await persistDraft();
      if (!scanner) {
        router.replace(`/scanners/${detail.id}/edit`);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save draft.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setSaving(true);
    setError(null);

    try {
      const saved = await persistDraft();
      const published = await publishScanner(saved.id);
      applyScannerDetail(published);
      setStatus(published.status);
      if (!scanner) {
        router.replace(`/scanners/${published.id}/edit`);
      }
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : 'Failed to publish scanner.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateNewVersion() {
    if (!scannerId) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const detail = await createNewVersion(scannerId);
      applyScannerDetail(detail);
    } catch (versionError) {
      setError(
        versionError instanceof Error
          ? versionError.message
          : 'Failed to create a new version.'
      );
    } finally {
      setSaving(false);
    }
  }

  function updateCategory(updatedCategory: typeof categories[number]) {
    setCategories(
      categories.map((category) =>
        category.id === updatedCategory.id ? updatedCategory : category
      )
    );
  }

  function updateSelectedSubdomain(updatedSubdomain: NonNullable<typeof selectedSubdomain>) {
    if (!selectedCategory) {
      return;
    }

    updateCategory({
      ...selectedCategory,
      subdomains: selectedCategory.subdomains.map((subdomain) =>
        subdomain.id === updatedSubdomain.id ? updatedSubdomain : subdomain
      ),
    });
  }

  function handleSelectSubdomain(subdomainId: string) {
    const category = categories.find(c => c.subdomains.some(s => s.id === subdomainId));
    if (category && category.id !== selectedCategoryId) {
      setSelectedCategoryId(category.id);
    }
    setSelectedSubdomainId(subdomainId);
  }

  function goToPreviousStep() {
    setActiveStep((current) => Math.max(0, current - 1));
  }

  const canProceed = () => {
    if (activeStep === 1) {
      return categories.every(cat => cat.subdomains.length > 0);
    }
    if (activeStep === 2) {
      return categories.every(cat => cat.subdomains.every(sub => sub.questions.length > 0));
    }
    if (activeStep === 3) {
      if (scannerWeight !== 100) return false;
      return categories.every(cat => {
        const catMetrics = getCategoryMetrics(cat);
        if (catMetrics.subdomainWeightTotal !== cat.weight) return false;
        return cat.subdomains.every(sub => {
          const subMetrics = getSubdomainMetrics(sub);
          return subMetrics.questionWeightTotal === sub.weight;
        });
      });
    }
    return true;
  };

  function goToNextStep() {
    if (!canProceed()) return;
    setActiveStep((current) => Math.min(steps.length - 1, current + 1));
  }

  return (
    <div className="relative min-h-screen bg-gray-50/50 pb-32">
      <StickyHeader 
        activeStep={activeStep} 
        steps={steps as unknown as { title: string; description: string }[]} 
        categories={categories} 
        validation={validation} 
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!hasDraftVersion && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span>{hasResponses ? 'Editing will create a new version. Structural edits must happen in a new draft.' : 'This published version is locked. Create a new draft to make edits.'}</span>
            <button
              type="button"
              onClick={handleCreateNewVersion}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-blue-700 shadow-sm transition hover:text-blue-900 disabled:opacity-50"
            >
              <CopyPlus className="h-4 w-4" />
              Create New Version
            </button>
          </div>
        )}

        {hasDraftVersion && hasResponses && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Editing draft. Published response history remains preserved in older versions.
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <StepNavigation
            steps={steps.map((step) => ({ title: step.title, description: step.description }))}
            activeStep={activeStep}
            canProceed={canProceed()}
            onStepChange={(stepIndex) => {
              if (stepIndex > activeStep && !canProceed()) return;
              setActiveStep(stepIndex);
            }}
            onPrevious={goToPreviousStep}
            onNext={goToNextStep}
          />

          <div className="p-6 sm:p-8">
            {activeStep === 0 && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                      <Languages className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Scanner basics</h3>
                      <p className="mt-1 text-sm text-gray-600">
                        Provide the name and description in both languages.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Name in English</label>
                        <input
                          value={name.en}
                          disabled={!hasDraftVersion || saving}
                          onChange={(e) => setName({ ...name, en: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                          placeholder="Scanner name"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Description in English</label>
                        <textarea
                          rows={4}
                          value={description.en}
                          disabled={!hasDraftVersion || saving}
                          onChange={(e) => setDescription({ ...description, en: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Name in Arabic</label>
                        <input
                          value={name.ar}
                          dir="rtl"
                          disabled={!hasDraftVersion || saving}
                          onChange={(e) => setName({ ...name, ar: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Description in Arabic</label>
                        <textarea
                          rows={4}
                          dir="rtl"
                          value={description.ar}
                          disabled={!hasDraftVersion || saving}
                          onChange={(e) => setDescription({ ...description, ar: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-gray-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="rounded-2xl bg-purple-50 p-3 text-purple-600">
                      <ListTree className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Attribute template</h3>
                      <p className="mt-1 text-sm text-gray-600">Choose the strict assignment hierarchy for this version.</p>
                    </div>
                  </div>
                  <div className="grid gap-6 md:grid-cols-[300px_minmax(0,1fr)]">
                    <TemplateSelector
                      selectedTemplateId={attributeTemplateId}
                      disabled={!hasDraftVersion || saving}
                      onSelect={setAttributeTemplateId}
                    />
                    <TemplatePreview templateId={attributeTemplateId} />
                  </div>
                </div>
              </div>
            )}

            {activeStep === 1 && (
              <StructureBuilder
                categories={categories}
                disabled={!hasDraftVersion || saving}
                onCategoryChange={updateCategory}
              />
            )}

            {activeStep === 2 && (
              <ContentBuilder
                categories={categories}
                selectedSubdomainId={selectedSubdomainId}
                disabled={!hasDraftVersion || saving}
                onSelectSubdomain={handleSelectSubdomain}
                onCategoryChange={updateCategory}
              />
            )}

            {activeStep === 3 && (
              <WeightBuilder
                categories={categories}
                disabled={!hasDraftVersion || saving}
                onCategoryChange={updateCategory}
              />
            )}

            {activeStep === 4 && (
              <div className="space-y-6 max-w-4xl mx-auto">
                <div className="text-center space-y-2 mb-8">
                  <h3 className="text-2xl font-bold text-gray-900">Final Review</h3>
                  <p className="text-gray-600">Ensure everything is correctly weighted before publishing.</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                    <div className="text-2xl font-bold text-gray-900">{counts.categoryCount}</div>
                    <div className="text-xs uppercase tracking-wider font-semibold text-gray-500 mt-1">Categories</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                    <div className="text-2xl font-bold text-gray-900">{counts.subdomainCount}</div>
                    <div className="text-xs uppercase tracking-wider font-semibold text-gray-500 mt-1">Subdomains</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                    <div className="text-2xl font-bold text-gray-900">{counts.questionCount}</div>
                    <div className="text-xs uppercase tracking-wider font-semibold text-gray-500 mt-1">Questions</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                    <div className={`text-2xl font-bold ${scannerWeight === 100 ? 'text-emerald-600' : 'text-rose-600'}`}>{scannerWeight}%</div>
                    <div className="text-xs uppercase tracking-wider font-semibold text-gray-500 mt-1">Total Weight</div>
                  </div>
                </div>

                <div className="mt-8">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Structure & Weights</h4>
                  <div className="space-y-4">
                    {categories.map((category) => (
                      <div key={category.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                        <div className="bg-gray-50 p-4 flex justify-between items-center border-b border-gray-100">
                          <span className="font-semibold text-gray-900">{category.name.en || `Category ${category.slot}`}</span>
                          <span className={`font-semibold ${category.weight > 0 ? 'text-gray-900' : 'text-rose-600'}`}>{category.weight}%</span>
                        </div>
                        <div className="p-4 space-y-4">
                          {category.subdomains.map((subdomain, sIndex) => {
                            const subMetrics = getSubdomainMetrics(subdomain);
                            const isSubBalanced = subMetrics.balance.isExact;
                            return (
                              <div key={subdomain.id} className="pl-4 border-l-2 border-gray-200 space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="font-medium text-gray-700 text-sm">Subdomain: {subdomain.name.en || `Subdomain ${sIndex + 1}`}</span>
                                  <span className={`text-sm font-medium ${isSubBalanced ? 'text-gray-700' : 'text-rose-600'}`}>{subdomain.weight}%</span>
                                </div>
                                <div className="space-y-2 pl-4 border-l border-gray-100">
                                  {subdomain.questions.map((q, qIndex) => (
                                    <div key={q.id} className="flex justify-between items-center text-sm">
                                      <span className="text-gray-600 truncate mr-4">Q{qIndex + 1}: {q.text.en || 'Untitled'}</span>
                                      <span className={`text-gray-500 font-medium whitespace-nowrap ${(q.weight ?? 0) === 0 ? 'text-rose-500' : ''}`}>{q.weight || 0}%</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => router.push('/scanners')}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Exit Builder
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={!hasDraftVersion || saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Draft'}
              </button>

              <button
                type="button"
                onClick={handlePublish}
                disabled={!hasDraftVersion || saving || !validation.isValid}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {saving ? 'Publishing...' : 'Publish Version'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <FloatingIssueButton issues={validation.issues} />
    </div>
  );
}
