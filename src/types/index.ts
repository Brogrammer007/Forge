// Image types and formats
export type ImageFormat = 'png' | 'jpg' | 'jpeg' | 'webp' | 'svg' | 'bmp' | 'tiff';
export type OutputFormat = 'png' | 'jpg' | 'webp' | 'svg';

export interface ImageFile {
  id: string;
  file: File;
  name: string;
  size: number;
  format: string; // More flexible for unknown formats
  width: number;
  height: number;
  previewUrl: string;
  uploadedAt: Date;
  // Server-side data
  serverFilename?: string;
  uploading?: boolean;
  error?: string;
  // Pre-calculated conversion sizes
  formatSizes?: Record<string, number>;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  channels?: number;
  hasAlpha?: boolean;
}

// Conversion types
export interface ConversionOptions {
  format: OutputFormat;
  quality?: number; // 1-100 for jpg/webp
  resize?: number | null; // Size in pixels
  resizeMode?: 'width' | 'height'; // Dimension to resize by
}

export interface ConversionResult {
  success: boolean;
  data?: Blob;
  filename?: string;
  error?: string;
}

// Vectorization types
export type DetailLevel = 'low' | 'medium' | 'high';

export interface VectorizeOptions {
  threshold?: number; // 0-255, binarization level
  turdSize?: number; // suppress speckles of up to this size
  alphaMax?: number; // corner threshold parameter
  optCurve?: boolean; // curve optimization
  optTolerance?: number; // curve optimization tolerance
  color?: string; // output color (hex)
  background?: string; // background color or 'transparent'
  turnPolicy?: 'black' | 'white' | 'left' | 'right' | 'minority' | 'majority';
}

export interface VectorizeResult {
  success: boolean;
  svg?: string;
  pathCount?: number;
  error?: string;
}

// Grid builder types
export type LayoutPreset = '1x2' | '2x1' | '2x2' | '3x3' | '4x4' | '2x3' | '3x2' | 'custom';
export type ResolutionPreset = '1080x1080' | '1920x1080' | '1080x1920' | '1200x628' | 'custom';

export type ImageFit = 'cover' | 'contain' | 'fill';

export interface GridOptions {
  rows: number;
  cols: number;
  width: number;
  height: number;
  padding: number;
  backgroundColor: string;
  borderWidth: number;
  borderColor: string;
  cornerRadius: number;
  imageFit: ImageFit;
}

export interface GridCell {
  imageId: string;
  imageUrl: string;
  order: number;
}

// Text overlay types
export type FontFamily = 
  | 'Arial'
  | 'Helvetica'
  | 'Georgia'
  | 'Times New Roman'
  | 'Courier New'
  | 'Verdana'
  | 'Impact';

export type FontWeight = 'normal' | 'bold';
export type TextAlign = 'left' | 'center' | 'right';

export interface TextOverlay {
  id: string;
  text: string;
  x: number; // 0-1 relative position
  y: number; // 0-1 relative position
  fontFamily: FontFamily;
  fontSize: number;
  fontWeight: FontWeight;
  color: string;
  align: TextAlign;
  shadow?: {
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
  stroke?: {
    color: string;
    width: number;
  };
}

export interface GridWithTextOptions extends GridOptions {
  images: GridCell[];
  textOverlays: TextOverlay[];
}

// API response types
export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

export type ApiResponse<T = unknown> = 
  | { success: true; data: T }
  | ApiError;

export interface UploadResponse {
  id: string;
  name: string;
  format: ImageFormat;
  size: number;
  width: number;
  height: number;
  previewUrl: string;
}

// Store types
export interface ImageStore {
  images: ImageFile[];
  addImage: (image: ImageFile) => void;
  addImages: (images: ImageFile[]) => void;
  updateImage: (id: string, updates: Partial<ImageFile>) => void;
  removeImage: (id: string) => void;
  clearImages: () => void;
  getImage: (id: string) => ImageFile | undefined;
  uploadFiles: (files: File[]) => Promise<void>;
}

