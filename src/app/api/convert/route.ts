import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { convertImage } from '@/lib/imageProcessing';
import type { OutputFormat } from '@/types';
import { getMimeType, createDownloadFilename } from '@/lib/utils';
import { logger } from '@/lib/logger';

const UPLOAD_DIR = path.join(process.cwd(), 'tmp', 'uploads');

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    
    let buffer: Buffer;
    let inputFormat: string;
    let outputFormat: OutputFormat;
    let quality: number;
    let originalFilename: string;
    
    if (contentType.includes('multipart/form-data')) {
      // Handle direct file upload
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const format = formData.get('format') as string | null;
      const qualityStr = formData.get('quality') as string | null;
      
      if (!file) {
        return NextResponse.json(
          { success: false, error: 'No file provided' },
          { status: 400 }
        );
      }
      
      if (!format || !isValidOutputFormat(format)) {
        return NextResponse.json(
          { success: false, error: 'Invalid output format' },
          { status: 400 }
        );
      }
      
      buffer = Buffer.from(await file.arrayBuffer());
      inputFormat = file.name.split('.').pop()?.toLowerCase() ?? '';
      outputFormat = format as OutputFormat;
      quality = qualityStr ? parseInt(qualityStr, 10) : 90;
      originalFilename = file.name;
      
    } else {
      // Handle conversion of already uploaded file
      const body = await request.json();
      const { fileId, filename, format: fmt, quality: q = 90, resize, resizeMode } = body;
      
      if (!filename && !fileId) {
        return NextResponse.json(
          { success: false, error: 'No file reference provided' },
          { status: 400 }
        );
      }
      
      if (!fmt || !isValidOutputFormat(fmt)) {
        return NextResponse.json(
          { success: false, error: 'Invalid output format' },
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
      
      buffer = await readFile(filepath);
      inputFormat = filename.split('.').pop()?.toLowerCase() ?? '';
      outputFormat = fmt as OutputFormat;
      quality = q;
      originalFilename = filename;
      
      // Perform conversion with resize
      const convertedBuffer = await convertImage(buffer, inputFormat, {
        format: outputFormat,
        quality,
        resize: resize || null,
        resizeMode: resizeMode || 'width',
      });
      
      const downloadFilename = createDownloadFilename(originalFilename, outputFormat);
      const mimeType = getMimeType(outputFormat);
      
      return new NextResponse(new Uint8Array(convertedBuffer), {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${downloadFilename}"`,
          'Content-Length': convertedBuffer.length.toString(),
        },
      });
    }
    
    // Note: Raster to SVG just wraps the image in SVG container
    // For true vectorization, user should use the Vectorizer tool
    
    // Perform conversion (for multipart form data uploads)
    const convertedBuffer = await convertImage(buffer, inputFormat, {
      format: outputFormat,
      quality,
    });
    
    const downloadFilename = createDownloadFilename(originalFilename, outputFormat);
    const mimeType = getMimeType(outputFormat);
    
    return new NextResponse(new Uint8Array(convertedBuffer), {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${downloadFilename}"`,
        'Content-Length': convertedBuffer.length.toString(),
      },
    });
    
  } catch (error) {
    logger.error('Conversion error', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert image',
      },
      { status: 500 }
    );
  }
}

function isValidOutputFormat(format: string): format is OutputFormat {
  return ['png', 'jpg', 'webp', 'svg'].includes(format.toLowerCase());
}

