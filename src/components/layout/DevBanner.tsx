'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

export function DevBanner() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="relative z-50">
      <div className="bg-[#f58220]/10 border-b border-[#f37820]/30 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 py-2 flex items-center justify-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-[#f58220] flex-shrink-0" />
          <span className="text-[#f58220] font-medium">
            Development Preview
          </span>
          <span className="text-[#1386a3]">
            — This is a testing environment. Features are under active development.
          </span>
          <button
            onClick={() => setVisible(false)}
            className="ml-2 p-1 rounded hover:bg-[#f58220]/20 transition-colors text-[#f58220]"
            aria-label="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
