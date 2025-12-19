# Forge

A professional desktop-ready design utility for image conversion, editing, vectorization, and grid building. All processing is done locally - your data never leaves your device.

## Features

### 🖼️ Image Converter
- Convert between PNG, JPG, WebP, SVG
- Batch processing support
- Quality control for lossy formats
- Drag & drop interface
- Pre-calculated file size estimates

### ✏️ Image Editor
- **Crop Tool**: Precise cropping with aspect ratio presets (1:1, 16:9, 4:3, etc.)
- **Transform**: Rotate, flip horizontally/vertically
- **Color Adjustments**: Brightness, contrast, saturation, blur controls
- **AI Background Removal**: Remove backgrounds using AI-powered processing
- **Watermark Tool**: Add text or image watermarks with position, opacity, and size controls
- **Filters & Effects**: 15+ artistic filters including sepia, grayscale, vintage, sharpen, vignette, warm, cool, invert, hue shift, and more
- **Live Preview**: Real-time preview of all edits
- **Export**: Download edited images in PNG, JPG, or WebP format

### ✨ Vectorizer (Raster → SVG)
- Convert raster images to clean SVG vectors using Potrace
- Adjustable detail level (low, medium, high), threshold, and smoothness
- Custom fill and stroke colors
- Background removal option
- SVG optimization with SVGO
- Live preview with auto-update
- Export as SVG, PNG, JPG, or WebP

### 🚀 AI Upscaler
- Increase image resolution up to 4x using AI-powered models
- Two upscaling models: 2x (default) and 4x (ESRGAN-thick)
- Automatic sharpening for better results
- Side-by-side comparison view
- Zoom controls for detailed inspection
- Progress tracking during upscaling

### 🎨 Grid Builder
- Create image grids and collages
- Multiple layout presets (1×2, 2×1, 2×2, 3×3, 4×4, 2×3, 3×2, custom)
- Custom resolution presets (1080×1080, 1920×1080, 1080×1920, 1200×628, custom)
- Padding, borders, and corner radius controls
- Text overlays with font customization (font family, size, weight, color, alignment)
- Drag & drop reordering
- Image fit options (cover, contain, fill)
- Export as PNG, JPG, WebP, or SVG

### 🎬 Video to GIF Converter
- Convert video clips to optimized GIFs
- Custom frame rate control
- Start/end time selection
- Quality settings
- Preview before export
- Progress tracking

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Image Processing**: Sharp
- **AI Background Removal**: @imgly/background-removal
- **AI Upscaling**: UpscalerJS with ESRGAN models
- **Vectorization**: Potrace
- **SVG Optimization**: SVGO
- **Video Processing**: FFmpeg.wasm
- **Text Rendering**: Canvas
- **State Management**: Zustand
- **Desktop**: Electron

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### 📦 Portable Version

Download the portable version (no installation required):

| Platform | Download Link | Size |
|----------|---------------|------|
| 🪟 **Windows** | [**Download Forge v1.0.1**](https://www.mediafire.com/file/4dzrrcs84eo6i1e/Forge-v1.0.1.zip/file) | ~500 MB |
| 🍎 **macOS** | [**Download Forge v1.0.1**](https://www.mediafire.com/file/2xq4fye6ka7678w/Forge-macOS-v1.0.1.zip/file) | ~577 MB |

> **Note**: macOS version is compatible with Intel Macs and Apple Silicon (M1/M2/M3/M4)

### Installation

```bash
# Clone the repository
git clone https://github.com/Brogrammer007/Forge.git
cd Forge

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Development with Electron

```bash
# Run Next.js dev server and Electron together
npm run dev:electron
```

## Building

### Web Build

```bash
npm run build:web
```

### Desktop Build

#### Windows

```bash
# Build unpacked Windows version (portable .exe)
npm run dist:win
```

This creates `dist-electron/win-unpacked/` folder with `Forge.exe` that can be run directly without installation.

#### macOS

**Prerequisites**: macOS build must be run on a macOS system (Intel or Apple Silicon M1/M2/M3).

```bash
# Build unpacked macOS version (portable .app bundle)
npm run dist:mac:unpacked
```

This will:
1. Automatically generate `icon.icns` from `icon.png` (if it doesn't exist)
2. Build the Next.js application
3. Create `dist-electron/mac-unpacked/Forge.app` bundle
4. Copy all necessary files into the `.app` bundle
5. Create a ZIP archive for distribution

The build creates `dist-electron/mac-unpacked/Forge.app` which can be run directly by double-clicking or using:
```bash
open dist-electron/mac-unpacked/Forge.app
```

**Note**: For DMG installer build (alternative):
```bash
npm run dist:mac
```

Build artifacts will be in the `dist-electron/` folder.

## Project Structure

```
vectorforge/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── api/            # API routes
│   │   │   ├── convert/    # Image conversion
│   │   │   ├── upload/     # File uploads
│   │   │   ├── vectorize/  # SVG vectorization
│   │   │   └── grid/       # Grid generation
│   │   ├── converter/      # Converter page
│   │   ├── image-editor/  # Image Editor page
│   │   ├── upscaler/      # AI Upscaler page
│   │   ├── vectorizer/     # Vectorizer page
│   │   ├── grid-builder/   # Grid builder page
│   │   └── gif-converter/  # Video to GIF page
│   ├── components/         # React components
│   │   ├── layout/        # Layout components
│   │   ├── ui/            # UI primitives
│   │   ├── ImageConverter.tsx
│   │   ├── ImageEditor.tsx
│   │   ├── Upscaler.tsx
│   │   ├── Vectorizer.tsx
│   │   ├── GridBuilder.tsx
│   │   ├── GifConverter.tsx
│   │   └── ImageLibrary.tsx
│   ├── lib/               # Utility functions
│   │   ├── imageProcessing.ts
│   │   ├── vectorize.ts
│   │   ├── grid.ts
│   │   ├── textOverlay.ts
│   │   └── utils.ts
│   ├── types/             # TypeScript types
│   └── store/             # State management
├── electron/              # Electron files
│   ├── main.ts           # Main process
│   └── preload.ts        # Preload script
├── public/               # Static assets
└── build/                # Build resources
```

## API Routes

### POST /api/upload
Upload one or more images. Returns metadata and server filename.

### POST /api/convert
Convert an image to another format.
- Body: `multipart/form-data` with `file`, `format`, `quality`

### POST /api/vectorize
Vectorize a raster image to SVG.
- Body: `multipart/form-data` with image and options

### POST /api/grid
Generate an image grid.
- Body: JSON with images, options, and text overlays

### PUT /api/grid
Generate a preview of the grid (returns base64).

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode

## License

MIT License - see [LICENSE](LICENSE) for details.

## Copyright

Copyright © 2025 Vuk. All rights reserved.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

