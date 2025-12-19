'use client';

import { useCallback } from 'react';
import { useImageStore } from '@/store/imageStore';
import { Dropzone } from './ui/Dropzone';
import { 
  TrashIcon, 
  LoaderIcon, 
  ImageIcon,
  XIcon,
  CheckIcon,
} from './ui/Icons';
import { formatFileSize } from '@/lib/utils';
import { clsx } from 'clsx';
import type { ImageFile } from '@/types';

interface ImageLibraryProps {
  selectedIds?: string[];
  onSelect?: (image: ImageFile) => void;
  onDeselect?: (imageId: string) => void;
  maxSelection?: number;
  showUpload?: boolean;
  compact?: boolean;
  className?: string;
}

export function ImageLibrary({
  selectedIds = [],
  onSelect,
  onDeselect,
  maxSelection,
  showUpload = true,
  compact = false,
  className,
}: ImageLibraryProps) {
  const { images, uploadFiles, removeImage, clearImages } = useImageStore();

  const handleFileDrop = useCallback(async (files: File[]) => {
    await uploadFiles(files);
  }, [uploadFiles]);

  const handleImageClick = useCallback((image: ImageFile) => {
    if (image.uploading || image.error) return;
    
    const isSelected = selectedIds.includes(image.id);
    
    if (isSelected) {
      onDeselect?.(image.id);
    } else {
      if (maxSelection && selectedIds.length >= maxSelection) {
        // Deselect first item and select new one
        const firstSelectedId = selectedIds[0];
        if (firstSelectedId) {
          onDeselect?.(firstSelectedId);
        }
      }
      onSelect?.(image);
    }
  }, [selectedIds, onSelect, onDeselect, maxSelection]);

  const uploadedImages = images.filter(img => !img.uploading && !img.error);
  const uploadingImages = images.filter(img => img.uploading);

  if (compact) {
    return (
      <div className={clsx("space-y-3", className)}>
        {/* Compact upload */}
        {showUpload && (
          <Dropzone onDrop={handleFileDrop} compact />
        )}
        
        {/* Compact image grid */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((image) => {
              const isSelected = selectedIds.includes(image.id);
              return (
                <div
                  key={image.id}
                  onClick={() => handleImageClick(image)}
                  className={clsx(
                    "relative w-16 h-16 rounded-lg overflow-hidden cursor-pointer transition-all",
                    "border-2",
                    isSelected
                      ? "border-accent-500 ring-2 ring-accent-500/30"
                      : "border-transparent hover:border-zinc-600",
                    image.uploading && "opacity-50",
                    image.error && "border-red-500/50"
                  )}
                >
                  {image.format === 'svg' ? (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-zinc-500" />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.previewUrl}
                      alt={image.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  {image.uploading && (
                    <div className="absolute inset-0 bg-zinc-950/70 flex items-center justify-center">
                      <LoaderIcon className="w-4 h-4 text-accent-400" />
                    </div>
                  )}
                  {isSelected && !image.uploading && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-accent-500 rounded-full flex items-center justify-center">
                      <CheckIcon className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {image.error && (
                    <div className="absolute inset-0 bg-red-950/70 flex items-center justify-center">
                      <XIcon className="w-4 h-4 text-red-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {images.length === 0 && !showUpload && (
          <p className="text-sm text-zinc-500 text-center py-4">No images in library</p>
        )}
      </div>
    );
  }

  return (
    <div className={clsx("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-zinc-300">
            Image Library
          </h3>
          <span className="text-xs text-zinc-500">
            ({uploadedImages.length} {uploadedImages.length === 1 ? 'image' : 'images'})
          </span>
          {uploadingImages.length > 0 && (
            <span className="text-xs text-accent-400 flex items-center gap-1">
              <LoaderIcon className="w-3 h-3" />
              Uploading {uploadingImages.length}...
            </span>
          )}
        </div>
        {images.length > 0 && (
          <button
            onClick={clearImages}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Upload area */}
      {showUpload && (
        <Dropzone onDrop={handleFileDrop} />
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((image) => {
            const isSelected = selectedIds.includes(image.id);
            return (
              <div
                key={image.id}
                className={clsx(
                  "group relative rounded-lg overflow-hidden cursor-pointer transition-all",
                  "border-2",
                  isSelected
                    ? "border-accent-500 ring-2 ring-accent-500/30"
                    : "border-zinc-800 hover:border-zinc-700",
                  image.uploading && "opacity-60",
                  image.error && "border-red-500/50"
                )}
                onClick={() => handleImageClick(image)}
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-zinc-900">
                  {image.format === 'svg' ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-10 h-10 text-zinc-600" />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.previewUrl}
                      alt={image.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                {/* Info overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-zinc-950/90 to-transparent p-2 pt-6">
                  <p className="text-xs text-zinc-300 truncate">{image.name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                    <span className="uppercase">{image.format}</span>
                    {image.width > 0 && <span>{image.width}×{image.height}</span>}
                    <span>{formatFileSize(image.size)}</span>
                  </div>
                </div>

                {/* Loading overlay */}
                {image.uploading && (
                  <div className="absolute inset-0 bg-zinc-950/70 flex items-center justify-center">
                    <LoaderIcon className="w-6 h-6 text-accent-400" />
                  </div>
                )}

                {/* Error overlay */}
                {image.error && (
                  <div className="absolute inset-0 bg-red-950/70 flex flex-col items-center justify-center p-2">
                    <XIcon className="w-6 h-6 text-red-400 mb-1" />
                    <span className="text-xs text-red-300 text-center">{image.error}</span>
                  </div>
                )}

                {/* Selection indicator */}
                {isSelected && !image.uploading && !image.error && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-accent-500 rounded-full flex items-center justify-center shadow-lg">
                    <CheckIcon className="w-4 h-4 text-white" />
                  </div>
                )}

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(image.id);
                    if (isSelected) {
                      onDeselect?.(image.id);
                    }
                  }}
                  className="absolute top-2 left-2 w-6 h-6 bg-zinc-900/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                >
                  <TrashIcon className="w-3 h-3 text-zinc-300" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {images.length === 0 && !showUpload && (
        <div className="text-center py-8">
          <ImageIcon className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No images in library</p>
          <p className="text-xs text-zinc-600 mt-1">Upload images to get started</p>
        </div>
      )}
    </div>
  );
}

