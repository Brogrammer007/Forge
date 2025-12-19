import sharp from 'sharp';
import type { TextOverlay } from '@/types';
import { hexToRgb } from '@/lib/utils';

/**
 * Escape special characters for SVG text
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Map web-safe font names to SVG-compatible names
 */
function mapFontFamily(fontFamily: string): string {
  const fontMap: Record<string, string> = {
    'Arial': 'Arial, sans-serif',
    'Helvetica': 'Helvetica, Arial, sans-serif',
    'Georgia': 'Georgia, serif',
    'Times New Roman': 'Times New Roman, Times, serif',
    'Courier New': 'Courier New, Courier, monospace',
    'Verdana': 'Verdana, sans-serif',
    'Impact': 'Impact, sans-serif',
  };

  return fontMap[fontFamily] ?? 'Arial, sans-serif';
}

/**
 * Create SVG text element with styling
 */
export function createTextSvgElement(
  overlay: TextOverlay,
  width: number,
  height: number
): string {
  const {
    text,
    x,
    y,
    fontFamily,
    fontSize,
    fontWeight,
    color,
    align,
    shadow,
    stroke,
  } = overlay;

  // Convert relative positions to absolute
  const absX = Math.round(x * width);
  const absY = Math.round(y * height);

  // Determine text-anchor based on alignment
  let textAnchor = 'start';
  let alignedX = absX;
  if (align === 'center') {
    textAnchor = 'middle';
    alignedX = absX;
  } else if (align === 'right') {
    textAnchor = 'end';
  }

  const escapedText = escapeXml(text);
  const mappedFont = mapFontFamily(fontFamily);

  let textElements = '';

  // Add shadow if configured
  if (shadow) {
    const shadowRgb = hexToRgb(shadow.color);
    const shadowColor = shadowRgb
      ? `rgba(${shadowRgb.r},${shadowRgb.g},${shadowRgb.b},0.5)`
      : shadow.color;

    textElements += `
      <text
        x="${alignedX + shadow.offsetX}"
        y="${absY + shadow.offsetY}"
        font-family="${mappedFont}"
        font-size="${fontSize}"
        font-weight="${fontWeight}"
        fill="${shadowColor}"
        text-anchor="${textAnchor}"
        filter="url(#shadow-blur)"
      >${escapedText}</text>
    `;
  }

  // Add stroke if configured
  if (stroke && stroke.width > 0) {
    textElements += `
      <text
        x="${alignedX}"
        y="${absY}"
        font-family="${mappedFont}"
        font-size="${fontSize}"
        font-weight="${fontWeight}"
        fill="none"
        stroke="${stroke.color}"
        stroke-width="${stroke.width}"
        text-anchor="${textAnchor}"
      >${escapedText}</text>
    `;
  }

  // Add main text
  textElements += `
    <text
      x="${alignedX}"
      y="${absY}"
      font-family="${mappedFont}"
      font-size="${fontSize}"
      font-weight="${fontWeight}"
      fill="${color}"
      text-anchor="${textAnchor}"
    >${escapedText}</text>
  `;

  return textElements;
}

/**
 * Create SVG with all text overlays
 */
function createTextOverlaySvg(
  overlays: TextOverlay[],
  width: number,
  height: number
): string {
  const textElements = overlays
    .map((overlay) => createTextSvgElement(overlay, width, height))
    .join('\n');

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
        </filter>
      </defs>
      ${textElements}
    </svg>
  `;
}

/**
 * Render text overlays onto an image buffer
 */
export async function renderTextOverlays(
  imageBuffer: Buffer,
  overlays: TextOverlay[],
  width: number,
  height: number
): Promise<Buffer> {
  if (overlays.length === 0) {
    return imageBuffer;
  }

  // Create SVG with text overlays
  const textSvg = createTextOverlaySvg(overlays, width, height);
  const textBuffer = Buffer.from(textSvg);

  // Composite text SVG onto image
  return sharp(imageBuffer)
    .composite([
      {
        input: textBuffer,
        blend: 'over',
      },
    ])
    .toBuffer();
}

/**
 * Generate preview of text overlay (returns base64 PNG)
 */
export async function generateTextPreview(
  overlay: TextOverlay,
  width: number,
  height: number,
  backgroundColor: string = 'transparent'
): Promise<string> {
  const svg = createTextOverlaySvg([overlay], width, height);

  const buffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return `data:image/png;base64,${buffer.toString('base64')}`;
}

/**
 * Validate text overlay configuration
 */
export function validateTextOverlay(overlay: Partial<TextOverlay>): string[] {
  const errors: string[] = [];

  if (!overlay.text || overlay.text.trim() === '') {
    errors.push('Text content is required');
  }

  if (overlay.fontSize !== undefined && (overlay.fontSize < 8 || overlay.fontSize > 500)) {
    errors.push('Font size must be between 8 and 500');
  }

  if (overlay.x !== undefined && (overlay.x < 0 || overlay.x > 1)) {
    errors.push('X position must be between 0 and 1');
  }

  if (overlay.y !== undefined && (overlay.y < 0 || overlay.y > 1)) {
    errors.push('Y position must be between 0 and 1');
  }

  return errors;
}

/**
 * Create default text overlay
 */
export function createDefaultTextOverlay(id: string): TextOverlay {
  return {
    id,
    text: 'New Text',
    x: 0.5,
    y: 0.5,
    fontFamily: 'Arial',
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    align: 'center',
  };
}

