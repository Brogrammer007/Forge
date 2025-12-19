import { contextBridge, ipcRenderer } from 'electron';

/**
 * Expose protected methods to the renderer process
 * via the contextBridge
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Get the application version
   */
  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke('get-app-version');
  },

  /**
   * Get the current platform
   */
  getPlatform: (): Promise<NodeJS.Platform> => {
    return ipcRenderer.invoke('get-platform');
  },

  /**
   * Check if running in Electron
   */
  isElectron: true,

  /**
   * Listen for server log messages
   */
  onServerLog: (callback: (message: string) => void) => {
    ipcRenderer.on('server-log', (event, message) => callback(message));
  },
});

// Type declarations for the exposed API
declare global {
  interface Window {
    electronAPI?: {
      getAppVersion: () => Promise<string>;
      getPlatform: () => Promise<NodeJS.Platform>;
      isElectron: boolean;
    };
  }
}

