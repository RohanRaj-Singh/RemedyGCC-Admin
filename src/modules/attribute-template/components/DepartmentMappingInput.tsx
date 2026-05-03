'use client';

import { useState } from 'react';
import { ChevronDown, Network, Plus, X } from 'lucide-react';
import { DepartmentOption, FunctionOption } from '../types';

interface DepartmentMappingInputProps {
  functions: FunctionOption[];
  departments: DepartmentOption[];
  onChange: (departments: DepartmentOption[]) => void;
}

export function DepartmentMappingInput({
  functions,
  departments,
  onChange,
}: DepartmentMappingInputProps) {
  const [newDepartment, setNewDepartment] = useState('');
  const [selectedFunctionId, setSelectedFunctionId] = useState('');

  function handleAdd() {
    if (!newDepartment.trim() || !selectedFunctionId) {
      return;
    }

    onChange([
      ...departments,
      {
        id: `${selectedFunctionId}-${newDepartment.toLowerCase().replace(/\s+/g, '-')}`,
        label: newDepartment.trim(),
        functionId: selectedFunctionId,
      },
    ]);

    setNewDepartment('');
    setSelectedFunctionId('');
  }

  function handleRemove(id: string) {
    onChange(departments.filter((item) => item.id !== id));
  }

  const groupedDepartments = functions.map((func) => ({
    func,
    items: departments.filter((item) => item.functionId === func.id),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-primary" />
        <label className="text-sm font-semibold text-gray-700">Department Mapping</label>
        <span className="text-xs text-gray-400">({departments.length})</span>
      </div>

      <p className="text-xs text-gray-500">
        Each department must be linked to one function, completing the required chain.
      </p>

      <div className="grid gap-4">
        {groupedDepartments.map(({ func, items }) =>
          items.length > 0 ? (
            <div key={func.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                  {func.label}
                </span>
                <span className="text-xs text-gray-400">({items.length} departments)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm"
                  >
                    <span>{item.label}</span>
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      className="ml-1 transition-colors hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null
        )}
      </div>

      {departments.length === 0 && (
        <div className="rounded-lg bg-gray-50 px-4 py-2 text-sm italic text-gray-400">
          No departments mapped yet
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <select
            value={selectedFunctionId}
            onChange={(event) => setSelectedFunctionId(event.target.value)}
            disabled={functions.length === 0}
            className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-gray-100"
          >
            <option value="">Select Function...</option>
            {functions.map((func) => (
              <option key={func.id} value={func.id}>
                {func.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>

        <input
          value={newDepartment}
          onChange={(event) => setNewDepartment(event.target.value)}
          placeholder="Department name"
          className="flex-1 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />

        <button
          type="button"
          onClick={handleAdd}
          disabled={!newDepartment.trim() || !selectedFunctionId || functions.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </div>
  );
}
