'use client';

import { ChevronLeft, ChevronRight, MessageSquareText, Plus } from 'lucide-react';
import { Category, Subdomain } from '../types';
import { QuestionBuilder } from './QuestionBuilder';

interface ContentBuilderProps {
  categories: Category[];
  selectedSubdomainId?: string;
  disabled?: boolean;
  onSelectSubdomain: (subdomainId: string) => void;
  onCategoryChange: (category: Category) => void;
}

export function ContentBuilder({
  categories,
  selectedSubdomainId,
  disabled = false,
  onSelectSubdomain,
  onCategoryChange,
}: ContentBuilderProps) {
  const selectedCategory = categories.find(c => 
    c.subdomains.some(s => s.id === selectedSubdomainId)
  ) || categories[0];
  
  const selectedSubdomain = selectedCategory?.subdomains.find(
    s => s.id === selectedSubdomainId
  ) || selectedCategory?.subdomains[0];

  function handleSubdomainChange(updatedSubdomain: Subdomain) {
    if (!selectedCategory) return;
    onCategoryChange({
      ...selectedCategory,
      subdomains: selectedCategory.subdomains.map(sub => 
        sub.id === updatedSubdomain.id ? updatedSubdomain : sub
      )
    });
  }

  const allSubdomains = categories.flatMap(c => c.subdomains);
  const currentIndex = allSubdomains.findIndex(s => s.id === selectedSubdomain?.id);
  const prevSubdomain = currentIndex > 0 ? allSubdomains[currentIndex - 1] : null;
  const nextSubdomain = currentIndex < allSubdomains.length - 1 ? allSubdomains[currentIndex + 1] : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      {/* TOP SELECTOR */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Category</label>
            <select
              value={selectedCategory?.id}
              onChange={(e) => {
                const cat = categories.find(c => c.id === e.target.value);
                if (cat && cat.subdomains.length > 0) {
                  onSelectSubdomain(cat.subdomains[0].id);
                }
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name.en || `Category ${c.slot}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Subdomain</label>
            <select
              value={selectedSubdomain?.id}
              onChange={(e) => onSelectSubdomain(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {selectedCategory?.subdomains.map((s, idx) => (
                <option key={s.id} value={s.id}>
                  {s.name.en || `Subdomain ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
            <span className="text-gray-400">{selectedCategory?.name.en || 'Category'}</span>
            <ChevronRight size={14} className="text-gray-300" />
            <span className="text-gray-900">{selectedSubdomain?.name.en || 'Subdomain'}</span>
            <span className="text-gray-400 font-normal">({selectedSubdomain?.questions.length || 0} questions)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => prevSubdomain && onSelectSubdomain(prevSubdomain.id)}
              disabled={!prevSubdomain}
              className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <button
              onClick={() => nextSubdomain && onSelectSubdomain(nextSubdomain.id)}
              disabled={!nextSubdomain}
              className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* FULL WIDTH QUESTION PANEL */}
      <div className="min-w-0">
        <QuestionBuilder
          category={selectedCategory}
          subdomain={selectedSubdomain}
          disabled={disabled}
          onSubdomainChange={handleSubdomainChange}
        />
      </div>
    </div>
  );
}
