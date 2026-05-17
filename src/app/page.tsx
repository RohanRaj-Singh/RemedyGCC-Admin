'use client';

/**
 * Super Admin Dashboard - Main Page
 * Refactored to use clean architecture pattern
 */

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Scan, Activity, FileText, Plus, Palette } from 'lucide-react';
import { Sidebar, Header } from '@/components/layout';
import { StatsCard } from '@/components/dashboard';
import { ScannerCard } from '@/components/scanners';
import { LogsTable } from '@/components/logs';
import { TemplateList } from '@/modules/attribute-template/components';
import { TenantList } from '@/modules/tenant/components';
import { getTenantHostname } from '@/modules/tenant/utils';
import { useDashboard, useTenants, useScanners, useLogs } from '@/hooks';

type TabType = 'dashboard' | 'tenants' | 'scanners' | 'logs' | 'attribute-templates' | 'settings';

const tabTitles = {
  dashboard: 'Dashboard',
  tenants: 'Tenants',
  scanners: 'Scanners',
  logs: 'System Logs',
  'attribute-templates': 'Attribute Templates',
  settings: 'Settings',
};

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  const { stats, loading: statsLoading } = useDashboard();
  const { tenants, loading: tenantsLoading } = useTenants();
  const { scanners, loading: scannersLoading } = useScanners();
  const { logs, loading: logsLoading } = useLogs();

  const loading = statsLoading || tenantsLoading || scannersLoading || logsLoading;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabType);
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      <main 
        className="transition-all duration-300"
        style={{ marginLeft: '16rem' }}
      >
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--primary)' }}></div>
            </div>
          ) : (
            <>
              {/* Dashboard Tab */}
              {activeTab === 'dashboard' && stats && (
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatsCard
                      title="Total Tenants"
                      value={stats.totalTenants}
                      change="+12% from last month"
                      changeType="positive"
                      icon={Building2}
                      iconColor="bg-gradient-to-br from-cyan-400 to-blue-600"
                    />
                    <StatsCard
                      title="Active Tenants"
                      value={stats.activeTenants}
                      change={`${stats.draftTenants ?? 0} still in draft`}
                      changeType="positive"
                      icon={Scan}
                      iconColor="bg-gradient-to-br from-green-400 to-emerald-600"
                    />
                    <StatsCard
                      title="Total Submissions"
                      value={stats.totalSubmissions ?? 0}
                      change="+5% from last week"
                      changeType="positive"
                      icon={Activity}
                      iconColor="bg-gradient-to-br from-purple-400 to-violet-600"
                    />
                    <StatsCard
                      title="Active Runtime Configs"
                      value={stats.activeRuntimeConfigs ?? 0}
                      change={`${stats.archivedTenants ?? 0} archived tenants`}
                      changeType="positive"
                      icon={FileText}
                      iconColor="bg-gradient-to-br from-amber-400 to-orange-600"
                    />
                  </div>

                  {/* Two Column Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Tenants */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Recent Tenants</h2>
                        <Link 
                          href="/tenants"
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          View all
                        </Link>
                      </div>
                      <div className="space-y-3">
                        {tenants.slice(0, 5).map((tenant) => (
                          <div key={tenant.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-medium" style={{ color: 'var(--foreground)' }}>{tenant.name}</p>
                              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                {getTenantHostname(tenant.subdomain)}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                                tenant.status === 'active' ? 'bg-green-100 text-green-700' :
                                tenant.status === 'disabled' ? 'bg-slate-100 text-slate-700' :
                                tenant.status === 'archived' ? 'bg-zinc-100 text-zinc-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {tenant.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Scanner Status */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Scanner Status</h2>
                        <Link 
                          href="/scanners"
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          View all
                        </Link>
                      </div>
                      <div className="space-y-3">
                        {scanners.slice(0, 5).map((scanner) => (
                          <div key={scanner.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-medium" style={{ color: 'var(--foreground)' }}>{scanner.name.en}</p>
                              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                v{scanner.latestVersionNumber} • {scanner.questionCount} questions
                              </p>
                            </div>
                            <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                              scanner.status === 'published' ? 'bg-green-100 text-green-700' :
                              scanner.status === 'archived' ? 'bg-slate-100 text-slate-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {scanner.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Recent Logs */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Recent System Logs</h2>
                    <div className="overflow-x-auto">
                      <LogsTable logs={logs.slice(0, 10)} />
                    </div>
                  </div>

                  {/* Tenant Statistics by Branding */}
                  {stats.tenantsByBranding && (
                    <div 
                      className="rounded-xl border p-4"
                      style={{ 
                        backgroundColor: 'var(--background)',
                        borderColor: 'var(--border)'
                      }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Palette className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                        <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Branding Overview</h3>
                      </div>
                      <div className="flex gap-6">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-violet-500" />
                          <span style={{ color: 'var(--foreground)' }}>
                            <strong>{stats.tenantsByBranding.custom}</strong> Custom Branding
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gray-400" />
                          <span style={{ color: 'var(--foreground)' }}>
                            <strong>{stats.tenantsByBranding.default}</strong> Default Branding
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-amber-500" />
                          <span style={{ color: 'var(--foreground)' }}>
                            <strong>{stats.tenantsByBranding.withWarnings || 0}</strong> Fallback Warnings
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tenants Tab */}
              {activeTab === 'tenants' && (
                <div className="space-y-6">
                  <TenantList tenants={tenants} />
                </div>
              )}

              {/* Scanners Tab */}
              {activeTab === 'scanners' && (
                <div className="space-y-6">
                  <div className="flex justify-end">
                    <Link
                      href="/scanners/new"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Create Scanner
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {scanners.map((scanner) => (
                      <ScannerCard 
                        key={scanner.id} 
                        scanner={scanner}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Logs Tab */}
              {activeTab === 'logs' && (
                <div className="space-y-6">
                  <LogsTable logs={logs} />
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Settings</h2>
                  <p className="" style={{ color: 'var(--muted-foreground)' }}>Settings configuration coming soon...</p>
                </div>
              )}

              {/* Attribute Templates Tab */}
              {activeTab === 'attribute-templates' && (
                <TemplateList />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
