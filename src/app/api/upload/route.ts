import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';
import { cleanupOldFiles } from '@/lib/cleanup';

// Store uploads in a temp directory
const UPLOAD_DIR = path.join(process.cwd(), 'tmp', 'uploads');

// File validation constants
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_FORMATS = ['png', 'jpg', 'jpeg', 'jfif', 'webp', 'svg', 'bmp', 'tiff', 'pdf', 'gif', 'mp4', 'mov', 'avi', 'webm'];

// Ensure upload directory exists
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureUploadDir();
    
    // Cleanup old files periodically (non-blocking)
    cleanupOldFiles().catch((error) => {
      logger.warn('Background cleanup failed', { error });
    });
    
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      );
    }
    
    const results = [];
    
    for (const file of files) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        logger.warn('File too large', {
          filename: file.name,
          size: file.size,
          maxSize: MAX_FILE_SIZE,
        });
        return NextResponse.json(
          {
            success: false,
            error: `File "${file.name}" is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          },
          { status: 400 }
        );
      }

      // Validate file format
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ALLOWED_FORMATS.includes(ext)) {
        logger.warn('Invalid file format', {
          filename: file.name,
          format: ext,
        });
        return NextResponse.json(
          {
            success: false,
            error: `File format "${ext}" is not supported. Allowed formats: ${ALLOWED_FORMATS.join(', ')}`,
          },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const id = uuidv4();
      const filename = `${id}.${ext}`;
      const filepath = path.join(UPLOAD_DIR, filename);
      
      // Save the original file
      await writeFile(filepath, buffer);
      
      // Get metadata
      let width = 0;
      let height = 0;
      let format = ext;
      
      // Handle SVG separately
      if (ext === 'svg') {
        // Try to extract dimensions from SVG
        const svgString = buffer.toString('utf-8');
        const widthMatch = svgString.match(/width="(\d+)"/);
        const heightMatch = svgString.match(/height="(\d+)"/);
        const viewBoxMatch = svgString.match(/viewBox="0 0 (\d+) (\d+)"/);
        
        if (widthMatch && heightMatch) {
          width = parseInt(widthMatch[1] ?? '0', 10);
          height = parseInt(heightMatch[1] ?? '0', 10);
        } else if (viewBoxMatch) {
          width = parseInt(viewBoxMatch[1] ?? '0', 10);
          height = parseInt(viewBoxMatch[2] ?? '0', 10);
        }
        format = 'svg';
      } else {
        try {
          const metadata = await sharp(buffer).metadata();
          width = metadata.width ?? 0;
          height = metadata.height ?? 0;
          // Normalize JFIF to JPEG format (JFIF is a JPEG variant)
          format = metadata.format ?? (ext === 'jfif' ? 'jpeg' : ext);
        } catch {
          // If Sharp can't read it, just use file info
          // Normalize JFIF to JPEG format
          if (ext === 'jfif') {
            format = 'jpeg';
          }
        }
      }
      
      // Create thumbnail for preview (not for SVGs, PDFs)
      let previewPath = '';
      if (!['svg', 'pdf'].includes(ext)) {
        try {
          const thumbnailBuffer = await sharp(buffer)
            .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
            .png()
            .toBuffer();
          
          const thumbnailFilename = `${id}_thumb.png`;
          previewPath = path.join(UPLOAD_DIR, thumbnailFilename);
          await writeFile(previewPath, thumbnailBuffer);
        } catch {
          // Thumbnail generation failed, continue without it
        }
      }
      
      // Pre-calculate sizes for all output formats
      const formatSizes: Record<string, number> = {};
      
      if (!['svg', 'pdf'].includes(ext)) {
        try {
          const sharpInstance = sharp(buffer, { failOn: 'none' });
          
          // Calculate PNG size
          const pngBuffer = await sharpInstance.clone().png({ compressionLevel: 6 }).toBuffer();
          formatSizes.png = pngBuffer.length;
          
          // Calculate JPG size (quality 90)
          const jpgBuffer = await sharpInstance.clone()
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: 90 })
            .toBuffer();
          formatSizes.jpg = jpgBuffer.length;
          
          // Calculate WebP size (quality 90)
          const webpBuffer = await sharpInstance.clone()
            .webp({ quality: 90 })
            .toBuffer();
          formatSizes.webp = webpBuffer.length;
          
          // Calculate SVG size (base64 wrapper)
          const svgSize = Math.round(pngBuffer.length * 1.37 + 200); // base64 overhead + SVG markup
          formatSizes.svg = svgSize;
          
        } catch (err) {
          logger.error('Error calculating format sizes', err, { filename: file.name });
        }
      } else if (ext === 'svg') {
        // For SVG input, estimate raster sizes based on dimensions
        const pixelCount = width * height || 1000000;
        formatSizes.png = Math.round(pixelCount * 0.5); // rough estimate
        formatSizes.jpg = Math.round(pixelCount * 0.1);
        formatSizes.webp = Math.round(pixelCount * 0.08);
        formatSizes.svg = file.size;
      }
      
      results.push({
        id,
        name: file.name,
        format,
        size: file.size,
        width,
        height,
        filepath: filename,
        previewPath: previewPath ? `${id}_thumb.png` : filename,
        formatSizes,
      });
    }
    
    return NextResponse.json({
      success: true,
      data: results,
    });
    
  } catch (error) {
    logger.error('Upload error', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload files',
      },
      { status: 500 }
    );
  }
}

// Get uploaded file
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('file');
  
  try {
    if (!filename) {
      return NextResponse.json(
        { success: false, error: 'No filename provided' },
        { status: 400 }
      );
    }
    
    const filepath = path.join(UPLOAD_DIR, filename);
    
    if (!existsSync(filepath)) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }
    
    const { readFile } = await import('fs/promises');
    const buffer = await readFile(filepath);
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    
    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      jfif: 'image/jpeg', // JFIF is a JPEG variant
      webp: 'image/webp',
      svg: 'image/svg+xml',
      pdf: 'application/pdf',
      bmp: 'image/bmp',
      tiff: 'image/tiff',
    };
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeTypes[ext] ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
    
  } catch (error) {
    logger.error('Get file error', error, { filename: filename || 'unknown' });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get file',
      },
      { status: 500 }
    );
  }
}
