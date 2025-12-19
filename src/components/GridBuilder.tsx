'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useImageStore } from '@/store/imageStore';
import { ImageLibrary } from './ImageLibrary';
import { HexColorPicker } from 'react-colorful';
import {
  GridIcon,
  DownloadIcon,
  LoaderIcon,
  XIcon,
  PlusIcon,
  TrashIcon,
  MoveIcon,
  RefreshIcon,
} from './ui/Icons';
import { generateId, downloadBlob } from '@/lib/utils';
import { clsx } from 'clsx';
import { showToast } from './ui/Toast';
import type {
  LayoutPreset,
  ResolutionPreset,
  GridOptions,
  TextOverlay,
  FontFamily,
  FontWeight,
  TextAlign,
  ImageFile,
} from '@/types';

interface GridImage {
  id: string;
  imageFile: ImageFile;
  order: number;
}

const LAYOUT_PRESETS: { value: LayoutPreset; label: string; rows: number; cols: number }[] = [
  { value: '1x2', label: '1×2', rows: 1, cols: 2 },
  { value: '2x1', label: '2×1', rows: 2, cols: 1 },
  { value: '2x2', label: '2×2', rows: 2, cols: 2 },
  { value: '2x3', label: '2×3', rows: 2, cols: 3 },
  { value: '3x2', label: '3×2', rows: 3, cols: 2 },
  { value: '3x3', label: '3×3', rows: 3, cols: 3 },
  { value: '4x4', label: '4×4', rows: 4, cols: 4 },
];

const RESOLUTION_PRESETS: { value: ResolutionPreset; label: string; width: number; height: number }[] = [
  { value: '1080x1080', label: '1080×1080 (Square)', width: 1080, height: 1080 },
  { value: '1920x1080', label: '1920×1080 (16:9)', width: 1920, height: 1080 },
  { value: '1080x1920', label: '1080×1920 (9:16)', width: 1080, height: 1920 },
  { value: '1200x628', label: '1200×628 (Social)', width: 1200, height: 628 },
];

const FONTS: FontFamily[] = [
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Impact',
];

