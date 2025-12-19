import { v4 as uuidv4 } from 'uuid';
import type { ImageFormat } from '@/types';

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Format file size to human readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1]?.toLowerCase() ?? '' : '';
}

/**
 * Check if a format is a supported image format
 */
export function isSupportedFormat(format: string): format is ImageFormat {
  const supported = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'pdf', 'bmp', 'tiff'];
  return supported.includes(format.toLowerCase());
}

/**
 * Get MIME type for image format
 */
export function getMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
  };
  
  return mimeTypes[format.toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Get format from MIME type
 */
export function getFormatFromMime(mimeType: string): ImageFormat | null {
  const formats: Record<string, ImageFormat> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
  };
  
  return formats[mimeType] ?? null;
}

/**
 * Check if format is raster (not vector)
 */
export function isRasterFormat(format: string): boolean {
  const rasterFormats = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff'];
  return rasterFormats.includes(format.toLowerCase());
}

/**
 * Check if format is vector
 */
export function isVectorFormat(format: string): boolean {
  return format.toLowerCase() === 'svg';
}

/**
 * Create download filename with new extension
 */
export function createDownloadFilename(originalName: string, newFormat: string): string {
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
  return `${nameWithoutExt}.${newFormat}`;
}

/**
 * Trigger file download in browser
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Convert File to base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as base64'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Convert base64 to Blob
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteString = atob(base64.split(',')[1] ?? base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  
  return new Blob([ab], { type: mimeType });
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Parse hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result || !result[1] || !result[2] || !result[3]) return null;
  
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * File size limits (in bytes)
 */
export const FILE_SIZE_LIMITS = {
  IMAGE: 50 * 1024 * 1024, // 50MB
  VIDEO: 500 * 1024 * 1024, // 500MB
  TOTAL_BATCH: 200 * 1024 * 1024, // 200MB for batch operations
} as const;

/**
 * Validate file size
 */
export function validateFileSize(
  file: File,
  maxSize: number = FILE_SIZE_LIMITS.IMAGE,
  type: 'image' | 'video' = 'image'
): { valid: boolean; error?: string } {
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `${type === 'image' ? 'Image' : 'Video'} file is too large. Maximum size is ${maxSizeMB}MB, but file is ${fileSizeMB}MB.`,
    };
  }
  return { valid: true };
}

/**
 * Validate multiple files for batch operations
 */
export function validateBatchFiles(
  files: File[],
  maxTotalSize: number = FILE_SIZE_LIMITS.TOTAL_BATCH
): { valid: boolean; error?: string } {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > maxTotalSize) {
    const maxSizeMB = (maxTotalSize / (1024 * 1024)).toFixed(0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Total file size exceeds limit. Maximum is ${maxSizeMB}MB, but total is ${totalSizeMB}MB.`,
    };
  }
  return { valid: true };
}

/**
 * Create a promise with timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

