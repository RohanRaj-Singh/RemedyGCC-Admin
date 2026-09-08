import { Building2 } from 'lucide-react';
import { TenantPortalNav } from '@/components/tenant-portal/TenantPortalNav';
import { RealtimeProvider } from '@/components/realtime/RealtimeProvider';

export default function TenantPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RealtimeProvider>
      <div className="min-h-screen bg-[linear-gradient(180deg,#f4fbfa_0%,#f8fafc_55%,#ffffff_100%)]">
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,#0f766e,#134e4a)] text-white shadow-sm">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
                    Tenant Dashboard
                  </p>
                  <h1 className="text-2xl font-semibold text-slate-900">
                    Tenant Workspace
                  </h1>
                </div>
              </div>
            </div>

            <TenantPortalNav />
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
          {children}
        </main>
      </div>
    </RealtimeProvider>
  );
}
