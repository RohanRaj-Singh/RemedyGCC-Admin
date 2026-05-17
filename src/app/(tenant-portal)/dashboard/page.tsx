import { Activity, ArrowRight, BarChart3, FileText, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { getCurrentTenantUserContext } from '@/modules/tenant-auth/utils/current-tenant-user';

const DASHBOARD_CARDS = [
  {
    title: 'Analytics Access',
    description: 'Protected tenant analytics pages stay isolated from scanner building and admin tooling.',
    href: '/analytics',
    icon: BarChart3,
  },
  {
    title: 'Reports',
    description: 'Reports access is locked behind the same tenant session and lifecycle checks.',
    href: '/reports',
    icon: FileText,
  },
  {
    title: 'Account Settings',
    description: 'Manage password changes and review the single dashboard owner account settings.',
    href: '/dashboard/settings',
    icon: ShieldCheck,
  },
] as const;

export default async function TenantDashboardPage() {
  const context = await getCurrentTenantUserContext();

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
              Dashboard Home
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              Secure access for analytics, reports, and future exports.
            </h2>
            <p className="mt-3 max-w-2xl text-base text-slate-600">
              This tenant workspace is intentionally narrow: one dashboard owner, one protected access path, and no exposure to scanner building or publishing infrastructure.
            </p>
          </div>

          <div className="rounded-3xl border border-teal-100 bg-teal-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
              Signed In
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {context?.user.username ?? 'Tenant Owner'}
            </p>
            <p className="text-sm text-slate-600">
              {context?.user.email ?? 'Dashboard account'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {DASHBOARD_CARDS.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(15,118,110,0.1)]">
                <Icon className="h-5 w-5 text-teal-700" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-teal-700">
                Open
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(2,132,199,0.1)]">
              <Activity className="h-5 w-5 text-sky-700" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Protected Analytics Surface</h3>
              <p className="text-sm text-slate-500">Built for tenant reporting, not platform administration.</p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(15,118,110,0.1)]">
              <ShieldCheck className="h-5 w-5 text-teal-700" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Session Isolation</h3>
              <p className="text-sm text-slate-500">Tenant cookies, guards, and sessions are separate from super admin auth.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
