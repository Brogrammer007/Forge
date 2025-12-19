import { GridBuilder } from '@/components/GridBuilder';

export default function GridBuilderPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Grid Builder</h1>
        <p className="text-zinc-400">
          Create stunning image grids and collages with customizable layouts, padding, borders, and text overlays.
          Export in PNG, JPG, WebP, or SVG formats. Perfect for social media posts and presentations.
        </p>
      </div>
      <GridBuilder />
    </div>
  );
}

