'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { memo } from 'react';
import { clsx } from 'clsx';
import { HomeIcon, ImageIcon, SparklesIcon, GridIcon, FilmIcon, EditIcon, MaximizeIcon } from '@/components/ui/Icons';

// Type declaration for Electron API
declare global {
  interface Window {
    electronAPI?: {
      getAppVersion: () => Promise<string>;
      getPlatform: () => Promise<NodeJS.Platform>;
      isElectron: boolean;
    };
  }
}

const navItems = [
  { href: '/', label: 'Dashboard', icon: HomeIcon },
  { href: '/converter', label: 'Image Converter', icon: ImageIcon },
  { href: '/upscaler', label: 'AI Upscaler', icon: MaximizeIcon },
  { href: '/image-editor', label: 'Image Editor', icon: EditIcon },
  { href: '/vectorizer', label: 'Vectorizer', icon: SparklesIcon },
  { href: '/grid-builder', label: 'Grid Builder', icon: GridIcon },
  { href: '/gif-converter', label: 'Video to GIF', icon: FilmIcon },
];

export const Sidebar = memo(function Sidebar() {
  const pathname = usePathname();
  const [appVersion, setAppVersion] = useState<string>('1.0.1');

  useEffect(() => {
    // Try to get version from Electron API, fallback to default
    if (typeof window !== 'undefined' && window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then(setAppVersion).catch(() => {
        // Fallback to default if Electron API fails
        setAppVersion('1.0.1');
      });
    }
  }, []);

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-zinc-800">
        <Link href="/" prefetch={true} scroll={true} className="flex items-center gap-3">
          <div className="relative group w-10 h-10 flex-shrink-0">
            <div className="absolute inset-0 bg-accent-500/20 blur-md rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <Image
              src="/logo.png"
              alt="Forge"
              width={40}
              height={40}
              className="relative z-10 w-10 h-10 object-contain rounded-lg drop-shadow-lg"
            />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-100">Forge</h1>
            <p className="text-xs text-zinc-500">Design Utility</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">© 2025 Vuk</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              scroll={true}
              aria-current={isActive ? 'page' : undefined}
              className={clsx(
                'nav-link',
                isActive && 'nav-link-active'
              )}
              style={{ willChange: 'auto' }}
            >
              <item.icon className="w-5 h-5" aria-hidden="true" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-800">
        <div className="card p-3 text-center">
          <p className="text-xs text-zinc-500">
            All processing is done locally
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            v{appVersion}
          </p>
          <p className="text-xs text-zinc-500 mt-2 pt-2 border-t border-zinc-800/50">
            Copyright © 2025 Vuk
            <br />
            <span className="text-zinc-600">All rights reserved.</span>
          </p>
        </div>
      </div>
    </aside>
  );
});

