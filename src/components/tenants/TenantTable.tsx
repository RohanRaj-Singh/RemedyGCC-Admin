'use client';

import { Tenant } from '@/types';
import { Building2, MoreVertical, Shield, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TenantTableProps {
  tenants: Tenant[];
  onEdit?: (tenant: Tenant) => void;
  onDelete?: (id: string) => void;
  onAssignScanner?: (tenant: Tenant) => void;
}

const statusConfig = {
  active: { label: 'Active', icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50' },
  inactive: { label: 'Inactive', icon: ShieldOff, color: 'text-slate-600 bg-slate-50' },
  suspended: { label: 'Suspended', icon: ShieldAlert, color: 'text-red-600 bg-red-50' },
};

export function TenantTable({ tenants, onEdit, onDelete, onAssignScanner }: TenantTableProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ backgroundColor: 'var(--secondary)', borderColor: 'var(--border)' }}>
              <th className="text-left px-6 py-4 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Tenant</th>
              <th className="text-left px-6 py-4 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Domain</th>
              <th className="text-left px-6 py-4 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Status</th>
              <th className="text-left px-6 py-4 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Submissions</th>
              <th className="text-left px-6 py-4 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Scanner</th>
              <th className="text-left px-6 py-4 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => {
              const StatusIcon = statusConfig[tenant.status].icon;
              
              return (
                <tr 
                  key={tenant.id} 
                  className="border-b hover:bg-slate-50/50 transition-colors"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center" 
                        style={{ background: tenant.branding.colorScheme.primaryColor }}
                      >
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold" style={{ color: 'var(--foreground)' }}>{tenant.name}</p>
                        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{tenant.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm" style={{ color: 'var(--foreground)' }}>{tenant.domain}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", statusConfig[tenant.status].color)}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {statusConfig[tenant.status].label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{tenant.totalSubmissions}</span>
                  </td>
                  <td className="px-6 py-4">
                    {tenant.scannerId ? (
                      <span className="text-sm font-medium text-emerald-600">Assigned</span>
                    ) : (
                      <button
                        onClick={() => onAssignScanner?.(tenant)}
                        className="text-sm font-medium"
                        style={{ color: 'var(--primary)' }}
                      >
                        + Assign
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEdit?.(tenant)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        style={{ color: 'var(--muted-foreground)' }}
                        title="Edit tenant"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}