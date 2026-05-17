export default function TenantReportsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
          Reports
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          Secure reporting workspace
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Reports remain available only inside the tenant dashboard session boundary and are intentionally separated from runtime infrastructure management.
        </p>
      </section>

      <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-sm">
        Reporting surfaces are now protected by tenant auth and ready for future tenant report implementations.
      </div>
    </div>
  );
}
