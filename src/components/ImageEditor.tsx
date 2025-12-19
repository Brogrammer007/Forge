'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import {
  UploadIcon,
  DownloadIcon,
  LoaderIcon,
  XIcon,
  RefreshIcon,
  BackgroundRemoverIcon,
  LockIcon,
  UnlockIcon,
  MoveIcon,
} from './ui/Icons';
import { formatFileSize, downloadBlob, validateFileSize, FILE_SIZE_LIMITS, withTimeout } from '@/lib/utils';
// @imgly/background-removal is imported dynamically to avoid webpack build issues
import { showToast } from './ui/Toast';

// Tool types
type EditorTool = 'crop' | 'resize' | 'adjust' | 'rotate' | 'background' | 'watermark' | 'filters';

// Aspect ratio presets
const ASPECT_RATIOS = [
  { label: 'Free', value: null },
  { label: '1:1', value: 1 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 3 / 2 },
];

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
}

interface Watermark {
  type: 'text' | 'image';
  text?: string;
  imageFile?: File;
  imageUrl?: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'custom';
  x?: number;
  y?: number;
  opacity: number;
  rotation: number;
  size: number;
  color?: string;
  fontFamily?: string;
  fontSize?: number;
}

type FilterType = 'none' | 'sepia' | 'grayscale' | 'vintage' | 'sharpen' | 'vignette' | 'warm' | 'cool' | 'invert' | 'hue-rotate' | 'saturate' | 'contrast' | 'brightness' | 'blur' | 'posterize' | 'noir';

interface ImageData {
  file: File;
  name: string;
  width: number;
  height: number;
  previewUrl: string;
}

