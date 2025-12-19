/**
 * WOZNIAK MODE: Fix for Electron + Next.js issues
 * This ensures that Next.js router works properly in Electron environment
 */

'use client';

import { useEffect } from 'react';

export function useElectronFix() {
  useEffect(() => {
    // Check if we're in Electron
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Force re-render if router is not initialized
      const checkRouter = () => {
        if (typeof window !== 'undefined') {
          // Check if Next.js router is available
          const hasNextRouter = typeof window.next !== 'undefined';
          
          if (!hasNextRouter) {
            console.warn('[WOZNIAK FIX] Next.js router not found, forcing page reload...');
            // Small delay to ensure everything is loaded
            setTimeout(() => {
              if (typeof window !== 'undefined' && typeof window.next === 'undefined') {
                console.warn('[WOZNIAK FIX] Router still not found, reloading page...');
                window.location.reload();
              }
            }, 1000);
          } else {
            console.log('[WOZNIAK FIX] Next.js router is available');
          }
        }
      };

      // Check immediately
      checkRouter();

      // Also check after a delay
      setTimeout(checkRouter, 500);
      setTimeout(checkRouter, 2000);
    }
  }, []);
}

