import potrace from 'potrace';
import sharp from 'sharp';
import { optimize } from 'svgo';
import { logger } from './logger';
import type { VectorizeOptions, DetailLevel } from '@/types';

/**
 * Map detail level to Potrace parameters
 */
export function getPotraceParamsForDetailLevel(level: DetailLevel): Partial<potrace.PotraceOptions> {
  switch (level) {
    case 'low':
      return {
        turdSize: 10,
        alphaMax: 1.5,
        optTolerance: 0.8,
      };
    case 'medium':
      return {
        turdSize: 4,
        alphaMax: 1.0,
        optTolerance: 0.4,
      };
    case 'high':
      return {
        turdSize: 2,
        alphaMax: 0.5,
        optTolerance: 0.2,
      };
    default:
      return {
        turdSize: 4,
        alphaMax: 1.0,
        optTolerance: 0.4,
      };
  }
}

/**
 * Vectorize a raster image to SVG using Potrace
 */
export async function vectorizeImage(
  imageBuffer: Buffer,
  options: VectorizeOptions = {}
): Promise<{ svg: string; pathCount: number }> {
  const {
    threshold = 128,
    turdSize = 4,
    alphaMax = 1.0,
    optCurve = true,
    optTolerance = 0.4,
    color = '#000000',
    background = 'transparent',
    turnPolicy = 'minority',
  } = options;

  // Preprocess image with Sharp
  // Convert to grayscale, resize if needed, and ensure proper format
  let processedBuffer = await sharp(imageBuffer)
    .grayscale()
    .normalize()
    .toBuffer();

  // Get metadata for dimensions
  const metadata = await sharp(processedBuffer).metadata();
  const width = metadata.width ?? 100;
  const height = metadata.height ?? 100;

  // If image is very large, resize for better performance
  if (width > 2000 || height > 2000) {
    processedBuffer = await sharp(processedBuffer)
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();
  }

  // Convert to BMP format which Potrace handles well
  const bmpBuffer = await sharp(processedBuffer)
    .png()
    .toBuffer();

  return new Promise((resolve, reject) => {
    const potraceOptions: potrace.PotraceOptions = {
      threshold,
      turdSize,
      alphaMax,
      optCurve,
      optTolerance,
      color,
      background: background === 'transparent' ? 'transparent' : background,
    };

    potrace.trace(bmpBuffer, potraceOptions, (err: Error | null, svg: string) => {
      if (err) {
        reject(err);
        return;
      }

      // Count paths in the SVG
      const pathCount = (svg.match(/<path/g) || []).length;

      // Optimize SVG with SVGO (with safer settings)
      try {
        const optimized = optimize(svg, {
          multipass: true,
          plugins: [
            {
              name: 'preset-default',
              params: {
                overrides: {
                  removeViewBox: false,
                },
              },
            },
          ],
        });

        resolve({
          svg: optimized.data,
          pathCount,
        });
      } catch (optimizeError) {
        // If optimization fails, return original SVG
        logger.warn('SVGO optimization failed, using original SVG', { error: optimizeError });
        resolve({
          svg,
          pathCount,
        });
      }
    });
  });
}

/**
 * Apply color and stroke to SVG
 */
export function applyStyleToSvg(
  svg: string,
  options: {
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
  }
): string {
  const { fillColor, strokeColor, strokeWidth } = options;

  let styledSvg = svg;

  // Replace fill color in paths
  if (fillColor) {
    styledSvg = styledSvg.replace(
      /fill="[^"]*"/g,
      `fill="${fillColor}"`
    );
    // Also handle paths without fill attribute (add it after <path )
    styledSvg = styledSvg.replace(
      /<path(?![^>]*fill=)([^>]*)/g,
      `<path fill="${fillColor}"$1`
    );
  }

  // Add or replace stroke
  if (strokeColor && strokeWidth && strokeWidth > 0) {
    styledSvg = styledSvg.replace(
      /<path([^>]*)>/g,
      (match, attrs) => {
        // Remove existing stroke attributes and clean up spaces
        const cleanAttrs = attrs
          .replace(/\s*stroke="[^"]*"/g, '')
          .replace(/\s*stroke-width="[^"]*"/g, '')
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        // Build the new path tag properly
        if (cleanAttrs) {
          return `<path ${cleanAttrs} stroke="${strokeColor}" stroke-width="${strokeWidth}">`;
        }
        return `<path stroke="${strokeColor}" stroke-width="${strokeWidth}">`;
      }
    );
  }

  return styledSvg;
}

/**
 * Convert SVG to raster format
 */
export async function svgToRaster(
  svg: string,
  format: 'png' | 'jpg' | 'webp',
  options: {
    width?: number;
    height?: number;
    quality?: number;
    background?: string;
  } = {}
): Promise<Buffer> {
  const { width, height, quality = 90, background } = options;

  let sharpInstance = sharp(Buffer.from(svg));

  if (width || height) {
    sharpInstance = sharpInstance.resize(width, height, {
      fit: 'inside',
      withoutEnlargement: false,
    });
  }

  switch (format) {
    case 'png':
      return sharpInstance.png().toBuffer();
    case 'jpg':
      if (background) {
        sharpInstance = sharpInstance.flatten({ background });
      } else {
        sharpInstance = sharpInstance.flatten({ background: '#ffffff' });
      }
      return sharpInstance.jpeg({ quality }).toBuffer();
    case 'webp':
      return sharpInstance.webp({ quality }).toBuffer();
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Calculate estimated SVG file size
 */
export function estimateSvgSize(svg: string): number {
  return new Blob([svg]).size;
}

/**
 * Extract SVG dimensions from SVG string
 */
export function getSvgDimensions(svg: string): { width: number; height: number } {
  // Try width and height attributes first
  const widthMatch = svg.match(/width=["']?(\d+(?:\.\d+)?)/);
  const heightMatch = svg.match(/height=["']?(\d+(?:\.\d+)?)/);
  
  if (widthMatch && heightMatch) {
    return {
      width: parseFloat(widthMatch[1] ?? '0'),
      height: parseFloat(heightMatch[1] ?? '0'),
    };
  }

  // Try viewBox if width/height not found
  const viewBoxMatch = svg.match(/viewBox=["']?[\d\s.]+ [\d\s.]+ ([\d.]+) ([\d.]+)["']?/);
  if (viewBoxMatch) {
    return {
      width: parseFloat(viewBoxMatch[1] ?? '0'),
      height: parseFloat(viewBoxMatch[2] ?? '0'),
    };
  }

  // Try to extract from SVG element attributes
  const svgMatch = svg.match(/<svg[^>]*>/);
  if (svgMatch) {
    const widthAttr = svgMatch[0].match(/width=["']?(\d+(?:\.\d+)?)/);
    const heightAttr = svgMatch[0].match(/height=["']?(\d+(?:\.\d+)?)/);
    
    if (widthAttr && heightAttr) {
      return {
        width: parseFloat(widthAttr[1] ?? '0'),
        height: parseFloat(heightAttr[1] ?? '0'),
      };
    }
  }

  return { width: 0, height: 0 };
}

