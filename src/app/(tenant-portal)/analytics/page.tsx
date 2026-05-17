export default function TenantAnalyticsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
          Analytics
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          Protected tenant analytics access
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          This route is intentionally behind tenant dashboard authentication and stays separate from scanner creation, publishing, and platform administration.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Tenant session</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">Active</p>
        </div>
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Analytics scope</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">Tenant only</p>
        </div>
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Export readiness</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">Future-ready</p>
        </div>
      </div>
    </div>
  );
}
