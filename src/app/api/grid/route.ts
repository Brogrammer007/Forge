import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { buildGrid, convertGridToFormat, calculateActualDimensions, buildGridSvg } from '@/lib/grid';
import { renderTextOverlays } from '@/lib/textOverlay';
import { getMimeType } from '@/lib/utils';
import { logger } from '@/lib/logger';
import type { GridOptions, TextOverlay } from '@/types';

const UPLOAD_DIR = path.join(process.cwd(), 'tmp', 'uploads');

interface GridRequestBody {
  images: Array<{
    filename: string;
    order: number;
  }>;
  options: GridOptions;
  textOverlays?: TextOverlay[];
  outputFormat?: 'png' | 'jpg' | 'webp' | 'svg';
  quality?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: GridRequestBody = await request.json();
    const {
      images: imageRefs,
      options,
      textOverlays = [],
      outputFormat = 'png',
      quality = 90,
    } = body;

    if (!imageRefs || imageRefs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No images provided' },
        { status: 400 }
      );
    }

    // Validate options
    if (!options || !options.rows || !options.cols) {
      return NextResponse.json(
        { success: false, error: 'Invalid grid options' },
        { status: 400 }
      );
    }

    // Load all images
    const images = await Promise.all(
      imageRefs.map(async (ref) => {
        const filepath = path.join(UPLOAD_DIR, ref.filename);

        if (!existsSync(filepath)) {
          throw new Error(`Image not found: ${ref.filename}`);
        }

        const buffer = await readFile(filepath);
        return {
          buffer,
          order: ref.order,
        };
      })
    );

    // Calculate actual dimensions based on image count
    const actualDimensions = calculateActualDimensions(options, images.length);

    // Build the grid
    let gridBuffer: Buffer;

    if (outputFormat === 'svg') {
      // For SVG, we build it directly including text overlays
      gridBuffer = await buildGridSvg(images, options, textOverlays);

      const filename = `grid_${Date.now()}.svg`;
      return new NextResponse(new Uint8Array(gridBuffer), {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    gridBuffer = await buildGrid(images, options);

    // Apply text overlays if any (using actual dimensions)
    if (textOverlays.length > 0) {
      gridBuffer = await renderTextOverlays(
        gridBuffer,
        textOverlays,
        actualDimensions.width,
        actualDimensions.height
      );
    }

    // Convert to requested format
    const finalBuffer = await convertGridToFormat(gridBuffer, outputFormat, quality);

    // Determine filename
    const timestamp = Date.now();
    const filename = `grid_${timestamp}.${outputFormat}`;
    const mimeType = getMimeType(outputFormat);

    return new NextResponse(new Uint8Array(finalBuffer), {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': finalBuffer.length.toString(),
      },
    });

  } catch (error) {
    logger.error('Grid generation error', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate grid'
      },
      { status: 500 }
    );
  }
}

// Preview endpoint - returns base64 encoded preview
export async function PUT(request: NextRequest) {
  try {
    const body: GridRequestBody = await request.json();
    const {
      images: imageRefs,
      options,
      textOverlays = [],
    } = body;

    if (!imageRefs || imageRefs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No images provided' },
        { status: 400 }
      );
    }

    // Load all images
    const images = await Promise.all(
      imageRefs.map(async (ref) => {
        const filepath = path.join(UPLOAD_DIR, ref.filename);

        if (!existsSync(filepath)) {
          throw new Error(`Image not found: ${ref.filename}`);
        }

        const buffer = await readFile(filepath);
        return {
          buffer,
          order: ref.order,
        };
      })
    );

    // Build grid at reduced size for preview
    const previewOptions = {
      ...options,
      width: Math.round(options.width / 2),
      height: Math.round(options.height / 2),
      padding: Math.round(options.padding / 2),
      borderWidth: Math.round(options.borderWidth / 2),
      cornerRadius: Math.round(options.cornerRadius / 2),
    };

    // Calculate actual dimensions for preview
    const actualPreviewDimensions = calculateActualDimensions(previewOptions, images.length);

    // Scale text overlays for preview
    const scaledTextOverlays = textOverlays.map(overlay => ({
      ...overlay,
      fontSize: Math.round(overlay.fontSize / 2),
    }));

    let gridBuffer = await buildGrid(images, previewOptions);

    // Apply text overlays if any (using actual dimensions)
    if (scaledTextOverlays.length > 0) {
      gridBuffer = await renderTextOverlays(
        gridBuffer,
        scaledTextOverlays,
        actualPreviewDimensions.width,
        actualPreviewDimensions.height
      );
    }

    // Convert to PNG for preview
    const { default: sharp } = await import('sharp');
    const previewBuffer = await sharp(gridBuffer)
      .png({ quality: 80 })
      .toBuffer();

    const base64 = previewBuffer.toString('base64');

    return NextResponse.json({
      success: true,
      data: {
        preview: `data:image/png;base64,${base64}`,
        width: actualPreviewDimensions.width,
        height: actualPreviewDimensions.height,
      },
    });

  } catch (error) {
    logger.error('Grid preview error', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate preview'
      },
      { status: 500 }
    );
  }
}

