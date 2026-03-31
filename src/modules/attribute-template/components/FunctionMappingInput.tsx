'use client';

import { useState } from 'react';
import { X, Plus, ChevronDown, Briefcase } from 'lucide-react';
import { FieldOption, DepartmentOption, FunctionOption } from '../types';

interface FunctionMappingInputProps {
  departments: DepartmentOption[];
  functions: FunctionOption[];
  onChange: (functions: FunctionOption[]) => void;
}

export function FunctionMappingInput({
  departments,
  functions,
  onChange,
}: FunctionMappingInputProps) {
  const [newFunction, setNewFunction] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');

  const handleAdd = () => {
    if (!newFunction.trim() || !selectedDepartmentId) return;
    
    const id = newFunction.toLowerCase().replace(/\s+/g, '-');
    
    const newFunc: FunctionOption = {
      id,
      label: newFunction.trim(),
      departmentId: selectedDepartmentId,
    };
    
    onChange([...functions, newFunc]);
    setNewFunction('');
    setSelectedDepartmentId('');
  };

  const handleRemove = (id: string) => {
    onChange(functions.filter(f => f.id !== id));
  };

  // Group functions by department for display
  const groupedFunctions = departments.map(dept => ({
    department: dept,
    funcs: functions.filter(f => f.departmentId === dept.id),
  }));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-primary" />
        <label className="block text-sm font-semibold text-gray-700">
          Function Mapping
        </label>
        <span className="text-xs text-gray-400">({functions.length})</span>
      </div>
      
      <p className="text-xs text-gray-500 mb-4">
        Each function must be linked to a department. Functions will be filtered based on selected department.
      </p>

      {/* Existing functions grouped by department */}
      <div className="grid gap-4">
        {groupedFunctions.map(({ department, funcs }) => (
          funcs.length > 0 && (
            <div key={department.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-primary uppercase tracking-wide bg-primary/10 px-2 py-1 rounded-md">
                  {department.label}
                </span>
                <span className="text-xs text-gray-400">
                  ({funcs.length} functions)
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {funcs.map((func) => (
                  <div
                    key={func.id}
                    className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium shadow-sm hover:border-primary/30 transition-colors"
                  >
                    <span>{func.label}</span>
                    <button
                      onClick={() => handleRemove(func.id)}
                      className="ml-1 hover:text-red-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
      </div>

      {functions.length === 0 && (
        <div className="text-sm text-gray-400 italic py-2 bg-gray-50 rounded-lg px-4">
          No functions mapped yet
        </div>
      )}

      {/* Add new function */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {/* Department selector */}
        <div className="relative flex-1">
          <select
            value={selectedDepartmentId}
            onChange={(e) => setSelectedDepartmentId(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm appearance-none bg-white cursor-pointer bg-gray-50/50"
            disabled={departments.length === 0}
          >
            <option value="">Select Department...</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Function name input */}
        <input
          type="text"
          value={newFunction}
          onChange={(e) => setNewFunction(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Function name"
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-gray-50/50"
        />

        {/* Add button */}
        <button
          onClick={handleAdd}
          disabled={!newFunction.trim() || !selectedDepartmentId || departments.length === 0}
          className="px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm font-medium shadow-sm hover:shadow-md"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {departments.length === 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">
          ⚠️ Please add departments first before adding functions.
        </p>
      )}
    </div>
  );
}
