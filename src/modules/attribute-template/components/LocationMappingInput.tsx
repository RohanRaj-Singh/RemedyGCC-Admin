'use client';

import { useState } from 'react';
import { ChevronDown, MapPinned, Plus, X } from 'lucide-react';
import { FieldOption, LocationOption } from '../types';

interface LocationMappingInputProps {
  streams: FieldOption[];
  locations: LocationOption[];
  onChange: (locations: LocationOption[]) => void;
}

export function LocationMappingInput({
  streams,
  locations,
  onChange,
}: LocationMappingInputProps) {
  const [newLocation, setNewLocation] = useState('');
  const [selectedStreamId, setSelectedStreamId] = useState('');

  function handleAdd() {
    if (!newLocation.trim() || !selectedStreamId) {
      return;
    }

    onChange([
      ...locations,
      {
        id: `${selectedStreamId}-${newLocation.toLowerCase().replace(/\s+/g, '-')}`,
        label: newLocation.trim(),
        streamId: selectedStreamId,
      },
    ]);

    setNewLocation('');
    setSelectedStreamId('');
  }

  function handleRemove(id: string) {
    onChange(locations.filter((location) => location.id !== id));
  }

  const groupedLocations = streams.map((stream) => ({
    stream,
    items: locations.filter((location) => location.streamId === stream.id),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MapPinned className="h-4 w-4 text-primary" />
        <label className="text-sm font-semibold text-gray-700">Location Mapping</label>
        <span className="text-xs text-gray-400">({locations.length})</span>
      </div>

      <p className="text-xs text-gray-500">
        Each location must be linked to one stream. This starts the required chain:
        stream to location to function to department.
      </p>

      <div className="grid gap-4">
        {groupedLocations.map(({ stream, items }) =>
          items.length > 0 ? (
            <div key={stream.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                  {stream.label}
                </span>
                <span className="text-xs text-gray-400">({items.length} locations)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {items.map((location) => (
                  <div
                    key={location.id}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm"
                  >
                    <span>{location.label}</span>
                    <button
                      type="button"
                      onClick={() => handleRemove(location.id)}
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

      {locations.length === 0 && (
        <div className="rounded-lg bg-gray-50 px-4 py-2 text-sm italic text-gray-400">
          No locations mapped yet
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <select
            value={selectedStreamId}
            onChange={(event) => setSelectedStreamId(event.target.value)}
            className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select Stream...</option>
            {streams.map((stream) => (
              <option key={stream.id} value={stream.id}>
                {stream.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>

        <input
          value={newLocation}
          onChange={(event) => setNewLocation(event.target.value)}
          placeholder="Location name"
          className="flex-1 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />

        <button
          type="button"
          onClick={handleAdd}
          disabled={!newLocation.trim() || !selectedStreamId}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </div>
  );
}
