'use client';

import { Upscaler } from '@/components/Upscaler';

export default function UpscalerPage() {
    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-zinc-100 mb-2">AI Image Upscaler</h1>
                <p className="text-zinc-400">
                    Enhance your images using advanced AI technology. Increase resolution up to 4x with multiple AI models. 
                    All processing happens locally in your browser - no uploads required.
                </p>
            </div>
            <Upscaler />
        </div>
    );
}
