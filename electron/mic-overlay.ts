/**
 * Microphone Overlay Window
 * Creates a system-wide always-on-top floating microphone widget
 * that appears over all applications
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
let visibilityCallback: (() => void) | null = null;

interface OverlayPosition {
  edge: 'left' | 'right';
  y: number; // Percentage from top
}

export function setVisibilityCallback(cb: () => void) {
  visibilityCallback = cb;
}

export function createMicOverlay() {
  if (overlayWindow) {
    overlayWindow.focus();
    return overlayWindow;
  }

  // Get saved position or use default
  const position = store.get('mic_position', { edge: 'right', y: 50 }) as OverlayPosition;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;

  // Calculate window position
  const windowWidth = 160; // Start with compact bar size
  const windowHeight = 48; 
  const x = position.edge === 'left' ? 0 : screenWidth - windowWidth;
  const y = Math.floor((screenHeight * position.y) / 100) - windowHeight / 2;

  overlayWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true, // Set to true to allow setBounds to work correctly on all platforms
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: true,
    backgroundColor: '#00000000', // Fully transparent
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
      type: 'toolbar', // Prevents window from appearing in Alt+Tab
    }),
  });

  // Set window to always stay on top of all windows
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Make window ignore mouse events for transparent areas
  overlayWindow.setIgnoreMouseEvents(false);

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
          "media-src 'self' data: blob:; " +
          "connect-src 'self' http://localhost:11434 https://generativelanguage.googleapis.com https://texttospeech.googleapis.com https://speech.googleapis.com https://*.google.com https://oauth2.googleapis.com https://gmail.googleapis.com https://www.googleapis.com https://openrouter.ai https://api.github.com https://api.resend.com https://api.elevenlabs.io https://discord.com https://*.discord.com;"
        ]
      }
    });
  });

  // Visibility listeners
  overlayWindow.on('show', () => visibilityCallback?.());
  overlayWindow.on('hide', () => visibilityCallback?.());

  // Load the overlay HTML
  const overlayUrl = process.env.VITE_DEV_SERVER_URL
    ? `${process.env.VITE_DEV_SERVER_URL}#/mic-overlay`
    : `file://${path.join(__dirname, '../dist/index.html')}#/mic-overlay`;

  overlayWindow.loadURL(overlayUrl);

  // Open DevTools in development
  if (process.env.VITE_DEV_SERVER_URL) {
    overlayWindow.webContents.openDevTools({ mode: 'detach' });
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

  // Handle window dragging
  overlayWindow.on('move', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const [x, y] = overlayWindow.getPosition();
      const [width, height] = overlayWindow.getSize();
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
      
      // Determine which edge it's closer to
      const edge = (x + width / 2) < screenWidth / 2 ? 'left' : 'right';
      // Calculate Y percentage
      const yPercent = Math.round((y + height / 2) * 100 / screenHeight);
      
      const newPosition = { edge, y: yPercent };
      store.set('mic_position', newPosition);
      
      // Broadcast update to all windows so they stay in sync
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('settings:changed');
        }
      });
    }
  });

  overlayWindow.webContents.on('did-finish-load', () => {
    overlayWindow?.webContents.send('overlay-ready');
  });

  console.log('🎤 Microphone overlay window created');

  return overlayWindow;
}

export function toggleMicOverlay() {
  if (!overlayWindow) {
    const win = createMicOverlay();
    win?.show();
  } else if (overlayWindow.isVisible()) {
    overlayWindow.hide();
  } else {
    overlayWindow.show();
  }
}

export function closeMicOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy();
    overlayWindow = null;
  }
}

export function getMicOverlay() {
  return overlayWindow;
}

// IPC Handlers for overlay window
export function setupOverlayIPC() {
  // Mic overlay resizing handler (global)
  ipcMain.on('mic-overlay:resize', (_event, { width: newWidth, height: newHeight }) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const [oldWidth, oldHeight] = overlayWindow.getSize();
      const [oldX, oldY] = overlayWindow.getPosition();
      
      const position = store.get('mic_position', { edge: 'right', y: 50 }) as OverlayPosition;
      
      // Calculate new X based on edge (anchor to edge)
      const newX = position.edge === 'left' ? oldX : (oldX + oldWidth - newWidth);
      
      // Calculate new Y to anchor bottom
      const newY = oldY + oldHeight - newHeight;

      // Log only if size actually changed to avoid spamming
      if (oldWidth !== newWidth || oldHeight !== newHeight) {
        console.log(`🎤 IPC: Resize overlay from ${oldWidth}x${oldHeight} to ${newWidth}x${newHeight} (Edge: ${position.edge})`);
        
        // Use setBounds which is atomic for position + size
        overlayWindow.setBounds({
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(newWidth),
          height: Math.round(newHeight)
        }, false);
      }
    }
  });

  // Update overlay position
  ipcMain.handle('overlay:updatePosition', (_, position: OverlayPosition) => {
    store.set('mic_position', position);
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
      
      const [width, height] = overlayWindow.getSize();
      const x = position.edge === 'left' ? 0 : screenWidth - width;
      const y = Math.floor((screenHeight * position.y) / 100) - height / 2;
      
      overlayWindow.setPosition(x, y, true);
    }
  });

  // Get overlay state
  ipcMain.handle('overlay:isVisible', () => {
    return overlayWindow?.isVisible() ?? false;
  });

  // Update overlay content (for communication from main window)
  ipcMain.handle('overlay:sendMessage', (_, message: any) => {
    overlayWindow?.webContents.send('overlay-message', message);
  });

  // Allow overlay to send messages to main window
  ipcMain.handle('overlay:toMainWindow', (_, message: any) => {
    // This will be handled by the main window
    const windows = BrowserWindow.getAllWindows();
    const mainWindow = windows.find(w => !w.webContents.getURL().includes('#/mic-overlay'));
    if (mainWindow) {
      if (message.type === 'navigate') {
        mainWindow.webContents.send('navigate', message.path);
        mainWindow.show();
        mainWindow.focus();
      }
    }
    return true;
  });
}
