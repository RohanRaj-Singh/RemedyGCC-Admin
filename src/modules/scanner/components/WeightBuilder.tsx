'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Category } from '../types';
import { getCategoryMetrics, getSubdomainMetrics, sumWeights } from '../utils/metrics';

interface WeightBuilderProps {
  categories: Category[];
  disabled?: boolean;
  onCategoryChange: (category: Category) => void;
}

export function WeightBuilder({
  categories,
  disabled = false,
  onCategoryChange,
}: WeightBuilderProps) {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const scannerTotal = sumWeights(categories);
  const isScannerBalanced = scannerTotal === 100;
  const scannerOverflow = scannerTotal > 100;

  function toggle(id: string) {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Weight Assignment</h2>
          <p className="text-sm text-gray-500 mt-1">
            Assign weights at all levels. Categories must total 100%. Subdomains must match their parent category. Questions must match their parent subdomain.
          </p>
        </div>
        <div className={`px-4 py-2 rounded-xl border text-sm font-medium ${
          isScannerBalanced ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
          scannerOverflow ? 'bg-rose-50 border-rose-200 text-rose-700' :
          'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          {scannerTotal} / 100% Total
          {!isScannerBalanced && !scannerOverflow && ` (${100 - scannerTotal}% rem)`}
          {scannerOverflow && ` (${scannerTotal - 100}% over)`}
        </div>
      </div>

      <div className="space-y-6">
        {categories.map(category => {
          const catMetrics = getCategoryMetrics(category);
          const isCatExpanded = expandedItems[category.id];
          const catBalanced = catMetrics.balance.isExact;
          const catOverflow = catMetrics.balance.overflow > 0;
          const maxCatAllowed = (100 - scannerTotal) + category.weight;

          return (
            <div key={category.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div 
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => toggle(category.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${isCatExpanded ? 'bg-primary/10 text-primary' : 'text-gray-400'}`}>
                    {isCatExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-base">
                      {category.name.en || `Category ${category.slot}`}
                    </h3>
                    <div className="text-xs text-gray-500 mt-0.5 font-medium flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md ${
                        catBalanced ? 'bg-emerald-100 text-emerald-700' :
                        catOverflow ? 'bg-rose-100 text-rose-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        Subdomains: {catMetrics.subdomainWeightTotal} / {category.weight}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                  <label className="text-xs font-semibold uppercase text-gray-500">Category Weight</label>
                  <div className="relative w-28">
                    <input
                      type="number"
                      min={0}
                      max={maxCatAllowed}
                      disabled={disabled}
                      value={category.weight === 0 ? '' : category.weight}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const clamped = Math.max(0, Math.min(val, maxCatAllowed));
                        onCategoryChange({ ...category, weight: clamped });
                      }}
                      placeholder="0"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm font-bold text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100 text-right"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">%</span>
                  </div>
                </div>
              </div>

              {isCatExpanded && (
                <div className="p-5 border-t border-gray-100 space-y-6">
                  {category.subdomains.map((subdomain, index) => {
                    const subMetrics = getSubdomainMetrics(subdomain);
                    const isSubExpanded = expandedItems[subdomain.id];
                    const subBalanced = subMetrics.balance.isExact;
                    const subOverflow = subMetrics.balance.overflow > 0;
                    const maxSubAllowed = catMetrics.balance.remaining + subdomain.weight;

                    return (
                      <div key={subdomain.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                        <div 
                          className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => toggle(subdomain.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-1 rounded-lg ${isSubExpanded ? 'text-primary' : 'text-gray-400'}`}>
                              {isSubExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </div>
                            <div>
                              <div className="text-xs font-semibold uppercase text-gray-500">Subdomain {index + 1}</div>
                              <h4 className="font-medium text-gray-900 mt-0.5">
                                {subdomain.name.en || 'Untitled Subdomain'}
                              </h4>
                              <div className="text-[10px] text-gray-500 mt-1 font-medium flex items-center gap-2">
                                <span className={`px-1.5 py-0.5 rounded ${
                                  subBalanced ? 'bg-emerald-100 text-emerald-700' :
                                  subOverflow ? 'bg-rose-100 text-rose-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                  Questions: {subMetrics.questionWeightTotal} / {subdomain.weight}%
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                            <label className="text-xs font-medium text-gray-500">Subdomain Weight</label>
                            <div className="relative w-24">
                              <input
                                type="number"
                                min={0}
                                max={maxSubAllowed}
                                disabled={disabled}
                                value={subdomain.weight === 0 ? '' : subdomain.weight}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const clamped = Math.max(0, Math.min(val, maxSubAllowed));
                                  onCategoryChange({
                                    ...category,
                                    subdomains: category.subdomains.map(s => 
                                      s.id === subdomain.id ? { ...s, weight: clamped } : s
                                    )
                                  });
                                }}
                                placeholder="0"
                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 pr-7 text-sm font-semibold text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100 text-right"
                              />
                              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">%</span>
                            </div>
                          </div>
                        </div>

                        {isSubExpanded && (
                          <div className="p-4 border-t border-gray-100 space-y-3">
                            {subdomain.questions.map((question, qIndex) => {
                              const maxQAllowed = subMetrics.balance.remaining + (question.weight || 0);

                              return (
                                <div key={question.id} className="flex items-center justify-between gap-4 p-3 rounded-lg border border-gray-100 bg-white shadow-sm">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-semibold uppercase text-gray-500">Q{qIndex + 1}</span>
                                      {question.isFollowUp && (
                                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 uppercase">
                                          Follow-up
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm font-medium text-gray-800 mt-1 truncate">
                                      {question.text.en || 'Untitled Question'}
                                    </p>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Weight</label>
                                    <div className="relative w-20">
                                      <input
                                        type="number"
                                        min={0}
                                        max={maxQAllowed}
                                        disabled={disabled}
                                        value={question.weight === 0 ? '' : (question.weight || '')}
                                        onChange={(e) => {
                                          const val = Number(e.target.value);
                                          const clamped = Math.max(0, Math.min(val, maxQAllowed));
                                          onCategoryChange({
                                            ...category,
                                            subdomains: category.subdomains.map(s => 
                                              s.id === subdomain.id ? {
                                                ...s,
                                                questions: s.questions.map(q => 
                                                  q.id === question.id ? { ...q, weight: clamped } : q
                                                )
                                              } : s
                                            )
                                          });
                                        }}
                                        placeholder="0"
                                        className="w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1 pr-6 text-sm font-semibold text-gray-900 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100 text-right"
                                      />
                                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">%</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
