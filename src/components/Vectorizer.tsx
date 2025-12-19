'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useImageStore } from '@/store/imageStore';
import { ImageLibrary } from './ImageLibrary';
import { HexColorPicker } from 'react-colorful';
import {
  SparklesIcon,
  DownloadIcon,
  LoaderIcon,
  ImageIcon,
  XIcon,
  RefreshIcon,
} from './ui/Icons';
import { formatFileSize, downloadBlob, withTimeout } from '@/lib/utils';
import { clsx } from 'clsx';
import { showToast } from './ui/Toast';
import type { DetailLevel, ImageFile } from '@/types';

interface VectorizationResult {
  svg: string;
  pathCount: number;
  width: number;
  height: number;
  estimatedSize: number;
}

interface VectorizerOptions {
  threshold: number;
  detailLevel: DetailLevel;
  smoothness: number;
  color: string;
  strokeWidth: number;
  strokeColor: string;
  removeBackground: boolean;
}

const DETAIL_LEVELS: { value: DetailLevel; label: string; description: string }[] = [
  { value: 'low', label: 'Low', description: 'Fewer details, smoother curves' },
  { value: 'medium', label: 'Medium', description: 'Balanced detail and smoothness' },
  { value: 'high', label: 'High', description: 'Maximum detail, sharper edges' },
];

