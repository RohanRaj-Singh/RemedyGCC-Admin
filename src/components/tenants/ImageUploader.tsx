'use client';

import { useState, useCallback, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import { Upload, X, Image as ImageIcon, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploaderProps {
  value?: string;
  onChange: (url: string | null) => void;
  label?: string;
  acceptedFormats?: string[];
  maxSizeMB?: number;
  placeholder?: string;
}

const DEFAULT_FORMATS = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
const DEFAULT_MAX_SIZE_MB = 5;

export function ImageUploader({
  value,
  onChange,
  label = 'Branding Image',
  acceptedFormats = DEFAULT_FORMATS,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  placeholder = 'Upload branding image',
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreviewUrl(value || null);
    setImageLoadFailed(false);
  }, [value]);

  const validateFile = (file: File): string | null => {
    if (!acceptedFormats.includes(file.type)) {
      return `Invalid file type. Accepted formats: ${acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}`;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File size exceeds ${maxSizeMB}MB limit`;
    }
    return null;
  };

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImageLoadFailed(false);
      setPreviewUrl(result);
      onChange(result);
    };
    reader.readAsDataURL(file);
  }, [onChange, acceptedFormats, maxSizeMB]);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          handleFile(file);
          break;
        }
      }
    }
  }, [handleFile]);

  const handleClear = () => {
    setPreviewUrl(null);
    onChange(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
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
        <div className="relative rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {imageLoadFailed ? (
            <div className="w-full h-40 bg-slate-50 flex flex-col items-center justify-center px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center mb-3">
                <ImageOff className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-700">Preview unavailable</p>
              <p className="text-xs text-slate-500 mt-1 break-all">
                {previewUrl}
              </p>
            </div>
          ) : (
            <img
              src={previewUrl}
              alt="Branding preview"
              className="w-full h-40 object-contain bg-slate-50"
              onError={() => setImageLoadFailed(true)}
            />
          )}
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              type="button"
              onClick={handleClick}
              className="p-1.5 rounded-lg bg-white/90 hover:bg-white shadow-sm transition-colors"
              title="Replace image"
            >
              <Upload className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-lg bg-white/90 hover:bg-white shadow-sm transition-colors"
              title="Remove image"
            >
              <X className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          onPaste={handlePaste}
          role="button"
          tabIndex={0}
          aria-label={placeholder}
          className={cn(
            "relative flex flex-col items-center justify-center h-40 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
            isDragging
              ? "border-[var(--primary)] bg-[var(--primary)]/5"
              : "border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-slate-50"
          )}
        >
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center mb-3",
            isDragging ? "bg-[var(--primary)]/10" : "bg-slate-100"
          )}>
            {isDragging ? (
              <Upload className="w-6 h-6" style={{ color: 'var(--primary)' }} />
            ) : (
              <ImageIcon className="w-6 h-6" style={{ color: 'var(--muted-foreground)' }} />
            )}
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {isDragging ? 'Drop image here' : placeholder}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
            PNG, JPG, SVG up to {maxSizeMB}MB
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
