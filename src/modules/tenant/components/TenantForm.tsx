'use client';

import { memo, useState, useEffect, useCallback } from 'react';
import { Tenant, TenantStatus, ScannerOption } from '../types';
import { getAvailableScanners } from '../service';
import { Scan, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TenantFormProps {
  tenant?: Tenant;
  onSubmit: (data: {
    name: string;
    subdomain: string;
    status: TenantStatus;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
  currentScannerId?: string;
  currentScannerName?: string;
  onAssignScanner?: (scannerId: string | null) => void;
}

const STATUS_OPTIONS: { value: TenantStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

export const TenantForm = memo(function TenantForm({ 
  tenant, 
  onSubmit, 
  onCancel, 
  isLoading, 
  error,
  currentScannerId,
  currentScannerName,
  onAssignScanner 
}: TenantFormProps) {
  const [name, setName] = useState(tenant?.name || '');
  const [subdomain, setSubdomain] = useState(tenant?.subdomain || '');
  const [status, setStatus] = useState<TenantStatus>(tenant?.status || 'active');
  const [subdomainError, setSubdomainError] = useState('');
  
  const [scanners, setScanners] = useState<ScannerOption[]>([]);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [selectedScannerId, setSelectedScannerId] = useState<string>(currentScannerId || '');

  useEffect(() => {
    setName(tenant?.name || '');
    setSubdomain(tenant?.subdomain || '');
    setStatus(tenant?.status || 'active');
  }, [tenant]);

  useEffect(() => {
    setSelectedScannerId(currentScannerId || '');
  }, [currentScannerId]);

  const loadScanners = useCallback(async () => {
    try {
      setScannerLoading(true);
      const availableScanners = await getAvailableScanners();
      setScanners(availableScanners);
    } catch (err) {
      console.error('Failed to load scanners', err);
    } finally {
      setScannerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (onAssignScanner) {
      void loadScanners();
    }
  }, [loadScanners, onAssignScanner]);

  const handleScannerChange = (newScannerId: string) => {
    setSelectedScannerId(newScannerId);
    if (onAssignScanner) {
      onAssignScanner(newScannerId || null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const subdomainRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
    if (!subdomainRegex.test(subdomain)) {
      setSubdomainError('Subdomain must be lowercase alphanumeric with hyphens (no leading/trailing hyphens)');
      return;
    }
    
    setSubdomainError('');
    onSubmit({ 
      name, 
      subdomain, 
      status,
    });
  };

  const labelStyle = 'block text-sm font-medium';
  const inputStyle = 'w-full px-4 py-2.5 rounded-lg border border-[var(--input)] focus:ring-2 focus:ring-[var(--ring)] focus:border-[var(--ring)] outline-none transition-all';
  const errorStyle = 'p-4 rounded-lg border text-sm';
  const buttonStyle = 'px-6 py-2.5 rounded-lg font-medium transition-colors';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
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
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <label htmlFor="name" className={labelStyle} style={{ color: 'var(--foreground)' }}>
            Tenant Name <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputStyle}
            placeholder="e.g., Acme Corporation"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="subdomain" className={labelStyle} style={{ color: 'var(--foreground)' }}>
            Subdomain <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <div className="flex items-center">
            <input
              type="text"
              id="subdomain"
              value={subdomain}
              onChange={(e) => {
                setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                setSubdomainError('');
              }}
              required
              className={cn(
                inputStyle,
                "rounded-r-none",
                subdomainError && "border-[var(--destructive)]"
              )}
              placeholder="e.g., acme"
              disabled={!!tenant}
            />
            <span 
              className="px-4 py-2.5 border border-l-0 rounded-r-lg text-sm"
              style={{ 
                backgroundColor: 'var(--muted)', 
                borderColor: 'var(--input)',
                color: 'var(--muted-foreground)'
              }}
            >
              .remedygcc.com
            </span>
          </div>
          {subdomainError && (
            <p className="text-sm" style={{ color: 'var(--destructive)' }}>{subdomainError}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className={labelStyle} style={{ color: 'var(--foreground)' }}>Status</label>
        <div className="flex gap-4">
          {STATUS_OPTIONS.map((option) => {
            const statusColors: Record<string, { dot: string }> = {
              active: { dot: 'hsl(142 76% 36%)' },
              inactive: { dot: 'hsl(0 0% 63%)' },
              suspended: { dot: 'hsl(0 84% 60%)' },
            };
            const colors = statusColors[option.value] || statusColors.inactive;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all",
                  status === option.value
                    ? "border-[var(--primary)] bg-[var(--primary)]/5"
                    : "border-[var(--border)] hover:border-[var(--primary)]/50"
                )}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.dot }} />
                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {onAssignScanner && (
        <div className="space-y-2">
          <label className={labelStyle} style={{ color: 'var(--foreground)' }}>
            Assigned Scanner
          </label>
          
          {scannerLoading ? (
            <div className="flex items-center gap-2 p-4" style={{ color: 'var(--muted-foreground)' }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading available scanners...</span>
            </div>
          ) : (
            <>
              {currentScannerId && (
                <div 
                  className="flex items-center gap-3 p-3 rounded-lg border mb-3"
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
                    onClick={() => handleScannerChange('')}
                    disabled={isLoading}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <select
                value={selectedScannerId}
                onChange={(e) => handleScannerChange(e.target.value)}
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
            </>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <button
          type="button"
          onClick={onCancel}
          className={buttonStyle}
          style={{ 
            border: '1px solid var(--border)', 
            color: 'var(--foreground)',
            backgroundColor: 'transparent'
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className={buttonStyle}
          style={{ 
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
            opacity: isLoading ? 0.5 : 1,
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoading ? 'Saving...' : tenant ? 'Update Tenant' : 'Create Tenant'}
        </button>
      </div>
    </form>
  );
});
