'use client';

import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Category, Subdomain } from '../types';
import { createEmptySubdomain } from '../utils/builder';

interface StructureBuilderProps {
  categories: Category[];
  disabled?: boolean;
  onCategoryChange: (category: Category) => void;
}

export function StructureBuilder({
  categories,
  disabled = false,
  onCategoryChange,
}: StructureBuilderProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    categories.forEach(cat => initial[cat.id] = true);
    return initial;
  });

  function toggleCategory(categoryId: string) {
    setExpandedCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  }

  function addSubdomain(category: Category) {
    onCategoryChange({
      ...category,
      subdomains: [...category.subdomains, createEmptySubdomain(category.id)],
    });
  }

  function updateSubdomain(category: Category, updatedSubdomain: Subdomain) {
    onCategoryChange({
      ...category,
      subdomains: category.subdomains.map(sub => sub.id === updatedSubdomain.id ? updatedSubdomain : sub)
    });
  }

  function removeSubdomain(category: Category, subdomainId: string) {
    if (category.subdomains.length <= 1) return;
    onCategoryChange({
      ...category,
      subdomains: category.subdomains.filter(sub => sub.id !== subdomainId)
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900">Scanner Structure</h2>
        <p className="text-sm text-gray-500 mt-1">
          Define the subdomains for each of the 5 fixed categories. Questions and weights will be added in later steps.
        </p>
      </div>

      <div className="space-y-6">
        {categories.map((category) => {
          const isExpanded = expandedCategories[category.id];

          return (
            <div key={category.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div 
                className="p-5 flex items-center justify-between cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                onClick={() => toggleCategory(category.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${isExpanded ? 'bg-primary/10 text-primary' : 'text-gray-400'}`}>
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 text-base">
                      {category.name.en || `Category ${category.slot}`}
                    </h3>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {category.subdomains.length} Subdomain{category.subdomains.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                  <label className="flex items-center gap-2 cursor-pointer mr-4">
                    <input 
                      type="checkbox" 
                      disabled={disabled}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      checked={category.polarity === 'positive'} 
                      onChange={(e) => onCategoryChange({ 
                        ...category, 
                        polarity: e.target.checked ? 'positive' : 'negative' 
                      })} 
                    />
                    <span className="text-sm font-medium text-gray-600">Positive Polarity</span>
                  </label>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => addSubdomain(category)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add Subdomain
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="p-5 border-t border-gray-100 space-y-4">
                  {category.subdomains.map((subdomain, index) => (
                    <div key={subdomain.id} className="flex flex-col xl:flex-row gap-4 items-start p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                      <div className="flex items-center gap-3 w-full xl:w-auto xl:flex-none">
                        <span className="text-xs font-semibold uppercase text-gray-400 w-24">Subdomain {index + 1}</span>
                      </div>
                      
                      <div className="grid gap-4 w-full xl:grid-cols-2">
                        <div>
                          <input
                            value={subdomain.name.en}
                            disabled={disabled}
                            onChange={(e) => updateSubdomain(category, {
                              ...subdomain,
                              name: { ...subdomain.name, en: e.target.value }
                            })}
                            placeholder="Name in English"
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-gray-100"
                          />
                        </div>
                        <div>
                          <input
                            value={subdomain.name.ar}
                            dir="rtl"
                            disabled={disabled}
                            onChange={(e) => updateSubdomain(category, {
                              ...subdomain,
                              name: { ...subdomain.name, ar: e.target.value }
                            })}
                            placeholder="Name in Arabic"
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-gray-100"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={disabled || category.subdomains.length <= 1}
                        onClick={() => removeSubdomain(category, subdomain.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
