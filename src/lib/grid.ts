import sharp from 'sharp';
import type { GridOptions, TextOverlay } from '@/types';
import { hexToRgb } from '@/lib/utils';
import { createTextSvgElement } from '@/lib/textOverlay';

interface GridImage {
  buffer: Buffer;
  order: number;
}

interface CellPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate the actual rows needed based on image count
 */
export function calculateActualRows(imageCount: number, cols: number): number {
  return Math.ceil(imageCount / cols);
}

/**
 * Calculate the actual canvas dimensions based on image count
 */
export function calculateActualDimensions(
  options: GridOptions,
  imageCount: number
): { width: number; height: number; rows: number; cols: number } {
  const { cols, width, padding, borderWidth } = options;

  // Calculate actual rows needed
  const actualRows = calculateActualRows(imageCount, cols);

  // Calculate cell dimensions based on width and columns
  const totalPaddingX = padding * (cols + 1);
  const totalBorderX = borderWidth * cols * 2;
  const availableWidth = width - totalPaddingX - totalBorderX;
  const cellWidth = Math.floor(availableWidth / cols);

  // Use same cell size for height to keep cells square-ish or use original aspect ratio
  // Calculate what the cell height would be based on original dimensions
  const originalRows = options.rows;
  const totalPaddingYOriginal = padding * (originalRows + 1);
  const totalBorderYOriginal = borderWidth * originalRows * 2;
  const availableHeightOriginal = options.height - totalPaddingYOriginal - totalBorderYOriginal;
  const cellHeight = Math.floor(availableHeightOriginal / originalRows);

  // Calculate actual canvas height based on actual rows
  const totalPaddingY = padding * (actualRows + 1);
  const totalBorderY = borderWidth * actualRows * 2;
  const actualHeight = totalPaddingY + totalBorderY + (cellHeight * actualRows);

  return {
    width,
    height: actualHeight,
    rows: actualRows,
    cols,
  };
}

/**
 * Calculate cell positions for grid layout
 */
export function calculateCellPositions(
  options: GridOptions,
  imageCount: number
): CellPosition[] {
  const { cols, width, padding, borderWidth } = options;

  // Calculate actual rows needed based on image count
  const actualRows = calculateActualRows(imageCount, cols);
  const effectiveImageCount = imageCount;

  // Calculate available space for images
  const totalPaddingX = padding * (cols + 1);
  const totalBorderX = borderWidth * cols * 2;
  const availableWidth = width - totalPaddingX - totalBorderX;

  // Calculate cell width
  const cellWidth = Math.floor(availableWidth / cols);

  // Calculate cell height based on original grid aspect ratio
  const originalRows = options.rows;
  const totalPaddingYOriginal = padding * (originalRows + 1);
  const totalBorderYOriginal = borderWidth * originalRows * 2;
  const availableHeightOriginal = options.height - totalPaddingYOriginal - totalBorderYOriginal;
  const cellHeight = Math.floor(availableHeightOriginal / originalRows);

  // Ensure minimum cell size
  const finalCellWidth = Math.max(1, cellWidth);
  const finalCellHeight = Math.max(1, cellHeight);

  const positions: CellPosition[] = [];

  for (let i = 0; i < effectiveImageCount; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;

    // Only add positions for cells that will actually be used
    if (row >= actualRows) continue;

    // Calculate exact position
    const x = padding + borderWidth + col * (finalCellWidth + borderWidth * 2 + padding);
    const y = padding + borderWidth + row * (finalCellHeight + borderWidth * 2 + padding);

    positions.push({
      x: Math.round(x),
      y: Math.round(y),
      width: finalCellWidth,
      height: finalCellHeight,
    });
  }

  return positions;
}

/**
 * Create rounded rectangle mask for corner radius
 */
