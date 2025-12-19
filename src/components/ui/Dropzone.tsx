'use client';

import { useCallback } from 'react';
import { useDropzone, type Accept } from 'react-dropzone';
import { clsx } from 'clsx';
import { UploadIcon } from './Icons';

interface DropzoneProps {
  onDrop: (files: File[]) => void;
  accept?: Accept;
  maxFiles?: number;
  maxSize?: number;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

export function Dropzone({
  onDrop,
  accept = {
    'image/*': ['.png', '.jpg', '.jpeg', '.jfif', '.webp', '.svg', '.bmp', '.tiff'],
  },
  maxFiles = 20,
  maxSize = 50 * 1024 * 1024, // 50MB
  disabled = false,
  compact = false,
  className,
}: DropzoneProps) {
  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onDrop(acceptedFiles);
      }
    },
    [onDrop]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop: handleDrop,
    accept,
    maxFiles,
    maxSize,
    disabled,
    multiple: true,
  });

  if (compact) {
    return (
      <div
        {...getRootProps()}
        role="button"
        aria-label="Upload images"
        tabIndex={disabled ? -1 : 0}
        className={clsx(
          'flex items-center gap-3 p-3 border-2 border-dashed rounded-lg transition-all cursor-pointer',
          isDragActive && !isDragReject 
            ? 'border-accent-500 bg-accent-500/10' 
            : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-600',
          isDragReject && 'border-red-500 bg-red-500/5',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <input {...getInputProps()} aria-label="File input" />
        <div className={clsx(
          'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
          isDragActive ? 'bg-accent-500/20' : 'bg-zinc-800'
        )}>
          <UploadIcon className={clsx(
            'w-5 h-5 transition-colors',
            isDragActive ? 'text-accent-400' : 'text-zinc-500'
          )} />
        </div>
        <div>
          <p className={clsx(
            'text-sm font-medium transition-colors',
            isDragActive ? 'text-accent-400' : 'text-zinc-300'
          )}>
            {isDragActive ? 'Drop here' : 'Add images'}
          </p>
          <p className="text-xs text-zinc-500">
            Drop files or <span className="text-accent-400">browse</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      role="button"
      aria-label="Upload images"
      tabIndex={disabled ? -1 : 0}
      className={clsx(
        'dropzone',
        isDragActive && !isDragReject && 'dropzone-active',
        isDragReject && 'border-red-500 bg-red-500/5',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <input {...getInputProps()} aria-label="File input" />
      <div className={clsx(
        'w-16 h-16 rounded-full flex items-center justify-center transition-colors',
        isDragActive ? 'bg-accent-500/20' : 'bg-zinc-800'
      )}>
        <UploadIcon className={clsx(
          'w-8 h-8 transition-colors',
          isDragActive ? 'text-accent-400' : 'text-zinc-500'
        )} />
      </div>
      <div className="text-center">
        <p className={clsx(
          'text-lg font-medium transition-colors',
          isDragActive ? 'text-accent-400' : 'text-zinc-300'
        )}>
          {isDragActive ? 'Drop files here' : 'Drag & drop images here'}
        </p>
        <p className="text-sm text-zinc-500 mt-1">
          or <span className="text-accent-400 cursor-pointer hover:underline">browse files</span>
        </p>
      </div>
      <p className="text-xs text-zinc-600 mt-2">
        PNG, JPG, WebP, SVG, BMP, TIFF • Max {maxFiles} files • Max 50MB each
      </p>
    </div>
  );
}
