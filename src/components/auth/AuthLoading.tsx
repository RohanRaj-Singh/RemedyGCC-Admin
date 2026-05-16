'use client';

import { Loader2 } from 'lucide-react';

interface AuthLoadingProps {
  message?: string;
}

export function AuthLoading({ message = 'Loading...' }: AuthLoadingProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-gray-500">{message}</p>
      </div>
    </div>
  );
}