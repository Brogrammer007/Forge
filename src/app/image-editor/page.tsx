'use client';

import { ImageEditor } from '@/components/ImageEditor';

export default function ImageEditorPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Image Editor</h1>
        <p className="text-zinc-400">
          Professional image editing with crop, rotate, color adjustments, AI background removal, and filters. 
          All processing happens locally in your browser with live preview.
        </p>
      </div>
      <ImageEditor />
    </div>
  );
}

