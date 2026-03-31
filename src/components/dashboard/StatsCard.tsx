'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  iconColor: string;
}

export function StatsCard({ title, value, change, changeType = 'neutral', icon: Icon, iconColor }: StatsCardProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border hover:shadow-md transition-shadow" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>{title}</p>
          <p className="text-3xl font-bold mt-2" style={{ color: 'var(--foreground)' }}>{value}</p>
          {change && (
            <p className={cn(
              "text-sm mt-2 flex items-center gap-1",
              changeType === 'positive' && "text-emerald-600",
              changeType === 'negative' && "text-red-600",
              changeType === 'neutral' && "text-slate-500"
            )}>
              {change}
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-xl", iconColor)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}
