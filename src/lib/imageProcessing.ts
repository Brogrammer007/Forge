import sharp from 'sharp';
import { optimize } from 'svgo';
import type { OutputFormat, ImageMetadata, ConversionOptions } from '@/types';

/**
 * Get image metadata using Sharp
 */
export async function getImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
  const metadata = await sharp(buffer).metadata();
  
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    format: metadata.format ?? 'unknown',
    size: buffer.length,
    channels: metadata.channels,
    hasAlpha: metadata.hasAlpha,
  };
}

/**
 * Convert image to specified format using Sharp
 */
export async function convertImage(
  inputBuffer: Buffer,
  inputFormat: string,
  options: ConversionOptions
): Promise<Buffer> {
  const { format, quality = 90, resize, resizeMode = 'width' } = options;
  
  // Handle SVG input specially
  if (inputFormat === 'svg') {
    return convertSvgTo(inputBuffer, format, quality);
  }
  
  // Handle SVG output (just wrap raster in SVG)
  if (format === 'svg') {
    return rasterToSvgWrapper(inputBuffer, resize);
  }
  
  // Standard raster-to-raster conversion
  let sharpInstance = sharp(inputBuffer, { failOn: 'none' });
  
  // Apply resize if specified
  if (resize && resize > 0) {
    if (resizeMode === 'height') {
      sharpInstance = sharpInstance.resize(null, resize, {
        fit: 'inside',
        withoutEnlargement: false, // Allow upscaling
      });
    } else {
      sharpInstance = sharpInstance.resize(resize, null, {
        fit: 'inside',
        withoutEnlargement: false, // Allow upscaling
      });
    }
  }
  
  switch (format) {
    case 'png':
      sharpInstance = sharpInstance.png({
        compressionLevel: 6, // Faster compression (0-9, lower = faster)
        effort: 4, // Balance between speed and compression
      });
      break;
    case 'jpg':
      sharpInstance = sharpInstance
        .flatten({ background: '#ffffff' }) // Handle transparency
        .jpeg({
          quality,
          mozjpeg: false, // Faster without mozjpeg
        });
      break;
    case 'webp':
      sharpInstance = sharpInstance.webp({
        quality,
        effort: 4, // Balance between speed and compression (0-6)
      });
      break;
    default:
      throw new Error(`Unsupported output format: ${format}`);
  }
  
  return sharpInstance.toBuffer();
}

/**
 * Convert SVG to raster or PDF
 */
async function convertSvgTo(
  svgBuffer: Buffer,
  format: OutputFormat,
  quality: number
): Promise<Buffer> {
  const svgString = svgBuffer.toString('utf-8');
  
  // Optimize SVG first
  const optimized = optimize(svgString, {
    multipass: true,
    plugins: [
      'preset-default',
      'removeDimensions',
    ],
  });
  
  if (format === 'svg') {
    return Buffer.from(optimized.data, 'utf-8');
  }
  
  // Render SVG to raster using Sharp
  const sharpInstance = sharp(Buffer.from(optimized.data));
  
  switch (format) {
    case 'png':
      return sharpInstance.png().toBuffer();
    case 'jpg':
      return sharpInstance.flatten({ background: '#ffffff' }).jpeg({ quality }).toBuffer();
    case 'webp':
      return sharpInstance.webp({ quality }).toBuffer();
    default:
      throw new Error(`Unsupported output format: ${format}`);
  }
}

/**
 * Wrap raster image in SVG container (simple embed, not true vectorization)
 */
async function rasterToSvgWrapper(buffer: Buffer, resize?: number | null): Promise<Buffer> {
  let instance = sharp(buffer, { failOn: 'none' });
  
  // Apply resize if specified
  if (resize && resize > 0) {
    instance = instance.resize(resize, null, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  
  const metadata = await instance.metadata();
  const width = metadata.width ?? 100;
  const height = metadata.height ?? 100;
  
  // Convert to WebP for smaller size, then base64 encode
  const webpBuffer = await instance.webp({ quality: 85 }).toBuffer();
  const base64 = webpBuffer.toString('base64');
  
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <image width="${width}" height="${height}" xlink:href="data:image/webp;base64,${base64}"/>
</svg>`;
  
  return Buffer.from(svg, 'utf-8');
}

/**
 * Optimize SVG string using SVGO
 */
export function optimizeSvg(svgString: string): string {
  const result = optimize(svgString, {
    multipass: true,
    plugins: [
      'preset-default',
      'removeDoctype',
      'removeXMLProcInst',
      'removeComments',
      'removeMetadata',
      'removeTitle',
      'removeDesc',
      'removeUselessDefs',
      'removeEditorsNSData',
      'removeEmptyAttrs',
      'removeHiddenElems',
      'removeEmptyText',
      'removeEmptyContainers',
      'cleanupEnableBackground',
      'convertStyleToAttrs',
      'convertColors',
      'convertPathData',
      'convertTransform',
      'removeUnknownsAndDefaults',
      'removeNonInheritableGroupAttrs',
      'removeUselessStrokeAndFill',
      'removeUnusedNS',
      'cleanupNumericValues',
      'moveElemsAttrsToGroup',
      'moveGroupAttrsToElems',
      'collapseGroups',
      'mergePaths',
      'sortAttrs',
      'removeDimensions',
    ],
  });
  
  return result.data;
}

/**
 * Resize image while maintaining aspect ratio
 */
export async function resizeImage(
  buffer: Buffer,
  maxWidth: number,
  maxHeight: number
): Promise<Buffer> {
  return sharp(buffer)
    .resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toBuffer();
}

/**
 * Create thumbnail for preview
 */
export async function createThumbnail(
  buffer: Buffer,
  size: number = 200
): Promise<Buffer> {
  return sharp(buffer)
    .resize(size, size, {
      fit: 'cover',
      position: 'center',
    })
    .png()
    .toBuffer();
}

