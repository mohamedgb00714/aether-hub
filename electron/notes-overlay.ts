/**
 * Notes Overlay Window
 * Creates a system-wide always-on-top floating notes widget
 * that appears over all applications - similar to mic overlay
 */

import { BrowserWindow, screen, ipcMain } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import { getEncryptionKey } from './security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store({
  encryptionKey: getEncryptionKey(),
  name: 'aether-hub-config'
});

let overlayWindow: BrowserWindow | null = null;

interface OverlayPosition {
  x: number;
  y: number;
}

interface OverlaySize {
  width: number;
  height: number;
}

export function createNotesOverlay() {
  if (overlayWindow) {
    overlayWindow.focus();
    return overlayWindow;
  }

  // Get saved position or use default (bottom-right corner)
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
  
  const savedPosition = store.get('notes_overlay_position') as OverlayPosition | undefined;
  const savedSize = store.get('notes_overlay_size') as OverlaySize | undefined;

  const windowWidth = savedSize?.width || 280;
  const windowHeight = savedSize?.height || 320;
  const x = savedPosition?.x ?? screenWidth - windowWidth - 20;
  const y = savedPosition?.y ?? screenHeight - windowHeight - 20;

  overlayWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    // Platform-specific options
    ...(process.platform === 'darwin' && {
      vibrancy: 'under-window',
      visualEffectState: 'active',
    }),
    ...(process.platform === 'win32' && {
      type: 'toolbar',
    }),
  });

  // Set window to always stay on top of all windows
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Set CSP headers for overlay window
  overlayWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "img-src 'self' data: https: blob:; " +
          "connect-src 'self' http://localhost:11434 https://generativelanguage.googleapis.com https://*.google.com;"
        ]
      }
    });
  });

  // Load the overlay HTML
  const overlayUrl = process.env.VITE_DEV_SERVER_URL
    ? `${process.env.VITE_DEV_SERVER_URL}#/notes-overlay`
    : `file://${path.join(__dirname, '../dist/index.html')}#/notes-overlay`;

  overlayWindow.loadURL(overlayUrl);

  // Open DevTools in development
  if (process.env.VITE_DEV_SERVER_URL) {
    // overlayWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Prevent window from being closed, just hide it
  overlayWindow.on('close', (event) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      event.preventDefault();
      overlayWindow.hide();
    }
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  // Save position when window is moved
  overlayWindow.on('move', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const [x, y] = overlayWindow.getPosition();
      store.set('notes_overlay_position', { x, y });
    }
  });

  // Save size when window is resized
  overlayWindow.on('resize', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const [width, height] = overlayWindow.getSize();
      store.set('notes_overlay_size', { width, height });
    }
  });

  console.log('📝 Notes overlay window created');

  return overlayWindow;
}

export function toggleNotesOverlay() {
  if (!overlayWindow) {
    const win = createNotesOverlay();
    win?.show();
  } else if (overlayWindow.isVisible()) {
    overlayWindow.hide();
  } else {
    overlayWindow.show();
  }
}

export function showNotesOverlay() {
  if (!overlayWindow) {
    createNotesOverlay();
  }
  overlayWindow?.show();
}

export function hideNotesOverlay() {
  overlayWindow?.hide();
}

export function closeNotesOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy();
    overlayWindow = null;
  }
}

export function getNotesOverlay() {
  return overlayWindow;
}

// IPC Handlers for notes overlay window
export function setupNotesOverlayIPC() {
  // Toggle notes overlay visibility
  ipcMain.handle('notes-overlay:toggle', () => {
    toggleNotesOverlay();
    return overlayWindow?.isVisible() ?? false;
  });

  // Show notes overlay
  ipcMain.handle('notes-overlay:show', () => {
    showNotesOverlay();
    return true;
  });

  // Hide notes overlay
  ipcMain.handle('notes-overlay:hide', () => {
    hideNotesOverlay();
    return true;
  });

  // Check if visible
  ipcMain.handle('notes-overlay:isVisible', () => {
    return overlayWindow?.isVisible() ?? false;
  });

  // Resize the overlay window
  ipcMain.on('notes-overlay:resize', (_event, { width, height }) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const [oldWidth, oldHeight] = overlayWindow.getSize();
      if (oldWidth !== width || oldHeight !== height) {
        overlayWindow.setSize(Math.round(width), Math.round(height), true);
      }
    }
  });

  // Update position
  ipcMain.handle('notes-overlay:updatePosition', (_, position: OverlayPosition) => {
    store.set('notes_overlay_position', position);
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setPosition(Math.round(position.x), Math.round(position.y), true);
    }
  });

  // Send message to overlay
  ipcMain.handle('notes-overlay:sendMessage', (_, message: any) => {
    overlayWindow?.webContents.send('notes-overlay-message', message);
  });

  // Navigate to main window
  ipcMain.handle('notes-overlay:toMainWindow', (_, message: any) => {
    const windows = BrowserWindow.getAllWindows();
    const mainWindow = windows.find(w => 
      !w.webContents.getURL().includes('#/notes-overlay') && 
      !w.webContents.getURL().includes('#/mic-overlay')
    );
    if (mainWindow) {
      if (message.type === 'navigate') {
        mainWindow.webContents.send('navigate', message.path);
        mainWindow.show();
        mainWindow.focus();
      }
    }
    return true;
  });

  // Broadcast notes changes to ALL windows (main + overlay)
  // This enables instant sync when notes are pinned/updated
  ipcMain.handle('notes:broadcast', () => {
    const windows = BrowserWindow.getAllWindows();
    console.log('📝 Broadcasting notes update to', windows.length, 'windows');
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('notes:changed');
      }
    }
    return true;
  });
}
