import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import path from 'path';
import { spawn, fork, ChildProcess } from 'child_process';
import fs from 'fs';

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('Application Error', `An error occurred: ${error.message}\n\n${error.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Rejection:', reason);
  dialog.showErrorBox('Application Error', `An unhandled rejection occurred: ${reason?.message || reason}`);
});

// Global logger
// fs imported at top level
const logFile = path.join(app.getPath('userData'), 'app-startup.log');
const log = (msg: string) => {
  try {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
  } catch (e) { /* ignore logging errors */ }
};
// Clear previous log on start
try { fs.writeFileSync(logFile, ''); } catch (e) { }

// Environment - WOZNIAK MODE: Only trust app.isPackaged, never environment variables!
// When packaged as exe, this MUST be false - no DevTools, no dev behavior
const isDev = !app.isPackaged;
let PORT = parseInt(process.env.PORT || '3000', 10);

let mainWindow: BrowserWindow | null = null;
let nextServerProcess: ChildProcess | null = null;

/**
 * Create the main application window
 */
function createWindow(): void {
  // WOZNIAK MODE: Detect macOS for platform-specific fixes
  const isMac = process.platform === 'darwin';
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Forge - © 2025 Vuk',
    backgroundColor: '#18181b',
    icon: path.join(__dirname, '../public/icon-new.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webgl: true,
      // Enable WebGPU support if available
      experimentalFeatures: true,
      // WOZNIAK MODE: Disable webSecurity for localhost to allow all resources to load
      // This is safe because we're only loading from localhost:3000
      webSecurity: false,
      // Allow loading local resources
      allowRunningInsecureContent: true,
      // WOZNIAK MODE: macOS specific fixes
      enableBlinkFeatures: 'CSSColorSchemeUARendering',
      // Disable spellcheck to avoid macOS-specific issues
      spellcheck: false,
      // Ensure smooth scrolling works on macOS
      enableWebSQL: false,
    },
    // WOZNIAK MODE: Use normal title bar on macOS to avoid interaction issues
    // hiddenInset can cause pointer-events problems on macOS
    titleBarStyle: isMac ? 'default' : 'hiddenInset',
    trafficLightPosition: isMac ? { x: 15, y: 15 } : undefined,
    show: false, // Don't show until ready
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // WOZNIAK MODE: Debug page load events
  mainWindow.webContents.on('did-finish-load', () => {
    const url = mainWindow?.webContents.getURL();
    log(`[PAGE LOADED] ${url}`);
    console.log(`[PAGE LOADED] ${url}`);
    
    // Check if JavaScript is executing
    mainWindow?.webContents.executeJavaScript(`
      console.log('[WOZNIAK DEBUG] JavaScript is executing!');
      console.log('[WOZNIAK DEBUG] window.location:', window.location.href);
      console.log('[WOZNIAK DEBUG] document.readyState:', document.readyState);
      console.log('[WOZNIAK DEBUG] typeof window.next:', typeof window.next);
      console.log('[WOZNIAK DEBUG] document.querySelectorAll("link[rel=stylesheet]").length:', document.querySelectorAll("link[rel=stylesheet]").length);
      console.log('[WOZNIAK DEBUG] document.querySelectorAll("script").length:', document.querySelectorAll("script").length);
    `).catch(err => {
      log(`[JS EXEC ERROR] ${err.message}`);
      console.error(`[JS EXEC ERROR] ${err.message}`);
    });
  });

  // WOZNIAK MODE: Debug DOM content loaded
  mainWindow.webContents.on('dom-ready', () => {
    log(`[DOM READY] ${mainWindow?.webContents.getURL()}`);
    console.log(`[DOM READY] ${mainWindow?.webContents.getURL()}`);
  });

  // Show window even if there's an error (for debugging)
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`[Electron] Failed to load: ${errorCode} - ${errorDescription}`);
    log(`[LOAD ERROR] ${errorCode}: ${errorDescription}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      // WOZNIAK MODE: Never open DevTools in production exe!
      // Users should never see inspect/DevTools - this is a standalone app
    }
  });

  // Log Network Requests - DETAILED LOGGING FOR DEBUGGING CSS ISSUES
  mainWindow.webContents.session.webRequest.onResponseStarted((details) => {
    if (details.url.includes('localhost') || details.url.includes('127.0.0.1')) {
      // Always log errors - CRITICAL for debugging CSS issues
      if (details.responseHeaders && details.statusCode >= 400) {
        log(`[NET ERROR] ${details.statusCode} ${details.url}`);
        console.error(`[NET ERROR] ${details.statusCode} ${details.url}`);

        // Special handling for CSS/JS errors
        if (details.url.includes('.css') || details.url.includes('_next/static')) {
          log(`[CRITICAL] Failed to load static asset: ${details.url}`);
          console.error(`[CRITICAL] Failed to load static asset: ${details.url}`);
        }

        if (!isDev && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('server-log', `[Error] ${details.url.split('/').pop()}`);
        }
      } else {
        // Log CSS files in production too for debugging
        if (details.url.includes('.css') || details.url.includes('_next/static/css')) {
          log(`[NET CSS] ${details.statusCode} ${details.url}`);
          console.log(`[NET CSS] ${details.statusCode} ${details.url}`);
        }
        // Log JS files too
        if (details.url.includes('.js') && !details.url.includes('node_modules') && details.url.includes('_next/static')) {
          log(`[NET JS] ${details.statusCode} ${details.url}`);
          console.log(`[NET JS] ${details.statusCode} ${details.url}`);
        }
      }
    }
  });

  // Also log failed requests
  mainWindow.webContents.session.webRequest.onErrorOccurred((details) => {
    if (details.url.includes('localhost') || details.url.includes('127.0.0.1')) {
      if (details.url.includes('.css') || details.url.includes('_next/static')) {
        log(`[NET ERROR] Request failed: ${details.error} - ${details.url}`);
        console.error(`[NET ERROR] Request failed: ${details.error} - ${details.url}`);
      }
    }
  });

  // Load the app/loading screen
  if (isDev) {
    // Development mode - load from Next.js dev server
    mainWindow.loadURL(`http://localhost:${PORT}`);
    // DevTools only in dev mode for debugging
    mainWindow.webContents.openDevTools();
  } else {
    // PRODUCTION MODE - Show loading screen first, then start server
    // WOZNIAK MODE: Never open DevTools in production!
    mainWindow.loadFile(path.join(__dirname, 'loading.html'));
    startNextServer();
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // WOZNIAK MODE: Disable DevTools in production - fixes work without it now
  if (!isDev) {
    // WOZNIAK MODE: Apply critical fixes after page loads (ONE TIME ONLY)
    // NOTE: React's ElectronFixProvider handles the continuous fixes
    mainWindow.webContents.once('did-finish-load', () => {
      log('[WOZNIAK FIX] Page finished loading, applying one-time critical fixes');
      
      // WOZNIAK MODE: Inject critical CSS fixes directly into the page
      mainWindow?.webContents.executeJavaScript(`
        (function() {
          console.log('[WOZNIAK FIX] Injecting one-time critical fixes from Electron');
          
          // Force enable all interactions - ONE TIME
          document.body.style.setProperty('pointer-events', 'auto', 'important');
          document.body.style.setProperty('-webkit-user-select', 'auto', 'important');
          document.body.style.setProperty('overflow', 'auto', 'important');
          document.body.style.setProperty('overflow-y', 'auto', 'important');
          document.documentElement.style.setProperty('pointer-events', 'auto', 'important');
          document.documentElement.style.setProperty('-webkit-user-select', 'auto', 'important');
          document.documentElement.style.setProperty('overflow', 'auto', 'important');
          document.documentElement.style.setProperty('overflow-y', 'auto', 'important');
          
          console.log('[WOZNIAK FIX] One-time fixes applied successfully');
        })();
      `).catch(err => {
        log(`[WOZNIAK FIX ERROR] ${err.message}`);
      });
    });
  }

  // Cleanup on close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Start the Next.js server in production mode
 */
async function startNextServer(): Promise<void> {
  // fs imported at top level
  const net = require('net');

  // Helper to check if port is in use
  const checkPort = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') resolve(true);
        else resolve(false);
      });
      server.once('listening', () => {
        server.close();
        resolve(false);
      });
      server.listen(port);
    });
  };

  // WOZNIAK MODE: Kill process on port if it exists
  const killProcessOnPort = async (port: number): Promise<void> => {
    // Check if port is in use first
    const isPortInUse = await checkPort(port);
    
    if (!isPortInUse) {
      return; // Port is free, nothing to do
    }
    
    log(`Port ${port} is in use, attempting to free it...`);
    
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      
      // macOS/Linux: Use lsof to find and kill process
      if (process.platform === 'darwin' || process.platform === 'linux') {
        exec(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, (error: any) => {
          if (error) {
            log(`Failed to kill process on port ${port}: ${error.message}`);
          } else {
            log(`Successfully freed port ${port}`);
          }
          // Wait a bit for port to be freed
          setTimeout(resolve, 500);
        });
      } else {
        // Windows: Use netstat and taskkill
        exec(`netstat -ano | findstr :${port}`, (error: any, stdout: string) => {
          if (stdout) {
            const lines = stdout.trim().split('\n');
            const pids = new Set<string>();
            lines.forEach((line) => {
              const parts = line.trim().split(/\s+/);
              if (parts.length > 0) {
                const pid = parts[parts.length - 1];
                if (pid && pid !== '0') pids.add(pid);
              }
            });
            
            pids.forEach((pid) => {
              exec(`taskkill /F /PID ${pid}`, () => {});
            });
          }
          setTimeout(resolve, 500);
        });
      }
    });
  };

  // Helper to poll the server
  const pollServer = async (retries = 150): Promise<void> => {
    const { net } = require('electron');
    const http = require('http');

    return new Promise((resolve, reject) => {
      let attempts = 0;

      const check = () => {
        attempts++;
        if (mainWindow && !mainWindow.isDestroyed()) {
          // Send simpler message for cleaner UI, or keep detail for diagnostics
          mainWindow.webContents.send('server-log', `Starting engine... ${Math.round((attempts / retries) * 100)}%`);
        }

        const req = http.get(`http://127.0.0.1:${PORT}`, (res: any) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            if (attempts >= retries) reject(new Error(`Server responded with ${res.statusCode}`));
            // Turbo Poll: check every 200ms
            else setTimeout(check, 200);
          }
        });

        req.on('error', (err: any) => {
          if (attempts >= retries) {
            reject(err);
          } else {
            // Turbo Poll: check every 200ms
            setTimeout(check, 200);
          }
        });

        req.end();
      };

      check();
    });
  };

  // Logger function - Moved to global scope
  log(`App starting. UserData: ${app.getPath('userData')}`);

  // WOZNIAK MODE: Free port before starting server
  log(`Checking if port ${PORT} is in use...`);
  await killProcessOnPort(PORT);
  
  // Wait longer for port to be fully freed (macOS can be slow)
  log('Waiting for port to be freed...');
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Double check port is free
  const portStillInUse = await checkPort(PORT);
  if (portStillInUse) {
    log(`⚠️  Port ${PORT} still in use after kill attempt, trying alternative port...`);
    // Try alternative ports
    for (let altPort = 3001; altPort <= 3010; altPort++) {
      const inUse = await checkPort(altPort);
      if (!inUse) {
        log(`✅ Found free port: ${altPort}`);
        PORT = altPort;
        process.env.PORT = String(altPort);
        break;
      }
    }
  } else {
    log(`✅ Port ${PORT} is free and ready`);
  }

  // Get the correct path based on whether app is packaged or not
  let appPath: string;
  let serverPath: string | undefined;
  let serverDir: string;

  if (app.isPackaged) {
    appPath = app.getAppPath();
    const resourcesPath = process.resourcesPath || path.join(path.dirname(process.execPath), 'resources');

    log(`App path: ${appPath}`);
    log(`Resources path: ${resourcesPath}`);

    const pathsToTry = [
      path.join(appPath.replace('app.asar', 'app.asar.unpacked'), '.next', 'standalone', 'server.js'),
      path.join(resourcesPath, 'standalone', 'server.js'),
      path.join(path.dirname(process.execPath), 'standalone', 'server.js'),
      path.join(appPath, '.next', 'standalone', 'server.js'),
    ];

    serverPath = pathsToTry.find(p => fs.existsSync(p));

    log(`Detected server path: ${serverPath || 'NONE'}`);

    if (!serverPath) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showErrorBox('Startup Error', `Could not find server files.\nSearched in:\n${pathsToTry.join('\n')}`);
      }
      return;
    }

    serverDir = path.dirname(serverPath as string);

    // WOZNIAK MODE: Verify static files exist - CRITICAL FOR CSS
    const staticPath = path.join(serverDir, '.next', 'static');
    log(`🔍 Checking for static files at: ${staticPath}`);
    console.log(`🔍 Checking for static files at: ${staticPath}`);

    // Check if static files exist, if not try to copy them
    if (!fs.existsSync(staticPath)) {
      log(`❌ Static files NOT found at: ${staticPath}`);

      // Try alternative locations
      const altPaths = [
        path.join(path.dirname(serverDir), '.next', 'static'),
        path.join(serverDir, 'static'),
        path.join(path.dirname(process.execPath), 'standalone', '.next', 'static'),
        path.join(process.resourcesPath || '', 'standalone', '.next', 'static'),
        // Add path relative to resources
        path.join(process.resourcesPath || '', 'app.asar.unpacked', '.next', 'static'),
      ];

      for (const altPath of altPaths) {
        log(`🔍 Checking alternative: ${altPath}`);
        if (fs.existsSync(altPath)) {
          log(`✅ Found at: ${altPath}`);
          try {
            log(`📋 Copying to ${staticPath}...`);
            const nextDir = path.join(serverDir, '.next');
            if (!fs.existsSync(nextDir)) fs.mkdirSync(nextDir, { recursive: true });
            fs.cpSync(altPath, staticPath, { recursive: true, force: true });
            log(`✅ Copied successfully!`);
          } catch (e) {
            log(`❌ Copy failed: ${e}`);
          }
          break;
        }
      }
    }

    if (fs.existsSync(staticPath)) {
      log(`✅ Static files found at: ${staticPath}`);
      console.log(`✅ Static files found at: ${staticPath}`);

      // Verify CSS files specifically
      const cssPath = path.join(staticPath, 'css');
      if (fs.existsSync(cssPath)) {
        const cssFiles = fs.readdirSync(cssPath).filter((f: string) => f.endsWith('.css'));
        log(`✅ Found ${cssFiles.length} CSS file(s) in static/css`);
        console.log(`✅ Found ${cssFiles.length} CSS file(s): ${cssFiles.join(', ')}`);
      } else {
        log(`⚠️  CSS folder not found at: ${cssPath}`);
        console.warn(`⚠️  CSS folder not found at: ${cssPath}`);
      }
    } else {
      log(`❌ Static files NOT found at: ${staticPath}`);
      console.error(`❌ Static files NOT found at: ${staticPath}`);

      // Try alternative locations
      const altPaths = [
        path.join(path.dirname(serverDir), '.next', 'static'),
        path.join(serverDir, 'static'),
        path.join(path.dirname(process.execPath), 'standalone', '.next', 'static'),
        path.join(process.resourcesPath || '', 'standalone', '.next', 'static'),
      ];

      for (const altPath of altPaths) {
        log(`🔍 Trying alternative path: ${altPath}`);
        if (fs.existsSync(altPath)) {
          log(`✅ Found static files at alternative location: ${altPath}`);
          console.log(`✅ Found static files at alternative location: ${altPath}`);
          break;
        }
      }
    }
  } else {
    // In development
    return;
  }

  // Use fork
  try {
    log(`Starting server process from: ${serverDir}`);

    // FORCE IPv4 to avoid localhost resolution issues (::1 vs 127.0.0.1)
    // WOZNIAK MODE: Set correct working directory so Next.js finds all files
    const env = {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      // Ensure Next.js can find static files
      NEXT_TELEMETRY_DISABLED: '1',
      // CRITICAL: Tell Next.js where to find static files in standalone mode
      // The server runs from serverDir, so .next/static should be at serverDir/.next/static
      // Next.js standalone mode automatically looks for .next/static relative to server.js
    };

    // Verify public folder exists
    const publicPath = path.join(serverDir, 'public');
    if (fs.existsSync(publicPath)) {
      log(`✅ Public folder found at: ${publicPath}`);
      console.log(`✅ Public folder found at: ${publicPath}`);
    } else {
      log(`⚠️  Public folder NOT found at: ${publicPath}`);
      console.warn(`⚠️  Public folder NOT found at: ${publicPath}`);

      // Try to find and copy public folder
      const altPublicPaths = [
        path.join(path.dirname(serverDir), 'public'),
        path.join(path.dirname(process.execPath), 'standalone', 'public'),
        path.join(process.resourcesPath || '', 'standalone', 'public'),
      ];

      for (const altPath of altPublicPaths) {
        if (fs.existsSync(altPath)) {
          log(`✅ Found public at: ${altPath}`);
          try {
            fs.cpSync(altPath, publicPath, { recursive: true, force: true });
            log(`✅ Public folder copied successfully!`);
          } catch (e) {
            log(`❌ Public copy failed: ${e}`);
          }
          break;
        }
      }
    }

    // WOZNIAK MODE: Next.js standalone handles all static files automatically
    // No need for separate asset server - Next.js knows where everything is!

    // WOZNIAK MODE: Fork with correct working directory
    // This ensures Next.js can find .next/static and all other files
    nextServerProcess = fork(serverPath, [], {
      cwd: serverDir, // Critical: server must run from standalone directory
      env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });

    log(`Server forked with cwd: ${serverDir}`);

    let lastStderr = '';

    // Log stdout/stderr
    nextServerProcess.stdout?.on('data', (d) => {
      const msg = d.toString();
      // Stream to UI for visibility
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server-log', `[Server] ${msg.trim().slice(0, 100)}`);
      }
      log(`[Next Output]: ${msg.trim()}`);

      // TRIGGER: If we see "Ready in", the server is up! Bypass polling wait.
      if (msg.includes('Ready in') || msg.includes('started server on') || msg.includes('localhost:' + PORT)) {
        log(`Create Trigger: Found ready signal in logs! Launching...`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          try {
            // Only load if we are still on the loading screen
            const currentUrl = mainWindow.webContents.getURL();
            if (currentUrl.includes('loading.html')) {
              mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
              mainWindow.show();
              // NEVER open DevTools in production - this is a standalone app!
            }
          } catch (e) { log(`Trigger load failed: ${e}`); }
        }
      }
    });

    nextServerProcess.stderr?.on('data', (d) => {
      const msg = d.toString();
      console.error(`[Next Err]: ${msg}`);
      log(`[Next Err]: ${msg.trim()}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server-log', `[Error] ${msg.trim().slice(0, 100)}`);
      }
      lastStderr += msg.slice(-500); // Keep last 500 chars
    });

    // CRITICAL: Handle early exit
    nextServerProcess.on('exit', (code, signal) => {
      log(`Server process exited with code ${code} and signal ${signal}`);
      if (code !== 0 && code !== null) {
        // If it exits with error, tell the user!
        if (mainWindow && !mainWindow.isDestroyed()) {
          // If we haven't loaded the main app yet (still on loading screen)
          const currentUrl = mainWindow.webContents.getURL();
          if (currentUrl.includes('loading.html')) {
            dialog.showErrorBox('Server Error', `The application server stopped unexpectedly.\n\nCode: ${code}\nLog: ${logFile}\n\nLast Error:\n${lastStderr}`);
          }
        }
      }
    });

    // Poll for readiness (Backup if log trigger misses)
    try {
      await pollServer();
      if (mainWindow && !mainWindow.isDestroyed()) {
        const currentUrl = mainWindow.webContents.getURL();
        // Only load if not already loaded by trigger
        if (currentUrl.includes('loading.html')) {
          mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
          mainWindow.show();
          // NEVER open DevTools in production - this is a standalone app!
        }
      }
    } catch (err: any) {
      log(`Polling failed: ${err.message}`);
      console.error('Server failed to respond:', err);

      // If process is still alive but not responding
      if (nextServerProcess && !nextServerProcess.killed) {
        dialog.showErrorBox('Connection Timeout', `The server is running but not responding.\nCheck logs at: ${logFile}`);
      }
    }

  } catch (error: any) {
    log(`Failed to fork: ${error.message}`);
    console.error(`Failed to fork: ${error.message}`);
    dialog.showErrorBox('Process Error', `Failed to start server process: ${error.message}`);
  }
}

/**
 * App lifecycle events
 */
app.whenReady().then(() => {
  createWindow();

  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup on quit
app.on('before-quit', () => {
  if (nextServerProcess) {
    nextServerProcess.kill();
  }
});

// Handle certificate errors for local development
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (url.startsWith('https://localhost')) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// IPC handlers for communication with renderer
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

