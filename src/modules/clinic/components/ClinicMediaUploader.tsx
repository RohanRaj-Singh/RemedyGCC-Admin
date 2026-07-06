'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageUp, Loader2, Trash2 } from 'lucide-react';

interface ClinicMediaUploaderProps {
  label: string;
  accept?: string;
  currentUrl?: string | null;
  uploading?: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => void;
}

/**
 * Upload a single clinic media file (logo, card image, cover).
 *
 * Shows a blob preview immediately when a file is selected. The blob preview
 * persists until the user picks another file or the component unmounts.
 * This prevents a flash of missing image when the server file overwrites
 * the same URL path (the currentUrl prop does not change on re-upload).
 */
export function ClinicMediaUploader({
  label,
  accept = 'image/png,image/jpeg,image/webp',
  currentUrl,
  uploading = false,
  onUpload,
  onRemove,
}: ClinicMediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Blob preview URL for the currently selected file
  const [blobPreview, setBlobPreview] = useState<string | null>(null);
  // Keep a ref so we can revoke on unmount
  const blobUrlRef = useRef<string | null>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revoke previous blob URL if any
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }

    // Create blob preview immediately
    const objectUrl = URL.createObjectURL(file);
    blobUrlRef.current = objectUrl;
    setBlobPreview(objectUrl);

    try {
      await onUpload(file);
    } catch {
      // Upload failed — revert to server URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setBlobPreview(null);
      if (inputRef.current) inputRef.current.value = '';
    }
    // Keep blob preview until user picks another file
  }, [onUpload]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  // Blob preview takes priority while it exists; otherwise show server URL
  const displayUrl = blobPreview || currentUrl;
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

          {/* Overlay with progress indicator — only during active upload */}
          {uploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 mb-1" />
              <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
              <span className="text-xs text-blue-600 mt-1 font-medium">Uploading...</span>
            </div>
          )}

          {/* Action buttons — only show when not uploading */}
          {!uploading && (
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
          )}
        </div>
      ) : (
        <label className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors">
          {uploading ? (
            <>
              <Loader2 className="mb-1.5 h-5 w-5 animate-spin text-blue-600" />
              <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden mb-1">
                <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
              <span className="text-xs text-blue-600 font-medium">Uploading...</span>
            </>
          ) : (
            <>
              <ImageUp className="mb-1.5 h-5 w-5 text-gray-400" />
              <span className="text-xs text-gray-500">Upload {label.toLowerCase()}</span>
            </>
          )}
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
