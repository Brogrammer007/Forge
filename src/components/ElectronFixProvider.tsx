'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Type declaration for Next.js window object
declare global {
  interface Window {
    next?: any;
  }
}

/**
 * WOZNIAK MODE: Fix for Electron + Next.js issues
 * This ensures that Next.js router works properly in Electron environment
 */
export function ElectronFixProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Check if we're in Electron
    if (typeof window !== 'undefined' && window.electronAPI) {
      // WOZNIAK MODE: Detect macOS
      const isMacOS = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      console.log(`[WOZNIAK FIX] Route changed to: ${pathname}`);
      console.log(`[WOZNIAK FIX] Platform: ${navigator.platform}, macOS: ${isMacOS}`);
      console.log('[WOZNIAK FIX] Electron environment detected');
      
      // macOS specific aggressive fixes
      if (isMacOS) {
        // Force enable all interactions immediately
        document.body.style.setProperty('-webkit-user-select', 'auto', 'important');
        document.body.style.setProperty('-webkit-touch-callout', 'default', 'important');
        document.documentElement.style.setProperty('-webkit-user-select', 'auto', 'important');
        
        // Remove any webkit-specific blocking
        const allElements = document.querySelectorAll('*');
        allElements.forEach((el) => {
          const element = el as HTMLElement;
          const computedStyle = window.getComputedStyle(element);
          if (computedStyle.webkitUserSelect === 'none') {
            element.style.setProperty('-webkit-user-select', 'auto', 'important');
          }
          if (computedStyle.pointerEvents === 'none') {
            element.style.pointerEvents = 'auto';
          }
          // Ensure touch-action is enabled
          if (computedStyle.touchAction === 'none') {
            element.style.touchAction = 'auto';
          }
        });
        
        console.log(`[WOZNIAK FIX] Fixed ${allElements.length} elements for macOS`);
      }
      
      // Ensure Next.js router is initialized
      const checkRouter = () => {
        if (typeof window !== 'undefined') {
          // Check if Next.js router is available
          const hasNextRouter = typeof window.next !== 'undefined';
          
          if (!hasNextRouter) {
            console.warn('[WOZNIAK FIX] Next.js router not found');
            // Try to force router initialization
            if (typeof window.next === 'undefined') {
              console.warn('[WOZNIAK FIX] Router still not found after delay');
            }
          } else {
            console.log('[WOZNIAK FIX] Next.js router is available');
          }

          // Check if CSS is loaded
          const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
          console.log(`[WOZNIAK FIX] Found ${stylesheets.length} stylesheets`);
          
          // Check if JavaScript is loaded
          const scripts = document.querySelectorAll('script[src]');
          console.log(`[WOZNIAK FIX] Found ${scripts.length} script tags with src`);
          
          // Check for Next.js scripts
          const nextScripts = Array.from(scripts).filter((script: any) => 
            script.src && script.src.includes('_next/static')
          );
          console.log(`[WOZNIAK FIX] Found ${nextScripts.length} Next.js scripts`);
        }
      };

      // Check immediately
      checkRouter();

      // Also check after delays
      setTimeout(checkRouter, 500);
      setTimeout(checkRouter, 2000);
      setTimeout(checkRouter, 5000);

      // WOZNIAK MODE: Aggressive fix for click and scroll issues - MUST WORK WITHOUT DEVTOOLS
      const fixInteractivity = () => {
        // WOZNIAK MODE: Force enable all interactions - this must work even without DevTools
        document.body.style.setProperty('pointer-events', 'auto', 'important');
        document.body.style.setProperty('-webkit-user-select', 'auto', 'important');
        document.body.style.setProperty('overflow', 'auto', 'important');
        document.body.style.setProperty('overflow-y', 'auto', 'important');
        document.documentElement.style.setProperty('pointer-events', 'auto', 'important');
        document.documentElement.style.setProperty('-webkit-user-select', 'auto', 'important');
        document.documentElement.style.setProperty('overflow', 'auto', 'important');
        document.documentElement.style.setProperty('overflow-y', 'auto', 'important');
        
        // Remove any overlays that might block clicks
        const overlays = document.querySelectorAll('[style*="pointer-events: none"], [style*="pointer-events:none"]');
        overlays.forEach((overlay) => {
          (overlay as HTMLElement).style.pointerEvents = 'auto';
        });
        if (overlays.length > 0) {
          console.log(`[WOZNIAK FIX] Removed ${overlays.length} blocking overlays`);
        }

        // CRITICAL: Fix Next.js Link components - they might not have event handlers
        const links = document.querySelectorAll('a[href]');
        links.forEach((link) => {
          const el = link as HTMLElement;
          el.style.setProperty('pointer-events', 'auto', 'important');
          el.style.setProperty('cursor', 'pointer', 'important');
          el.style.setProperty('-webkit-user-select', 'auto', 'important');
          el.style.zIndex = 'auto';
          
          // WOZNIAK MODE: Add direct click handler as fallback for Next.js Link
          // This ensures clicks work even if Next.js router fails
          const href = el.getAttribute('href');
          if (href && href.startsWith('/') && !el.hasAttribute('data-wozniak-fixed')) {
            el.setAttribute('data-wozniak-fixed', 'true');
            el.addEventListener('click', (e) => {
              // Only handle if Next.js router didn't handle it
              const target = e.currentTarget as HTMLAnchorElement;
              const targetHref = target.getAttribute('href');
              if (targetHref && targetHref.startsWith('/')) {
                // Small delay to check if navigation happened
                setTimeout(() => {
                  if (window.location.pathname !== targetHref) {
                    console.log(`[WOZNIAK FIX] Next.js router failed, using direct navigation to ${targetHref}`);
                    window.location.href = targetHref;
                  }
                }, 100);
              }
            }, { capture: true });
          }
        });
        console.log(`[WOZNIAK FIX] Fixed ${links.length} links`);
        
        // Fix all clickable elements
        const clickableElements = document.querySelectorAll('[role="button"], button, [onclick], .card, .card-hover, .nav-link, input, select, textarea');
        clickableElements.forEach((el) => {
          const element = el as HTMLElement;
          element.style.pointerEvents = 'auto';
          element.style.cursor = element.tagName === 'BUTTON' || element.getAttribute('role') === 'button' ? 'pointer' : 'default';
          element.style.userSelect = 'auto';
        });
        console.log(`[WOZNIAK FIX] Fixed ${clickableElements.length} clickable elements`);

        // Fix main content area - CRITICAL for editor functionality
        const main = document.querySelector('main');
        if (main) {
          (main as HTMLElement).style.pointerEvents = 'auto';
          (main as HTMLElement).style.overflow = 'auto';
          (main as HTMLElement).style.overflowY = 'auto';
          // Ensure all children are interactive
          const mainChildren = main.querySelectorAll('*');
          mainChildren.forEach((child) => {
            const childEl = child as HTMLElement;
            if (childEl.style.pointerEvents === 'none') {
              childEl.style.pointerEvents = 'auto';
            }
          });
        }

        // Fix sidebar - ensure navigation works
        const sidebar = document.querySelector('aside');
        if (sidebar) {
          (sidebar as HTMLElement).style.pointerEvents = 'auto';
          const sidebarLinks = sidebar.querySelectorAll('a[href]');
          sidebarLinks.forEach((link) => {
            (link as HTMLElement).style.pointerEvents = 'auto';
            (link as HTMLElement).style.cursor = 'pointer';
          });
        }

        // Fix body and html scroll
        document.body.style.overflow = 'auto';
        document.body.style.overflowY = 'auto';
        document.body.style.overflowX = 'auto';
        document.body.style.pointerEvents = 'auto';
        document.body.style.userSelect = 'auto';
        document.documentElement.style.overflow = 'auto';
        document.documentElement.style.overflowY = 'auto';
        document.documentElement.style.overflowX = 'auto';
        document.documentElement.style.pointerEvents = 'auto';

        // Remove any fixed positioning that might block
        const fixedElements = document.querySelectorAll('[style*="position: fixed"], [style*="position:fixed"]');
        fixedElements.forEach((el) => {
          const element = el as HTMLElement;
          // Only fix if it's blocking (check z-index)
          const zIndex = parseInt(element.style.zIndex || '0');
          if (zIndex > 1000 && element.offsetWidth === window.innerWidth && element.offsetHeight === window.innerHeight) {
            console.log(`[WOZNIAK FIX] Found potentially blocking fixed element: ${element.tagName}`);
            element.style.pointerEvents = 'none';
            // Make children clickable
            const children = element.querySelectorAll('*');
            children.forEach((child) => {
              (child as HTMLElement).style.pointerEvents = 'auto';
            });
          }
        });
      };

      // Fix immediately and repeatedly
      fixInteractivity();
      setTimeout(fixInteractivity, 100);
      setTimeout(fixInteractivity, 500);
      setTimeout(fixInteractivity, 1000);
      setTimeout(fixInteractivity, 2000);
      setTimeout(fixInteractivity, 3000);
      
      // WOZNIAK MODE: Interval fix - runs every 2 seconds (not 500ms to prevent freezing)
      const fixInterval = setInterval(() => {
        fixInteractivity();
      }, 2000);
      
      // Also fix on any DOM changes - CRITICAL for navigation
      // WOZNIAK MODE: Only observe childList, NOT attributes (prevents infinite loop!)
      let isFixing = false;
      const observer = new MutationObserver(() => {
        if (!isFixing) {
          isFixing = true;
          fixInteractivity();
          setTimeout(() => { isFixing = false; }, 100);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true }); // NO attributes!
      
      // Fix on route changes
      const originalPushState = history.pushState;
      history.pushState = function(...args) {
        originalPushState.apply(history, args);
        setTimeout(fixInteractivity, 100);
      };
      
      const handlePopstate = () => {
        setTimeout(fixInteractivity, 100);
      };
      window.addEventListener('popstate', handlePopstate);
      
      // WOZNIAK MODE: Listen for manual fix triggers (e.g., from Electron main process)
      const handleFixTrigger = () => {
        console.log('[WOZNIAK FIX] Manual fix trigger received');
        fixInteractivity();
      };
      window.addEventListener('wozniak-fix-trigger', handleFixTrigger);
      
      // Fix for images not loading
      const fixImages = () => {
        const images = document.querySelectorAll('img[src]');
        images.forEach((img) => {
          const imgElement = img as HTMLImageElement;
          if (!imgElement.complete || imgElement.naturalHeight === 0) {
            // Force reload if image failed to load
            const src = imgElement.src;
            imgElement.src = '';
            setTimeout(() => {
              imgElement.src = src;
            }, 100);
          }
        });
        console.log(`[WOZNIAK FIX] Checked ${images.length} images`);
      };
      
      setTimeout(fixImages, 500);
      setTimeout(fixImages, 2000);
      
      // WOZNIAK MODE: Cleanup function
      return () => {
        clearInterval(fixInterval);
        observer.disconnect();
        window.removeEventListener('popstate', handlePopstate);
        window.removeEventListener('wozniak-fix-trigger', handleFixTrigger);
      };
    }
    
    // Return undefined for non-Electron environments
    return undefined;
  }, [pathname, router]);

  return <>{children}</>;
}

