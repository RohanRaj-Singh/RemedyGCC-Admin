const fs = require('fs');

const path = 'src/modules/scanner/components/ScannerForm.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace return block
const returnIndex = content.indexOf('  return (');
if (returnIndex !== -1) {
  const returnContent = `  return (
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
            onStepChange={setActiveStep}
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
              <CategoryBuilder
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                disabled={!hasDraftVersion || saving}
                onSelectCategory={setSelectedCategoryId}
                onCategoryChange={updateCategory}
                onManageSubdomains={(catId) => {
                  setSelectedCategoryId(catId);
                  setActiveStep(2);
                }}
              />
            )}

            {activeStep === 2 && (
              <div className="space-y-6">
                <button 
                  onClick={() => setActiveStep(1)} 
                  className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft size={16} /> Back to Categories
                </button>
                <SubdomainBuilder
                  category={selectedCategory}
                  selectedSubdomainId={selectedSubdomainId}
                  disabled={!hasDraftVersion || saving}
                  onSelectSubdomain={setSelectedSubdomainId}
                  onCategoryChange={updateCategory}
                  onAdvanceToQuestions={() => setActiveStep(3)}
                />
              </div>
            )}

            {activeStep === 3 && (
              <div className="space-y-6">
                <button 
                  onClick={() => setActiveStep(2)} 
                  className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft size={16} /> Back to Subdomains
                </button>
                <QuestionBuilder
                  category={selectedCategory}
                  subdomain={selectedSubdomain}
                  selectedSubdomainId={selectedSubdomainId}
                  disabled={!hasDraftVersion || saving}
                  onSelectSubdomain={setSelectedSubdomainId}
                  onSubdomainChange={updateSelectedSubdomain}
                />
              </div>
            )}

            {activeStep === 4 && (
              <div className="space-y-6 max-w-3xl mx-auto">
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
                    <div className="text-2xl font-bold text-gray-900">{scannerWeight}%</div>
                    <div className="text-xs uppercase tracking-wider font-semibold text-gray-500 mt-1">Weight</div>
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
`;
  
  content = content.substring(0, returnIndex) + returnContent;
  fs.writeFileSync(path, content, 'utf8');
  console.log('Successfully updated ScannerForm.tsx');
} else {
  console.error('Could not find return statement in ScannerForm.tsx');
}
