'use client';

import { clsx } from 'clsx';

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressBar({
  progress,
  label,
  showPercentage = true,
  className,
  size = 'md',
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={clsx('w-full', className)}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <span className="text-sm text-zinc-400 font-medium">{label}</span>
          )}
          {showPercentage && (
            <span className="text-sm text-zinc-500 font-mono">
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}
      <div
        className={clsx(
          'w-full bg-zinc-800 rounded-full overflow-hidden',
          sizeClasses[size]
        )}
        role="progressbar"
        aria-valuenow={clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
      >
        <div
          className={clsx(
            'h-full bg-gradient-to-r from-accent-500 to-accent-400 transition-all duration-300 ease-out rounded-full',
            clampedProgress === 100 && 'from-green-500 to-green-400'
          )}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}
