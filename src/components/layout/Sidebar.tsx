'use client';

import { LayoutDashboard, Building2, Scan, FileText, Settings, FileStack, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { id: 'tenants', label: 'Tenants', icon: Building2, href: '/tenants' },
  { id: 'scanners', label: 'Scanners', icon: Scan, href: '/scanners' },
  { id: 'logs', label: 'System Logs', icon: FileText, href: '/logs' },
  { id: 'attribute-templates', label: 'Attribute Templates', icon: FileStack, href: '/attribute-templates' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full transition-all duration-300 z-50",
        collapsed ? "w-16" : "w-64"
      )}
      style={{
        width: collapsed ? '4rem' : '16rem',
        minWidth: collapsed ? '4rem' : '16rem',
        backgroundColor: 'var(--primary)',
      }}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary-foreground)' }}>
              <span className="font-bold text-sm" style={{ color: 'var(--primary)' }}>R</span>
            </div>
            <span className="font-bold text-lg text-white">RemedyGCC</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'rgba(255,255,255,0.7)' }}
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      <nav className="p-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => onTabChange?.(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                isActive ? "text-white shadow-lg" : "text-white/60 hover:text-white hover:bg-white/10"
              )}
              style={isActive ? { background: 'rgba(255,255,255,0.15)' } : {}}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <button
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:text-red-400 hover:bg-white/10 transition-all duration-200",
            collapsed && "justify-center"
          )}
          title={collapsed ? "Logout" : undefined}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && <span className="font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
