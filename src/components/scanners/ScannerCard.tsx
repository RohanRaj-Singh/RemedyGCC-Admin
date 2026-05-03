'use client';

import Link from 'next/link';
import { Scanner } from '@/modules/scanner/types';
import { Scan, CheckCircle, XCircle, Archive, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScannerCardProps {
  scanner: Scanner;
  onEdit?: (scanner: Scanner) => void;
  onDelete?: (id: string) => void;
}

export function ScannerCard({ scanner, onEdit, onDelete }: ScannerCardProps) {
  const getStatusDisplay = (status: Scanner['status']) => {
    switch (status) {
      case 'published':
        return { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Published' };
      case 'draft':
        return { icon: XCircle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Draft' };
      case 'archived':
        return { icon: Archive, color: 'text-slate-500', bg: 'bg-slate-50', label: 'Archived' };
    }
  };

  const status = getStatusDisplay(scanner.status);
  const StatusIcon = status.icon;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border hover:shadow-md transition-all" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className={cn(
            "p-3 rounded-xl",
            scanner.status === 'published' ? "bg-emerald-50" : "bg-slate-100"
          )}>
            <Scan className={cn(
              "w-6 h-6",
              scanner.status === 'published' ? "text-emerald-600" : "text-slate-400"
            )} />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>{scanner.name.en}</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {scanner.description?.en || 'No description'}
            </p>
            <div className="flex items-center gap-4 mt-3">
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {scanner.questionCount} questions
              </span>
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Template: {scanner.attributeTemplateName || 'N/A'}
              </span>
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                v{scanner.latestVersionNumber}
              </span>
            </div>
            {scanner.hasUnpublishedChanges && (
              <div className="mt-3 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                Draft changes pending publish
              </div>
            )}
          </div>
        </div>
        <Link
          href={`/scanners/${scanner.id}/edit`}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          style={{ color: 'var(--muted-foreground)' }}
          title="Edit scanner"
        >
          <Pencil className="w-4 h-4" />
        </Link>
      </div>
      
      <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <StatusIcon className={cn("w-4 h-4", status.color)} />
          <span className={cn("text-sm font-medium", status.color)}>{status.label}</span>
        </div>
        <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Updated {new Date(scanner.updatedAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
