import { Vectorizer } from '@/components/Vectorizer';

export default function VectorizerPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Vectorizer</h1>
        <p className="text-zinc-400">
          Transform raster images into clean, scalable SVG vectors using advanced tracing algorithms. 
          Perfect for logos, icons, and sketches. Export as SVG or raster formats (PNG, JPG, WebP).
        </p>
      </div>
      <Vectorizer />
    </div>
  );
}

