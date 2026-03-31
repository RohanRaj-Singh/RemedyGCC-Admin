'use client';

import { Bell, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="h-16 bg-white/80 backdrop-blur-xl border-b flex items-center justify-between px-6 sticky top-0 z-40" style={{ borderColor: 'var(--border)' }}>
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{title}</h1>
        {subtitle && (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{subtitle}</p>
        )}
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
          <input
            type="text"
            placeholder="Search..."
            className="pl-10 pr-4 py-2 w-64 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all"
            style={{ 
              backgroundColor: 'var(--secondary)', 
              borderColor: 'var(--border)',
              color: 'var(--foreground)'
            }}
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors" style={{ color: 'var(--muted-foreground)' }}>
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* User */}
        <div className="flex items-center gap-3 pl-4 border-l" style={{ borderColor: 'var(--border)' }}>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Admin User</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Super Admin</p>
          </div>
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--primary)' }}>
            <User className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>
    </header>
  );
}
