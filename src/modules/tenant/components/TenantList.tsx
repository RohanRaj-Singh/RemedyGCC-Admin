'use client';

import { Tenant } from '@/types';
import Link from 'next/link';
import { Building2, Edit, Trash2, Scan } from 'lucide-react';

interface TenantListProps {
  tenants: Tenant[];
  onDelete?: (id: string) => void;
  isDeleting?: string | null;
}

function getBrandingCSSVars(branding: Tenant['branding']): Record<string, string> {
  return {
    '--brand-primary': branding.colorScheme.primaryColor,
    '--brand-secondary': branding.colorScheme.secondaryColor || branding.colorScheme.primaryColor,
    '--brand-background': branding.colorScheme.backgroundColor || '0 0% 100%',
    '--brand-text': branding.colorScheme.textColor || '0 0% 43%',
    '--brand-accent': branding.colorScheme.accentColor || '212 100% 50%',
  };
}

const STATUS_CONFIG = {
  active: { label: 'Active', bg: 'hsl(142 76% 36% / 0.15)', color: 'hsl(142 76% 26%)', dot: 'hsl(142 76% 36%)' },
  inactive: { label: 'Inactive', bg: 'hsl(0 0% 85% / 0.5)', color: 'hsl(0 0% 30%)', dot: 'hsl(0 0% 60%)' },
  suspended: { label: 'Suspended', bg: 'hsl(0 84% 60% / 0.15)', color: 'hsl(0 84% 50%)', dot: 'hsl(0 84% 60%)' },
};

export function TenantList({ tenants, onDelete, isDeleting }: TenantListProps) {
  if (tenants.length === 0) {
    return (
      <div className="text-center py-16">
        <div 
          className="w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--muted)' }}
        >
          <Building2 className="w-10 h-10" style={{ color: 'var(--muted-foreground)' }} />
        </div>
        <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>No tenants found</h3>
        <p className="text-base" style={{ color: 'var(--muted-foreground)' }}>Create your first tenant to get started</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px]">
        <thead>
          <tr 
            className="border-b-2"
            style={{ 
              borderColor: 'var(--border)',
              backgroundColor: 'hsl(0 0% 98%)'
            }}
          >
            <th 
              className="text-left py-4 px-5 font-bold text-sm uppercase tracking-wide"
              style={{ color: 'var(--foreground)' }}
            >
              Tenant
            </th>
            <th 
              className="text-left py-4 px-5 font-bold text-sm uppercase tracking-wide"
              style={{ color: 'var(--foreground)' }}
            >
              Subdomain
            </th>
            <th 
              className="text-left py-4 px-5 font-bold text-sm uppercase tracking-wide"
              style={{ color: 'var(--foreground)' }}
            >
              Status
            </th>
            <th 
              className="text-left py-4 px-5 font-bold text-sm uppercase tracking-wide"
              style={{ color: 'var(--foreground)' }}
            >
              Scanner
            </th>
            <th 
              className="text-left py-4 px-5 font-bold text-sm uppercase tracking-wide"
              style={{ color: 'var(--foreground)' }}
            >
              Submissions
            </th>
            <th 
              className="text-right py-4 px-5 font-bold text-sm uppercase tracking-wide"
              style={{ color: 'var(--foreground)' }}
            >
              Actions
            </th>
          </tr>
        </thead>
          <tbody>
          {tenants.map((tenant) => {
            const status = STATUS_CONFIG[tenant.status] || STATUS_CONFIG.inactive;
            const cssVars = getBrandingCSSVars(tenant.branding);
            
            return (
              <tr 
                key={tenant.id} 
                className="border-b transition-all duration-150 hover:bg-slate-50/80"
                style={{ 
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--background)'
                }}
              >
                <td className="py-4 px-5">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm"
                      style={{ 
                        backgroundColor: cssVars['--brand-primary'], 
                        color: 'white',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      {tenant.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div 
                        className="font-semibold text-base" 
                        style={{ color: 'var(--foreground)' }}
                      >
                        {tenant.name}
                      </div>
                      <div 
                        className="text-sm mt-0.5"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        Created {new Date(tenant.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-5">
                  <code 
                    className="text-sm px-3 py-1.5 rounded-md font-medium"
                    style={{ 
                      backgroundColor: 'var(--muted)', 
                      color: 'var(--foreground)'
                    }}
                  >
                    {tenant.subdomain}.remedygcc.com
                  </code>
                </td>
                <td className="py-4 px-5">
                  <div className="flex items-center gap-2.5">
                    <span 
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: status.dot }}
                    />
                    <span 
                      className="inline-flex px-3 py-1.5 rounded-lg text-sm font-semibold"
                      style={{ 
                        backgroundColor: status.bg, 
                        color: status.color
                      }}
                    >
                      {status.label}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-5">
                  {tenant.assignedScannerId ? (
                    <div className="flex items-center gap-2.5">
                      <div 
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'hsl(142 76% 36% / 0.1)' }}
                      >
                        <Scan className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                      </div>
                      <span 
                        className="text-sm font-medium truncate max-w-[180px]"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {tenant.assignedScannerName || tenant.assignedScannerId}
                      </span>
                    </div>
                  ) : (
                    <span 
                      className="text-sm italic font-medium"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      Not assigned
                    </span>
                  )}
                </td>
                <td className="py-4 px-5">
                  <span 
                    className="text-base font-bold"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {tenant.totalSubmissions.toLocaleString()}
                  </span>
                </td>
                <td className="py-4 px-5">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/tenants/${tenant.id}/edit`}
                      className="p-2.5 rounded-lg transition-all duration-150 hover:scale-105"
                      title="Edit tenant"
                      style={{ 
                        color: 'var(--muted-foreground)',
                        backgroundColor: 'var(--muted)',
                      }}
                    >
                      <Edit className="w-4.5 h-4.5" />
                    </Link>
                    <button
                      onClick={() => onDelete?.(tenant.id)}
                      disabled={isDeleting === tenant.id}
                      className="p-2.5 rounded-lg transition-all duration-150 hover:scale-105 disabled:cursor-not-allowed"
                      title="Delete tenant"
                      style={{ 
                        color: isDeleting === tenant.id ? 'var(--destructive)' : 'hsl(0 70% 50%)',
                        backgroundColor: isDeleting === tenant.id ? 'hsl(0 84% 60% / 0.1)' : 'var(--muted)',
                      }}
                    >
                      {isDeleting === tenant.id ? (
                        <span 
                          className="w-4.5 h-4.5 border-2 rounded-full animate-spin" 
                          style={{ 
                            borderColor: 'var(--destructive)',
                            borderTopColor: 'transparent' 
                          }} 
                        />
                      ) : (
                        <Trash2 className="w-4.5 h-4.5" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}