async function createRoundedMask(
  width: number,
  height: number,
  radius: number
): Promise<Buffer> {
  // Create SVG with rounded rectangle
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

/**
 * Apply rounded corners to an image and ensure exact dimensions
 */
async function applyRoundedCorners(
  imageBuffer: Buffer,
  width: number,
  height: number,
  radius: number,
  imageFit: 'cover' | 'contain' | 'fill' = 'cover'
): Promise<Buffer> {
  // Map our fit options to Sharp's fit options
  const sharpFit = imageFit === 'fill' ? 'fill' : imageFit;

  // First, resize and extract to exact dimensions
  let resizedImage: Buffer;

  if (imageFit === 'contain') {
    // For contain, we need to resize then extend with transparent background
    const metadata = await sharp(imageBuffer).metadata();
    const imgWidth = metadata.width || 1;
    const imgHeight = metadata.height || 1;
    const scale = Math.min(width / imgWidth, height / imgHeight);
    const newWidth = Math.round(imgWidth * scale);
    const newHeight = Math.round(imgHeight * scale);

    const resized = await sharp(imageBuffer)
      .resize(newWidth, newHeight, { fit: 'inside' })
      .png()
      .toBuffer();

    // Center the image on a transparent canvas
    resizedImage = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{
        input: resized,
        left: Math.round((width - newWidth) / 2),
        top: Math.round((height - newHeight) / 2),
      }])
      .png()
      .toBuffer();
  } else {
    resizedImage = await sharp(imageBuffer)
      .resize(width, height, {
        fit: sharpFit,
        position: 'center',
      })
      .extract({ left: 0, top: 0, width, height }) // Ensure exact dimensions
      .png()
      .toBuffer();
  }

  if (radius <= 0) {
    return resizedImage;
  }

  const mask = await createRoundedMask(width, height, radius);

  // Apply mask for rounded corners
  return sharp(resizedImage)
    .composite([
      {
        input: mask,
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();
}

/**
 * Create border for a cell
 */
async function createCellBorder(
  cellWidth: number,
  cellHeight: number,
  borderWidth: number,
  borderColor: string,
  cornerRadius: number
): Promise<Buffer | null> {
  if (borderWidth <= 0) {
    return null;
  }

  const rgb = hexToRgb(borderColor);
  const color = rgb ? `rgb(${rgb.r},${rgb.g},${rgb.b})` : borderColor;

  const totalWidth = cellWidth + borderWidth * 2;
  const totalHeight = cellHeight + borderWidth * 2;

  const svg = `
    <svg width="${totalWidth}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect 
        x="${borderWidth / 2}" 
        y="${borderWidth / 2}" 
        width="${totalWidth - borderWidth}" 
        height="${totalHeight - borderWidth}" 
        rx="${cornerRadius}" 
        ry="${cornerRadius}" 
        fill="none" 
        stroke="${color}" 
        stroke-width="${borderWidth}"
      />
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

/**
 * Build the image grid
 */
export async function buildGrid(
  images: GridImage[],
  options: GridOptions
): Promise<Buffer> {
  const {
    backgroundColor,
    borderWidth,
    borderColor,
    cornerRadius,
    imageFit = 'cover',
  } = options;

  // Sort images by order
  const sortedImages = [...images].sort((a, b) => a.order - b.order);

  // Calculate actual dimensions based on image count (shrink canvas to fit only used cells)
  const actualDimensions = calculateActualDimensions(options, sortedImages.length);
  const canvasWidth = actualDimensions.width;
  const canvasHeight = actualDimensions.height;

  // Calculate cell positions with adjusted options
  const adjustedOptions = {
    ...options,
    rows: actualDimensions.rows,
    height: canvasHeight,
  };
  const positions = calculateCellPositions(adjustedOptions, sortedImages.length);

  // Parse background color
  const bgRgb = hexToRgb(backgroundColor);
  const background = bgRgb
    ? { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b, alpha: 1 }
    : { r: 255, g: 255, b: 255, alpha: 1 };

  // Create base canvas with actual dimensions
  const canvas = sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background,
    },
  });

  // Prepare composite operations - images first, then borders on top
  const imageComposites: sharp.OverlayOptions[] = [];
  const borderComposites: sharp.OverlayOptions[] = [];

  // Process each image
  for (let i = 0; i < sortedImages.length; i++) {
    const image = sortedImages[i];
    const position = positions[i];

    if (!image || !position) continue;

    // Ensure position values are integers
    const posX = Math.round(position.x);
    const posY = Math.round(position.y);
    const cellWidth = Math.round(position.width);
    const cellHeight = Math.round(position.height);

    // Process image with exact dimensions and rounded corners
    const processedImage = await applyRoundedCorners(
      image.buffer,
      cellWidth,
      cellHeight,
      cornerRadius,
      imageFit
    );

    // Add image to composites FIRST
    imageComposites.push({
      input: processedImage,
      left: posX,
      top: posY,
    });

    // Add border ON TOP of image
    if (borderWidth > 0) {
      const border = await createCellBorder(
        cellWidth,
        cellHeight,
        borderWidth,
        borderColor,
        cornerRadius
      );

      if (border) {
        borderComposites.push({
          input: border,
          left: posX - borderWidth,
          top: posY - borderWidth,
        });
      }
    }
  }

  // Composite: images first, then borders on top to frame them
  const allComposites = [...imageComposites, ...borderComposites];

  // Composite all onto canvas
  const result = await canvas
    .composite(allComposites)
    .png()
    .toBuffer();

  return result;
}

/**
 * Convert grid to specified format
 */
export async function convertGridToFormat(
  gridBuffer: Buffer,
  format: 'png' | 'jpg' | 'webp',
  quality: number = 90
): Promise<Buffer> {
  const sharpInstance = sharp(gridBuffer);

  switch (format) {
    case 'png':
      return sharpInstance.png().toBuffer();
    case 'jpg':
      return sharpInstance.jpeg({ quality }).toBuffer();
    case 'webp':
      return sharpInstance.webp({ quality }).toBuffer();
    default:
      return sharpInstance.png().toBuffer();
  }
}

/**
 * Get preset dimensions
 */
export function getPresetDimensions(preset: string): { width: number; height: number } {
  const presets: Record<string, { width: number; height: number }> = {
    '1080x1080': { width: 1080, height: 1080 },
    '1920x1080': { width: 1920, height: 1080 },
    '1080x1920': { width: 1080, height: 1920 },
    '1200x628': { width: 1200, height: 628 },
  };

  return presets[preset] ?? { width: 1080, height: 1080 };
}

/**
 * Get layout preset configuration
 */
export function getLayoutPreset(preset: string): { rows: number; cols: number } {
  const presets: Record<string, { rows: number; cols: number }> = {
    '1x2': { rows: 1, cols: 2 },
    '2x1': { rows: 2, cols: 1 },
    '2x2': { rows: 2, cols: 2 },
    '2x3': { rows: 2, cols: 3 },
    '3x2': { rows: 3, cols: 2 },
    '3x3': { rows: 3, cols: 3 },
    '4x4': { rows: 4, cols: 4 },
  };

  return presets[preset] ?? { rows: 2, cols: 2 };
}

/**
 * Build the grid as a native SVG string
 */
export async function buildGridSvg(
  images: GridImage[],
  options: GridOptions,
  textOverlays: TextOverlay[] = []
): Promise<Buffer> {
  const {
    backgroundColor,
    borderWidth,
    borderColor,
    cornerRadius,
    imageFit = 'cover',
  } = options;

  // Sort images by order
  const sortedImages = [...images].sort((a, b) => a.order - b.order);

  // Calculate actual dimensions based on image count
  const actualDimensions = calculateActualDimensions(options, sortedImages.length);
  const canvasWidth = actualDimensions.width;
  const canvasHeight = actualDimensions.height;

  // Calculate cell positions
  const adjustedOptions = {
    ...options,
    rows: actualDimensions.rows,
    height: canvasHeight,
  };
  const positions = calculateCellPositions(adjustedOptions, sortedImages.length);

  // Start SVG
  let svg = `<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`;

  // Initial definitions for clip paths
  svg += `<defs>`;

  // Add background
  if (backgroundColor && backgroundColor !== 'transparent') {
    svg += `<rect x="0" y="0" width="${canvasWidth}" height="${canvasHeight}" fill="${backgroundColor}" />`;
  }

  // Process each image
  for (let i = 0; i < sortedImages.length; i++) {
    const image = sortedImages[i];
    const position = positions[i];

    if (!image || !position) continue;

    const posX = Math.round(position.x);
    const posY = Math.round(position.y);
    const cellWidth = Math.round(position.width);
    const cellHeight = Math.round(position.height);
    const clipId = `clip-${i}`;

    // Add clip path for this cell if rounded corners exist
    if (cornerRadius > 0) {
      svg += `
        <clipPath id="${clipId}">
          <rect x="${posX}" y="${posY}" width="${cellWidth}" height="${cellHeight}" rx="${cornerRadius}" ry="${cornerRadius}" />
        </clipPath>
      `;
    }

    // Process image to fit dimensions (using sharp to resize/fit before embedding)
    // We still use sharp to resize the image to the correct dimensions to keep file size reasonable
    const sharpFit = imageFit === 'fill' ? 'fill' : imageFit;
    let processedBuffer: Buffer;

    if (imageFit === 'contain') {
      // For contain, we resize within bounds and center
      const metadata = await sharp(image.buffer).metadata();
      const imgWidth = metadata.width || 1;
      const imgHeight = metadata.height || 1;
      const scale = Math.min(cellWidth / imgWidth, cellHeight / imgHeight);
      const newWidth = Math.round(imgWidth * scale);
      const newHeight = Math.round(imgHeight * scale);

      const resized = await sharp(image.buffer)
        .resize(newWidth, newHeight, { fit: 'inside' })
        .png()
        .toBuffer();

      // Calculate centered position offsets
      const offsetX = (cellWidth - newWidth) / 2;
      const offsetY = (cellHeight - newHeight) / 2;

      // For contain we need a group to handle the positioning relative to the cell
      // Embed as base64
      const base64 = resized.toString('base64');
      const mimeType = 'image/png';

      // Use the clip path on the image group or image
      const clipAttr = cornerRadius > 0 ? `clip-path="url(#${clipId})"` : '';

      svg += `
         <image 
           x="${posX + offsetX}" 
           y="${posY + offsetY}" 
           width="${newWidth}" 
           height="${newHeight}" 
           href="data:${mimeType};base64,${base64}" 
           ${clipAttr}
         />
       `;

    } else {
      // Cover or Fill
      processedBuffer = await sharp(image.buffer)
        .resize(cellWidth, cellHeight, {
          fit: sharpFit,
          position: 'center'
        })
        .png()
        .toBuffer();

      const base64 = processedBuffer.toString('base64');
      const mimeType = 'image/png';

      const clipAttr = cornerRadius > 0 ? `clip-path="url(#${clipId})"` : '';

      svg += `
        <image 
          x="${posX}" 
          y="${posY}" 
          width="${cellWidth}" 
          height="${cellHeight}" 
          href="data:${mimeType};base64,${base64}" 
          ${clipAttr}
        />
      `;
    }

    // Add border (drawn on top)
    if (borderWidth > 0) {
      // SVG stroke is centered on the path, so providing a rect with correct dimensions needs care or 'stroke-alignment'
      // Easier to just use a rect with no fill and stroke
      // To strictly match "border outside" or "border inside", logic varies. 
      // Our existing logic was roughly "border adds to size" or "border inset".
      // Let's assume standard stroke behavior but we might need to inset by half stroke width for "inside" behavior if desired.
      // Based on previous createCellBorder:
      // x="${borderWidth / 2}" ... width="${totalWidth - borderWidth}"
      // This implies the rect stroke is centered on the line x=borderWidth/2.
      // So the outer edge of stroke is at x=0.

      // We want the border to surround the cell at posX, posY with width cellWidth, height cellHeight.
      // If we draw a rect at those exact coords with stroke-width, half the stroke is inside, half outside.
      // Previous logic seemed to create a separate "border image" that was composited.

      // Let's replicate strict visual:
      // A rect at (posX - borderWidth/2) would put the stroke center outside.
      // Let's use the exact cell bounds and stroke-alignment if possible, but SVG 1.1 doesn't support stroke-alignment easily.
      // We will draw a rect that effectively covers the border area.

      // The previous logic generated a dedicated SVG for the border of size (cell+2*border).
      // effectively putting the stroke around the cell.

      svg += `
        <rect 
          x="${posX - borderWidth / 2}" 
          y="${posY - borderWidth / 2}" 
          width="${cellWidth + borderWidth}" 
          height="${cellHeight + borderWidth}" 
          rx="${cornerRadius + borderWidth / 2}" 
          ry="${cornerRadius + borderWidth / 2}"
          fill="none" 
          stroke="${borderColor}" 
          stroke-width="${borderWidth}"
        />
      `;
    }
  }

  // Close defs
  svg += `</defs>`;

  // Add Text Overlays
  if (textOverlays && textOverlays.length > 0) {
    for (const overlay of textOverlays) {
      svg += createTextSvgElement(overlay, canvasWidth, canvasHeight);
    }
  }

  svg += `</svg>`;

  return Buffer.from(svg);
}
