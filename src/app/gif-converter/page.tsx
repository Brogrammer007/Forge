'use client';

import { GifConverter } from '@/components/GifConverter';

export default function GifConverterPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Video to GIF</h1>
        <p className="text-zinc-400">
          Convert video clips to optimized animated GIFs. Trim videos, adjust resolution, frame rate, and quality. 
          All processing happens locally in your browser using FFmpeg.
        </p>
      </div>
      <GifConverter />
    </div>
  );
}

