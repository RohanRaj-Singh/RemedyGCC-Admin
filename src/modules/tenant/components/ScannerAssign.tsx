'use client';

import { useState, useEffect } from 'react';
import { ScannerOption } from '../types';
import { getAvailableScanners, getScannerName } from '../service';
import { Scan, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScannerAssignProps {
  tenantId: string;
  currentScannerId?: string;
  currentScannerName?: string;
  onAssign: (scannerId: string | null) => void;
  isLoading?: boolean;
}

export function ScannerAssign({ 
  tenantId, 
  currentScannerId, 
  currentScannerName, 
  onAssign, 
  isLoading 
}: ScannerAssignProps) {
  const [scanners, setScanners] = useState<ScannerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>(currentScannerId || '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadScanners();
  }, [tenantId]);

  const loadScanners = async () => {
    try {
      setLoading(true);
      const availableScanners = await getAvailableScanners();
      setScanners(availableScanners);
    } catch (err) {
      setError('Failed to load scanners');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = async (newScannerId: string) => {
    setSelectedId(newScannerId);
    
    if (newScannerId === '') {
      onAssign(null);
    } else {
      onAssign(newScannerId);
    }
  };

  const inputStyle = 'w-full px-4 py-2.5 rounded-lg border border-[var(--input)] focus:ring-2 focus:ring-[var(--ring)] focus:border-[var(--ring)] outline-none transition-all';
  const errorStyle = 'p-4 rounded-lg border text-sm';

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4" style={{ color: 'var(--muted-foreground)' }}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading available scanners...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className={errorStyle}
        style={{ 
          backgroundColor: 'hsl(0 84% 60% / 0.1)', 
          borderColor: 'var(--destructive)', 
          color: 'var(--destructive)' 
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          Assigned Scanner
        </label>
        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {scanners.length} available
        </span>
      </div>

      {currentScannerId && (
        <div 
          className="flex items-center gap-3 p-3 rounded-lg border"
          style={{ 
            backgroundColor: 'hsl(142 76% 36% / 0.1)', 
            borderColor: 'var(--primary)' 
          }}
        >
          <div 
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'hsl(142 76% 36% / 0.2)' }}
          >
            <Scan className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
              {currentScannerName || 'Assigned Scanner'}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              ID: {currentScannerId}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleChange('')}
            disabled={isLoading}
            className="p-1.5 rounded-lg transition-colors"
            style={{ 
              color: 'var(--muted-foreground)',
              backgroundColor: 'transparent'
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <select
        value={selectedId}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isLoading}
        className={cn(
          inputStyle,
          isLoading && "opacity-50 cursor-not-allowed"
        )}
      >
        <option value="">-- Select a Scanner --</option>
        {scanners.map((scanner) => (
          <option 
            key={scanner.id} 
            value={scanner.id}
            disabled={scanner.id === currentScannerId}
          >
            {scanner.name} {scanner.description ? `- ${scanner.description}` : ''}
          </option>
        ))}
      </select>

      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
        Each tenant can only be assigned one scanner. Select a published scanner from the list above.
      </p>
    </div>
  );
}