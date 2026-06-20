'use client';

import { useCallback, useRef, useState } from 'react';
import { ImageUp, Loader2, Trash2 } from 'lucide-react';

interface ClinicMediaUploaderProps {
  label: string;
  accept?: string;
  currentUrl?: string | null;
  uploading?: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => void;
}

export function ClinicMediaUploader({
  label,
  accept = 'image/png,image/jpeg,image/webp',
  currentUrl,
  uploading = false,
  onUpload,
  onRemove,
}: ClinicMediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    try {
      await onUpload(file);
    } finally {
      URL.revokeObjectURL(objectUrl);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [onUpload]);

  const displayUrl = preview || currentUrl;
  const hasImage = !!displayUrl;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>

      {hasImage ? (
        <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white group">
          <div className="flex h-36 items-center justify-center bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={displayUrl!} alt={label} className="h-full w-full object-contain p-2" />
          </div>
          <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <label className="cursor-pointer rounded-lg bg-white/90 p-1.5 shadow-sm hover:bg-white border border-gray-200">
              <ImageUp className="h-3.5 w-3.5 text-gray-600" />
              <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </label>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="rounded-lg bg-white/90 p-1.5 shadow-sm hover:bg-white border border-gray-200"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </button>
            )}
          </div>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            </div>
          )}
        </div>
      ) : (
        <label
          className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          {uploading ? (
            <Loader2 className="mb-1.5 h-5 w-5 animate-spin text-blue-600" />
          ) : (
            <ImageUp className="mb-1.5 h-5 w-5 text-gray-400" />
          )}
          <span className="text-xs text-gray-500">
            {uploading ? 'Uploading...' : `Upload ${label.toLowerCase()}`}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}
