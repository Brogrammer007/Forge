'use client';

import { useState, useCallback, memo, useMemo } from 'react';
import { useImageStore } from '@/store/imageStore';
import { ImageLibrary } from './ImageLibrary';
import {
  DownloadIcon,
  LoaderIcon,
  ImageIcon,
  CheckIcon,
  XIcon,
} from './ui/Icons';
import { formatFileSize, createDownloadFilename, downloadBlob } from '@/lib/utils';
import { clsx } from 'clsx';
import { showToast } from './ui/Toast';
import type { OutputFormat, ImageFile } from '@/types';

interface ConversionState {
  imageId: string;
  format: OutputFormat;
  status: 'idle' | 'converting' | 'success' | 'error';
  error?: string;
}

const OUTPUT_FORMATS: { value: OutputFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'webp', label: 'WebP' },
  { value: 'svg', label: 'SVG' },
];

export const ImageConverter = memo(function ImageConverter() {
  const { images } = useImageStore();
  const [conversions, setConversions] = useState<Map<string, ConversionState>>(new Map());
  const [quality, setQuality] = useState(90);

  const [hoveredFormat, setHoveredFormat] = useState<{ imageId: string; format: OutputFormat } | null>(null);

  // Filter to only show uploaded (non-uploading) images - memoized for performance
  const readyImages = useMemo(
    () => images.filter(img => !img.uploading && !img.error && img.serverFilename),
    [images]
  );

  const convertImage = useCallback(
    async (image: ImageFile, format: OutputFormat) => {
      const conversionKey = `${image.id}-${format}`;

      setConversions((prev) => {
        const next = new Map(prev);
        next.set(conversionKey, {
          imageId: image.id,
          format,
          status: 'converting',
        });
        return next;
      });

      try {
        const response = await fetch('/api/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: image.serverFilename,
            format,
            quality,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Conversion failed');
        }

        const blob = await response.blob();
        const filename = createDownloadFilename(image.name, format);
        downloadBlob(blob, filename);

        setConversions((prev) => {
          const next = new Map(prev);
          next.set(conversionKey, {
            imageId: image.id,
            format,
            status: 'success',
          });
          return next;
        });

        // Reset status after a delay
        setTimeout(() => {
          setConversions((prev) => {
            const next = new Map(prev);
            next.delete(conversionKey);
            return next;
          });
        }, 2000);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Conversion failed';
        showToast(errorMessage, 'error');
        setConversions((prev) => {
          const next = new Map(prev);
          next.set(conversionKey, {
            imageId: image.id,
            format,
            status: 'error',
            error: error instanceof Error ? error.message : 'Conversion failed',
          });
          return next;
        });
      }
    },
    [quality]
  );

  const getConversionState = (imageId: string, format: OutputFormat): ConversionState | undefined => {
    return conversions.get(`${imageId}-${format}`);
  };

  return (
    <div className="space-y-6">
      {/* Image Library */}
      <ImageLibrary />

      {/* Conversion Settings */}
      {readyImages.length > 0 && (
        <div className="card p-4">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-8">
              {/* Quality */}
              <div className="flex items-center gap-3">
                <label className="label mb-0 text-sm w-24">
                  Quality: {quality}%
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(parseInt(e.target.value, 10))}
                  className="w-32 accent-accent-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conversion Cards */}
      {readyImages.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-zinc-400">Convert Images</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {readyImages.map((image) => (
              <div key={image.id} className="card p-4">
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 flex-shrink-0 rounded-lg bg-zinc-800 overflow-hidden">
                    {image.format === 'svg' ? (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500">
                        <ImageIcon className="w-8 h-8" />
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

                  {/* Info & Controls */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-zinc-100 truncate text-sm" title={image.name}>
                      {image.name}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                      <span className="uppercase font-mono bg-zinc-800 px-1.5 py-0.5 rounded">
                        {image.format}
                      </span>
                      {image.width > 0 && (
                        <span>{image.width}×{image.height}</span>
                      )}
                      <span>{formatFileSize(image.size)}</span>
                    </div>

                    {/* Conversion Buttons */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {OUTPUT_FORMATS.map(({ value, label }) => {
                        const state = getConversionState(image.id, value);
                        const isConverting = state?.status === 'converting';
                        const isSuccess = state?.status === 'success';
                        const isError = state?.status === 'error';
                        const isSameFormat = image.format === value ||
                          (image.format === 'jpeg' && value === 'jpg');
                        const isHovered = hoveredFormat?.imageId === image.id && hoveredFormat?.format === value;

                        // Use pre-calculated size if available
                        const actualSize = image.formatSizes?.[value];
                        const isExact = !!actualSize;

                        return (
                          <div key={value} className="relative">
                            <button
                              onClick={() => convertImage(image, value)}
                              disabled={isConverting}
                              onMouseEnter={() => setHoveredFormat({ imageId: image.id, format: value })}
                              onMouseLeave={() => setHoveredFormat(null)}
                              aria-label={`Convert ${image.name} to ${label}`}
                              aria-busy={isConverting}
                              aria-disabled={isConverting}
                              className={clsx(
                                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                                isSameFormat && !isHovered
                                  ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                                  : isHovered
                                    ? 'bg-accent-500 text-white shadow-lg shadow-accent-500/25'
                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700',
                                isSuccess && 'bg-green-500/20 text-green-400',
                                isError && 'bg-red-500/20 text-red-400'
                              )}
                            >
                              {isConverting ? (
                                <LoaderIcon className="w-3.5 h-3.5" />
                              ) : isSuccess ? (
                                <CheckIcon className="w-3.5 h-3.5" />
                              ) : isError ? (
                                <XIcon className="w-3.5 h-3.5" />
                              ) : (
                                <DownloadIcon className="w-3.5 h-3.5" />
                              )}
                              {label}
                            </button>
                            {/* Size tooltip */}
                            {isHovered && !isConverting && !isSuccess && !isError && actualSize && (
                              <div className={clsx(
                                "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded text-xs whitespace-nowrap z-10 shadow-lg",
                                isExact
                                  ? "bg-accent-500/20 border border-accent-500/40 text-accent-300"
                                  : "bg-zinc-900 border border-zinc-700 text-zinc-300"
                              )}>
                                {formatFileSize(actualSize)}
                                <div className={clsx(
                                  "absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent",
                                  isExact ? "border-t-accent-500/40" : "border-t-zinc-700"
                                )} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {readyImages.length === 0 && images.length === 0 && (
        <div className="card p-12 text-center">
          <ImageIcon className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-400 mb-2">No images uploaded</h3>
          <p className="text-zinc-600">
            Drag and drop images above or click to browse
          </p>
        </div>
      )}
    </div>
  );
});
