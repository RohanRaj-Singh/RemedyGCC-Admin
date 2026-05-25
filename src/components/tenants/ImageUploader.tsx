'use client';

import { useState, useCallback, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import { Loader2, Upload, Image as ImageIcon, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploaderProps {
  value?: string;
  onUpload: (file: File) => Promise<void> | void;
  label?: string;
  acceptedFormats?: string[];
  maxSizeMB?: number;
  placeholder?: string;
  isUploading?: boolean;
}

const DEFAULT_FORMATS = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const DEFAULT_MAX_SIZE_MB = 5;

export function ImageUploader({
  value,
  onUpload,
  label = 'Branding Image',
  acceptedFormats = DEFAULT_FORMATS,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  placeholder = 'Upload branding image',
  isUploading = false,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value) {
      setPreviewUrl(value);
      setImageLoadFailed(false);
    } else if (!objectUrlRef.current) {
      setPreviewUrl(null);
    }
  }, [value]);

  useEffect(() => () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
  }, []);

  const validateFile = (file: File): string | null => {
    if (!acceptedFormats.includes(file.type)) {
      return `Invalid file type. Accepted formats: ${acceptedFormats
        .map((format) => format.split('/')[1].toUpperCase())
        .join(', ')}`;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File size exceeds ${maxSizeMB}MB limit`;
    }

    return null;
  };

  const handleFile = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setImageLoadFailed(false);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);

    try {
      await onUpload(file);
      objectUrlRef.current = null;
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : 'Failed to upload image.',
      );
    }
  }, [acceptedFormats, maxSizeMB, onUpload]);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      void handleFile(files[0]);
    }
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      void handleFile(files[0]);
    }
  };

  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          {label}
        </label>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        onChange={handleFileInput}
        className="hidden"
        aria-label={label}
      />

      {previewUrl ? (
        <button
          type="button"
          onClick={handleClick}
          className="relative block w-full overflow-hidden rounded-lg border text-left"
          style={{ borderColor: 'var(--border)' }}
        >
          {imageLoadFailed ? (
            <div className="flex h-40 w-full flex-col items-center justify-center bg-slate-50 px-4 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200">
                <ImageOff className="h-5 w-5 text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-700">Preview unavailable</p>
              <p className="mt-1 break-all text-xs text-slate-500">{previewUrl}</p>
            </div>
          ) : (
            <img
              src={previewUrl}
              alt="Branding preview"
              className="h-40 w-full bg-slate-50 object-contain"
              onError={() => setImageLoadFailed(true)}
            />
          )}

          <div className="absolute right-2 top-2 flex items-center gap-2 rounded-lg bg-white/90 px-2 py-1 text-xs font-medium shadow-sm">
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Replace
              </>
            )}
          </div>
        </button>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          role="button"
          tabIndex={0}
          aria-label={placeholder}
          className={cn(
            'relative flex h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
            isUploading && 'pointer-events-none opacity-70',
            isDragging
              ? 'border-[var(--primary)] bg-[var(--primary)]/5'
              : 'border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-slate-50',
          )}
        >
          <div
            className={cn(
              'mb-3 flex h-12 w-12 items-center justify-center rounded-full',
              isDragging ? 'bg-[var(--primary)]/10' : 'bg-slate-100',
            )}
          >
            {isUploading ? (
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--primary)' }} />
            ) : isDragging ? (
              <Upload className="h-6 w-6" style={{ color: 'var(--primary)' }} />
            ) : (
              <ImageIcon className="h-6 w-6" style={{ color: 'var(--muted-foreground)' }} />
            )}
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {isUploading ? 'Uploading image...' : isDragging ? 'Drop image here' : placeholder}
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            PNG, JPG, JPEG, WEBP up to {maxSizeMB}MB
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
