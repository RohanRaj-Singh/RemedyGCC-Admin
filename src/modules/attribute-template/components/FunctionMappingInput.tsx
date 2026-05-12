'use client';

import { useEffect, useMemo, useState } from 'react';
import { Briefcase, ChevronDown, Plus, X } from 'lucide-react';
import { FunctionOption, FieldOption, LocationOption } from '../types';
import {
  createAttributeOptionId,
  formatHierarchyPath,
} from '../utils';

interface FunctionMappingInputProps {
  streams: FieldOption[];
  locations: LocationOption[];
  functions: FunctionOption[];
  onChange: (functions: FunctionOption[]) => void;
}

export function FunctionMappingInput({
  streams,
  locations,
  functions,
  onChange,
}: FunctionMappingInputProps) {
  const [newFunction, setNewFunction] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');

  useEffect(() => {
    if (selectedLocationId && !locations.some((location) => location.id === selectedLocationId)) {
      setSelectedLocationId('');
    }
  }, [selectedLocationId, locations]);

  const streamById = useMemo(
    () => new Map(streams.map((stream) => [stream.id, stream])),
    [streams],
  );

  function handleAdd() {
    if (!newFunction.trim() || !selectedLocationId) {
      return;
    }

    onChange([
      ...functions,
      {
        id: createAttributeOptionId(selectedLocationId, newFunction),
        label: newFunction.trim(),
        locationId: selectedLocationId,
      },
    ]);

    setNewFunction('');
    setSelectedLocationId('');
  }

  function handleRemove(id: string) {
    onChange(functions.filter((item) => item.id !== id));
  }

  const groupedFunctions = locations.map((location) => {
    const stream = streamById.get(location.streamId) ?? null;
    return {
      location,
      stream,
      pathLabel: formatHierarchyPath([stream?.label, location.label]),
      items: functions.filter((item) => item.locationId === location.id),
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-primary" />
        <label className="text-sm font-semibold text-gray-700">Function Mapping</label>
        <span className="text-xs text-gray-400">({functions.length})</span>
      </div>

      <p className="text-xs text-gray-500">
        Each function must sit under exactly one location and only filters the next level: departments.
      </p>

      <div className="grid gap-4">
        {groupedFunctions.map(({ location, pathLabel, items }) =>
          items.length > 0 ? (
            <div key={location.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                  {pathLabel}
                </span>
                <span className="text-xs text-gray-400">({items.length} functions)</span>
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

      {functions.length === 0 && (
        <div className="rounded-lg bg-gray-50 px-4 py-2 text-sm italic text-gray-400">
          No functions mapped yet
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <select
            value={selectedLocationId}
            onChange={(event) => setSelectedLocationId(event.target.value)}
            disabled={locations.length === 0}
            className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-gray-100"
          >
            <option value="">Select Location...</option>
            {locations.map((location) => {
              const stream = streamById.get(location.streamId);
              return (
                <option key={location.id} value={location.id}>
                  {formatHierarchyPath([stream?.label, location.label])}
                </option>
              );
            })}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>

        <input
          value={newFunction}
          onChange={(event) => setNewFunction(event.target.value)}
          placeholder="Function name"
          className="flex-1 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />

        <button
          type="button"
          onClick={handleAdd}
          disabled={!newFunction.trim() || !selectedLocationId || locations.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </div>
  );
}
