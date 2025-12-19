import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { 
  vectorizeImage, 
  applyStyleToSvg, 
  svgToRaster,
  getSvgDimensions,
  estimateSvgSize,
} from '@/lib/vectorize';
import { getMimeType, createDownloadFilename } from '@/lib/utils';
import { logger } from '@/lib/logger';
import type { DetailLevel } from '@/types';

const UPLOAD_DIR = path.join(process.cwd(), 'tmp', 'uploads');

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    
    let imageBuffer: Buffer;
    let originalFilename: string;
    let options: {
      threshold: number;
      detailLevel: DetailLevel;
      smoothness: number;
      color: string;
      strokeWidth: number;
      strokeColor: string;
      removeBackground: boolean;
      outputFormat: 'svg' | 'png' | 'jpg' | 'webp';
    };

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      
      if (!file) {
        return NextResponse.json(
          { success: false, error: 'No file provided' },
          { status: 400 }
        );
      }

      imageBuffer = Buffer.from(await file.arrayBuffer());
      originalFilename = file.name;

      options = {
        threshold: parseInt(formData.get('threshold') as string) || 128,
        detailLevel: (formData.get('detailLevel') as DetailLevel) || 'medium',
        smoothness: parseFloat(formData.get('smoothness') as string) || 0.4,
        color: (formData.get('color') as string) || '#000000',
        strokeWidth: parseFloat(formData.get('strokeWidth') as string) || 0,
        strokeColor: (formData.get('strokeColor') as string) || '#000000',
        removeBackground: formData.get('removeBackground') === 'true',
        outputFormat: (formData.get('outputFormat') as 'svg' | 'png' | 'jpg' | 'webp') || 'svg',
      };
    } else {
      const body = await request.json();
      const { filename } = body;
      
      if (!filename) {
        return NextResponse.json(
          { success: false, error: 'No file reference provided' },
          { status: 400 }
        );
      }

      const filepath = path.join(UPLOAD_DIR, filename);
      
      if (!existsSync(filepath)) {
        return NextResponse.json(
          { success: false, error: 'Source file not found' },
          { status: 404 }
        );
      }

      imageBuffer = await readFile(filepath);
      originalFilename = filename;
      
      // Support both nested options object and flat body properties
      options = body.options || {
        threshold: body.threshold ?? 128,
        detailLevel: body.detailLevel ?? 'medium',
        smoothness: body.smoothness ?? 0.4,
        color: body.color ?? '#000000',
        strokeWidth: body.strokeWidth ?? 0,
        strokeColor: body.strokeColor ?? '#000000',
        removeBackground: body.removeBackground ?? true,
        outputFormat: body.outputFormat ?? 'svg',
      };
    }

    // Check if input is SVG (can't vectorize SVG)
    const inputFormat = originalFilename.split('.').pop()?.toLowerCase();
    if (inputFormat === 'svg') {
      return NextResponse.json(
        { success: false, error: 'Cannot vectorize an SVG file. Use Image Converter for SVG optimization.' },
        { status: 400 }
      );
    }

    // Calculate Potrace parameters based on detail level
    const turdSize = options.detailLevel === 'low' ? 10 : options.detailLevel === 'high' ? 2 : 4;
    const alphaMax = options.detailLevel === 'low' ? 1.5 : options.detailLevel === 'high' ? 0.5 : 1.0;

    // Vectorize the image
    const { svg, pathCount } = await vectorizeImage(imageBuffer, {
      threshold: options.threshold,
      turdSize,
      alphaMax,
      optCurve: true,
      optTolerance: options.smoothness,
      color: options.color,
      background: options.removeBackground ? 'transparent' : '#ffffff',
    });

    // Apply custom styling if needed
    let styledSvg = svg;
    if (options.strokeWidth > 0) {
      styledSvg = applyStyleToSvg(svg, {
        fillColor: options.color,
        strokeColor: options.strokeColor,
        strokeWidth: options.strokeWidth,
      });
    }

    // Get SVG info
    const dimensions = getSvgDimensions(styledSvg);
    const estimatedSize = estimateSvgSize(styledSvg);

    // If output is SVG, return the SVG data with metadata
    if (options.outputFormat === 'svg') {
      // Check if this is a download request
      const searchParams = new URL(request.url).searchParams;
      const download = searchParams.get('download') === 'true';

      if (download) {
        const filename = createDownloadFilename(originalFilename, 'svg');
        return new NextResponse(styledSvg, {
          headers: {
            'Content-Type': 'image/svg+xml',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          svg: styledSvg,
          pathCount,
          width: dimensions.width,
          height: dimensions.height,
          estimatedSize,
        },
      });
    }

    // Convert SVG to raster format
    const rasterBuffer = await svgToRaster(styledSvg, options.outputFormat, {
      quality: 90,
      background: options.removeBackground ? undefined : '#ffffff',
    });

    const filename = createDownloadFilename(originalFilename, options.outputFormat);
    const mimeType = getMimeType(options.outputFormat);

    return new NextResponse(new Uint8Array(rasterBuffer), {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': rasterBuffer.length.toString(),
      },
    });

  } catch (error) {
    logger.error('Vectorization error', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to vectorize image' 
      },
      { status: 500 }
    );
  }
}

