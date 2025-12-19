'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useImageStore } from '@/store/imageStore';
import {
    DownloadIcon,
    LoaderIcon,
    ImageIcon,
    XIcon,
    UploadIcon,
    ZoomInIcon,
    ZoomOutIcon
} from './ui/Icons';
import { formatFileSize, downloadBlob, validateFileSize, FILE_SIZE_LIMITS } from '@/lib/utils';
import { clsx } from 'clsx';
import { showToast } from './ui/Toast';
// Dynamic imports for UpscalerJS

export function Upscaler() {
    const [image, setImage] = useState<{
        file: File;
        previewUrl: string;
        width: number;
        height: number;
        name: string;
    } | null>(null);

    const [upscaledImage, setUpscaledImage] = useState<{
        url: string;
        blob: Blob;
    } | null>(null);

    const [isUpscaling, setIsUpscaling] = useState(false);
    const [progress, setProgress] = useState(0);
    const [modelName, setModelName] = useState<'x2' | 'x4' | null>(null);
    const [sliderPosition, setSliderPosition] = useState(50);
    const [isHovering, setIsHovering] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset zoom when image changes
    useEffect(() => {
        setZoomLevel(1);
    }, [upscaledImage]);

    const processFile = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file', 'error');
            return;
        }

        // Validate file size
        const validation = validateFileSize(file, FILE_SIZE_LIMITS.IMAGE, 'image');
        if (!validation.valid) {
            showToast(validation.error ?? 'File is too large', 'error');
            return;
        }

        // Cleanup previous object URLs
        if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
        if (upscaledImage?.url) URL.revokeObjectURL(upscaledImage.url);

        setUpscaledImage(null);
        setSliderPosition(50);
        setZoomLevel(1);

        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            setImage({
                file,
                previewUrl: url,
                width: img.naturalWidth,
                height: img.naturalHeight,
                name: file.name
            });
        };
        img.src = url;
    }, [image, upscaledImage]);

    // Handle file upload
    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    }, [processFile]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsHovering(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    }, [processFile]);

    const applySharpening = (imgSrc: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(imgSrc);
                    return;
                }

                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const width = canvas.width;
                const height = canvas.height;

                const buffer = new Uint8ClampedArray(data);

                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const idx = (y * width + x) * 4;

                        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) continue;

                        const up = ((y - 1) * width + x) * 4;
                        const down = ((y + 1) * width + x) * 4;
                        const left = (y * width + (x - 1)) * 4;
                        const right = (y * width + (x + 1)) * 4;

                        for (let c = 0; c < 3; c++) {
                            const val =
                                5 * buffer[idx + c]!
                                - buffer[up + c]!
                                - buffer[down + c]!
                                - buffer[left + c]!
                                - buffer[right + c]!;

                            data[idx + c] = val;
                        }
                    }
                }

                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve(imgSrc);
            img.src = imgSrc;
        });
    };

    const handleUpscale = async (scale: 'x2' | 'x4') => {
        if (!image) return;

        setIsUpscaling(true);
        setProgress(0);
        setModelName(scale);
        setUpscaledImage(null);

        try {
            // Load Upscaler and models from CDN
            // @ts-ignore
            const { default: Upscaler } = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/upscaler@1.0.0-beta.19/+esm');
            const { default: model } = scale === 'x2'
                // @ts-ignore
                ? await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/@upscalerjs/default-model@1.0.0-beta.17/+esm')
                // @ts-ignore
                : await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-thick@1.0.0-beta.16/+esm');

            const upscaler = new Upscaler({
                model: model as any,
            });

            setProgress(10);

            const upscaledSrc = await upscaler.upscale(image.previewUrl, {
                patchSize: 64,
                padding: 5,
                progress: (amount: number) => setProgress(Math.round(amount * 90))
            });

            setProgress(95);
            const sharpenedSrc = await applySharpening(upscaledSrc);

            const res = await fetch(sharpenedSrc);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            setUpscaledImage({ url, blob });
            setProgress(100);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Upscaling failed';
            showToast(errorMessage, 'error');
        } finally {
            setIsUpscaling(false);
            setProgress(0);
            setModelName(null);
        }
    };

    const handleDownload = () => {
        if (!upscaledImage || !image) return;
        const filename = image.name.replace(/\.[^/.]+$/, '') + '_upscaled.png';
        downloadBlob(upscaledImage.blob, filename);
    };

    const handleZoom = (delta: number) => {
        setZoomLevel(prev => {
            const next = prev + delta;
            return Math.min(Math.max(next, 1), 3); // Min 1x, Max 3x
        });
    };

    return (
        <div className="space-y-6">
            {/* Upload Area */}
            {!image ? (
                <div
                    className={clsx(
                        "border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer",
                        isHovering ? "border-accent-500 bg-accent-500/10" : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/50"
                    )}
                    onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
                    onDragLeave={() => setIsHovering(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileSelect}
                    />
                    <UploadIcon className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
                    <h3 className="text-lg font-medium text-zinc-300 mb-2">Upload Image to Upscale</h3>
                    <p className="text-zinc-500 text-sm">Drag & drop or click to browse</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Controls Header */}
                    <div className="flex items-center justify-between bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-zinc-800 rounded overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={image.previewUrl} alt="Original" className="w-full h-full object-cover" />
                            </div>
                            <div>
                                <h3 className="font-medium text-zinc-200 truncate max-w-[200px]">{image.name}</h3>
                                <p className="text-xs text-zinc-500">{image.width} × {image.height}</p>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setImage(null)}
                                className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-red-400 transition-colors"
                                title="Remove image"
                                aria-label="Remove image"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Upscale Options */}
                    {!upscaledImage && !isUpscaling && (
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => handleUpscale('x2')}
                                className="card p-6 hover:border-accent-500/50 transition-all group text-left"
                                aria-label="Upscale image 2x - Fast processing, doubles image resolution"
                            >
                                <div className="text-2xl font-bold text-accent-400 mb-1">x2 Upscale</div>
                                <div className="text-sm text-zinc-400 group-hover:text-zinc-300">Fast processing. Doubles image resolution.</div>
                                <div className="mt-4 text-xs font-mono bg-zinc-900/50 inline-block px-2 py-1 rounded text-zinc-500">
                                    {image.width * 2} × {image.height * 2}
                                </div>
                            </button>

                            <button
                                onClick={() => handleUpscale('x4')}
                                className="card p-6 hover:border-accent-500/50 transition-all group text-left"
                                aria-label="Upscale image 4x - Best quality, 4x resolution, slower processing"
                            >
                                <div className="text-2xl font-bold text-accent-400 mb-1">x4 Upscale</div>
                                <div className="text-sm text-zinc-400 group-hover:text-zinc-300">Best quality. 4x resolution. Slower.</div>
                                <div className="mt-4 text-xs font-mono bg-zinc-900/50 inline-block px-2 py-1 rounded text-zinc-500">
                                    {image.width * 4} × {image.height * 4}
                                </div>
                            </button>
                        </div>
                    )}

                    {/* Progress State */}
                    {isUpscaling && (
                        <div className="card p-12 text-center animate-pulse">
                            <LoaderIcon className="w-8 h-8 mx-auto text-accent-500 animate-spin mb-4" />
                            <h3 className="text-lg font-medium text-zinc-200 mb-2">
                                Upscaling {modelName}... {progress}%
                            </h3>
                            <p className="text-zinc-500 text-sm">Processing time is dependent on your device.</p>
                            <div className="w-full max-w-md mx-auto h-1 bg-zinc-800 rounded-full mt-6 overflow-hidden">
                                <div
                                    className="h-full bg-accent-500 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Result & Comparison */}
                    {upscaledImage && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-lg font-medium text-zinc-200">Result Comparison</h3>

                                    {/* Zoom Controls */}
                                    <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                                        <button
                                            onClick={() => handleZoom(-0.5)}
                                            disabled={zoomLevel <= 1}
                                            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                                        >
                                            <ZoomOutIcon className="w-4 h-4" />
                                        </button>
                                        <span className="text-xs font-mono w-10 text-center text-zinc-300">{zoomLevel}x</span>
                                        <button
                                            onClick={() => handleZoom(0.5)}
                                            disabled={zoomLevel >= 3}
                                            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                                        >
                                            <ZoomInIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleDownload}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    <DownloadIcon className="w-4 h-4" /> Download Upscaled
                                </button>
                            </div>

                            {/* Slider Comparison Wrapper */}
                            <div className="overflow-auto max-h-[70vh] border border-zinc-800 rounded-xl bg-zinc-950">
                                <div
                                    className="relative transition-all duration-200 ease-out origin-top-left"
                                    style={{
                                        width: `${zoomLevel * 100}%`,
                                        // We need to maintain aspect ratio logic manually if we break out of aspect-video?
                                        // No, keeping aspect-video on the inner div works well enough for landscape
                                        // But for consistency:
                                    }}
                                >
                                    <div className="relative w-full aspect-video group select-none">
                                        <div className="absolute inset-0 w-full h-full">
                                            {/* Background: Original Image */}
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={image.previewUrl}
                                                alt="Original"
                                                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                                            />

                                            {/* Foreground: Upscaled Image */}
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={upscaledImage.url}
                                                alt="Upscaled"
                                                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                                                style={{
                                                    clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` // Clip from right
                                                }}
                                            />
                                        </div>

                                        {/* Slider Handle */}
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={sliderPosition}
                                            onChange={(e) => setSliderPosition(Number(e.target.value))}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                                        />

                                        {/* Visual Handle Line */}
                                        <div
                                            className="absolute top-0 bottom-0 w-0.5 bg-white z-10 pointer-events-none shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                                            style={{ left: `${sliderPosition}%` }}
                                        >
                                            <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center text-zinc-900 shadow-lg border border-zinc-200 scalar-handle">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="m15 18-6-6 6-6" />
                                                    <path d="m9 18 6-6-6-6" />
                                                </svg>
                                            </div>

                                            {/* Tooltip Labels - Hide when zoomed in to avoid clutter? Or keep? Keep. */}
                                            {zoomLevel === 1 && (
                                                <>
                                                    <div className="absolute top-4 right-2 bg-accent-500/90 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm whitespace-nowrap">
                                                        Upscaled
                                                    </div>
                                                    <div className="absolute top-4 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm whitespace-nowrap">
                                                        Original
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="text-center">
                                <button
                                    onClick={() => setUpscaledImage(null)}
                                    className="text-sm text-zinc-500 hover:text-zinc-300 underline"
                                >
                                    Upscale another image
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
