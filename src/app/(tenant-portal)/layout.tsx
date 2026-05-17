import Link from 'next/link';
import { Building2, LockKeyhole, LogOut } from 'lucide-react';
import { TenantPortalNav } from '@/components/tenant-portal/TenantPortalNav';
import { requireCurrentTenantUser } from '@/modules/tenant-auth/utils/current-tenant-user';
import { getTenantDocumentById } from '@/server/tenant/repository';

export default async function TenantPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireCurrentTenantUser({
    allowPasswordChange: true,
    nextPath: '/dashboard',
  });
  const tenant = await getTenantDocumentById(context.user.tenantId);

  return (
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
                  {tenant?.name ?? 'Tenant Workspace'}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Signed in as {context.user.email}
                </p>
              </div>
            </div>

            <form action="/api/tenant-auth/logout" method="post">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </form>
          </div>

          <TenantPortalNav />
        </div>
      </header>

      {context.user.mustChangePassword ? (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3 text-sm text-amber-900 lg:px-8">
            <LockKeyhole className="h-4 w-4" />
            Password change is required before continuing. Update it now to unlock the full dashboard.
            <Link href="/dashboard/change-password" className="font-semibold underline">
              Change password
            </Link>
          </div>
        </div>
      ) : null}

      <main className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
