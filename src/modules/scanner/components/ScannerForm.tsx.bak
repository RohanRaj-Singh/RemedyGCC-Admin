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
import { getCategoryMetrics, getScannerCounts, getSubdomainMetrics, sumWeights } from '../utils/metrics';
import { validateScannerDraft } from '../utils/validation';
import { CategoryBuilder } from './CategoryBuilder';
import { CategoryCard } from './CategoryCard';
import { QuestionBuilder } from './QuestionBuilder';
import { StepNavigation } from './StepNavigation';
import { SubdomainBuilder } from './SubdomainBuilder';
import { TemplatePreview } from './TemplatePreview';
import { TemplateSelector } from './TemplateSelector';
import { ValidationBanner } from './ValidationBanner';
import { VersionHistory } from './VersionHistory';
import { WeightSummaryPanel } from './WeightSummaryPanel';

interface ScannerFormProps {
  scanner?: ScannerDetail | null;
}

const steps = [
  {
    title: 'Basic Info',
    description: 'Name the scanner, describe the methodology, and attach the attribute template.',
  },
  {
    title: 'Categories',
    description: 'Configure the five fixed categories with weights and polarity.',
  },
  {
    title: 'Subdomains',
    description: 'Open one category at a time and divide its weight across subdomains.',
  },
  {
    title: 'Questions',
    description: 'Add weighted multiple-choice questions and optional follow-up triggers.',
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
  const [categories, setCategories] = useState(
    scanner?.draftVersion?.categories
      ?? scanner?.publishedVersion?.categories
      ?? createDefaultCategories()
  );
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
    setCategories(
      detail.draftVersion?.categories
        ?? detail.publishedVersion?.categories
        ?? createDefaultCategories()
    );
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

  function goToPreviousStep() {
    setActiveStep((current) => Math.max(0, current - 1));
  }

  function goToNextStep() {
    setActiveStep((current) => Math.min(steps.length - 1, current + 1));
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-[1.75rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!hasDraftVersion && (
        <div className="rounded-[1.75rem] border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-blue-900">
                {hasResponses ? 'Editing will create a new version' : 'This published version is locked'}
              </div>
              <p className="mt-1 text-sm text-blue-700">
                {hasResponses
                  ? 'Responses already exist for the published version, so structural edits must happen in a new draft.'
                  : 'Published versions stay immutable. Create a new draft version to make structural changes.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreateNewVersion}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-sm transition hover:text-blue-900 disabled:opacity-50"
            >
              <CopyPlus className="h-4 w-4" />
              Create New Version
            </button>
          </div>
        </div>
      )}

      {hasDraftVersion && hasResponses && (
        <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You are editing a draft while published response history remains preserved in older versions.
        </div>
      )}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-gray-200 bg-[linear-gradient(135deg,rgba(239,248,244,1)_0%,rgba(255,255,255,1)_50%,rgba(248,250,252,1)_100%)] p-6 shadow-sm">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                  <span>Scanner Builder</span>
                  <span className="text-gray-300">/</span>
                  <span className="text-primary">
                    {status === 'published' ? 'Published methodology' : 'Draft methodology'}
                  </span>
                </div>
                <h1 className="mt-3 text-3xl font-semibold text-gray-900">
                  Guided assessment builder
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-gray-600">
                  Move through the hierarchy in order: scanner details, five categories,
                  category subdomains, and weighted questions. Every screen keeps the
                  publish rules visible so non-technical admins always know what is left.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[320px] xl:grid-cols-2">
                <div className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                    Status
                  </div>
                  <div className="mt-2 text-lg font-semibold text-gray-900">{status}</div>
                </div>
                <div className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                    Categories
                  </div>
                  <div className="mt-2 text-lg font-semibold text-gray-900">{counts.categoryCount}</div>
                </div>
                <div className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                    Subdomains
                  </div>
                  <div className="mt-2 text-lg font-semibold text-gray-900">{counts.subdomainCount}</div>
                </div>
                <div className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                    Questions
                  </div>
                  <div className="mt-2 text-lg font-semibold text-gray-900">{counts.questionCount}</div>
                </div>
              </div>
            </div>
          </div>

          <StepNavigation
            steps={steps.map((step) => ({ title: step.title, description: step.description }))}
            activeStep={activeStep}
            onStepChange={setActiveStep}
            onPrevious={goToPreviousStep}
            onNext={goToNextStep}
          />

          <ValidationBanner issues={validation.issues} />

          {activeStep === 0 && (
            <div className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-6">
                  <div className="rounded-[1.75rem] border border-gray-200 bg-gray-50 p-5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                        <Languages className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">Scanner basics</h3>
                        <p className="mt-1 text-sm text-gray-600">
                          Start with the name and description in both languages. This information
                          appears before any tenant assignment or assessment delivery.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-2">
                      <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                          Name in English
                        </label>
                        <input
                          value={name.en}
                          disabled={!hasDraftVersion || saving}
                          onChange={(event) => setName({ ...name, en: event.target.value })}
                          className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
                          placeholder="Scanner name in English"
                        />

                        <label className="mb-2 mt-4 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                          Description in English
                        </label>
                        <textarea
                          rows={5}
                          value={description.en}
                          disabled={!hasDraftVersion || saving}
                          onChange={(event) =>
                            setDescription({ ...description, en: event.target.value })
                          }
                          className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
                          placeholder="Describe what this scanner assesses"
                        />
                      </div>

                      <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                          Name in Arabic
                        </label>
                        <input
                          value={name.ar}
                          dir="rtl"
                          disabled={!hasDraftVersion || saving}
                          onChange={(event) => setName({ ...name, ar: event.target.value })}
                          className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
                          placeholder="Name in Arabic"
                        />

                        <label className="mb-2 mt-4 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                          Description in Arabic
                        </label>
                        <textarea
                          rows={5}
                          dir="rtl"
                          value={description.ar}
                          disabled={!hasDraftVersion || saving}
                          onChange={(event) =>
                            setDescription({ ...description, ar: event.target.value })
                          }
                          className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
                          placeholder="Description in Arabic"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border border-gray-200 bg-gray-50 p-5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                        <ListTree className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">Attribute template</h3>
                        <p className="mt-1 text-sm text-gray-600">
                          Choose the template that defines the strict assignment hierarchy for
                          this scanner version.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
                      <TemplateSelector
                        selectedTemplateId={attributeTemplateId}
                        disabled={!hasDraftVersion || saving}
                        onSelect={setAttributeTemplateId}
                      />
                      <TemplatePreview templateId={attributeTemplateId} />
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-gray-200 bg-gray-50 p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                    What happens next
                  </div>
                  <div className="mt-3 text-lg font-semibold text-gray-900">
                    Set the five scoring pillars
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    After the basic information is complete, move to categories and assign the
                    first layer of weights and polarity.
                  </p>

                  <div className="mt-5 space-y-3">
                    {steps.slice(1).map((step, index) => (
                      <div
                        key={step.title}
                        className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm"
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                          Step {index + 2}
                        </div>
                        <div className="mt-1 font-medium text-gray-900">{step.title}</div>
                        <div className="mt-1 text-sm text-gray-500">{step.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeStep === 1 && (
            <div className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Five category cards</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    This step keeps the top level flat and easy to compare. Use these cards to
                    decide how much of the scanner belongs to each category.
                  </p>
                </div>
              </div>

              <CategoryBuilder
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                disabled={!hasDraftVersion || saving}
                onSelectCategory={setSelectedCategoryId}
                onCategoryChange={updateCategory}
              />
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-6">
              <div className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                      Choose a category
                    </div>
                    <h3 className="mt-2 text-xl font-semibold text-gray-900">Open one category at a time</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Pick a category below to reveal its subdomains and keep the hierarchy visually focused.
                    </p>
                  </div>
                  {selectedCategory && (
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                      {selectedCategory.name.en || `Category ${selectedCategory.slot}`} selected
                    </div>
                  )}
                </div>

                <div className="mt-5 overflow-x-auto pb-2">
                  <div className="grid min-w-[920px] grid-flow-col auto-cols-[minmax(220px,1fr)] gap-3">
                    {categories.map((category) => (
                      <CategoryCard
                        key={category.id}
                        category={category}
                        variant="selector"
                        selected={category.id === selectedCategoryId}
                        onSelect={setSelectedCategoryId}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm">
                <SubdomainBuilder
                  category={selectedCategory}
                  selectedSubdomainId={selectedSubdomainId}
                  disabled={!hasDraftVersion || saving}
                  onSelectSubdomain={setSelectedSubdomainId}
                  onCategoryChange={updateCategory}
                  onAdvanceToQuestions={() => setActiveStep(3)}
                />
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="space-y-6">
              <div className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                      Question workspace
                    </div>
                    <h3 className="mt-2 text-xl font-semibold text-gray-900">
                      Focus on one subdomain at a time
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Questions stay visually nested inside their subdomain, with option editing
                      inline and follow-up logic kept close to the question itself.
                    </p>
                  </div>
                  {selectedCategory && (
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                      {selectedCategory.name.en || `Category ${selectedCategory.slot}`}
                    </div>
                  )}
                </div>

                <div className="mt-5 overflow-x-auto pb-2">
                  <div className="grid min-w-[920px] grid-flow-col auto-cols-[minmax(220px,1fr)] gap-3">
                    {categories.map((category) => (
                      <CategoryCard
                        key={category.id}
                        category={category}
                        variant="selector"
                        selected={category.id === selectedCategoryId}
                        onSelect={setSelectedCategoryId}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm">
                <QuestionBuilder
                  category={selectedCategory}
                  subdomain={selectedSubdomain}
                  selectedSubdomainId={selectedSubdomainId}
                  disabled={!hasDraftVersion || saving}
                  onSelectSubdomain={setSelectedSubdomainId}
                  onSubdomainChange={updateSelectedSubdomain}
                />
              </div>
            </div>
          )}

          {activeStep === 4 && (
            <div className="space-y-6">
              <div className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                      Final review
                    </div>
                    <h3 className="mt-2 text-xl font-semibold text-gray-900">Hierarchy and publish status</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Review every level before publishing. The publish button stays disabled
                      until all blocking rules pass.
                    </p>
                  </div>

                  <div
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                      validation.isValid
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {validation.isValid ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    <span>{validation.isValid ? 'Ready to publish' : 'Publish blocked'}</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                      Categories
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-gray-900">{counts.categoryCount}</div>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                      Subdomains
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-gray-900">{counts.subdomainCount}</div>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                      Questions
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-gray-900">{counts.questionCount}</div>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                      Scanner weight
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-gray-900">{scannerWeight} / 100%</div>
                  </div>
                </div>

                <div className="mt-5 rounded-[1.75rem] border border-gray-200 bg-gray-50 p-5">
                  <div className="text-sm font-semibold text-gray-900">Blocking issues</div>
                  {blockingIssues.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      All hierarchy, weight, and template checks are passing.
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      {blockingIssues.map((issue) => (
                        <div
                          key={`${issue.code}-${issue.path}-${issue.entityId ?? 'root'}`}
                          className="rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm"
                        >
                          <div className="font-medium text-gray-900">{issue.message}</div>
                          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                            {issue.level.replace('-', ' ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm">
                <div className="space-y-5">
                  {categories.map((category) => {
                    const categoryMetrics = getCategoryMetrics(category);

                    return (
                      <div
                        key={category.id}
                        className="rounded-[1.75rem] border border-gray-200 bg-gray-50 p-5"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                              Category {category.slot}
                            </div>
                            <div className="mt-2 text-lg font-semibold text-gray-900">
                              {category.name.en || `Category ${category.slot}`}
                            </div>
                            <div className="mt-1 text-sm text-gray-500">
                              {category.name.ar || 'Arabic name pending'}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <div className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm">
                              {category.weight}% weight
                            </div>
                            <div
                              className={`rounded-full px-3 py-2 text-xs font-semibold ${
                                category.polarity === 'negative'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {category.polarity}
                            </div>
                            <div
                              className={`rounded-full px-3 py-2 text-xs font-semibold ${
                                categoryMetrics.balance.isExact
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : categoryMetrics.balance.overflow > 0
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {categoryMetrics.subdomainWeightTotal} / {category.weight}%
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                          <div
                            className={`h-full rounded-full ${
                              categoryMetrics.balance.isExact
                                ? 'bg-emerald-500'
                                : categoryMetrics.balance.overflow > 0
                                  ? 'bg-rose-500'
                                  : 'bg-amber-500'
                            }`}
                            style={{
                              width: `${Math.min(
                                (categoryMetrics.subdomainWeightTotal / Math.max(category.weight || 1, 1)) * 100,
                                100
                              )}%`,
                            }}
                          />
                        </div>

                        <div className="mt-4 space-y-4">
                          {category.subdomains.map((subdomain, index) => {
                            const subdomainMetrics = getSubdomainMetrics(subdomain);

                            return (
                              <div
                                key={subdomain.id}
                                className="rounded-[1.4rem] border border-white bg-white p-4 shadow-sm"
                              >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div>
                                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                                      Subdomain {index + 1}
                                    </div>
                                    <div className="mt-1 font-semibold text-gray-900">
                                      {subdomain.name.en || 'Untitled subdomain'}
                                    </div>
                                    <div className="mt-1 text-sm text-gray-500">
                                      {subdomain.name.ar || 'Arabic name pending'}
                                    </div>
                                  </div>

                                  <div
                                    className={`rounded-full px-3 py-2 text-xs font-semibold ${
                                      subdomainMetrics.balance.isExact
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : subdomainMetrics.balance.overflow > 0
                                          ? 'bg-rose-50 text-rose-700'
                                          : 'bg-amber-50 text-amber-700'
                                    }`}
                                  >
                                    {subdomainMetrics.questionWeightTotal} / {subdomain.weight}%
                                  </div>
                                </div>

                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                                  <div
                                    className={`h-full rounded-full ${
                                      subdomainMetrics.balance.isExact
                                        ? 'bg-emerald-500'
                                        : subdomainMetrics.balance.overflow > 0
                                          ? 'bg-rose-500'
                                          : 'bg-amber-500'
                                    }`}
                                    style={{
                                      width: `${Math.min(
                                        (subdomainMetrics.questionWeightTotal / Math.max(subdomain.weight || 1, 1)) * 100,
                                        100
                                      )}%`,
                                    }}
                                  />
                                </div>

                                <div className="mt-4 space-y-3">
                                  {subdomain.questions.map((question, questionIndex) => (
                                    <div
                                      key={question.id}
                                      className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                                    >
                                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                                            Question {questionIndex + 1}
                                          </div>
                                          <div className="mt-1 font-medium text-gray-900">
                                            {question.text.en || 'Untitled question'}
                                          </div>
                                          <div className="mt-1 text-sm text-gray-500">
                                            {question.text.ar || 'Arabic text pending'}
                                          </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                          <div className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-gray-700">
                                            {question.weight}% weight
                                          </div>
                                          <div
                                            className={`rounded-full px-3 py-2 text-xs font-semibold ${
                                              question.isFollowUp
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-gray-200 text-gray-700'
                                            }`}
                                          >
                                            {question.isFollowUp ? 'follow-up' : 'primary'}
                                          </div>
                                          <div className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-gray-700">
                                            {question.options.length} options
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <button
              type="button"
              onClick={() => router.push('/scanners')}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Scanners
            </button>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={!hasDraftVersion || saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Draft'}
              </button>

              <button
                type="button"
                onClick={handlePublish}
                disabled={!hasDraftVersion || saving || !validation.isValid}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {saving ? 'Publishing...' : 'Publish Version'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6 2xl:sticky 2xl:top-6 2xl:self-start">
          <WeightSummaryPanel
            categories={categories}
            issues={validation.issues}
            selectedCategoryId={selectedCategoryId}
            selectedSubdomainId={selectedSubdomainId}
          />

          <VersionHistory
            versions={versions}
            canCreateVersion={Boolean(scannerId) && !hasDraftVersion}
            onCreateVersion={handleCreateNewVersion}
            loading={saving}
          />
        </div>
      </div>
    </div>
  );
}