export function Vectorizer() {
  const globalImages = useImageStore((state) => state.images);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [result, setResult] = useState<VectorizationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<'fill' | 'stroke' | null>(null);

  const [options, setOptions] = useState<VectorizerOptions>({
    threshold: 128,
    detailLevel: 'medium',
    smoothness: 0.4,
    color: '#000000',
    strokeWidth: 0,
    strokeColor: '#000000',
    removeBackground: true,
  });

  // Live preview state
  const [livePreview, setLivePreview] = useState(true);
  const lastOptionsRef = useRef<string>('');
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get selected image from global store
  const sourceImage = selectedImageId 
    ? globalImages.find(img => img.id === selectedImageId) 
    : null;

  const handleImageSelect = useCallback((image: ImageFile) => {
    // Check if file is raster
    if (image.format === 'svg') {
      setError('Cannot vectorize SVG files. Please use a raster image (PNG, JPG, etc.)');
      return;
    }
    
    if (!image.serverFilename) {
      setError('Image is still uploading. Please wait.');
      return;
    }
    
    setSelectedImageId(image.id);
    setResult(null);
    setError(null);
  }, []);

  const handleImageDeselect = useCallback(() => {
    setSelectedImageId(null);
    setResult(null);
    setError(null);
  }, []);

  const vectorize = useCallback(async (force = false) => {
    if (!sourceImage || !sourceImage.serverFilename) return;

    // If force is true, cancel any pending debounce and reset lastOptionsRef
    if (force) {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      lastOptionsRef.current = '';
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await withTimeout(
        fetch('/api/vectorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: sourceImage.serverFilename,
            threshold: options.threshold,
            detailLevel: options.detailLevel,
            smoothness: options.smoothness,
            color: options.color,
            strokeWidth: options.strokeWidth,
            strokeColor: options.strokeColor,
            removeBackground: options.removeBackground,
            outputFormat: 'svg',
          }),
        }),
        2 * 60 * 1000, // 2 minutes timeout
        'Vectorization timed out. Please try again with different settings.'
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Vectorization failed');
      }

      setResult(data.data);
      
      // Update lastOptionsRef after successful vectorization
      const signature = JSON.stringify({ imageId: sourceImage.id, options });
      lastOptionsRef.current = signature;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Vectorization failed';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [sourceImage, options]);

  const downloadSvg = useCallback(() => {
    if (!result || !sourceImage) return;

    // Ensure SVG has proper XML declaration
    let svgContent = result.svg;
    if (!svgContent.startsWith('<?xml')) {
      svgContent = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgContent;
    }
    
    // Ensure SVG has xmlns attribute
    if (!svgContent.includes('xmlns=')) {
      svgContent = svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const filename = sourceImage.name.replace(/\.[^/.]+$/, '') + '.svg';
    downloadBlob(blob, filename);
  }, [result, sourceImage]);

  const downloadAsFormat = useCallback(async (format: 'png' | 'jpg' | 'webp') => {
    if (!sourceImage || !sourceImage.serverFilename) return;

    try {
      const response = await fetch('/api/vectorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: sourceImage.serverFilename,
          threshold: options.threshold,
          detailLevel: options.detailLevel,
          smoothness: options.smoothness,
          color: options.color,
          strokeWidth: options.strokeWidth,
          strokeColor: options.strokeColor,
          removeBackground: options.removeBackground,
          outputFormat: format,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      const blob = await response.blob();
      const filename = sourceImage.name.replace(/\.[^/.]+$/, '') + '_vector.' + format;
      downloadBlob(blob, filename);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    }
  }, [sourceImage, options]);

  const updateOption = <K extends keyof VectorizerOptions>(
    key: K,
    value: VectorizerOptions[K]
  ) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  // Live preview effect - debounced auto-vectorize when settings change
  useEffect(() => {
    if (!livePreview || !sourceImage?.serverFilename) return;
    
    // Create signature of current options
    const signature = JSON.stringify({ imageId: sourceImage.id, options });
    
    // Skip if same as last vectorization
    if (signature === lastOptionsRef.current) return;
    
    // Cancel any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Debounce the vectorization
    debounceTimeoutRef.current = setTimeout(() => {
      lastOptionsRef.current = signature;
      vectorize(false); // false = not forced, from live preview
      debounceTimeoutRef.current = null;
    }, 500);
    
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, [livePreview, sourceImage, options, vectorize]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column - Source & Controls */}
      <div className="lg:col-span-1 space-y-6">
        {/* Image Library - Select Source */}
        <div className="card p-4">
          <ImageLibrary
            selectedIds={selectedImageId ? [selectedImageId] : []}
            onSelect={handleImageSelect}
            onDeselect={handleImageDeselect}
            maxSelection={1}
            showUpload={true}
            compact={!sourceImage}
          />
        </div>

        {/* Selected Source Image Preview */}
        {sourceImage && (
          <div className="card p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-medium text-zinc-300">Source Image</h3>
              <button
                onClick={handleImageDeselect}
                className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="aspect-square rounded-lg bg-zinc-800 overflow-hidden mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sourceImage.previewUrl}
                alt={sourceImage.name}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-sm text-zinc-500 space-y-1">
              <p className="truncate" title={sourceImage.name}>{sourceImage.name}</p>
              <p>{sourceImage.width} × {sourceImage.height} • {formatFileSize(sourceImage.size)}</p>
            </div>
          </div>
        )}

        {/* Controls */}
        {sourceImage && (
          <div className="card p-4 space-y-4 max-h-[70vh] overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent hover:scrollbar-thumb-zinc-600">
            <div className="sticky top-0 bg-zinc-900/98 backdrop-blur-md pb-3 z-20 border-b border-zinc-800/50 mb-3">
              <h3 className="font-medium text-zinc-300 mb-1">Vectorization Settings</h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-2">
                Adjust settings to customize the vectorization process. Changes are applied automatically with live preview enabled.
              </p>
              <div className="mt-2 p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-xs text-yellow-400 leading-relaxed">
                  <strong className="text-yellow-300">💡 Best for:</strong> Logos, icons, silhouettes, and simple graphics with clear contrast. 
                  Complex photos may lose detail as the algorithm converts images to black & white vectors.
                </p>
              </div>
            </div>

            <div className="space-y-5">

            {/* Detail Level */}
            <div>
              <label className="label">Detail Level</label>
              <div className="grid grid-cols-3 gap-2">
                {DETAIL_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => updateOption('detailLevel', level.value)}
                    className={clsx(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                      options.detailLevel === level.value
                        ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    )}
                    title={level.description}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Threshold */}
            <div>
              <label className="label">
                Threshold: {options.threshold}
              </label>
              <input
                type="range"
                min="0"
                max="255"
                value={options.threshold}
                onChange={(e) => updateOption('threshold', parseInt(e.target.value, 10))}
                className="w-full accent-accent-500"
              />
              <p className="text-xs text-zinc-600 mt-1">
                Controls black/white cutoff point
              </p>
            </div>

            {/* Smoothness */}
            <div>
              <label className="label">
                Smoothness: {options.smoothness.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.1"
                max="1.5"
                step="0.1"
                value={options.smoothness}
                onChange={(e) => updateOption('smoothness', parseFloat(e.target.value))}
                className="w-full accent-accent-500"
              />
            </div>

            {/* Fill Color */}
            <div className="relative">
              <label className="label">Fill Color</label>
              <button
                onClick={() => setShowColorPicker(showColorPicker === 'fill' ? null : 'fill')}
                className="flex items-center gap-2 w-full px-3 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                <div
                  className="w-6 h-6 rounded border border-zinc-600"
                  style={{ backgroundColor: options.color }}
                />
                <span className="text-sm text-zinc-300 font-mono">{options.color}</span>
              </button>
              {showColorPicker === 'fill' && (
                <div className="absolute z-10 mt-2">
                  <div 
                    className="fixed inset-0" 
                    onClick={() => setShowColorPicker(null)}
                  />
                  <div className="relative card p-3">
                    <HexColorPicker 
                      color={options.color} 
                      onChange={(color) => updateOption('color', color)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Stroke */}
            <div>
              <label className="label">
                Stroke Width: {options.strokeWidth}px
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={options.strokeWidth}
                onChange={(e) => updateOption('strokeWidth', parseFloat(e.target.value))}
                className="w-full accent-accent-500"
              />
            </div>

            {options.strokeWidth > 0 && (
              <div className="relative">
                <label className="label">Stroke Color</label>
                <button
                  onClick={() => setShowColorPicker(showColorPicker === 'stroke' ? null : 'stroke')}
                  className="flex items-center gap-2 w-full px-3 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  <div
                    className="w-6 h-6 rounded border border-zinc-600"
                    style={{ backgroundColor: options.strokeColor }}
                  />
                  <span className="text-sm text-zinc-300 font-mono">{options.strokeColor}</span>
                </button>
                {showColorPicker === 'stroke' && (
                  <div className="absolute z-10 mt-2">
                    <div 
                      className="fixed inset-0" 
                      onClick={() => setShowColorPicker(null)}
                    />
                    <div className="relative card p-3">
                      <HexColorPicker 
                        color={options.strokeColor} 
                        onChange={(color) => updateOption('strokeColor', color)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Remove Background */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-zinc-400">Transparent Background</label>
              <button
                onClick={() => updateOption('removeBackground', !options.removeBackground)}
                className={clsx(
                  'w-12 h-6 rounded-full transition-colors relative',
                  options.removeBackground ? 'bg-accent-500' : 'bg-zinc-700'
                )}
              >
                <div
                  className={clsx(
                    'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform',
                    options.removeBackground ? 'translate-x-6' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>

            {/* Live Preview Toggle */}
            <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-400">Live Preview</span>
                {livePreview && isProcessing && (
                  <LoaderIcon className="w-3 h-3 text-accent-400" />
                )}
              </div>
              <button
                onClick={() => setLivePreview(!livePreview)}
                className={clsx(
                  'w-12 h-6 rounded-full transition-colors relative',
                  livePreview ? 'bg-accent-500' : 'bg-zinc-700'
                )}
                aria-label={livePreview ? 'Disable live preview' : 'Enable live preview'}
                aria-pressed={livePreview}
                role="switch"
              >
                <div
                  className={clsx(
                    'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform',
                    livePreview ? 'translate-x-6' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>

            {/* Vectorize Button */}
            <button
              onClick={() => vectorize(true)}
              disabled={isProcessing}
              aria-label={livePreview ? 'Re-vectorize image' : 'Vectorize image'}
              aria-busy={isProcessing}
              aria-disabled={isProcessing}
              className={clsx(
                "w-full flex items-center justify-center gap-2",
                livePreview 
                  ? "btn-secondary" 
                  : "btn-primary"
              )}
            >
              {isProcessing ? (
                <>
                  <LoaderIcon className="w-5 h-5" />
                  Processing...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-5 h-5" />
                  {livePreview ? 'Re-vectorize' : 'Vectorize'}
                </>
              )}
            </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Column - Preview & Results */}
      <div className="lg:col-span-2 space-y-6">
        {/* Error Display */}
        {error && (
          <div className="card p-4 border-red-500/30 bg-red-500/5">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Result Preview */}
        {result ? (
          <>
            <div className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-zinc-300">Vector Preview</h3>
                  <span className="px-2 py-0.5 bg-accent-500/20 text-accent-400 text-xs font-medium rounded-full">
                    SVG
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <span>{result.pathCount} paths</span>
                  <span>•</span>
                  <span>{formatFileSize(result.estimatedSize)}</span>
                </div>
              </div>
              
              {/* SVG Preview - Fixed sizing */}
              <div 
                className="w-full rounded-lg overflow-hidden flex items-center justify-center p-4"
                style={{ 
                  backgroundColor: options.removeBackground 
                    ? 'repeating-conic-gradient(#27272a 0% 25%, #3f3f46 0% 50%) 50% / 20px 20px'
                    : '#ffffff',
                  minHeight: '300px',
                }}
              >
                <div 
                  dangerouslySetInnerHTML={{ __html: result.svg }}
                  className="w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-[400px] [&>svg]:w-auto [&>svg]:h-auto"
                />
              </div>

              {/* Info */}
              <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
                <span>Original: {result.width} × {result.height}px • Infinitely scalable</span>
                <button
                  onClick={() => vectorize(true)}
                  className="flex items-center gap-1.5 text-accent-400 hover:text-accent-300 transition-colors"
                >
                  <RefreshIcon className="w-4 h-4" />
                  Re-vectorize
                </button>
              </div>
            </div>

            {/* Export Options - Separated */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Vector Export */}
              <div className="card p-4 border-accent-500/30 bg-accent-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-medium text-accent-400">Vector Format</h3>
                  <span className="text-xs text-zinc-500">Recommended</span>
                </div>
                <p className="text-xs text-zinc-500 mb-4">
                  Scalable, editable, small file size. Use for logos, icons, illustrations.
                </p>
                <button
                  onClick={downloadSvg}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <DownloadIcon className="w-4 h-4" />
                  Download SVG
                </button>
              </div>

              {/* Raster Export */}
              <div className="card p-4">
                <h3 className="font-medium text-zinc-300 mb-3">Raster Formats</h3>
                <p className="text-xs text-zinc-500 mb-4">
                  For compatibility with apps that don&apos;t support SVG.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => downloadAsFormat('png')}
                    className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-sm"
                  >
                    <DownloadIcon className="w-3.5 h-3.5" />
                    PNG
                  </button>
                  <button
                    onClick={() => downloadAsFormat('jpg')}
                    className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-sm"
                  >
                    <DownloadIcon className="w-3.5 h-3.5" />
                    JPG
                  </button>
                  <button
                    onClick={() => downloadAsFormat('webp')}
                    className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-sm"
                  >
                    <DownloadIcon className="w-3.5 h-3.5" />
                    WebP
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="card p-12 text-center h-full flex flex-col items-center justify-center min-h-[400px]">
            <SparklesIcon className="w-16 h-16 text-zinc-700 mb-4" />
            <h3 className="text-lg font-medium text-zinc-400 mb-2">
              {sourceImage ? 'Ready to vectorize' : 'No image selected'}
            </h3>
            <p className="text-zinc-600 max-w-md mb-3">
              {sourceImage 
                ? 'Adjust the settings and click "Vectorize" to convert your image to SVG'
                : 'Upload a raster image (PNG, JPG, etc.) to convert it to a clean SVG vector'
              }
            </p>
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg max-w-md">
              <p className="text-xs text-blue-400 leading-relaxed">
                <strong className="text-blue-300">✨ Works best with:</strong> Simple images like logos, icons, text, and silhouettes. 
                For complex photos, try adjusting the <strong>Threshold</strong> slider to capture more details.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

