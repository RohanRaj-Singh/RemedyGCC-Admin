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
import { TenantTable, BrandingDialog, BrandingEditor } from '@/components/tenants';
import { ScannerCard } from '@/components/scanners';
import { LogsTable } from '@/components/logs';
import { TemplateList } from '@/modules/attribute-template/components';
import { useDashboard, useTenants, useScanners, useLogs } from '@/hooks';
import { updateTenant } from '@/modules/tenant/service';
import { Tenant as TenantType, BrandingConfig } from '@/modules/tenant/types';
import { Tenant } from '@/types';
import { cn } from '@/lib/utils';

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

  const [brandingDialogOpen, setBrandingDialogOpen] = useState(false);
  const [selectedTenantForBranding, setSelectedTenantForBranding] = useState<TenantType | null>(null);

  const loading = statsLoading || tenantsLoading || scannersLoading || logsLoading;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabType);
  };

  const handleEditBranding = (tenant: TenantType) => {
    setSelectedTenantForBranding(tenant);
    setBrandingDialogOpen(true);
  };

  const handleSaveBranding = async (branding: Partial<BrandingConfig>) => {
    if (!selectedTenantForBranding) return;
    await updateTenant(selectedTenantForBranding.id, { branding });
    setBrandingDialogOpen(false);
    setSelectedTenantForBranding(null);
  };

  return (
    <div className="min-h-screen bg-white">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      <main 
        className="transition-all duration-300"
        style={{ marginLeft: '16rem' }}
      >
        <Header 
          title={tabTitles[activeTab]} 
          subtitle={`Manage your ${activeTab} settings and configurations`}
        />
        
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
                      title="Active Scanners"
                      value={stats.activeScanners}
                      change="+5% from last month"
                      changeType="positive"
                      icon={Scan}
                      iconColor="bg-gradient-to-br from-emerald-400 to-teal-600"
                    />
                    <StatsCard
                      title="Total Submissions"
                      value={stats.totalSubmissions.toLocaleString()}
                      change="+23% from last month"
                      changeType="positive"
                      icon={Activity}
                      iconColor="bg-gradient-to-br from-purple-400 to-pink-600"
                    />
                    <StatsCard
                      title="System Logs"
                      value={stats.totalLogs}
                      change="2 critical alerts"
                      changeType="negative"
                      icon={FileText}
                      iconColor="bg-gradient-to-br from-amber-400 to-orange-600"
                    />
                  </div>

                  {/* Branding Stats */}
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
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tenants Tab */}
              {activeTab === 'tenants' && (
                <div className="space-y-6">
                  <TenantTable 
                    tenants={tenants} 
                    onEdit={(tenant) => console.log('Edit', tenant)}
                    onDelete={(id) => console.log('Delete', id)}
                    onAssignScanner={(tenant) => console.log('Assign scanner', tenant)}
                  />
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
                        onEdit={(scanner) => console.log('Edit', scanner)}
                        onDelete={(id) => console.log('Delete', id)}
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

              {/* Branding Dialog */}
              <BrandingDialog
                open={brandingDialogOpen}
                onClose={() => setBrandingDialogOpen(false)}
                title={`Edit Branding - ${selectedTenantForBranding?.name || ''}`}
              >
                {selectedTenantForBranding && (
                  <BrandingEditor
                    branding={selectedTenantForBranding.branding}
                    onSave={handleSaveBranding}
                    onCancel={() => setBrandingDialogOpen(false)}
                  />
                )}
              </BrandingDialog>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
