import { ImageConverter } from '@/components/ImageConverter';

export default function ConverterPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Image Converter</h1>
        <p className="text-zinc-400">
          Convert images between PNG, JPG, WebP, and SVG formats with quality control. 
          Upload multiple files for batch processing. All conversions happen locally.
        </p>
      </div>
      <ImageConverter />
    </div>
  );
}

