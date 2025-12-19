'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { clsx } from 'clsx';
import {
  UploadIcon,
  LoaderIcon,
  DownloadIcon,
  PlayIcon,
  PauseIcon,
  XIcon,
} from './ui/Icons';
import { formatFileSize, downloadBlob, validateFileSize, FILE_SIZE_LIMITS } from '@/lib/utils';
import { showToast } from './ui/Toast';

// Resolution presets
const RESOLUTION_PRESETS = [
  { label: 'Original', value: null },
  { label: '480px', value: 480 },
  { label: '360px', value: 360 },
  { label: '240px', value: 240 },
  { label: '160px', value: 160 },
];

// FPS presets
const FPS_PRESETS = [
  { label: '30', value: 30 },
  { label: '24', value: 24 },
  { label: '15', value: 15 },
  { label: '10', value: 10 },
  { label: '5', value: 5 },
];

interface VideoFile {
  file: File;
  name: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  previewUrl: string;
}

export function GifConverter() {
  const [video, setVideo] = useState<VideoFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [gifSize, setGifSize] = useState<number>(0);
  
  // Settings
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [outputWidth, setOutputWidth] = useState<number | null>(null);
  const [fps, setFps] = useState(15);
  
  // Video playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

  // Load FFmpeg on mount
  useEffect(() => {
    let mounted = true;
    
    const loadFfmpeg = async () => {
      try {
        const ffmpeg = new FFmpeg();
        
        ffmpeg.on('progress', ({ progress }) => {
          if (mounted) {
            setProgress(Math.round(progress * 100));
          }
        });

        // Load FFmpeg from local files served by Next.js
        // These files are in the public/ffmpeg folder
        await ffmpeg.load({
          coreURL: '/ffmpeg/ffmpeg-core.js',
          wasmURL: '/ffmpeg/ffmpeg-core.wasm',
        });
        
        if (mounted) {
          ffmpegRef.current = ffmpeg;
          setFfmpegLoaded(true);
        } else {
          // Component unmounted during loading, terminate FFmpeg
          ffmpeg.terminate();
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = 'Failed to load video processor. Please try refreshing the page or check browser compatibility.';
          setError(errorMessage);
          showToast(errorMessage, 'error');
        }
      }
    };

    loadFfmpeg();
    
    return () => {
      mounted = false;
      if (ffmpegRef.current) {
        ffmpegRef.current.terminate();
        ffmpegRef.current = null;
      }
    };
  }, []);

  // Handle video file drop/select
  const handleVideoFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('video/')) {
      showToast('Please select a video file', 'error');
      return;
    }

    // Validate file size
    const validation = validateFileSize(file, FILE_SIZE_LIMITS.VIDEO, 'video');
    if (!validation.valid) {
      showToast(validation.error ?? 'File is too large', 'error');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGifUrl(null);

    try {
      const url = URL.createObjectURL(file);
      
      // Get video metadata using a temporary video element
      const metadata = await new Promise<{ duration: number; width: number; height: number }>((resolve, reject) => {
        const tempVideo = document.createElement('video');
        tempVideo.preload = 'metadata';
        tempVideo.onloadedmetadata = () => {
          resolve({
            duration: tempVideo.duration,
            width: tempVideo.videoWidth,
            height: tempVideo.videoHeight,
          });
          URL.revokeObjectURL(tempVideo.src);
        };
        tempVideo.onerror = () => reject(new Error('Failed to load video metadata'));
        tempVideo.src = url;
      });

      // Revoke old preview URL
      if (video?.previewUrl) {
        URL.revokeObjectURL(video.previewUrl);
      }

      const newVideo: VideoFile = {
        file,
        name: file.name,
        size: file.size,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        previewUrl: URL.createObjectURL(file),
      };

      setVideo(newVideo);
      setStartTime(0);
      setEndTime(Math.min(metadata.duration, 10)); // Default max 10 seconds
      setCurrentTime(0);
      
    } catch (err) {
      const errorMessage = 'Failed to load video. Please try another file.';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [video]);

  // Handle file input change
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleVideoFile(file);
  }, [handleVideoFile]);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleVideoFile(file);
  }, [handleVideoFile]);

  // Video playback controls
  const togglePlayback = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Update current time from video
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  // Seek video
  const seekTo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  // Convert video to GIF
  const convertToGif = useCallback(async () => {
    if (!video || !ffmpegRef.current || !ffmpegLoaded) return;

    setIsConverting(true);
    setProgress(0);
    setError(null);
    setGifUrl(null);

    try {
      const ffmpeg = ffmpegRef.current;
      
      // Write input file
      const inputFileName = 'input' + video.name.substring(video.name.lastIndexOf('.'));
      await ffmpeg.writeFile(inputFileName, await fetchFile(video.file));

      // Calculate output dimensions
      let scaleFilter = '';
      if (outputWidth) {
        scaleFilter = `scale=${outputWidth}:-1:flags=lanczos`;
      } else {
        scaleFilter = 'scale=iw:-1:flags=lanczos';
      }

      // Build FFmpeg command
      const duration = endTime - startTime;
      
      // Create palette for better quality
      await ffmpeg.exec([
        '-ss', startTime.toString(),
        '-t', duration.toString(),
        '-i', inputFileName,
        '-vf', `${scaleFilter},fps=${fps},palettegen=stats_mode=diff`,
        '-y', 'palette.png'
      ]);

      // Create GIF using palette
      await ffmpeg.exec([
        '-ss', startTime.toString(),
        '-t', duration.toString(),
        '-i', inputFileName,
        '-i', 'palette.png',
        '-lavfi', `${scaleFilter},fps=${fps} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
        '-y', 'output.gif'
      ]);

      // Read output file
      const data = await ffmpeg.readFile('output.gif');
      // Create blob from the data - use type assertion for TypeScript compatibility
      const blob = new Blob([new Uint8Array(data as unknown as ArrayBuffer)], { type: 'image/gif' });
      
      // Revoke old GIF URL
      if (gifUrl) {
        URL.revokeObjectURL(gifUrl);
      }
      
      setGifUrl(URL.createObjectURL(blob));
      setGifSize(blob.size);

      // Cleanup
      await ffmpeg.deleteFile(inputFileName);
      await ffmpeg.deleteFile('palette.png');
      await ffmpeg.deleteFile('output.gif');

    } catch (err) {
      const errorMessage = 'Failed to convert video. Please try different settings.';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsConverting(false);
      setProgress(0);
    }
  }, [video, ffmpegLoaded, startTime, endTime, outputWidth, fps, gifUrl]);

  // Download GIF
  const downloadGif = useCallback(() => {
    if (!gifUrl || !video) return;
    
    fetch(gifUrl)
      .then(res => res.blob())
      .then(blob => {
        const filename = video.name.replace(/\.[^/.]+$/, '') + '.gif';
        downloadBlob(blob, filename);
      });
  }, [gifUrl, video]);

  // Clear video
  const clearVideo = useCallback(() => {
    if (video?.previewUrl) URL.revokeObjectURL(video.previewUrl);
    if (gifUrl) URL.revokeObjectURL(gifUrl);
    setVideo(null);
    setGifUrl(null);
    setGifSize(0);
    setError(null);
  }, [video, gifUrl]);

  // Format time as mm:ss.ms
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="space-y-6">
      {/* FFmpeg Loading */}
      {!ffmpegLoaded && !error && (
        <div className="card p-8 text-center">
          <LoaderIcon className="w-8 h-8 text-accent-500 mx-auto mb-3" />
          <p className="text-zinc-400">Loading video processor...</p>
          <p className="text-xs text-zinc-600 mt-1">This may take a few seconds on first load</p>
        </div>
      )}

      {/* Upload Area */}
      {ffmpegLoaded && !video && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="card p-12 border-2 border-dashed border-zinc-700 hover:border-accent-500/50 transition-colors cursor-pointer"
        >
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
            id="video-upload"
          />
          <label htmlFor="video-upload" className="cursor-pointer block text-center">
            <UploadIcon className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-300 mb-2">
              Drop video here or click to browse
            </h3>
            <p className="text-zinc-500 text-sm">
              MP4, WebM, MOV, AVI • Max recommended: 100MB
            </p>
          </label>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="card p-8 text-center">
          <LoaderIcon className="w-8 h-8 text-accent-500 mx-auto mb-3" />
          <p className="text-zinc-400">Loading video...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card p-4 border-red-500/30 bg-red-500/5">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Video Loaded */}
      {video && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Video Preview & Controls */}
          <div className="xl:col-span-2 space-y-4">
            {/* Video Preview */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium text-zinc-200 truncate" title={video.name}>
                    {video.name}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {video.width}×{video.height} • {formatTime(video.duration)} • {formatFileSize(video.size)}
                  </p>
                </div>
                <button
                  onClick={clearVideo}
                  className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  src={video.previewUrl}
                  className="w-full max-h-[400px] object-contain"
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                />
                
                {/* Play/Pause Overlay */}
                <button
                  onClick={togglePlayback}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
                >
                  {isPlaying ? (
                    <PauseIcon className="w-16 h-16 text-white/80" />
                  ) : (
                    <PlayIcon className="w-16 h-16 text-white/80" />
                  )}
                </button>
              </div>

              {/* Timeline */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>{formatTime(currentTime)}</span>
                  <div className="flex-1 relative h-2 bg-zinc-800 rounded-full overflow-hidden">
                    {/* Trim range indicator */}
                    <div 
                      className="absolute h-full bg-accent-500/30"
                      style={{
                        left: `${(startTime / video.duration) * 100}%`,
                        width: `${((endTime - startTime) / video.duration) * 100}%`
                      }}
                    />
                    {/* Current position */}
                    <div 
                      className="absolute h-full w-1 bg-white rounded"
                      style={{ left: `${(currentTime / video.duration) * 100}%` }}
                    />
                  </div>
                  <span>{formatTime(video.duration)}</span>
                </div>
              </div>
            </div>

            {/* GIF Preview */}
            {gifUrl && (
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-zinc-200">Generated GIF</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-zinc-500">{formatFileSize(gifSize)}</span>
                    <button
                      onClick={downloadGif}
                      className="btn-primary text-sm flex items-center gap-2"
                    >
                      <DownloadIcon className="w-4 h-4" />
                      Download GIF
                    </button>
                  </div>
                </div>
                <div className="bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={gifUrl} 
                    alt="Generated GIF" 
                    className="max-w-full max-h-[400px] rounded"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Settings */}
          <div className="space-y-4">
            {/* Trim Settings */}
            <div className="card p-4 space-y-4">
              <h3 className="font-medium text-zinc-200 flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-accent-500/20 flex items-center justify-center text-xs">✂️</span>
                Trim
              </h3>

              <div>
                <label className="label">
                  Start: {formatTime(startTime)}
                </label>
                <input
                  type="range"
                  min="0"
                  max={video.duration}
                  step="0.1"
                  value={startTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setStartTime(val);
                    if (val >= endTime) setEndTime(Math.min(val + 0.5, video.duration));
                    seekTo(val);
                  }}
                  className="w-full accent-accent-500"
                />
              </div>

              <div>
                <label className="label">
                  End: {formatTime(endTime)}
                </label>
                <input
                  type="range"
                  min="0"
                  max={video.duration}
                  step="0.1"
                  value={endTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setEndTime(val);
                    if (val <= startTime) setStartTime(Math.max(val - 0.5, 0));
                    seekTo(val);
                  }}
                  className="w-full accent-accent-500"
                />
              </div>

              <div className="pt-2 border-t border-zinc-800">
                <p className="text-sm text-zinc-400">
                  Duration: <span className="text-accent-400 font-medium">{formatTime(endTime - startTime)}</span>
                </p>
                {(endTime - startTime) > 15 && (
                  <p className="text-xs text-orange-400 mt-1">
                    ⚠️ Long clips create large GIFs. Consider trimming more.
                  </p>
                )}
              </div>
            </div>

            {/* Output Settings */}
            <div className="card p-4 space-y-4">
              <h3 className="font-medium text-zinc-200 flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-accent-500/20 flex items-center justify-center text-xs">⚙️</span>
                Output Settings
              </h3>

              {/* Resolution */}
              <div>
                <label className="label">Width</label>
                <div className="flex flex-wrap gap-2">
                  {RESOLUTION_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setOutputWidth(preset.value)}
                      className={clsx(
                        'px-3 py-1.5 text-xs rounded-lg font-medium transition-all',
                        outputWidth === preset.value
                          ? 'bg-accent-500 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* FPS */}
              <div>
                <label className="label">Frame Rate (FPS)</label>
                <div className="flex flex-wrap gap-2">
                  {FPS_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setFps(preset.value)}
                      className={clsx(
                        'px-3 py-1.5 text-xs rounded-lg font-medium transition-all',
                        fps === preset.value
                          ? 'bg-accent-500 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-600 mt-2">
                  Lower FPS = smaller file size
                </p>
              </div>
            </div>

            {/* Convert Button */}
            <button
              onClick={convertToGif}
              disabled={isConverting || !ffmpegLoaded}
              className={clsx(
                'w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
                isConverting
                  ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-accent-500 to-teal-500 text-white hover:opacity-90'
              )}
            >
              {isConverting ? (
                <>
                  <LoaderIcon className="w-5 h-5" />
                  Converting... {progress}%
                </>
              ) : (
                <>
                  🎬 Convert to GIF
                </>
              )}
            </button>

            {/* Progress Bar */}
            {isConverting && (
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-accent-500 to-teal-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {/* Tips */}
            <div className="card p-3 bg-zinc-900/50 border-zinc-800/50">
              <p className="text-xs text-zinc-500">
                <strong className="text-zinc-400">Tips:</strong> For smaller GIFs, use shorter clips, 
                lower resolution, and 10-15 FPS. All processing happens locally in your browser.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

