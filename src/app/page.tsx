import Link from 'next/link';
import Image from 'next/image';
import { ArrowRightIcon, ImageIcon, SparklesIcon, GridIcon, FilmIcon, EditIcon, MaximizeIcon } from '@/components/ui/Icons';

const mainTools = [
  {
    title: 'Image Converter',
    description: 'Convert between common formats with batch processing support.',
    href: '/converter',
    icon: ImageIcon,
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    title: 'Image Editor',
    description: 'Crop, rotate, adjust colors, remove backgrounds with AI, and apply filters with live preview.',
    href: '/image-editor',
    icon: EditIcon,
    gradient: 'from-violet-500 to-purple-500',
  },
  {
    title: 'Vectorizer',
    description: 'Convert raster images into scalable vectors for logos.',
    href: '/vectorizer',
    icon: SparklesIcon,
    gradient: 'from-pink-500 to-rose-500',
  },
  {
    title: 'AI Upscaler',
    description: 'Increase resolution up to 4x with AI-powered sharpening.',
    href: '/upscaler',
    icon: MaximizeIcon,
    gradient: 'from-indigo-500 to-cyan-500',
  },
];

const additionalTools = [
  {
    title: 'Grid Builder',
    description: 'Compose image grids and collages easily.',
    href: '/grid-builder',
    icon: GridIcon,
    gradient: 'from-orange-500 to-amber-500',
  },
  {
    title: 'Video to GIF',
    description: 'Turn video clips into optimized GIFs.',
    href: '/gif-converter',
    icon: FilmIcon,
    gradient: 'from-green-500 to-teal-500',
  },
];

export default function Home() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-12 pt-8">
        {/* Main Logo with "Steve Jobs" minimalist placement */}
        <div className="relative inline-block group mb-6">
          <div className="absolute inset-0 bg-accent-500/40 blur-[40px] rounded-full opacity-30 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="absolute inset-0 bg-gradient-to-tr from-accent-500/20 to-transparent rounded-2xl blur-xl animate-pulse-soft" />
          <Image
            src="/logo.png"
            alt="Forge Logo"
            width={120}
            height={120}
            className="relative z-10 w-24 h-24 object-contain drop-shadow-2xl rounded-2xl"
            priority
          />
        </div>

        <h1 className="text-5xl lg:text-7xl font-bold mb-4 tracking-tight">
          <span className="text-gradient bg-clip-text text-transparent bg-gradient-to-br from-white via-zinc-200 to-zinc-500">Forge</span>
        </h1>
        <p className="text-lg text-zinc-400 max-w-xl mx-auto">
          Convert, edit, upscale, vectorize, and compose images with AI-powered tools.
          <br />
          <span className="text-zinc-500">100% local processing. No data leaves your device.</span>
        </p>

        {/* Download Buttons */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-3 mb-8 mt-10">
          {/* Windows Download */}
          <a
            href="https://www.mediafire.com/file/4dzrrcs84eo6i1e/Forge-v1.0.1.zip/file"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-zinc-800 to-zinc-900 border border-zinc-700 text-zinc-100 rounded-full text-sm font-medium overflow-hidden transition-all duration-300 hover:scale-105 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/20"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
            {/* Windows Logo */}
            <svg className="w-4 h-4 text-blue-400 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
            </svg>
            <span className="relative">Download for Windows</span>
          </a>
          
          {/* macOS Download */}
          <a
            href="https://www.mediafire.com/file/2xq4fye6ka7678w/Forge-macOS-v1.0.1.zip/file"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-zinc-800 to-zinc-900 border border-zinc-700 text-zinc-100 rounded-full text-sm font-medium overflow-hidden transition-all duration-300 hover:scale-105 hover:border-zinc-400/50 hover:shadow-lg hover:shadow-zinc-400/20"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
            {/* Apple Logo */}
            <svg className="w-4 h-4 text-zinc-300 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <span className="relative">Download for macOS</span>
          </a>
        </div>
      </div>

      {/* Main Tools - 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {mainTools.map((feature, index) => (
          <Link
            key={feature.href}
            href={feature.href}
            scroll={true}
            className="group card p-4 card-hover animate-fade-in"
            style={{ animationDelay: `${index * 80}ms`, willChange: 'auto' }}
          >
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${feature.gradient} p-0.5 mb-2`}>
              <div className="w-full h-full bg-zinc-900 rounded-[6px] flex items-center justify-center">
                <feature.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <h2 className="text-base font-semibold text-zinc-100 mb-1 group-hover:text-accent-400 transition-colors duration-150">
              {feature.title}
            </h2>
            <p className="text-zinc-500 text-sm leading-relaxed mb-2">
              {feature.description}
            </p>
            <div className="flex items-center gap-1.5 text-accent-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <span>Open</span>
              <ArrowRightIcon className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
            </div>
          </Link>
        ))}
      </div>

      {/* Additional Tools - 2 columns centered */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mb-10">
        {additionalTools.map((feature, index) => (
          <Link
            key={feature.href}
            href={feature.href}
            scroll={true}
            className="group card p-4 card-hover animate-fade-in flex items-center gap-4"
            style={{ animationDelay: `${(index + 3) * 80}ms`, willChange: 'auto' }}
          >
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${feature.gradient} p-0.5 flex-shrink-0`}>
              <div className="w-full h-full bg-zinc-900 rounded-[6px] flex items-center justify-center">
                <feature.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-zinc-100 group-hover:text-accent-400 transition-colors duration-150">
                {feature.title}
              </h2>
              <p className="text-zinc-500 text-sm truncate">
                {feature.description}
              </p>
            </div>
            <ArrowRightIcon className="w-4 h-4 text-zinc-600 group-hover:text-accent-400 group-hover:translate-x-0.5 transition-all duration-150 flex-shrink-0" />
          </Link>
        ))}
      </div>

      {/* Stats - more compact */}
      <div className="card p-5 bg-zinc-900/50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: '6', label: 'Tools' },
            { value: '100%', label: 'Local' },
            { value: '∞', label: 'Batch Size' },
            { value: '0', label: 'Cloud Deps' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-accent-400">{stat.value}</div>
              <div className="text-xs text-zinc-600">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Copyright Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-zinc-500">
          Copyright © 2025 Vuk. All rights reserved.
        </p>
      </div>
    </div>
  );
}

