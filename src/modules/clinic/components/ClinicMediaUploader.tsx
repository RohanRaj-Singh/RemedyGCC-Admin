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
 * Shows a blob preview immediately when a file is selected, then transitions
 * to the server URL once the upload completes. The blob preview is kept alive
 * until the server URL is confirmed to avoid a flash of missing image.
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
  // Track the blob preview URL separately from the server URL
  const [blobPreview, setBlobPreview] = useState<string | null>(null);
  // Track whether we're waiting for the upload response to resolve
  const [pending, setPending] = useState(false);
  // Keep a ref to the blob URL so we can revoke it on cleanup
  const blobUrlRef = useRef<string | null>(null);

  // Track upload transitions: when uploading goes from true -> false,
  // the upload operation finished. Clear the blob preview and pending state.
  const prevUploadingRef = useRef(uploading);
  useEffect(() => {
    if (prevUploadingRef.current && !uploading) {
      // Upload just completed - clear blob preview
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setBlobPreview(null);
      setPending(false);
    }
    prevUploadingRef.current = uploading;
  }, [uploading]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create blob preview immediately
    const objectUrl = URL.createObjectURL(file);
    blobUrlRef.current = objectUrl;
    setBlobPreview(objectUrl);
    setPending(true);

    try {
      await onUpload(file);
    } catch {
      // Upload failed — revert preview
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setBlobPreview(null);
      setPending(false);
      if (inputRef.current) inputRef.current.value = '';
    }
    // Don't clear preview here — wait for currentUrl to update (via the effect above)
  }, [onUpload]);

  // Show blob preview during/after upload until currentUrl confirms
  // Then fall back to the server URL
  const displayUrl = blobPreview || currentUrl;
  const hasImage = !!displayUrl;
  const isBusy = uploading || pending;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>

      {hasImage ? (
        <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white group">
          <div className="flex h-36 items-center justify-center bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={displayUrl!} alt={label} className="h-full w-full object-contain p-2" />
          </div>

          {/* Overlay with progress indicator */}
          {isBusy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 mb-1" />
              <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
              <span className="text-xs text-blue-600 mt-1 font-medium">Uploading...</span>
            </div>
          )}

          {/* Action buttons — only show when not busy */}
          {!isBusy && (
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
          {isBusy ? (
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
