'use client';

import { SystemLog } from '@/types';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogsTableProps {
  logs: SystemLog[];
}

const levelConfig = {
  info: { label: 'Info', icon: Info, color: 'text-blue-600 bg-blue-50' },
  warning: { label: 'Warning', icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
  error: { label: 'Error', icon: AlertCircle, color: 'text-red-600 bg-red-50' },
};

const moduleConfig = {
  tenant: { label: 'Tenant', color: 'text-purple-600 bg-purple-50' },
  scanner: { label: 'Scanner', color: 'text-cyan-600 bg-cyan-50' },
  submission: { label: 'Submission', color: 'text-emerald-600 bg-emerald-50' },
  system: { label: 'System', color: 'text-slate-600 bg-slate-100' },
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  // Less than 1 hour
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}m ago`;
  }
  
  // Less than 24 hours
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}h ago`;
  }
  
  // Less than 7 days
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}d ago`;
  }
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function LogsTable({ logs }: LogsTableProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ backgroundColor: 'var(--secondary)', borderColor: 'var(--border)' }}>
              <th className="text-left px-6 py-4 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Level</th>
              <th className="text-left px-6 py-4 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Message</th>
              <th className="text-left px-6 py-4 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Module</th>
              <th className="text-left px-6 py-4 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Tenant</th>
              <th className="text-left px-6 py-4 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const LevelIcon = levelConfig[log.level].icon;
              const module = moduleConfig[log.module];
              
              return (
                <tr 
                  key={log.id} 
                  className="border-b hover:bg-slate-50/50 transition-colors"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="px-6 py-4">
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", levelConfig[log.level].color)}>
                      <LevelIcon className="w-3.5 h-3.5" />
                      {levelConfig[log.level].label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>{log.message}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", module.color)}>
                      {module.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {log.tenantId ? (
                      <span className="text-sm font-mono" style={{ color: 'var(--foreground)' }}>{log.tenantId.slice(0, 8)}</span>
                    ) : (
                      <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{formatTimestamp(log.timestamp)}</span>
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
