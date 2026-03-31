'use client';

import { useState } from 'react';
import { X, Plus, ChevronDown, Network } from 'lucide-react';
import { FieldOption, DepartmentOption } from '../types';

interface DepartmentMappingInputProps {
  streams: FieldOption[];
  departments: DepartmentOption[];
  onChange: (departments: DepartmentOption[]) => void;
}

export function DepartmentMappingInput({
  streams,
  departments,
  onChange,
}: DepartmentMappingInputProps) {
  const [newDept, setNewDept] = useState('');
  const [selectedStreamId, setSelectedStreamId] = useState('');

  const handleAdd = () => {
    if (!newDept.trim() || !selectedStreamId) return;
    
    const id = newDept.toLowerCase().replace(/\s+/g, '-');
    
    const newDepartment: DepartmentOption = {
      id,
      label: newDept.trim(),
      streamId: selectedStreamId,
    };
    
    onChange([...departments, newDepartment]);
    setNewDept('');
    setSelectedStreamId('');
  };

  const handleRemove = (id: string) => {
    onChange(departments.filter(d => d.id !== id));
  };

  // Group departments by stream for display
  const groupedDepartments = streams.map(stream => ({
    stream,
    departments: departments.filter(d => d.streamId === stream.id),
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
        <Network className="w-4 h-4 text-primary" />
        <label className="block text-sm font-semibold text-gray-700">
          Department Mapping
        </label>
        <span className="text-xs text-gray-400">({departments.length})</span>
      </div>
      
      <p className="text-xs text-gray-500 mb-4">
        Each department must be linked to a stream. Departments will be filtered based on selected stream.
      </p>

      {/* Existing departments grouped by stream */}
      <div className="grid gap-4">
        {groupedDepartments.map(({ stream, departments: depts }) => (
          depts.length > 0 && (
            <div key={stream.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-primary uppercase tracking-wide bg-primary/10 px-2 py-1 rounded-md">
                  {stream.label}
                </span>
                <span className="text-xs text-gray-400">
                  ({depts.length} departments)
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {depts.map((dept) => (
                  <div
                    key={dept.id}
                    className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium shadow-sm hover:border-primary/30 transition-colors"
                  >
                    <span>{dept.label}</span>
                    <button
                      onClick={() => handleRemove(dept.id)}
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

      {departments.length === 0 && (
        <div className="text-sm text-gray-400 italic py-2 bg-gray-50 rounded-lg px-4">
          No departments mapped yet
        </div>
      )}

      {/* Add new department */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {/* Stream selector */}
        <div className="relative flex-1">
          <select
            value={selectedStreamId}
            onChange={(e) => setSelectedStreamId(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm appearance-none bg-white cursor-pointer bg-gray-50/50"
          >
            <option value="">Select Stream...</option>
            {streams.map((stream) => (
              <option key={stream.id} value={stream.id}>
                {stream.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Department name input */}
        <input
          type="text"
          value={newDept}
          onChange={(e) => setNewDept(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Department name"
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-gray-50/50"
        />

        {/* Add button */}
        <button
          onClick={handleAdd}
          disabled={!newDept.trim() || !selectedStreamId}
          className="px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm font-medium shadow-sm hover:shadow-md"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>
    </div>
  );
}
