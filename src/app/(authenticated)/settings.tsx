import { Settings as SettingsIcon, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div className="p-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-[#126479]/10 flex items-center justify-center mx-auto mb-4">
          <SettingsIcon className="w-8 h-8 text-[#126479]" />
        </div>
        <h2 className="text-xl font-semibold mb-2 text-gray-900">Settings</h2>
        <p className="text-[#1386a3] mb-6">Platform settings and configuration options are currently under development.</p>
        <Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#126479] text-white font-semibold rounded-lg hover:bg-[#126479]/90 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