export function ImageEditor() {
  // Image state
  const [image, setImage] = useState<ImageData | null>(null);
  const [originalImage, setOriginalImage] = useState<ImageData | null>(null); // Store original for reset
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Background removal state
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [bgRemovalProgress, setBgRemovalProgress] = useState(0);

  // Tool state
  const [activeTool, setActiveTool] = useState<EditorTool>('crop');

  // Crop state
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragType, setDragType] = useState<'move' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br' | 'resize-t' | 'resize-b' | 'resize-l' | 'resize-r' | null>(null);

  // Rotation state
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  // Adjustments state
  const [adjustments, setAdjustments] = useState<Adjustments>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
  });

  // Watermark state
  const [watermark, setWatermark] = useState<Watermark | null>(null);
  const [watermarkImageFile, setWatermarkImageFile] = useState<File | null>(null);
  const watermarkImageRef = useRef<HTMLImageElement | null>(null);

  // Filters state
  const [activeFilter, setActiveFilter] = useState<FilterType>('none');
  const [filterIntensity, setFilterIntensity] = useState(100);

  // Resize state
  const [resizeWidth, setResizeWidth] = useState(0);
  const [resizeHeight, setResizeHeight] = useState(0);
  const [lockRatio, setLockRatio] = useState(true);
  const [logoMode, setLogoMode] = useState(false);
  const [resizeQuality, setResizeQuality] = useState<'pixelated' | 'low' | 'medium' | 'high' | 'ultra' | 'lossless'>('lossless');

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageWrapperRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Load image
  const loadImage = useCallback(async (file: File, isOriginal: boolean = false) => {
    // Validate file size
    const validation = validateFileSize(file, FILE_SIZE_LIMITS.IMAGE, 'image');
    if (!validation.valid) {
      showToast(validation.error ?? 'File is too large', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const url = URL.createObjectURL(file);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });

      // Revoke old URL (but not original)
      if (image?.previewUrl && image.previewUrl !== originalImage?.previewUrl) {
        URL.revokeObjectURL(image.previewUrl);
      }

      imageRef.current = img;

      const newImageData = {
        file,
        name: file.name,
        width: img.naturalWidth,
        height: img.naturalHeight,
        previewUrl: url,
      };

      setImage(newImageData);

      // Save as original only on first upload
      if (isOriginal) {
        // Revoke old original image URL if exists
        if (originalImage?.previewUrl && originalImage.previewUrl !== newImageData.previewUrl) {
          URL.revokeObjectURL(originalImage.previewUrl);
        }
        setOriginalImage(newImageData);

        // Clean up old watermark image if exists
        // Always cleanup watermark ref, state will be reset below
        if (watermarkImageRef.current) {
          watermarkImageRef.current = null;
        }
      }

      // Reset all edits when loading new image
      setCropArea(null);
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      setFlipV(false);
      setAdjustments({ brightness: 100, contrast: 100, saturation: 100, blur: 0 });
      setWatermark(null);
      setResizeWidth(img.naturalWidth);
      setResizeHeight(img.naturalHeight);
      setWatermarkImageFile(null);
      watermarkImageRef.current = null;
      setActiveFilter('none');
      setFilterIntensity(100);
      setActiveTool('crop');
      setAspectRatio(null);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load image';
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [image, originalImage, watermark, watermarkImageFile]);

  // Handle file input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      loadImage(file, true); // true = this is original upload
    }
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      loadImage(file, true); // true = this is original upload
    }
  };

  // Clear image
  const clearImage = () => {
    if (image?.previewUrl) {
      URL.revokeObjectURL(image.previewUrl);
    }
    if (originalImage?.previewUrl && originalImage.previewUrl !== image?.previewUrl) {
      URL.revokeObjectURL(originalImage.previewUrl);
    }
    setImage(null);
    setOriginalImage(null);
    setCropArea(null);
  };

  // Get display dimensions (fit image in container while maintaining aspect ratio)
  const getDisplayDimensions = useCallback(() => {
    if (!image || image.width === 0 || image.height === 0 || !imageWrapperRef.current) {
      return { width: 0, height: 0, scale: 1 };
    }

    // Get container dimensions dynamically
    const container = imageWrapperRef.current.parentElement;
    if (!container) {
      return { width: 0, height: 0, scale: 1 };
    }

    const containerRect = container.getBoundingClientRect();
    // Use container dimensions minus padding (20px on each side = 40px total)
    const maxWidth = Math.max(300, containerRect.width - 40);
    const maxHeight = Math.max(300, containerRect.height - 40);

    // Calculate scale to fit within max dimensions while maintaining aspect ratio
    const aspectRatio = image.width / image.height;

    let displayWidth: number;
    let displayHeight: number;

    if (aspectRatio > maxWidth / maxHeight) {
      // Image is wider than container - constrain by width
      displayWidth = Math.min(image.width, maxWidth);
      displayHeight = displayWidth / aspectRatio;
    } else {
      // Image is taller than container - constrain by height
      displayHeight = Math.min(image.height, maxHeight);
      displayWidth = displayHeight * aspectRatio;
    }

    // Ensure we don't exceed max dimensions
    if (displayWidth > maxWidth) {
      displayWidth = maxWidth;
      displayHeight = displayWidth / aspectRatio;
    }
    if (displayHeight > maxHeight) {
      displayHeight = maxHeight;
      displayWidth = displayHeight * aspectRatio;
    }

    const scale = displayWidth / image.width;

    return {
      width: Math.floor(displayWidth),
      height: Math.floor(displayHeight),
      scale,
    };
  }, [image]);

  // Initialize crop area - always starts centered at 80% of image
  const initCropArea = useCallback(() => {
    if (!image || !imageWrapperRef.current) return;

    // Small delay to ensure DOM is ready
    setTimeout(() => {
      const dims = getDisplayDimensions();
      const maxW = dims.width;
      const maxH = dims.height;

      if (maxW === 0 || maxH === 0) return;

      // Start with 80% of the display dimensions
      let cropW = maxW * 0.8;
      let cropH = maxH * 0.8;

      // Apply aspect ratio if selected
      if (aspectRatio) {
        // Calculate the largest crop that fits within 80% of the display area
        // while maintaining the aspect ratio
        const maxCropW = maxW * 0.8;
        const maxCropH = maxH * 0.8;

        if (maxCropW / maxCropH > aspectRatio) {
          // Height is the limiting factor
          cropH = maxCropH;
          cropW = cropH * aspectRatio;
        } else {
          // Width is the limiting factor
          cropW = maxCropW;
          cropH = cropW / aspectRatio;
        }
      }

      // Ensure crop stays within bounds
      cropW = Math.min(cropW, maxW);
      cropH = Math.min(cropH, maxH);

      // Center the crop area
      const x = Math.floor((maxW - cropW) / 2);
      const y = Math.floor((maxH - cropH) / 2);

      setCropArea({
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: Math.floor(cropW),
        height: Math.floor(cropH),
      });
    }, 50);
  }, [image, aspectRatio, getDisplayDimensions]);

  // Initialize crop area when image is loaded and crop tool is active
  useEffect(() => {
    if (activeTool === 'crop' && image && !cropArea) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        initCropArea();
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [activeTool, image, cropArea, initCropArea]);

  // Update crop area when aspect ratio changes
  useEffect(() => {
    if (activeTool === 'crop' && image && cropArea && aspectRatio !== null) {
      initCropArea();
    }
  }, [aspectRatio, activeTool, image, initCropArea, cropArea]);

  // Force recalculation when imageWrapperRef is set (ensures image displays immediately)
  useEffect(() => {
    if (image && imageWrapperRef.current) {
      // Force a re-render by updating a state that triggers getDisplayDimensions
      // This ensures the image displays immediately after loading
      const timer = setTimeout(() => {
        // Trigger a re-render by calling getDisplayDimensions
        getDisplayDimensions();
        // Initialize crop area if crop tool is active
        if (activeTool === 'crop' && !cropArea) {
          initCropArea();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [image, activeTool, cropArea, getDisplayDimensions, initCropArea]);

  // Recalculate display dimensions when window resizes
  useEffect(() => {
    const handleResize = () => {
      if (activeTool === 'crop' && cropArea && image) {
        // Recalculate crop area based on new dimensions
        const dims = getDisplayDimensions();
        if (dims.width > 0 && dims.height > 0) {
          // Scale crop area proportionally
          const scaleX = dims.width / (cropArea.x + cropArea.width);
          const scaleY = dims.height / (cropArea.y + cropArea.height);
          const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down if needed

          setCropArea({
            x: Math.round(cropArea.x * scale),
            y: Math.round(cropArea.y * scale),
            width: Math.round(Math.min(cropArea.width * scale, dims.width)),
            height: Math.round(Math.min(cropArea.height * scale, dims.height)),
          });
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTool, cropArea, image, getDisplayDimensions]);

  // Handle crop area mouse events
  const handleCropMouseDown = (e: React.MouseEvent, type: 'move' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br' | 'resize-t' | 'resize-b' | 'resize-l' | 'resize-r') => {
    if (!cropArea || !imageWrapperRef.current) return;

    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragType(type);

    // Get the image wrapper's bounding rect
    const wrapperRect = imageWrapperRef.current.getBoundingClientRect();

    // Calculate mouse position relative to the image wrapper
    const mouseX = e.clientX - wrapperRect.left;
    const mouseY = e.clientY - wrapperRect.top;

    if (type === 'move') {
      // Store offset from mouse to crop area top-left corner
      setDragStart({
        x: mouseX - cropArea.x,
        y: mouseY - cropArea.y,
      });
    } else {
      // For resize, store the initial crop area state and mouse position
      setDragStart({
        x: mouseX,
        y: mouseY,
      });
    }
  };

  const handleCropMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !cropArea || !imageWrapperRef.current) return;

    const wrapperRect = imageWrapperRef.current.getBoundingClientRect();
    const dims = getDisplayDimensions();
    const maxW = dims.width;
    const maxH = dims.height;

    if (maxW === 0 || maxH === 0) return;

    // Calculate mouse position relative to wrapper, STRICTLY clamped to bounds
    const rawX = e.clientX - wrapperRect.left;
    const rawY = e.clientY - wrapperRect.top;
    const mouseX = Math.max(0, Math.min(rawX, maxW));
    const mouseY = Math.max(0, Math.min(rawY, maxH));

    const minSize = 40;

    if (dragType === 'move') {
      let newX = mouseX - dragStart.x;
      let newY = mouseY - dragStart.y;

      // Clamp position so crop stays fully inside
      newX = Math.max(0, Math.min(newX, maxW - cropArea.width));
      newY = Math.max(0, Math.min(newY, maxH - cropArea.height));

      setCropArea({
        x: Math.round(newX),
        y: Math.round(newY),
        width: cropArea.width,
        height: cropArea.height
      });
    } else if (dragType?.startsWith('resize')) {
      // Store the anchor points (opposite corner/edge)
      const anchorRight = cropArea.x + cropArea.width;
      const anchorBottom = cropArea.y + cropArea.height;
      const anchorLeft = cropArea.x;
      const anchorTop = cropArea.y;

      let newX = cropArea.x;
      let newY = cropArea.y;
      let newWidth = cropArea.width;
      let newHeight = cropArea.height;

      // Calculate delta from initial mouse position
      const deltaX = mouseX - dragStart.x;
      const deltaY = mouseY - dragStart.y;

      switch (dragType) {
        case 'resize-br':
          // Bottom-right corner
          newWidth = mouseX - cropArea.x;
          newHeight = mouseY - cropArea.y;
          break;
        case 'resize-bl':
          // Bottom-left corner
          newX = mouseX;
          newWidth = anchorRight - mouseX;
          newHeight = mouseY - cropArea.y;
          break;
        case 'resize-tr':
          // Top-right corner
          newY = mouseY;
          newWidth = mouseX - cropArea.x;
          newHeight = anchorBottom - mouseY;
          break;
        case 'resize-tl':
          // Top-left corner
          newX = mouseX;
          newY = mouseY;
          newWidth = anchorRight - mouseX;
          newHeight = anchorBottom - mouseY;
          break;
        case 'resize-t':
          // Top edge
          newY = mouseY;
          newHeight = anchorBottom - mouseY;
          break;
        case 'resize-b':
          // Bottom edge
          newHeight = mouseY - cropArea.y;
          break;
        case 'resize-l':
          // Left edge
          newX = mouseX;
          newWidth = anchorRight - mouseX;
          break;
        case 'resize-r':
          // Right edge
          newWidth = mouseX - cropArea.x;
          break;
      }

      // Apply aspect ratio if selected
      if (aspectRatio) {
        // For edge handles, maintain aspect ratio by adjusting the other dimension
        if (dragType === 'resize-t' || dragType === 'resize-b') {
          // Vertical resize - adjust width
          newWidth = newHeight * aspectRatio;
          // Keep center aligned or adjust based on anchor
          if (dragType === 'resize-t') {
            newX = anchorRight - newWidth;
          } else {
            // For bottom resize, keep left edge fixed
            newX = anchorLeft;
          }
        } else if (dragType === 'resize-l' || dragType === 'resize-r') {
          // Horizontal resize - adjust height
          newHeight = newWidth / aspectRatio;
          // Keep center aligned or adjust based on anchor
          if (dragType === 'resize-l') {
            newY = anchorBottom - newHeight;
          } else {
            // For right resize, keep top edge fixed
            newY = anchorTop;
          }
        } else {
          // Corner handles - adjust based on which dimension is closer to desired ratio
          const currentRatio = newWidth / newHeight;

          if (currentRatio > aspectRatio) {
            // Too wide - adjust height
            newHeight = newWidth / aspectRatio;
            // Adjust position based on resize type
            if (dragType === 'resize-tl' || dragType === 'resize-tr') {
              newY = anchorBottom - newHeight;
            }
          } else {
            // Too tall - adjust width
            newWidth = newHeight * aspectRatio;
            // Adjust position based on resize type
            if (dragType === 'resize-tl' || dragType === 'resize-bl') {
              newX = anchorRight - newWidth;
            }
          }
        }
      }

      // Enforce minimum size
      if (newWidth < minSize) {
        const widthDiff = minSize - newWidth;
        newWidth = minSize;
        // Adjust position for left-side resize handles
        if (dragType === 'resize-tl' || dragType === 'resize-bl' || dragType === 'resize-l') {
          newX = anchorRight - minSize;
        }
      }
      if (newHeight < minSize) {
        const heightDiff = minSize - newHeight;
        newHeight = minSize;
        // Adjust position for top-side resize handles
        if (dragType === 'resize-tl' || dragType === 'resize-tr' || dragType === 'resize-t') {
          newY = anchorBottom - minSize;
        }
      }

      // ===== STRICT BOUNDS ENFORCEMENT =====
      // Left edge
      if (newX < 0) {
        const overflow = -newX;
        newX = 0;
        if (dragType === 'resize-l' || dragType === 'resize-tl' || dragType === 'resize-bl') {
          newWidth -= overflow;
        }
      }
      // Top edge
      if (newY < 0) {
        const overflow = -newY;
        newY = 0;
        if (dragType === 'resize-t' || dragType === 'resize-tl' || dragType === 'resize-tr') {
          newHeight -= overflow;
        }
      }
      // Right edge
      if (newX + newWidth > maxW) {
        const overflow = (newX + newWidth) - maxW;
        if (dragType === 'resize-r' || dragType === 'resize-tr' || dragType === 'resize-br') {
          newWidth -= overflow;
        } else {
          newX = maxW - newWidth;
        }
      }
      // Bottom edge
      if (newY + newHeight > maxH) {
        const overflow = (newY + newHeight) - maxH;
        if (dragType === 'resize-b' || dragType === 'resize-bl' || dragType === 'resize-br') {
          newHeight -= overflow;
        } else {
          newY = maxH - newHeight;
        }
      }

      // Ensure minimum size after bounds check
      newWidth = Math.max(minSize, newWidth);
      newHeight = Math.max(minSize, newHeight);

      // Final safety clamp
      newX = Math.max(0, Math.min(newX, maxW - newWidth));
      newY = Math.max(0, Math.min(newY, maxH - newHeight));

      setCropArea({
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newWidth),
        height: Math.round(newHeight)
      });
    }
  }, [isDragging, cropArea, dragType, dragStart, aspectRatio, getDisplayDimensions]);

  const handleCropMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragType(null);
  }, []);

  // Add/remove mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleCropMouseMove);
      window.addEventListener('mouseup', handleCropMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleCropMouseMove);
      window.removeEventListener('mouseup', handleCropMouseUp);
    };
  }, [isDragging, handleCropMouseMove, handleCropMouseUp]);

  // Apply crop
  const applyCrop = () => {
    if (!cropArea || !image) return;

    const { scale } = getDisplayDimensions();

    // Convert display coords to image coords
    const realCrop = {
      x: cropArea.x / scale,
      y: cropArea.y / scale,
      width: cropArea.width / scale,
      height: cropArea.height / scale,
    };

    // Create canvas and crop
    const canvas = document.createElement('canvas');
    canvas.width = realCrop.width;
    canvas.height = realCrop.height;

    const ctx = canvas.getContext('2d');
    if (!ctx || !imageRef.current) return;

    ctx.drawImage(
      imageRef.current,
      realCrop.x, realCrop.y, realCrop.width, realCrop.height,
      0, 0, realCrop.width, realCrop.height
    );

    // Update image with cropped version
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], image.name, { type: 'image/png' });
        loadImage(file);
      }
    }, 'image/png');
  };

  // Rotate image
  const rotateImage = (degrees: number) => {
    setRotation((prev) => (prev + degrees) % 360);
  };

  // Resize Logic
  useEffect(() => {
    if (image && activeTool === 'resize') {
      // Only set initial if 0 (to avoid overwriting user input on re-renders, unless purely decorative re-render)
      // Actually, we want to sync with current image dimensions if we just switched to resize tool?
      // Let's rely on manual reset or initial load.
      if (resizeWidth === 0 || resizeHeight === 0) {
        setResizeWidth(image.width);
        setResizeHeight(image.height);
      }
    }
  }, [activeTool, image]);

  const handleResizeChange = (dimension: 'width' | 'height', value: number) => {
    if (!image) return;

    if (dimension === 'width') {
      setResizeWidth(value);
      if (lockRatio) {
        setResizeHeight(Math.round(value * (image.height / image.width)));
      }
    } else {
      setResizeHeight(value);
      if (lockRatio) {
        setResizeWidth(Math.round(value * (image.width / image.height)));
      }
    }
  };

  const applyResize = async () => {
    if (!image || !imageRef.current) return;

    setIsLoading(true);
    try {
      const targetW = resizeWidth;
      const targetH = resizeHeight;
      const srcW = image.width;
      const srcH = image.height;

      // Calculate scale ratio for intelligent processing
      const scaleRatio = Math.min(targetW / srcW, targetH / srcH);
      const isDownscaling = scaleRatio < 1;
      const isSignificantDownscale = scaleRatio < 0.5;
      const isExtremeDownscale = scaleRatio < 0.25;

      // Create source canvas with alpha support
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = srcW;
      srcCanvas.height = srcH;
      const srcCtx = srcCanvas.getContext('2d', { alpha: true, willReadFrequently: true });
      if (!srcCtx) throw new Error('Could not get source context');
      srcCtx.drawImage(imageRef.current, 0, 0);

      // Create result canvas
      const resultCanvas = document.createElement('canvas');
      resultCanvas.width = targetW;
      resultCanvas.height = targetH;
      const ctx = resultCanvas.getContext('2d', { alpha: true });
      if (!ctx) throw new Error('Could not get context');

      if (resizeQuality === 'pixelated') {
        // === PIXELATED (Nearest Neighbor) - for pixel art ===
        ctx.imageSmoothingEnabled = false;

        if (logoMode) {
          ctx.clearRect(0, 0, targetW, targetH);
          const scale = Math.min(targetW / srcW, targetH / srcH);
          const w = Math.floor(srcW * scale);
          const h = Math.floor(srcH * scale);
          const x = Math.floor((targetW - w) / 2);
          const y = Math.floor((targetH - h) / 2);
          ctx.drawImage(srcCanvas, x, y, w, h);
        } else {
          ctx.drawImage(srcCanvas, 0, 0, targetW, targetH);
        }

      } else if (resizeQuality === 'lossless' || resizeQuality === 'ultra') {
        // === LOSSLESS / ULTRA (Pure Lanczos3 - NO sharpening for maximum quality) ===
        // Wozniak principle: Let the math do the work, don't "improve" the algorithm
        const Pica = (await import('pica')).default;
        const pica = new Pica({
          features: ['js', 'wasm', 'ww'],
        });

        // For LOSSLESS: Pure Lanczos3 with ZERO sharpening
        // For ULTRA: Very subtle sharpening only on final pass
        const isLossless = resizeQuality === 'lossless';

        // Multi-pass downscaling with finer steps (70%) for maximum quality
        // This is the key to preserving detail during significant size reductions
        const multiPassResize = async (
          source: HTMLCanvasElement,
          targetWidth: number,
          targetHeight: number,
          applyFinalSharpening: boolean
        ): Promise<HTMLCanvasElement> => {
          let currentCanvas = source;
          let currentW = source.width;
          let currentH = source.height;

          // Use 70% reduction per step (finer than 50%, preserves more detail)
          const stepRatio = isLossless ? 0.65 : 0.7;

          // Multi-pass downscaling without ANY sharpening on intermediate steps
          while (currentW * stepRatio > targetWidth || currentH * stepRatio > targetHeight) {
            // Calculate next step size
            let nextW = Math.round(currentW * stepRatio);
            let nextH = Math.round(currentH * stepRatio);

            // Don't go below target
            if (nextW < targetWidth) nextW = targetWidth;
            if (nextH < targetHeight) nextH = targetHeight;

            // If we're already at or below target, break
            if (nextW >= currentW && nextH >= currentH) break;

            const intermediateCanvas = document.createElement('canvas');
            intermediateCanvas.width = nextW;
            intermediateCanvas.height = nextH;

            // Pure Lanczos3 - NO sharpening on intermediate passes
            await pica.resize(currentCanvas, intermediateCanvas, {
              quality: 3 as 0 | 1 | 2 | 3,
              unsharpAmount: 0,
              unsharpRadius: 0,
              unsharpThreshold: 0,
            });

            currentCanvas = intermediateCanvas;
            currentW = nextW;
            currentH = nextH;
          }

          // Final resize pass
          const finalCanvas = document.createElement('canvas');
          finalCanvas.width = targetWidth;
          finalCanvas.height = targetHeight;

          if (isLossless) {
            // LOSSLESS: Pure Lanczos3, absolutely NO sharpening
            await pica.resize(currentCanvas, finalCanvas, {
              quality: 3 as 0 | 1 | 2 | 3,
              unsharpAmount: 0,
              unsharpRadius: 0,
              unsharpThreshold: 0,
            });
          } else {
            // ULTRA: Very subtle sharpening on final pass only
            await pica.resize(currentCanvas, finalCanvas, {
              quality: 3 as 0 | 1 | 2 | 3,
              unsharpAmount: applyFinalSharpening ? 25 : 0, // Very light
              unsharpRadius: 0.4,
              unsharpThreshold: 2,
            });
          }

          return finalCanvas;
        };

        if (logoMode) {
          // Logo mode: Fit within bounds, center
          const scale = Math.min(targetW / srcW, targetH / srcH);
          const w = Math.round(srcW * scale);
          const h = Math.round(srcH * scale);

          const resizedCanvas = await multiPassResize(srcCanvas, w, h, isDownscaling);

          // Center on result canvas with transparency
          ctx.clearRect(0, 0, targetW, targetH);
          const x = Math.round((targetW - w) / 2);
          const y = Math.round((targetH - h) / 2);
          ctx.drawImage(resizedCanvas, x, y);

        } else {
          // Standard resize
          const resizedCanvas = await multiPassResize(srcCanvas, targetW, targetH, isDownscaling);
          ctx.clearRect(0, 0, targetW, targetH);
          ctx.drawImage(resizedCanvas, 0, 0);
        }

      } else {
        // === STANDARD / HIGH / MEDIUM / LOW (Canvas-based) ===
        const qualityMap: Record<string, ImageSmoothingQuality> = {
          'low': 'low',
          'medium': 'medium',
          'high': 'high',
        };
        const smoothingQuality = qualityMap[resizeQuality] || 'high';

        if (logoMode) {
          const scale = Math.min(targetW / srcW, targetH / srcH);
          const w = Math.round(srcW * scale);
          const h = Math.round(srcH * scale);
          const x = Math.round((targetW - w) / 2);
          const y = Math.round((targetH - h) / 2);

          // Progressive step-down for better quality
          let curCanvas = srcCanvas;
          let curW = srcW;
          let curH = srcH;

          while (curW * 0.5 >= w && curH * 0.5 >= h) {
            const nextW = Math.round(curW * 0.5);
            const nextH = Math.round(curH * 0.5);
            const nextCanvas = document.createElement('canvas');
            nextCanvas.width = nextW;
            nextCanvas.height = nextH;
            const nextCtx = nextCanvas.getContext('2d', { alpha: true });
            if (nextCtx) {
              nextCtx.imageSmoothingEnabled = true;
              nextCtx.imageSmoothingQuality = smoothingQuality;
              nextCtx.drawImage(curCanvas, 0, 0, nextW, nextH);
            }
            curW = nextW;
            curH = nextH;
            curCanvas = nextCanvas;
          }

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = w;
          tempCanvas.height = h;
          const tempCtx = tempCanvas.getContext('2d', { alpha: true });
          if (tempCtx) {
            tempCtx.imageSmoothingEnabled = true;
            tempCtx.imageSmoothingQuality = smoothingQuality;
            tempCtx.drawImage(curCanvas, 0, 0, w, h);
          }

          ctx.clearRect(0, 0, targetW, targetH);
          ctx.drawImage(tempCanvas, x, y);

        } else {
          let curCanvas = srcCanvas;
          let curW = srcW;
          let curH = srcH;

          if (isSignificantDownscale) {
            while (curW * 0.5 >= targetW && curH * 0.5 >= targetH) {
              const nextW = Math.round(curW * 0.5);
              const nextH = Math.round(curH * 0.5);
              const nextCanvas = document.createElement('canvas');
              nextCanvas.width = nextW;
              nextCanvas.height = nextH;
              const nextCtx = nextCanvas.getContext('2d', { alpha: true });
              if (nextCtx) {
                nextCtx.imageSmoothingEnabled = true;
                nextCtx.imageSmoothingQuality = smoothingQuality;
                nextCtx.drawImage(curCanvas, 0, 0, nextW, nextH);
              }
              curW = nextW;
              curH = nextH;
              curCanvas = nextCanvas;
            }
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = smoothingQuality;
          ctx.drawImage(curCanvas, 0, 0, targetW, targetH);
        }
      }

      // === EXPORT WITH MAXIMUM QUALITY ===
      // Lossless mode ALWAYS exports as PNG (no compression artifacts)
      // Other modes use original format but with maximum quality
      const hasTransparency = checkImageTransparency(srcCanvas);

      let outputType: string;
      let outputQuality: number | undefined;

      if (resizeQuality === 'lossless') {
        // LOSSLESS: Always PNG (zero compression loss)
        outputType = 'image/png';
        outputQuality = undefined; // PNG is always lossless
      } else if (hasTransparency) {
        // Has transparency: use PNG
        outputType = 'image/png';
        outputQuality = undefined;
      } else {
        // No transparency: use original format with max quality
        outputType = image.file.type;
        if (outputType === 'image/jpeg') {
          outputQuality = 1.0; // Maximum JPEG quality
        } else if (outputType === 'image/webp') {
          outputQuality = 1.0; // Maximum WebP quality
        }
      }

      resultCanvas.toBlob((blob) => {
        if (blob) {
          const extension = outputType === 'image/png' ? '.png' :
            outputType === 'image/webp' ? '.webp' : '.jpg';
          const baseName = image.name.replace(/\.[^/.]+$/, '');
          const file = new File([blob], baseName + extension, { type: outputType });
          loadImage(file);
        }
      }, outputType, outputQuality);

    } catch (e) {
      console.error(e);
      showToast('Resize failed: ' + (e instanceof Error ? e.message : 'Unknown error'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to detect if image has transparency (synchronous for speed)
  const checkImageTransparency = (canvas: HTMLCanvasElement): boolean => {
    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    if (!ctx) return false;

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Sample pixels for transparency (every 400th pixel for performance)
      for (let i = 3; i < data.length; i += 400) {
        const alpha = data[i];
        if (alpha !== undefined && alpha < 255) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  // Flip image
  const toggleFlipH = () => setFlipH(!flipH);
  const toggleFlipV = () => setFlipV(!flipV);

  // Reset all
  const resetAll = async () => {
    // First, reset all state values
    setCropArea(null);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setAdjustments({ brightness: 100, contrast: 100, saturation: 100, blur: 0 });
    setWatermark(null);

    // Revoke watermark image URL if exists
    if (watermarkImageFile) {
      // Find and revoke watermark image URL
      if (watermark?.imageUrl) {
        URL.revokeObjectURL(watermark.imageUrl);
      }
    }

    setWatermarkImageFile(null);
    watermarkImageRef.current = null;
    setActiveFilter('none');
    setFilterIntensity(100);
    setActiveTool('crop');

    // If we have original image, reload it to reset any transformations
    if (originalImage && originalImage.file) {
      // Revoke current preview URL if it's different from original
      if (image?.previewUrl && image.previewUrl !== originalImage.previewUrl) {
        URL.revokeObjectURL(image.previewUrl);
      }

      // Reload original image
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = originalImage.previewUrl;
      });

      imageRef.current = img;
      setImage({ ...originalImage });

      // Re-initialize crop area after image is set
      setTimeout(() => {
        initCropArea();
      }, 100);
    } else if (image) {
      // If no original image but we have current image, just reset all edits
      // Image stays but all edits are cleared
      setTimeout(() => {
        initCropArea();
      }, 100);
    }
  };

  // Handle watermark image upload
  const handleWatermarkImageUpload = async (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
    watermarkImageRef.current = img;
    setWatermarkImageFile(file);
    setWatermark({
      type: 'image',
      imageFile: file,
      imageUrl: url,
      position: 'bottom-right',
      opacity: 70,
      rotation: 0,
      size: 20,
    });
  };

  // Get CSS filter string (includes both adjustments and filters)
  const getFilterStyle = () => {
    const filters = [];
    if (adjustments.brightness !== 100) filters.push(`brightness(${adjustments.brightness}%)`);
    if (adjustments.contrast !== 100) filters.push(`contrast(${adjustments.contrast}%)`);
    if (adjustments.saturation !== 100) filters.push(`saturate(${adjustments.saturation}%)`);
    if (adjustments.blur > 0) filters.push(`blur(${adjustments.blur}px)`);

    // Apply artistic filters
    if (activeFilter !== 'none') {
      const intensity = filterIntensity / 100;
      switch (activeFilter) {
        case 'sepia':
          filters.push(`sepia(${intensity * 100}%)`);
          break;
        case 'grayscale':
          filters.push(`grayscale(${intensity * 100}%)`);
          break;
        case 'vintage':
          filters.push(`sepia(${intensity * 80}%) contrast(${100 + intensity * 20}%) brightness(${100 - intensity * 10}%)`);
          break;
        case 'sharpen':
          filters.push(`contrast(${100 + intensity * 30}%)`);
          break;
        case 'vignette':
          // Vignette is handled separately in canvas
          break;
        case 'warm':
          filters.push(`sepia(${intensity * 30}%) saturate(${100 + intensity * 30}%)`);
          break;
        case 'cool':
          filters.push(`hue-rotate(${intensity * -30}deg) saturate(${100 + intensity * 20}%)`);
          break;
        case 'invert':
          filters.push(`invert(${intensity * 100}%)`);
          break;
        case 'hue-rotate':
          filters.push(`hue-rotate(${intensity * 180}deg)`);
          break;
        case 'saturate':
          filters.push(`saturate(${100 + intensity * 200}%)`);
          break;
        case 'contrast':
          filters.push(`contrast(${100 + intensity * 100}%)`);
          break;
        case 'brightness':
          filters.push(`brightness(${100 + intensity * 50}%)`);
          break;
        case 'blur':
          filters.push(`blur(${intensity * 5}px)`);
          break;
        case 'posterize':
          // Posterize effect using contrast and saturation
          filters.push(`contrast(${100 + intensity * 50}%) saturate(${100 + intensity * 100}%)`);
          break;
        case 'noir':
          filters.push(`grayscale(${intensity * 100}%) contrast(${100 + intensity * 50}%) brightness(${100 - intensity * 20}%)`);
          break;
      }
    }

    return filters.join(' ') || 'none';
  };

  // Get filter presets
  const FILTER_PRESETS: { value: FilterType; label: string; description: string }[] = [
    { value: 'none', label: 'None', description: 'No filter' },
    { value: 'sepia', label: 'Sepia', description: 'Warm vintage tone' },
    { value: 'grayscale', label: 'Grayscale', description: 'Black and white' },
    { value: 'vintage', label: 'Vintage', description: 'Classic film look' },
    { value: 'sharpen', label: 'Sharpen', description: 'Increase clarity' },
    { value: 'warm', label: 'Warm', description: 'Warmer colors' },
    { value: 'cool', label: 'Cool', description: 'Cooler tones' },
    { value: 'invert', label: 'Invert', description: 'Invert colors' },
    { value: 'hue-rotate', label: 'Hue Shift', description: 'Shift color hues' },
    { value: 'saturate', label: 'Saturate', description: 'Boost colors' },
    { value: 'contrast', label: 'Contrast', description: 'Enhance contrast' },
    { value: 'brightness', label: 'Brightness', description: 'Adjust brightness' },
    { value: 'blur', label: 'Blur', description: 'Soft blur effect' },
    { value: 'posterize', label: 'Posterize', description: 'Artistic poster effect' },
    { value: 'noir', label: 'Noir', description: 'Film noir style' },
  ];

  // Get transform string
  const getTransformStyle = () => {
    const transforms = [];
    if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
    if (flipH) transforms.push('scaleX(-1)');
    if (flipV) transforms.push('scaleY(-1)');
    return transforms.join(' ') || 'none';
  };

  // Export image
  const exportImage = async (format: 'png' | 'jpg' | 'webp') => {
    if (!image || !imageRef.current) return;

    setIsExporting(true);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Handle rotation
      const isRotated90 = rotation === 90 || rotation === 270 || rotation === -90 || rotation === -270;
      canvas.width = isRotated90 ? image.height : image.width;
      canvas.height = isRotated90 ? image.width : image.height;

      // Apply transforms
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      if (flipH) ctx.scale(-1, 1);
      if (flipV) ctx.scale(1, -1);

      // Apply filters
      ctx.filter = getFilterStyle();

      // Draw image
      ctx.drawImage(
        imageRef.current,
        -image.width / 2,
        -image.height / 2,
        image.width,
        image.height
      );

      // Reset transform for vignette and watermark (they need to be in canvas space, not image space)
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Apply vignette if selected
      if (activeFilter === 'vignette') {
        const intensity = filterIntensity / 100;
        const gradient = ctx.createRadialGradient(
          canvas.width / 2,
          canvas.height / 2,
          Math.min(canvas.width, canvas.height) * 0.3,
          canvas.width / 2,
          canvas.height / 2,
          Math.max(canvas.width, canvas.height) * 0.8
        );
        gradient.addColorStop(0, `rgba(0, 0, 0, 0)`);
        gradient.addColorStop(1, `rgba(0, 0, 0, ${intensity * 0.6})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Apply watermark if present
      if (watermark) {
        ctx.save();
        ctx.globalAlpha = watermark.opacity / 100;
        ctx.filter = 'none'; // Watermark should not have filters applied

        // Calculate watermark position based on canvas dimensions
        let wmX = 0;
        let wmY = 0;
        const padding = 20;

        switch (watermark.position) {
          case 'top-left':
            wmX = padding;
            wmY = padding;
            break;
          case 'top-right':
            wmX = canvas.width - padding;
            wmY = padding;
            break;
          case 'bottom-left':
            wmX = padding;
            wmY = canvas.height - padding;
            break;
          case 'bottom-right':
            wmX = canvas.width - padding;
            wmY = canvas.height - padding;
            break;
          case 'center':
            wmX = canvas.width / 2;
            wmY = canvas.height / 2;
            break;
          case 'custom':
            wmX = watermark.x || canvas.width / 2;
            wmY = watermark.y || canvas.height / 2;
            break;
        }

        // Position watermark
        ctx.translate(wmX, wmY);

        if (watermark.type === 'text' && watermark.text && watermark.text.trim() !== '') {
          // Draw text watermark
          const fontSize = watermark.fontSize || 24;
          ctx.font = `${fontSize}px ${watermark.fontFamily || 'Arial'}`;
          ctx.fillStyle = watermark.color || '#ffffff';

          // Set text alignment based on position
          if (watermark.position === 'top-left' || watermark.position === 'bottom-left') {
            ctx.textAlign = 'left';
            ctx.textBaseline = watermark.position === 'top-left' ? 'top' : 'bottom';
          } else if (watermark.position === 'top-right' || watermark.position === 'bottom-right') {
            ctx.textAlign = 'right';
            ctx.textBaseline = watermark.position === 'top-right' ? 'top' : 'bottom';
          } else {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
          }

          // Draw text with shadow for better visibility
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;

          ctx.fillText(watermark.text, 0, 0);

          // Reset shadow
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        } else if (watermark.type === 'image' && watermarkImageRef.current) {
          // Draw image watermark
          const wmSize = (Math.min(canvas.width, canvas.height) * watermark.size) / 100;
          const aspectRatio = watermarkImageRef.current.height / watermarkImageRef.current.width;

          // Position based on corner
          let offsetX = 0;
          let offsetY = 0;

          if (watermark.position === 'top-left' || watermark.position === 'bottom-left') {
            offsetX = wmSize / 2;
          } else if (watermark.position === 'top-right' || watermark.position === 'bottom-right') {
            offsetX = -wmSize / 2;
          }

          if (watermark.position === 'top-left' || watermark.position === 'top-right') {
            offsetY = (wmSize * aspectRatio) / 2;
          } else if (watermark.position === 'bottom-left' || watermark.position === 'bottom-right') {
            offsetY = -(wmSize * aspectRatio) / 2;
          }

          ctx.drawImage(
            watermarkImageRef.current,
            offsetX - wmSize / 2,
            offsetY - (wmSize * aspectRatio) / 2,
            wmSize,
            wmSize * aspectRatio
          );
        }

        ctx.restore();
      }

      // Convert to blob
      const mimeType = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
      const quality = format === 'png' ? undefined : 0.92;

      canvas.toBlob((blob) => {
        if (blob) {
          const filename = image.name.replace(/\.[^/.]+$/, '') + '_edited.' + format;
          downloadBlob(blob, filename);
        } else {
          showToast('Failed to export image. Please try again.', 'error');
        }
        setIsExporting(false);
      }, mimeType, quality);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export image';
      showToast(errorMessage, 'error');
      setIsExporting(false);
    }
  };

  const displayDims = getDisplayDimensions();
  const displayWidth = displayDims.width || (image ? Math.min(image.width, 550) : 0);
  const displayHeight = displayDims.height || (image ? Math.min(image.height, 400) : 0);

  return (
    <div className="space-y-6" ref={containerRef}>
      {/* Upload Area */}
      {!image && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="card p-12 border-2 border-dashed border-zinc-700 hover:border-accent-500/50 transition-colors cursor-pointer"
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            id="image-editor-upload"
            aria-label="Upload image for editing"
          />
          <label htmlFor="image-editor-upload" className="cursor-pointer block text-center">
            <UploadIcon className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-300 mb-2">
              Drop image here or click to browse
            </h3>
            <p className="text-zinc-500 text-sm">
              PNG, JPG, WebP • Supported for editing
            </p>
          </label>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="card p-8 text-center">
          <LoaderIcon className="w-8 h-8 text-accent-500 mx-auto mb-3" />
          <p className="text-zinc-400">Loading image...</p>
        </div>
      )}

      {/* Editor */}
      {image && !isLoading && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Left - Tools */}
          <div className="space-y-4 flex flex-col">
            {/* Tool Tabs */}
            <div className="card p-2">
              <div className="flex flex-col gap-1">
                {[
                  { id: 'crop' as const, label: 'Crop', icon: '✂️' },
                  { id: 'resize' as const, label: 'Resize', icon: MoveIcon },
                  { id: 'rotate' as const, label: 'Transform', icon: '🔄' },
                  { id: 'adjust' as const, label: 'Adjust', icon: '🎨' },
                  { id: 'filters' as const, label: 'Filters', icon: '🎭' },
                  { id: 'watermark' as const, label: 'Watermark', icon: '🔒' },
                  { id: 'background' as const, label: 'Background', icon: BackgroundRemoverIcon },
                ].map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => setActiveTool(tool.id)}
                    aria-label={`Switch to ${tool.label} tool`}
                    aria-pressed={activeTool === tool.id}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                      activeTool === tool.id
                        ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                        : 'text-zinc-400 hover:bg-zinc-800'
                    )}
                  >
                    {typeof tool.icon === 'string' ? (
                      <span className="text-lg">{tool.icon}</span>
                    ) : (
                      <tool.icon className="w-5 h-5" />
                    )}
                    {tool.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tool Options */}
            <div className="card p-4 space-y-4 flex-1 overflow-visible">
              {/* Crop Options */}
              {activeTool === 'crop' && (
                <>
                  <h3 className="text-sm font-medium text-zinc-300">Aspect Ratio</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio.label}
                        onClick={() => setAspectRatio(ratio.value)}
                        className={clsx(
                          'px-3 py-2 rounded-lg text-xs font-medium transition-all',
                          aspectRatio === ratio.value
                            ? 'bg-accent-500 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        )}
                      >
                        {ratio.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={applyCrop}
                    disabled={!cropArea}
                    className="w-full btn-primary mt-4"
                  >
                    Apply Crop
                  </button>
                </>
              )}

              {/* Resize Panel */}
              {activeTool === 'resize' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <h3 className="text-sm font-semibold text-zinc-200">Resize Image</h3>
                    <div className="text-xs text-zinc-500 font-mono">
                      {image && `${image.width} × ${image.height}`}
                    </div>
                  </div>

                  {/* Presets */}
                  <div className="grid grid-cols-3 gap-2">
                    {[16, 32, 64, 128, 256].map(size => {
                      const isActive = resizeWidth === size && resizeHeight === size;
                      return (
                        <button
                          key={size}
                          onClick={() => {
                            setResizeWidth(size);
                            setResizeHeight(size);
                            setLockRatio(true);
                          }}
                          className={clsx(
                            "px-2 py-2 rounded-md text-xs font-medium transition-all border",
                            isActive
                              ? "bg-accent-500 text-white border-accent-600 shadow-md shadow-accent-500/20"
                              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white border-zinc-700/50"
                          )}
                        >
                          {size} × {size}
                        </button>
                      );
                    })}
                  </div>

                  {/* Inputs */}
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Width (px)</label>
                      <input
                        type="number"
                        value={resizeWidth}
                        onChange={(e) => handleResizeChange('width', parseInt(e.target.value) || 0)}
                        className="input-field w-full text-center font-mono"
                      />
                    </div>
                    <button
                      onClick={() => setLockRatio(!lockRatio)}
                      className={clsx(
                        "p-2 rounded-lg mb-[1px] transition-colors",
                        lockRatio ? "text-accent-500 bg-accent-500/10" : "text-zinc-600 hover:bg-zinc-800"
                      )}
                      title="Lock Aspect Ratio"
                    >
                      {lockRatio ? <LockIcon className="w-4 h-4" /> : <UnlockIcon className="w-4 h-4" />}
                    </button>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Height (px)</label>
                      <input
                        type="number"
                        value={resizeHeight}
                        onChange={(e) => handleResizeChange('height', parseInt(e.target.value) || 0)}
                        className="input-field w-full text-center font-mono"
                      />
                    </div>
                  </div>

                  {/* Logo Mode */}
                  <div className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-800">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="text-sm text-zinc-300 font-medium group-hover:text-white transition-colors">Logo / Icon Mode</span>
                      <input
                        type="checkbox"
                        checked={logoMode}
                        onChange={(e) => setLogoMode(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-600 text-accent-500 focus:ring-accent-500 focus:ring-offset-zinc-900 bg-zinc-700"
                      />
                    </label>
                    {logoMode && (
                      <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">
                        Enables transparent background, pixel-perfect centering, and fits image within dimensions without distortion.
                      </p>
                    )}
                  </div>

                  {/* Resampling */}
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Resampling Quality</label>
                    <div className="space-y-1">
                      {/* Top row: Best quality options */}
                      <div className="grid grid-cols-2 bg-zinc-800/80 p-1 rounded-lg gap-1">
                        {(['lossless', 'ultra'] as const).map((q) => (
                          <button
                            key={q}
                            onClick={() => setResizeQuality(q)}
                            className={clsx(
                              "text-[10px] uppercase tracking-wide font-semibold py-2 px-3 rounded-lg transition-all",
                              resizeQuality === q
                                ? q === 'lossless'
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/25"
                                  : "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md shadow-violet-500/25"
                                : "text-zinc-400 hover:text-white hover:bg-zinc-700/70 border border-zinc-700/50"
                            )}
                            title={q === 'lossless' ? 'Maximum Quality (Pure Lanczos3 + PNG)' : 'High Quality (Lanczos3 + Light Sharpening)'}
                          >
                            {q === 'lossless' ? '✨ Lossless' : '⚡ Ultra'}
                          </button>
                        ))}
                      </div>
                      {/* Bottom row: Standard options */}
                      <div className="grid grid-cols-4 bg-zinc-800/60 p-1.5 rounded-lg gap-1.5">
                        {(['pixelated', 'low', 'medium', 'high'] as const).map((q) => (
                          <button
                            key={q}
                            onClick={() => setResizeQuality(q)}
                            className={clsx(
                              "text-[10px] uppercase tracking-wide font-medium py-2 rounded-lg transition-all",
                              resizeQuality === q
                                ? "bg-zinc-600 text-white shadow-sm"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50"
                            )}
                            title={q === 'pixelated' ? 'Nearest Neighbor (Retro)' : `${q.charAt(0).toUpperCase() + q.slice(1)} Quality`}
                          >
                            {q === 'pixelated' ? '🎮 Pixel' : q.charAt(0).toUpperCase() + q.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    {resizeQuality === 'lossless' && (
                      <p className="text-[10px] text-emerald-400/90 mt-2 leading-relaxed bg-emerald-500/10 rounded-lg p-2 border border-emerald-500/20">
                        🎯 Pure Lanczos3 algorithm with zero post-processing. Exports as PNG for maximum quality preservation.
                      </p>
                    )}
                    {resizeQuality === 'ultra' && (
                      <p className="text-[10px] text-violet-400/90 mt-2 leading-relaxed bg-violet-500/10 rounded-lg p-2 border border-violet-500/20">
                        ⚡ Lanczos3 with subtle sharpening for crisp results.
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-3 grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        // Reset to original dimensions
                        if (image) {
                          setResizeWidth(image.width);
                          setResizeHeight(image.height);
                        }
                      }}
                      className="btn-secondary text-xs py-2.5"
                    >
                      ↩️ Reset
                    </button>
                    <button
                      onClick={applyResize}
                      className="btn-primary text-xs py-2.5"
                    >
                      ✅ Apply Resize
                    </button>
                  </div>
                </div>
              )}

              {/* Transform Options */}
              {activeTool === 'rotate' && (
                <>
                  <h3 className="text-sm font-medium text-zinc-300">Rotate</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {[-90, -45, 45, 90].map((deg) => (
                      <button
                        key={deg}
                        onClick={() => rotateImage(deg)}
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      >
                        {deg > 0 ? '+' : ''}{deg}°
                      </button>
                    ))}
                  </div>

                  <h3 className="text-sm font-medium text-zinc-300 mt-4">Flip</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={toggleFlipH}
                      className={clsx(
                        'px-3 py-2 rounded-lg text-xs font-medium transition-all',
                        flipH
                          ? 'bg-accent-500 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      )}
                    >
                      ↔️ Horizontal
                    </button>
                    <button
                      onClick={toggleFlipV}
                      className={clsx(
                        'px-3 py-2 rounded-lg text-xs font-medium transition-all',
                        flipV
                          ? 'bg-accent-500 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      )}
                    >
                      ↕️ Vertical
                    </button>
                  </div>

                  <p className="text-xs text-zinc-500 mt-2">
                    Current: {rotation}° {flipH ? '(flipped H)' : ''} {flipV ? '(flipped V)' : ''}
                  </p>
                </>
              )}

              {/* Adjust Options */}
              {activeTool === 'adjust' && (
                <>
                  <div>
                    <label className="label flex justify-between">
                      <span>Brightness</span>
                      <span className="text-zinc-500">{adjustments.brightness}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={adjustments.brightness}
                      onChange={(e) => setAdjustments({ ...adjustments, brightness: parseInt(e.target.value) })}
                      className="w-full accent-accent-500"
                    />
                  </div>

                  <div>
                    <label className="label flex justify-between">
                      <span>Contrast</span>
                      <span className="text-zinc-500">{adjustments.contrast}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={adjustments.contrast}
                      onChange={(e) => setAdjustments({ ...adjustments, contrast: parseInt(e.target.value) })}
                      className="w-full accent-accent-500"
                    />
                  </div>

                  <div>
                    <label className="label flex justify-between">
                      <span>Saturation</span>
                      <span className="text-zinc-500">{adjustments.saturation}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={adjustments.saturation}
                      onChange={(e) => setAdjustments({ ...adjustments, saturation: parseInt(e.target.value) })}
                      className="w-full accent-accent-500"
                    />
                  </div>

                  <div>
                    <label className="label flex justify-between">
                      <span>Blur</span>
                      <span className="text-zinc-500">{adjustments.blur}px</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={adjustments.blur}
                      onChange={(e) => setAdjustments({ ...adjustments, blur: parseInt(e.target.value) })}
                      className="w-full accent-accent-500"
                    />
                  </div>
                </>
              )}

              {/* Filters Options */}
              {activeTool === 'filters' && (
                <div className="space-y-4 max-h-[65vh] overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent hover:scrollbar-thumb-zinc-600">
                  <div className="sticky top-0 bg-zinc-900/98 backdrop-blur-md pb-3 z-20 border-b border-zinc-800/50 mb-3">
                    <h3 className="text-sm font-medium text-zinc-300 mb-1">Image Filters</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Apply artistic filters to transform your image with live preview.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {FILTER_PRESETS.map((filter, index) => {
                      const gradients = [
                        'from-purple-500/20 to-pink-500/20',
                        'from-blue-500/20 to-cyan-500/20',
                        'from-amber-500/20 to-orange-500/20',
                        'from-violet-500/20 to-purple-500/20',
                        'from-green-500/20 to-emerald-500/20',
                        'from-rose-500/20 to-pink-500/20',
                        'from-teal-500/20 to-cyan-500/20',
                        'from-indigo-500/20 to-purple-500/20',
                        'from-yellow-500/20 to-orange-500/20',
                        'from-red-500/20 to-pink-500/20',
                        'from-cyan-500/20 to-blue-500/20',
                        'from-emerald-500/20 to-teal-500/20',
                        'from-slate-500/20 to-gray-500/20',
                        'from-fuchsia-500/20 to-purple-500/20',
                        'from-zinc-500/20 to-neutral-500/20',
                      ];
                      const activeGradients = [
                        'from-purple-500 to-pink-500',
                        'from-blue-500 to-cyan-500',
                        'from-amber-500 to-orange-500',
                        'from-violet-500 to-purple-500',
                        'from-green-500 to-emerald-500',
                        'from-rose-500 to-pink-500',
                        'from-teal-500 to-cyan-500',
                        'from-indigo-500 to-purple-500',
                        'from-yellow-500 to-orange-500',
                        'from-red-500 to-pink-500',
                        'from-cyan-500 to-blue-500',
                        'from-emerald-500 to-teal-500',
                        'from-slate-500 to-gray-500',
                        'from-fuchsia-500 to-purple-500',
                        'from-zinc-500 to-neutral-500',
                      ];
                      const gradient = gradients[index % gradients.length];
                      const activeGradient = activeGradients[index % activeGradients.length];

                      return (
                        <button
                          key={filter.value}
                          onClick={() => setActiveFilter(filter.value)}
                          className={clsx(
                            'relative px-3 py-3 rounded-lg text-xs font-medium transition-all text-left overflow-hidden group',
                            activeFilter === filter.value
                              ? 'bg-gradient-to-br ' + activeGradient + ' text-white shadow-lg shadow-accent-500/25'
                              : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700/80 border border-zinc-700/50'
                          )}
                          title={filter.description}
                        >
                          {/* Gradient overlay for inactive buttons */}
                          {activeFilter !== filter.value && (
                            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-200`} />
                          )}

                          <div className="relative z-10">
                            <div className={clsx(
                              'font-semibold mb-0.5',
                              activeFilter === filter.value ? 'text-white' : 'text-zinc-200'
                            )}>
                              {filter.label}
                            </div>
                            <div className={clsx(
                              'text-xs leading-tight',
                              activeFilter === filter.value
                                ? 'text-white/90'
                                : 'text-zinc-400'
                            )}>
                              {filter.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {activeFilter !== 'none' && (
                    <div className="pt-2">
                      <label className="label flex justify-between mb-2">
                        <span className="text-zinc-300 font-medium">Intensity</span>
                        <span className="text-accent-400 font-semibold">{filterIntensity}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={filterIntensity}
                        onChange={(e) => setFilterIntensity(parseInt(e.target.value))}
                        className="w-full accent-accent-500"
                      />
                    </div>
                  )}

                  <div className="p-3.5 bg-gradient-to-br from-zinc-800/60 to-zinc-900/60 rounded-lg border border-zinc-700/50 backdrop-blur-sm">
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      <strong className="text-accent-400 font-semibold">💡 Tip:</strong>{' '}
                      <span className="text-zinc-400">Filters are combined with adjustments for creative effects.</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Watermark Options */}
              {activeTool === 'watermark' && (
                <div className="space-y-4 max-h-[70vh] overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent hover:scrollbar-thumb-zinc-600">
                  <div className="sticky top-0 bg-zinc-900/98 backdrop-blur-md pb-3 z-20 border-b border-zinc-800/50 mb-3">
                    <h3 className="text-sm font-medium text-zinc-300 mb-1">Watermark Tool</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Add text or image watermarks to protect your images. Position and adjust opacity to customize.
                    </p>
                  </div>

                  {/* Watermark Type Selection */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      onClick={() => {
                        setWatermark({
                          type: 'text',
                          text: 'Watermark',
                          position: 'bottom-right',
                          opacity: 70,
                          rotation: 0,
                          size: 20,
                          color: '#ffffff',
                          fontFamily: 'Arial',
                          fontSize: 24,
                        });
                      }}
                      className={clsx(
                        'px-3 py-2 rounded-lg text-xs font-medium transition-all',
                        watermark?.type === 'text'
                          ? 'bg-accent-500 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      )}
                    >
                      Text
                    </button>
                    <button
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) handleWatermarkImageUpload(file);
                        };
                        input.click();
                      }}
                      className={clsx(
                        'px-3 py-2 rounded-lg text-xs font-medium transition-all',
                        watermark?.type === 'image'
                          ? 'bg-accent-500 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      )}
                    >
                      Image
                    </button>
                  </div>

                  {watermark && (
                    <>
                      {/* Text Watermark Options */}
                      {watermark.type === 'text' && (
                        <>
                          <div className="mb-3">
                            <label className="label">Text</label>
                            <input
                              type="text"
                              value={watermark.text || ''}
                              onChange={(e) => setWatermark({ ...watermark, text: e.target.value })}
                              className="input-field w-full"
                              placeholder="Enter watermark text"
                            />
                          </div>

                          <div className="mb-3">
                            <label className="label flex justify-between">
                              <span>Font Size</span>
                              <span className="text-zinc-500">{watermark.fontSize || 24}px</span>
                            </label>
                            <input
                              type="range"
                              min="12"
                              max="72"
                              value={watermark.fontSize || 24}
                              onChange={(e) => setWatermark({ ...watermark, fontSize: parseInt(e.target.value) })}
                              className="w-full accent-accent-500"
                            />
                          </div>

                          <div className="mb-3">
                            <label className="label">Text Color</label>
                            <div className="flex gap-2">
                              <input
                                type="color"
                                value={watermark.color || '#ffffff'}
                                onChange={(e) => setWatermark({ ...watermark, color: e.target.value })}
                                className="w-12 h-10 rounded cursor-pointer"
                              />
                              <input
                                type="text"
                                value={watermark.color || '#ffffff'}
                                onChange={(e) => setWatermark({ ...watermark, color: e.target.value })}
                                className="input-field flex-1 font-mono text-sm"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {/* Position */}
                      <div className="mb-3">
                        <label className="label">Position</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'].map((pos) => (
                            <button
                              key={pos}
                              onClick={() => setWatermark({ ...watermark, position: pos as Watermark['position'] })}
                              className={clsx(
                                'px-2 py-1.5 rounded text-xs font-medium transition-all capitalize',
                                watermark.position === pos
                                  ? 'bg-accent-500 text-white'
                                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                              )}
                            >
                              {pos.replace('-', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Opacity - moved up for better visibility */}
                      <div className="mb-3">
                        <label className="label flex justify-between">
                          <span>Opacity</span>
                          <span className="text-zinc-500">{watermark.opacity}%</span>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={watermark.opacity}
                          onChange={(e) => setWatermark({ ...watermark, opacity: parseInt(e.target.value) })}
                          className="w-full accent-accent-500"
                        />
                      </div>

                      {/* Size (for image watermark) */}
                      {watermark.type === 'image' && (
                        <div className="mb-3">
                          <label className="label flex justify-between">
                            <span>Size</span>
                            <span className="text-zinc-500">{watermark.size}%</span>
                          </label>
                          <input
                            type="range"
                            min="5"
                            max="50"
                            value={watermark.size}
                            onChange={(e) => setWatermark({ ...watermark, size: parseInt(e.target.value) })}
                            className="w-full accent-accent-500"
                          />
                        </div>
                      )}

                      {/* Remove Watermark */}
                      <button
                        onClick={() => {
                          setWatermark(null);
                          setWatermarkImageFile(null);
                          if (watermark?.imageUrl) {
                            URL.revokeObjectURL(watermark.imageUrl);
                          }
                        }}
                        className="w-full btn-secondary mt-2 text-red-400 hover:text-red-300"
                      >
                        Remove Watermark
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Background Options */}
              {activeTool === 'background' && (
                <>
                  <h3 className="text-sm font-medium text-zinc-300">AI Background Remover</h3>
                  <p className="text-xs text-zinc-500 mb-4">
                    Uses advanced AI to precisely remove backgrounds while preserving fine details like hair, fur, and edges.
                    Powered by ISNet model running entirely in your browser.
                  </p>

                  {isRemovingBg ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <LoaderIcon className="w-5 h-5 text-accent-500 animate-spin" />
                        <span className="text-sm text-zinc-400">Processing...</span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-accent-500 to-purple-500 transition-all duration-300"
                          style={{ width: `${bgRemovalProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-zinc-500 text-center">
                        {bgRemovalProgress < 30 ? 'Loading AI model...' :
                          bgRemovalProgress < 70 ? 'Analyzing image...' :
                            'Removing background...'}
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        if (!image || !imageRef.current) return;

                        setIsRemovingBg(true);
                        setBgRemovalProgress(0);

                        try {
                          // Use @imgly/background-removal with isnet_fp16 model
                          // This is completely free and runs in the browser
                          setBgRemovalProgress(10);

                          // Dynamically import @imgly/background-removal to avoid webpack build issues
                          // Dynamically import @imgly/background-removal from CDN to handle assets correctly
                          // @ts-ignore
                          const { removeBackground } = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');

                          // Add timeout for background removal (5 minutes max)
                          const blob = await withTimeout(
                            removeBackground(image.previewUrl, {
                              model: 'isnet_fp16', // 16-bit precision for better accuracy
                              output: {
                                format: 'image/png',
                                quality: 1.0,
                              },
                              progress: (key: string, current: number, total: number) => {
                                // Calculate progress based on download and inference phases
                                const baseProgress = 10;
                                const maxProgress = 90;
                                const progress = baseProgress + Math.round((current / total) * (maxProgress - baseProgress));
                                setBgRemovalProgress(Math.min(progress, maxProgress));
                              }
                            }),
                            5 * 60 * 1000, // 5 minutes
                            'Background removal timed out. Please try again with a smaller image.'
                          ) as Blob;

                          setBgRemovalProgress(95);

                          // Create new image from result without triggering loading state
                          const url = URL.createObjectURL(blob);
                          const img = new Image();
                          await new Promise<void>((resolve, reject) => {
                            img.onload = () => resolve();
                            img.onerror = reject;
                            img.src = url;
                          });

                          // Revoke old URL (but not original)
                          if (image?.previewUrl && image.previewUrl !== originalImage?.previewUrl) {
                            URL.revokeObjectURL(image.previewUrl);
                          }

                          imageRef.current = img;

                          const newImageData = {
                            file: new File([blob], image.name.replace(/\.[^/.]+$/, '_nobg.png'), { type: 'image/png' }),
                            name: image.name.replace(/\.[^/.]+$/, '_nobg.png'),
                            width: img.naturalWidth,
                            height: img.naturalHeight,
                            previewUrl: url,
                          };

                          setImage(newImageData);

                          setBgRemovalProgress(100);

                          // Small delay to show 100% progress before hiding
                          await new Promise(resolve => setTimeout(resolve, 300));
                        } catch (err) {
                          const errorMessage = err instanceof Error ? err.message : 'Failed to remove background';
                          showToast(errorMessage, 'error');
                        } finally {
                          setIsRemovingBg(false);
                          setBgRemovalProgress(0);
                        }
                      }}
                      className="w-full btn-primary flex items-center justify-center gap-2"
                    >
                      <BackgroundRemoverIcon className="w-5 h-5" />
                      Remove Background
                    </button>
                  )}

                  <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                    <p className="text-xs text-zinc-400">
                      <strong className="text-zinc-300">Tip:</strong> Works best with clear subjects like people, animals, or products.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="card p-4 space-y-3">
              <button
                onClick={resetAll}
                className="w-full btn-secondary flex items-center justify-center gap-2"
              >
                <RefreshIcon className="w-4 h-4" />
                Reset All
              </button>
              <button
                onClick={clearImage}
                className="w-full text-sm text-zinc-500 hover:text-red-400 transition-colors"
              >
                Remove Image
              </button>
            </div>
          </div>

          {/* Center - Canvas */}
          <div className="xl:col-span-2">
            <div className="card p-6">
              {/* Image Info */}
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-zinc-200 truncate" title={image.name}>
                    {image.name}
                  </h3>
                  <p className="text-xs text-zinc-500 truncate">
                    {image.width}×{image.height} • {formatFileSize(image.file.size)}
                  </p>
                </div>
                <button
                  onClick={clearImage}
                  className="flex-shrink-0 p-2 text-zinc-500 hover:text-red-400 transition-colors"
                  title="Remove image"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Image Container */}
              <div
                className="image-container relative bg-zinc-950 rounded-lg flex items-center justify-center"
                style={{
                  minHeight: '400px',
                  padding: '20px',
                  overflow: 'hidden', // Always hidden to prevent watermark from overflowing
                }}
              >
                {/* Checkboard background */}
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: `
                      linear-gradient(45deg, #333 25%, transparent 25%),
                      linear-gradient(-45deg, #333 25%, transparent 25%),
                      linear-gradient(45deg, transparent 75%, #333 75%),
                      linear-gradient(-45deg, transparent 75%, #333 75%)
                    `,
                    backgroundSize: '20px 20px',
                    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                  }}
                />

                {/* Image Wrapper - exact dimensions calculated to maintain aspect ratio */}
                <div
                  ref={imageWrapperRef}
                  className="relative bg-black"
                  style={{
                    width: displayWidth > 0 ? `${displayWidth}px` : (image ? `${Math.min(image.width, 550)}px` : 'auto'),
                    height: displayHeight > 0 ? `${displayHeight}px` : (image ? `${Math.min(image.height, 400)}px` : 'auto'),
                    minWidth: displayWidth > 0 ? undefined : '300px',
                    minHeight: displayHeight > 0 ? undefined : '300px',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    aspectRatio: image ? `${image.width} / ${image.height}` : undefined,
                    overflow: watermark && watermark.type === 'text' ? 'visible' : 'hidden', // Allow text watermark to be fully visible
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.previewUrl}
                    alt="Edit preview"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: '100%',
                      objectFit: 'fill', // Fill exactly - wrapper already has correct aspect ratio
                      filter: getFilterStyle(),
                      transform: getTransformStyle(),
                      transformOrigin: 'center center',
                    }}
                  />

                  {/* Watermark Overlay */}
                  {watermark && !(activeTool === 'crop' && cropArea) && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        opacity: watermark.opacity / 100,
                        overflow: watermark.type === 'text' ? 'visible' : 'hidden', // Allow text to be fully visible
                      }}
                    >
                      {(() => {
                        // Calculate watermark position based on display dimensions
                        const fontSize = (watermark.fontSize || 24) * (displayWidth / 550);
                        // Fixed padding to prevent position changes when font size changes
                        const padding = 20 * (displayWidth / 550); // Fixed padding scaled to display size

                        let wmX = 0;
                        let wmY = 0;
                        let transformX = '0%';
                        let transformY = '0%';
                        let transformOrigin = 'center center';

                        // For corner positions, use different transform to ensure text stays visible
                        const isCorner = ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(watermark.position);

                        switch (watermark.position) {
                          case 'top-left':
                            wmX = padding;
                            wmY = padding;
                            transformX = '0%';
                            transformY = '0%';
                            transformOrigin = 'top left';
                            break;
                          case 'top-right':
                            // Position at top-right corner with padding from edges
                            wmX = displayWidth - padding;
                            wmY = padding;
                            transformX = '-100%';
                            transformY = '0%';
                            transformOrigin = 'top right';
                            break;
                          case 'bottom-left':
                            // Position at bottom-left corner with padding from edges
                            wmX = padding;
                            wmY = displayHeight - padding;
                            transformX = '0%';
                            transformY = '-100%';
                            transformOrigin = 'bottom left';
                            break;
                          case 'bottom-right':
                            // Position at bottom-right corner with padding from edges
                            wmX = displayWidth - padding;
                            wmY = displayHeight - padding;
                            transformX = '-100%';
                            transformY = '-100%';
                            transformOrigin = 'bottom right';
                            break;
                          case 'center':
                            wmX = displayWidth / 2;
                            wmY = displayHeight / 2;
                            transformX = '-50%';
                            transformY = '-50%';
                            transformOrigin = 'center center';
                            break;
                          case 'custom':
                            wmX = watermark.x || displayWidth / 2;
                            wmY = watermark.y || displayHeight / 2;
                            transformX = '-50%';
                            transformY = '-50%';
                            transformOrigin = 'center center';
                            break;
                        }

                        // Estimate watermark dimensions to ensure it stays within bounds
                        // Estimate watermark dimensions (approximate)
                        let wmWidth = 0;
                        let wmHeight = 0;

                        if (watermark.type === 'text' && watermark.text) {
                          // Approximate text dimensions (rough estimate)
                          const textLength = watermark.text.length;
                          wmWidth = fontSize * textLength * 0.6; // Approximate character width
                          wmHeight = fontSize * 1.2;
                        } else if (watermark.imageUrl) {
                          // Use actual image dimensions scaled by size
                          if (watermarkImageRef.current && watermarkImageRef.current.naturalWidth > 0) {
                            const img = watermarkImageRef.current;
                            const scale = watermark.size / 100;
                            wmWidth = img.naturalWidth * scale * (displayWidth / 550);
                            wmHeight = img.naturalHeight * scale * (displayWidth / 550);
                          } else {
                            // Fallback: estimate based on size percentage
                            wmWidth = (displayWidth * watermark.size) / 100;
                            wmHeight = (displayHeight * watermark.size) / 100;
                          }
                        }

                        // Ensure positions are within bounds
                        // Corner positions are already correctly calculated in switch statement above
                        // Only clamp center/custom positions
                        if (!isCorner) {
                          // For center/custom, ensure it doesn't go too close to edges
                          const minPadding = padding * 2;
                          wmX = Math.max(minPadding, Math.min(wmX, displayWidth - minPadding));
                          wmY = Math.max(minPadding, Math.min(wmY, displayHeight - minPadding));
                        }
                        // Corner positions don't need clamping - they're already at correct positions with padding

                        // Determine text alignment based on position
                        let textAlign: 'left' | 'center' | 'right' = 'center';
                        if (watermark.position === 'top-left' || watermark.position === 'bottom-left') {
                          textAlign = 'left';
                        } else if (watermark.position === 'top-right' || watermark.position === 'bottom-right') {
                          textAlign = 'right';
                        }


                        return (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${wmX}px`,
                              top: `${wmY}px`,
                              transform: `translate(${transformX}, ${transformY})`,
                              // Don't set maxWidth/maxHeight for text watermarks - let them expand naturally
                              ...(watermark.type === 'text' ? {} : {
                                maxWidth: `${displayWidth - (padding * 2)}px`,
                                maxHeight: `${displayHeight - (padding * 2)}px`,
                              }),
                              overflow: 'visible', // Allow text to be fully visible
                            }}
                          >
                            {watermark.type === 'text' ? (
                              <div
                                style={{
                                  color: watermark.color || '#ffffff',
                                  fontSize: `${fontSize}px`,
                                  fontFamily: watermark.fontFamily || 'Arial',
                                  textAlign: textAlign,
                                  whiteSpace: 'nowrap',
                                  textShadow: '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8)',
                                  overflow: 'visible',
                                  display: 'inline-block',
                                  lineHeight: '1.2',
                                  minWidth: 'fit-content',
                                  width: 'fit-content',
                                  // Remove max width constraint - let text expand naturally
                                }}
                              >
                                {watermark.text || 'Watermark'}
                              </div>
                            ) : watermark.imageUrl ? (
                              <img
                                src={watermark.imageUrl}
                                alt="Watermark"
                                style={{
                                  maxWidth: `${(displayWidth * watermark.size) / 100}px`,
                                  maxHeight: `${(displayHeight * watermark.size) / 100}px`,
                                  objectFit: 'contain',
                                }}
                              />
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Crop Overlay */}
                  {activeTool === 'crop' && cropArea && (
                    <>
                      {/* Dark overlay outside crop area */}
                      <div className="absolute inset-0 pointer-events-none">
                        {/* Top */}
                        <div
                          className="absolute bg-black/60"
                          style={{ top: 0, left: 0, right: 0, height: cropArea.y }}
                        />
                        {/* Bottom */}
                        <div
                          className="absolute bg-black/60"
                          style={{ top: cropArea.y + cropArea.height, left: 0, right: 0, bottom: 0 }}
                        />
                        {/* Left */}
                        <div
                          className="absolute bg-black/60"
                          style={{ top: cropArea.y, left: 0, width: cropArea.x, height: cropArea.height }}
                        />
                        {/* Right */}
                        <div
                          className="absolute bg-black/60"
                          style={{ top: cropArea.y, left: cropArea.x + cropArea.width, right: 0, height: cropArea.height }}
                        />
                      </div>

                      {/* Crop box */}
                      <div
                        className="crop-overlay absolute border-2 border-accent-500 cursor-move"
                        style={{
                          left: cropArea.x,
                          top: cropArea.y,
                          width: cropArea.width,
                          height: cropArea.height,
                        }}
                        onMouseDown={(e) => handleCropMouseDown(e, 'move')}
                      >
                        {/* Grid lines */}
                        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                          {[...Array(9)].map((_, i) => (
                            <div key={i} className="border border-accent-500/30" />
                          ))}
                        </div>

                        {/* Corner resize handles */}
                        {/* Top-left */}
                        <div
                          className="absolute left-0 top-0 w-6 h-6 cursor-nw-resize z-10 group"
                          onMouseDown={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'resize-tl'); }}
                        >
                          <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-sm shadow-lg group-hover:scale-125 transition-transform" />
                        </div>
                        {/* Top-right */}
                        <div
                          className="absolute right-0 top-0 w-6 h-6 cursor-ne-resize z-10 group"
                          onMouseDown={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'resize-tr'); }}
                        >
                          <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-sm shadow-lg group-hover:scale-125 transition-transform" />
                        </div>
                        {/* Bottom-left */}
                        <div
                          className="absolute left-0 bottom-0 w-6 h-6 cursor-sw-resize z-10 group"
                          onMouseDown={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'resize-bl'); }}
                        >
                          <div className="absolute left-1 bottom-1 w-3 h-3 bg-white rounded-sm shadow-lg group-hover:scale-125 transition-transform" />
                        </div>
                        {/* Bottom-right */}
                        <div
                          className="absolute right-0 bottom-0 w-6 h-6 cursor-se-resize z-10 group"
                          onMouseDown={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'resize-br'); }}
                        >
                          <div className="absolute right-1 bottom-1 w-3 h-3 bg-white rounded-sm shadow-lg group-hover:scale-125 transition-transform" />
                        </div>

                        {/* Edge resize handles - larger hitbox for easier grabbing */}
                        {/* Top edge */}
                        <div
                          className="absolute left-0 right-0 top-0 cursor-ns-resize z-10 group"
                          style={{ top: '-12px', height: '24px' }}
                          onMouseDown={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'resize-t'); }}
                        >
                          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-1.5 bg-white rounded shadow-lg group-hover:bg-accent-400 group-hover:scale-110 transition-all" />
                        </div>
                        {/* Bottom edge */}
                        <div
                          className="absolute left-0 right-0 bottom-0 cursor-ns-resize z-10 group"
                          style={{ bottom: '-12px', height: '24px' }}
                          onMouseDown={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'resize-b'); }}
                        >
                          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-1.5 bg-white rounded shadow-lg group-hover:bg-accent-400 group-hover:scale-110 transition-all" />
                        </div>
                        {/* Left edge */}
                        <div
                          className="absolute left-0 top-0 bottom-0 cursor-ew-resize z-10 group"
                          style={{ left: '-12px', width: '24px' }}
                          onMouseDown={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'resize-l'); }}
                        >
                          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-1.5 bg-white rounded shadow-lg group-hover:bg-accent-400 group-hover:scale-110 transition-all" />
                        </div>
                        {/* Right edge */}
                        <div
                          className="absolute right-0 top-0 bottom-0 cursor-ew-resize z-10 group"
                          style={{ right: '-12px', width: '24px' }}
                          onMouseDown={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'resize-r'); }}
                        >
                          <div className="absolute right-1/2 top-1/2 translate-x-1/2 -translate-y-1/2 h-12 w-1.5 bg-white rounded shadow-lg group-hover:bg-accent-400 group-hover:scale-110 transition-all" />
                        </div>

                        {/* Corner visual brackets - decorative L shapes */}
                        <div className="absolute left-0 top-0 w-5 h-5 border-t-2 border-l-2 border-accent-400 pointer-events-none" />
                        <div className="absolute right-0 top-0 w-5 h-5 border-t-2 border-r-2 border-accent-400 pointer-events-none" />
                        <div className="absolute left-0 bottom-0 w-5 h-5 border-b-2 border-l-2 border-accent-400 pointer-events-none" />
                        <div className="absolute right-0 bottom-0 w-5 h-5 border-b-2 border-r-2 border-accent-400 pointer-events-none" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right - Export */}
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">Export</h3>

              <div className="space-y-2">
                {['png', 'jpg', 'webp'].map((format) => (
                  <button
                    key={format}
                    onClick={() => exportImage(format as 'png' | 'jpg' | 'webp')}
                    disabled={isExporting}
                    aria-label={`Download edited image as ${format.toUpperCase()}`}
                    className="w-full btn-secondary flex items-center justify-center gap-2"
                  >
                    {isExporting ? (
                      <LoaderIcon className="w-4 h-4" />
                    ) : (
                      <DownloadIcon className="w-4 h-4" />
                    )}
                    Download {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="card p-4 bg-zinc-900/50 border-zinc-800/50">
              <p className="text-xs text-zinc-500">
                <strong className="text-zinc-400">Tips:</strong><br />
                • Drag to move crop area<br />
                • Drag corners or edges to resize<br />
                • Use aspect ratio presets for consistent sizing<br />
                • Combine filters with adjustments for creative effects<br />
                • Watermarks are visible in preview and export<br />
                • All edits are applied on export<br />
                • Background removal works best with clear subjects
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hidden canvas for operations */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