export function GridBuilder() {
  // Global image store
  const globalImages = useImageStore((state) => state.images);

  // Local selected images for grid (references to global images)
  const [selectedImages, setSelectedImages] = useState<GridImage[]>([]);

  // Grid options
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>('2x2');
  const [resolutionPreset, setResolutionPreset] = useState<ResolutionPreset>('1080x1080');
  const [customRows, setCustomRows] = useState(2);
  const [customCols, setCustomCols] = useState(2);
  const [customWidth, setCustomWidth] = useState(1080);
  const [customHeight, setCustomHeight] = useState(1080);
  const [padding, setPadding] = useState(20);
  const [backgroundColor, setBackgroundColor] = useState('#1a1a1a');
  const [borderWidth, setBorderWidth] = useState(0);
  const [borderColor, setBorderColor] = useState('#ffffff');
  const [cornerRadius, setCornerRadius] = useState(0);
  const [imageFit, setImageFit] = useState<'cover' | 'contain' | 'fill'>('cover');

  // Text overlays
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

  // UI state
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [showBorderColorPicker, setShowBorderColorPicker] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'layout' | 'style' | 'text'>('layout');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDimensions, setPreviewDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Calculate grid dimensions
  const getGridDimensions = () => {
    if (layoutPreset === 'custom') {
      return { rows: customRows, cols: customCols };
    }
    const preset = LAYOUT_PRESETS.find(p => p.value === layoutPreset);
    return preset ? { rows: preset.rows, cols: preset.cols } : { rows: 2, cols: 2 };
  };

  const getResolution = () => {
    if (resolutionPreset === 'custom') {
      return { width: customWidth, height: customHeight };
    }
    const preset = RESOLUTION_PRESETS.find(p => p.value === resolutionPreset);
    return preset ? { width: preset.width, height: preset.height } : { width: 1080, height: 1080 };
  };

  const gridOptions: GridOptions = useMemo(() => ({
    ...getGridDimensions(),
    ...getResolution(),
    padding,
    backgroundColor,
    borderWidth,
    borderColor,
    cornerRadius,
    imageFit,
  }), [layoutPreset, resolutionPreset, customRows, customCols, customWidth, customHeight, padding, backgroundColor, borderWidth, borderColor, cornerRadius, imageFit]);

  // Handle image selection from library
  const handleImageSelect = useCallback((image: ImageFile) => {
    if (!image.serverFilename) return; // Only allow uploaded images

    setSelectedImages(prev => {
      // Check if already selected
      if (prev.some(img => img.id === image.id)) return prev;

      return [...prev, {
        id: image.id,
        imageFile: image,
        order: prev.length,
      }];
    });
    markPreviewStale();
  }, []);

  // Handle image deselection
  const handleImageDeselect = useCallback((imageId: string) => {
    setSelectedImages(prev => {
      const filtered = prev.filter(img => img.id !== imageId);
      return filtered.map((img, index) => ({ ...img, order: index }));
    });
    markPreviewStale();
  }, []);

  // Remove image from grid
  const removeImage = useCallback((imageId: string) => {
    handleImageDeselect(imageId);
  }, [handleImageDeselect]);

  // Alias for compatibility
  const images = selectedImages;

  // Drag and drop reordering
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setSelectedImages(prev => {
      const newImages = [...prev];
      const draggedItem = newImages[draggedIndex];
      if (!draggedItem) return prev;

      newImages.splice(draggedIndex, 1);
      newImages.splice(index, 0, draggedItem);
      return newImages.map((img, i) => ({ ...img, order: i }));
    });
    setDraggedIndex(index);
    markPreviewStale();
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Text overlay management
  const addTextOverlay = () => {
    const newOverlay: TextOverlay = {
      id: generateId(),
      text: 'New Text',
      x: 0.5,
      y: 0.5,
      fontFamily: 'Arial',
      fontSize: 48,
      fontWeight: 'bold',
      color: '#ffffff',
      align: 'center',
    };
    setTextOverlays(prev => [...prev, newOverlay]);
    setSelectedTextId(newOverlay.id);
    markPreviewStale();
  };

  const updateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays(prev =>
      prev.map(overlay =>
        overlay.id === id ? { ...overlay, ...updates } : overlay
      )
    );
    markPreviewStale();
  };

  const removeTextOverlay = (id: string) => {
    setTextOverlays(prev => prev.filter(overlay => overlay.id !== id));
    if (selectedTextId === id) {
      setSelectedTextId(null);
    }
    markPreviewStale();
  };

  const selectedText = textOverlays.find(t => t.id === selectedTextId);

  // Track if preview needs refresh
  const [previewStale, setPreviewStale] = useState(false);
  const lastPreviewRef = useRef<string>('');

  // Generate preview
  const generatePreview = useCallback(async () => {
    if (selectedImages.length === 0 || !selectedImages.every(img => img.imageFile.serverFilename)) {
      return;
    }

    // Create a signature for this preview request
    const signature = JSON.stringify({
      images: selectedImages.map(img => ({ filename: img.imageFile.serverFilename, order: img.order })),
      options: gridOptions,
      textOverlays,
    });

    // Skip if same as last preview
    if (signature === lastPreviewRef.current && previewUrl) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/grid', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: selectedImages.map(img => ({
            filename: img.imageFile.serverFilename,
            order: img.order,
          })),
          options: gridOptions,
          textOverlays,
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        setPreviewUrl(result.data.preview);
        setPreviewDimensions({
          width: result.data.width * 2, // Multiply by 2 since preview is half size
          height: result.data.height * 2,
        });
        lastPreviewRef.current = signature;
        setPreviewStale(false);
      } else {
        throw new Error(result.error || 'Failed to generate preview');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate preview';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedImages, gridOptions, textOverlays, previewUrl]);

  // Track settings version for live updates
  const settingsVersion = useRef(0);

  // Mark preview as stale and trigger live update
  const markPreviewStale = useCallback(() => {
    settingsVersion.current += 1;
    if (previewUrl) {
      setPreviewStale(true);
    }
  }, [previewUrl]);

  // Live update: auto-regenerate preview when settings change (with debounce)
  useEffect(() => {
    // Only run if we have images selected and ready
    if (selectedImages.length === 0 || !selectedImages.every(img => img.imageFile.serverFilename)) {
      return;
    }

    // Debounce the preview generation
    const timer = setTimeout(() => {
      generatePreview();
    }, 600); // 600ms delay for smooth experience

    return () => clearTimeout(timer);
  }, [
    // Dependencies that trigger live update
    images,
    layoutPreset,
    resolutionPreset,
    padding,
    backgroundColor,
    borderWidth,
    borderColor,
    cornerRadius,
    textOverlays,
    // Don't include generatePreview to avoid circular dependency
  ]);

  // Export grid
  const exportGrid = async (format: 'png' | 'jpg' | 'webp' | 'svg') => {
    if (images.length === 0) return;

    setIsGenerating(true);
    setError(null);

    try {
      // Save output format preference
      const body = {
        images: selectedImages.map(img => ({
          filename: img.imageFile.serverFilename,
          order: img.order,
        })),
        options: gridOptions,
        textOverlays,
        outputFormat: format,
        quality: 90,
      };

      const response = await fetch('/api/grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      const blob = await response.blob();
      downloadBlob(blob, `grid_${Date.now()}.${format}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const { rows, cols } = getGridDimensions();
  const { width, height } = getResolution();
  const maxImages = rows * cols;

  // Only show download button if we have content
  const canDownload = images.length > 0 && images.every(img => img.imageFile.serverFilename);



  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Left Column - Controls */}
      <div className="xl:col-span-1 space-y-6">
        {/* Tabs */}
        <div className="card p-1 flex gap-1" role="tablist" aria-label="Grid builder tabs">
          {(['layout', 'style', 'text'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`${tab}-panel`}
              className={clsx(
                'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize',
                activeTab === tab
                  ? 'bg-accent-500/20 text-accent-400'
                  : 'text-zinc-400 hover:text-zinc-300'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Layout Tab */}
        {activeTab === 'layout' && (
          <div className="card p-4 space-y-5">
            {/* Layout Presets */}
            <div>
              <label className="label">Layout</label>
              <div className="grid grid-cols-4 gap-2">
                {LAYOUT_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => { setLayoutPreset(preset.value); markPreviewStale(); }}
                    className={clsx(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                      layoutPreset === preset.value
                        ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution Presets */}
            <div>
              <label className="label">Resolution</label>
              <div className="space-y-2">
                {RESOLUTION_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => { setResolutionPreset(preset.value); markPreviewStale(); }}
                    className={clsx(
                      'w-full px-3 py-2 rounded-lg text-sm font-medium text-left transition-all',
                      resolutionPreset === preset.value
                        ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Style Tab */}
        {activeTab === 'style' && (
          <div className="card p-4 space-y-5">
            {/* Spacing Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-xs">📐</span>
                Spacing
              </h4>
              <div>
                <label className="label">Gap Between Images: {padding}px</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={padding}
                  onChange={(e) => { setPadding(parseInt(e.target.value, 10)); markPreviewStale(); }}
                  className="w-full accent-accent-500"
                />
                <div className="flex justify-between text-xs text-zinc-600 mt-1">
                  <span>No gap</span>
                  <span>Large gap</span>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-4">
              {/* Border Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-xs">🔲</span>
                    Border
                  </h4>
                  <button
                    onClick={() => {
                      setBorderWidth(borderWidth > 0 ? 0 : 3);
                      markPreviewStale();
                    }}
                    className={clsx(
                      'w-12 h-6 rounded-full transition-colors relative',
                      borderWidth > 0 ? 'bg-accent-500' : 'bg-zinc-700'
                    )}
                  >
                    <div
                      className={clsx(
                        'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform',
                        borderWidth > 0 ? 'translate-x-6' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </div>

                {borderWidth > 0 && (
                  <>
                    {/* Border Width */}
                    <div>
                      <label className="label">Thickness: {borderWidth}px</label>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={borderWidth}
                        onChange={(e) => { setBorderWidth(parseInt(e.target.value, 10)); markPreviewStale(); }}
                        className="w-full accent-accent-500"
                      />
                    </div>

                    {/* Border Color Presets */}
                    <div>
                      <label className="label">Border Color</label>
                      <div className="grid grid-cols-6 gap-2 mb-2">
                        {[
                          { color: '#ffffff', name: 'White' },
                          { color: '#000000', name: 'Black' },
                          { color: '#6b7280', name: 'Gray' },
                          { color: '#14b8a6', name: 'Teal' },
                          { color: '#f59e0b', name: 'Amber' },
                          { color: '#ef4444', name: 'Red' },
                        ].map((preset) => (
                          <button
                            key={preset.color}
                            onClick={() => { setBorderColor(preset.color); markPreviewStale(); }}
                            title={preset.name}
                            className={clsx(
                              'w-full aspect-square rounded-lg border-2 transition-all hover:scale-110',
                              borderColor === preset.color
                                ? 'border-accent-400 ring-2 ring-accent-400/50'
                                : 'border-zinc-600'
                            )}
                            style={{ backgroundColor: preset.color }}
                          />
                        ))}
                      </div>
                      {/* Custom Color */}
                      <div className="relative">
                        <button
                          onClick={() => setShowBorderColorPicker(!showBorderColorPicker)}
                          className="flex items-center gap-2 w-full px-3 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors text-sm"
                        >
                          <div
                            className="w-5 h-5 rounded border border-zinc-600"
                            style={{ backgroundColor: borderColor }}
                          />
                          <span className="text-zinc-400">Custom:</span>
                          <span className="text-zinc-300 font-mono">{borderColor}</span>
                        </button>
                        {showBorderColorPicker && (
                          <div className="absolute z-50 bottom-full mb-2 left-0">
                            <div className="fixed inset-0" onClick={() => setShowBorderColorPicker(false)} />
                            <div className="relative card p-3 shadow-xl">
                              <HexColorPicker color={borderColor} onChange={(c) => { setBorderColor(c); markPreviewStale(); }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-4">
              {/* Background Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-xs">🎨</span>
                  Background
                </h4>

                {/* Background Color Presets */}
                <div className="grid grid-cols-6 gap-2 mb-2">
                  {[
                    { color: '#000000', name: 'Black' },
                    { color: '#1a1a1a', name: 'Dark' },
                    { color: '#27272a', name: 'Zinc' },
                    { color: '#ffffff', name: 'White' },
                    { color: '#f5f5f4', name: 'Stone' },
                    { color: 'transparent', name: 'None' },
                  ].map((preset) => (
                    <button
                      key={preset.color}
                      onClick={() => { setBackgroundColor(preset.color); markPreviewStale(); }}
                      title={preset.name}
                      className={clsx(
                        'w-full aspect-square rounded-lg border-2 transition-all hover:scale-110',
                        backgroundColor === preset.color
                          ? 'border-accent-400 ring-2 ring-accent-400/50'
                          : 'border-zinc-600',
                        preset.color === 'transparent' && 'bg-[conic-gradient(#27272a_25%,#3f3f46_25%_50%,#27272a_50%_75%,#3f3f46_75%)] bg-[length:8px_8px]'
                      )}
                      style={{ backgroundColor: preset.color === 'transparent' ? undefined : preset.color }}
                    />
                  ))}
                </div>

                {/* Custom Background Color */}
                <div className="relative">
                  <button
                    onClick={() => setShowBgColorPicker(!showBgColorPicker)}
                    className="flex items-center gap-2 w-full px-3 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors text-sm"
                  >
                    <div
                      className="w-5 h-5 rounded border border-zinc-600"
                      style={{ backgroundColor }}
                    />
                    <span className="text-zinc-400">Custom:</span>
                    <span className="text-zinc-300 font-mono">{backgroundColor}</span>
                  </button>
                  {showBgColorPicker && (
                    <div className="absolute z-50 bottom-full mb-2 left-0">
                      <div className="fixed inset-0" onClick={() => setShowBgColorPicker(false)} />
                      <div className="relative card p-3 shadow-xl">
                        <HexColorPicker color={backgroundColor} onChange={(c) => { setBackgroundColor(c); markPreviewStale(); }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-4">
              {/* Corner Radius Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-xs">⬜</span>
                  Corners
                </h4>
                <div>
                  <label className="label">Roundness: {cornerRadius}px</label>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={cornerRadius}
                    onChange={(e) => { setCornerRadius(parseInt(e.target.value, 10)); markPreviewStale(); }}
                    className="w-full accent-accent-500"
                  />
                  <div className="flex justify-between text-xs text-zinc-600 mt-1">
                    <span>Sharp</span>
                    <span>Rounded</span>
                  </div>
                </div>
                {/* Corner Radius Presets */}
                <div className="flex gap-2">
                  {[
                    { value: 0, label: 'None' },
                    { value: 8, label: 'Small' },
                    { value: 16, label: 'Medium' },
                    { value: 32, label: 'Large' },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => { setCornerRadius(preset.value); markPreviewStale(); }}
                      className={clsx(
                        'flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all',
                        cornerRadius === preset.value
                          ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image Fit */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-xs">📷</span>
                  Image Fit
                </h4>
                <div className="flex gap-2">
                  {[
                    { value: 'cover' as const, label: 'Cover', desc: 'Fill cell, crop if needed' },
                    { value: 'contain' as const, label: 'Contain', desc: 'Fit entire image' },
                    { value: 'fill' as const, label: 'Stretch', desc: 'Stretch to fill' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => { setImageFit(option.value); markPreviewStale(); }}
                      className={clsx(
                        'flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-all text-center',
                        imageFit === option.value
                          ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      )}
                      title={option.desc}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-600">
                  {imageFit === 'cover' && 'Images fill cells completely, may be cropped'}
                  {imageFit === 'contain' && 'Entire image visible, may have gaps'}
                  {imageFit === 'fill' && 'Images stretch to fill cells exactly'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Text Tab */}
        {activeTab === 'text' && (
          <div className="card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="label mb-0">Text Overlays</label>
              <button
                onClick={addTextOverlay}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <PlusIcon className="w-4 h-4" />
                Add Text
              </button>
            </div>

            {/* Text overlay list */}
            {textOverlays.map((overlay) => (
              <div
                key={overlay.id}
                onClick={() => setSelectedTextId(overlay.id)}
                className={clsx(
                  'p-3 rounded-lg cursor-pointer transition-all',
                  selectedTextId === overlay.id
                    ? 'bg-accent-500/10 border border-accent-500/30'
                    : 'bg-zinc-800 hover:bg-zinc-700'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300 truncate">{overlay.text}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTextOverlay(overlay.id);
                    }}
                    className="p-1 hover:bg-zinc-700 rounded text-zinc-500 hover:text-red-400"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* Selected text editor */}
            {selectedText && (
              <div className="space-y-4 pt-4 border-t border-zinc-800">
                <div>
                  <label className="label">Text</label>
                  <input
                    type="text"
                    value={selectedText.text}
                    onChange={(e) => updateTextOverlay(selectedText.id, { text: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Font</label>
                    <select
                      value={selectedText.fontFamily}
                      onChange={(e) => updateTextOverlay(selectedText.id, { fontFamily: e.target.value as FontFamily })}
                      className="select-field"
                    >
                      {FONTS.map((font) => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Size: {selectedText.fontSize}px</label>
                    <input
                      type="range"
                      min="12"
                      max="200"
                      value={selectedText.fontSize}
                      onChange={(e) => updateTextOverlay(selectedText.id, { fontSize: parseInt(e.target.value, 10) })}
                      className="w-full accent-accent-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Weight</label>
                    <select
                      value={selectedText.fontWeight}
                      onChange={(e) => updateTextOverlay(selectedText.id, { fontWeight: e.target.value as FontWeight })}
                      className="select-field"
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Align</label>
                    <select
                      value={selectedText.align}
                      onChange={(e) => updateTextOverlay(selectedText.id, { align: e.target.value as TextAlign })}
                      className="select-field"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>

                <div className="relative">
                  <label className="label">Color</label>
                  <button
                    onClick={() => setShowTextColorPicker(!showTextColorPicker)}
                    className="flex items-center gap-2 w-full px-3 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                  >
                    <div
                      className="w-6 h-6 rounded border border-zinc-600"
                      style={{ backgroundColor: selectedText.color }}
                    />
                    <span className="text-sm text-zinc-300 font-mono">{selectedText.color}</span>
                  </button>
                  {showTextColorPicker && (
                    <div className="absolute z-50 bottom-full mb-2 left-0">
                      <div className="fixed inset-0" onClick={() => setShowTextColorPicker(false)} />
                      <div className="relative card p-3 shadow-xl">
                        <HexColorPicker
                          color={selectedText.color}
                          onChange={(color) => updateTextOverlay(selectedText.id, { color })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">X: {Math.round(selectedText.x * 100)}%</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={selectedText.x * 100}
                      onChange={(e) => updateTextOverlay(selectedText.id, { x: parseInt(e.target.value, 10) / 100 })}
                      className="w-full accent-accent-500"
                    />
                  </div>
                  <div>
                    <label className="label">Y: {Math.round(selectedText.y * 100)}%</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={selectedText.y * 100}
                      onChange={(e) => updateTextOverlay(selectedText.id, { y: parseInt(e.target.value, 10) / 100 })}
                      className="w-full accent-accent-500"
                    />
                  </div>
                </div>

                {/* Shadow */}
                <div className="pt-3 border-t border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-zinc-400">Text Shadow</label>
                    <button
                      onClick={() => {
                        if (selectedText.shadow) {
                          updateTextOverlay(selectedText.id, { shadow: undefined });
                        } else {
                          updateTextOverlay(selectedText.id, {
                            shadow: { color: '#000000', blur: 4, offsetX: 2, offsetY: 2 }
                          });
                        }
                      }}
                      className={clsx(
                        'w-10 h-5 rounded-full transition-colors relative',
                        selectedText.shadow ? 'bg-accent-500' : 'bg-zinc-700'
                      )}
                    >
                      <div
                        className={clsx(
                          'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
                          selectedText.shadow ? 'translate-x-5' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </div>
                  {selectedText.shadow && (
                    <div className="space-y-2 mt-2">
                      <div>
                        <label className="label text-xs">Blur: {selectedText.shadow.blur}px</label>
                        <input
                          type="range"
                          min="0"
                          max="20"
                          value={selectedText.shadow.blur}
                          onChange={(e) => updateTextOverlay(selectedText.id, {
                            shadow: { ...selectedText.shadow!, blur: parseInt(e.target.value, 10) }
                          })}
                          className="w-full accent-accent-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="label text-xs">X: {selectedText.shadow.offsetX}px</label>
                          <input
                            type="range"
                            min="-10"
                            max="10"
                            value={selectedText.shadow.offsetX}
                            onChange={(e) => updateTextOverlay(selectedText.id, {
                              shadow: { ...selectedText.shadow!, offsetX: parseInt(e.target.value, 10) }
                            })}
                            className="w-full accent-accent-500"
                          />
                        </div>
                        <div>
                          <label className="label text-xs">Y: {selectedText.shadow.offsetY}px</label>
                          <input
                            type="range"
                            min="-10"
                            max="10"
                            value={selectedText.shadow.offsetY}
                            onChange={(e) => updateTextOverlay(selectedText.id, {
                              shadow: { ...selectedText.shadow!, offsetY: parseInt(e.target.value, 10) }
                            })}
                            className="w-full accent-accent-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Stroke/Outline */}
                <div className="pt-3 border-t border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-zinc-400">Text Outline</label>
                    <button
                      onClick={() => {
                        if (selectedText.stroke) {
                          updateTextOverlay(selectedText.id, { stroke: undefined });
                        } else {
                          updateTextOverlay(selectedText.id, {
                            stroke: { color: '#000000', width: 2 }
                          });
                        }
                      }}
                      className={clsx(
                        'w-10 h-5 rounded-full transition-colors relative',
                        selectedText.stroke ? 'bg-accent-500' : 'bg-zinc-700'
                      )}
                    >
                      <div
                        className={clsx(
                          'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
                          selectedText.stroke ? 'translate-x-5' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </div>
                  {selectedText.stroke && (
                    <div className="space-y-2 mt-2">
                      <div>
                        <label className="label text-xs">Width: {selectedText.stroke.width}px</label>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={selectedText.stroke.width}
                          onChange={(e) => updateTextOverlay(selectedText.id, {
                            stroke: { ...selectedText.stroke!, width: parseInt(e.target.value, 10) }
                          })}
                          className="w-full accent-accent-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        {['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff'].map((color) => (
                          <button
                            key={color}
                            onClick={() => updateTextOverlay(selectedText.id, {
                              stroke: { ...selectedText.stroke!, color }
                            })}
                            className={clsx(
                              'w-6 h-6 rounded border-2 transition-all',
                              selectedText.stroke?.color === color
                                ? 'border-accent-500 scale-110'
                                : 'border-zinc-600'
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Image Library - Select from global images */}
        <div className="card p-4">
          <ImageLibrary
            selectedIds={selectedImages.map(img => img.id)}
            onSelect={handleImageSelect}
            onDeselect={handleImageDeselect}
            maxSelection={maxImages}
            showUpload={true}
          />
        </div>

        {/* Selected Images - Drag to Reorder */}
        {selectedImages.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Grid Order ({selectedImages.length}/{maxImages})</label>
              <button
                onClick={() => {
                  setSelectedImages([]);
                  setPreviewUrl(null);
                  setPreviewDimensions(null);
                }}
                className="text-sm text-zinc-500 hover:text-zinc-300"
              >
                Clear Selection
              </button>
            </div>
            <p className="text-xs text-zinc-500 mb-3">Drag to reorder images in the grid</p>
            <div className="grid grid-cols-4 gap-2">
              {selectedImages.map((img, index) => (
                <div
                  key={img.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={clsx(
                    'relative aspect-square rounded-lg overflow-hidden cursor-move group',
                    draggedIndex === index && 'opacity-50'
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.imageFile.previewUrl}
                    alt={img.imageFile.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-zinc-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <MoveIcon className="w-4 h-4 text-zinc-300" />
                    <button
                      onClick={() => removeImage(img.id)}
                      className="p-1 bg-red-500/80 rounded hover:bg-red-500"
                    >
                      <XIcon className="w-3 h-3 text-white" />
                    </button>
                  </div>
                  <div className="absolute bottom-1 left-1 bg-zinc-950/80 px-1.5 py-0.5 rounded text-xs text-zinc-300">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Column - Preview & Export */}
      <div className="xl:col-span-2 space-y-6">
        {/* Error */}
        {error && (
          <div className="card p-4 border-red-500/30 bg-red-500/5">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Preview */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-zinc-300">Preview</h3>
              {isGenerating && (
                <span className="flex items-center gap-1.5 text-xs text-accent-400">
                  <LoaderIcon className="w-3 h-3" />
                  Updating...
                </span>
              )}
              {!isGenerating && previewUrl && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  Live
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-500">
                {previewDimensions
                  ? `${previewDimensions.width} × ${previewDimensions.height}`
                  : `${width} × ${height}`}
              </span>
              {selectedImages.length > 0 && selectedImages.every(img => img.imageFile.serverFilename) && (
                <button
                  onClick={generatePreview}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
                  title="Force refresh preview"
                >
                  <RefreshIcon className={clsx("w-4 h-4", isGenerating && "animate-spin")} />
                </button>
              )}
            </div>
          </div>

          <div
            ref={previewRef}
            className="relative rounded-lg overflow-hidden flex items-center justify-center"
            style={{
              backgroundColor: '#0a0a0a',
              aspectRatio: previewDimensions
                ? `${previewDimensions.width} / ${previewDimensions.height}`
                : `${width} / ${height}`,
              maxHeight: '500px',
            }}
          >
            {isGenerating && (
              <div className="absolute inset-0 bg-zinc-950/50 flex items-center justify-center z-10">
                <div className="bg-zinc-900/90 rounded-lg px-4 py-2 flex items-center gap-2">
                  <LoaderIcon className="w-5 h-5 text-accent-400" />
                  <span className="text-sm text-zinc-300">Updating preview...</span>
                </div>
              </div>
            )}

            {previewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Grid preview"
                  className="max-w-full max-h-full object-contain transition-opacity"
                />
              </>
            ) : selectedImages.length > 0 && selectedImages.every(img => img.imageFile.serverFilename) ? (
              <div className="text-center text-zinc-500">
                <LoaderIcon className="w-8 h-8 mx-auto mb-2 animate-spin" />
                <p>Generating preview...</p>
              </div>
            ) : images.length > 0 ? (
              <div className="text-center text-zinc-500">
                <LoaderIcon className="w-8 h-8 mx-auto mb-2 animate-spin" />
                <p>Uploading images...</p>
              </div>
            ) : (
              <div className="text-center text-zinc-600">
                <GridIcon className="w-16 h-16 mx-auto mb-4" />
                <p>Upload images to see preview</p>
              </div>
            )}
          </div>
        </div>

        {/* Export Options */}
        {images.length > 0 && (
          <div className="card p-4">
            <h3 className="font-medium text-zinc-300 mb-4">Export</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => exportGrid('png')}
                disabled={isGenerating}
                className="btn-primary flex items-center gap-2"
              >
                <DownloadIcon className="w-4 h-4" />
                Download PNG
              </button>
              <button
                onClick={() => exportGrid('jpg')}
                disabled={isGenerating}
                className="btn-secondary flex items-center gap-2"
              >
                <DownloadIcon className="w-4 h-4" />
                JPG
              </button>
              <button
                onClick={() => exportGrid('webp')}
                disabled={isGenerating}
                className="btn-secondary flex items-center gap-2"
              >
                <DownloadIcon className="w-4 h-4" />
                WebP
              </button>
              <button
                onClick={() => exportGrid('svg')}
                disabled={isGenerating}
                className="btn-secondary flex items-center gap-2"
              >
                <DownloadIcon className="w-4 h-4" />
                SVG
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {images.length === 0 && !previewUrl && (
          <div className="card p-12 text-center">
            <GridIcon className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-400 mb-2">No images selected</h3>
            <p className="text-zinc-600">
              Upload images to create your grid. You can add up to {maxImages} images for a {rows}×{cols} grid.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

