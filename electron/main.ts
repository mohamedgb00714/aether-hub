import { app, BrowserWindow, ipcMain, Menu, Tray, globalShortcut, dialog, shell, screen, nativeImage, Notification } from 'electron';
import * as dotenv from 'dotenv';
// Load environment variables from .env file
dotenv.config();

// Auto-updater disabled for now - dependencies not bundling properly
// import pkg from 'electron-updater';
// const { autoUpdater } = pkg;
import Store from 'electron-store';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as http from 'http';
import { parse as parseUrl } from 'url';
import { 
  database,
  createAutomation,
  getAutomations,
  getAutomation,
  updateAutomation,
  deleteAutomation,
  createAutomationHistory,
  getAutomationHistory,
  updateAutomationHistory
} from './database.js';
import * as whatsapp from './whatsapp.js';
import * as telegram from './telegram.js';
import * as discordSelfBot from './discord-selfbot.js';
import * as addonServer from './addon-server.js';
import * as micOverlay from './mic-overlay.js';
import * as notesOverlay from './notes-overlay.js';
import * as youtube from './youtube.js';
import * as automationScheduler from './automation-scheduler.js';
import { copilotService } from './copilot-service.js';
import { getEncryptionKey } from './security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize secure store with encryption
// Note: safeStorage is used via getEncryptionKey()
const store = new Store({
  encryptionKey: getEncryptionKey(),
  name: 'aether-hub-config'
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let oauthServer: http.Server | null = null;

// OAuth callback server port
const OAUTH_PORT = 8089;

// Start local OAuth callback server
function startOAuthServer() {
  if (oauthServer) {
    console.log('🟡 MAIN: OAuth server already running');
    return;
  }
  
  console.log('🔵 MAIN: Starting OAuth callback server...');
  
  oauthServer = http.createServer((req, res) => {
    const url = parseUrl(req.url || '', true);
    
    if (url.pathname === '/oauth/callback') {
      const code = url.query.code as string;
      const error = url.query.error as string;
      
      // Send response to browser
      res.writeHead(200, { 'Content-Type': 'text/html' });
      if (error) {
        res.end(`
          <html>
            <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f1f5f9;">
              <div style="text-align: center; padding: 40px; background: white; border-radius: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h1 style="color: #ef4444; margin: 0;">Authentication Failed</h1>
                <p style="color: #64748b; margin-top: 16px;">${error}</p>
                <p style="color: #94a3b8; margin-top: 8px;">You can close this window.</p>
              </div>
            </body>
          </html>
        `);
      } else {
        res.end(`
          <html>
            <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f1f5f9;">
              <div style="text-align: center; padding: 40px; background: white; border-radius: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h1 style="color: #4f46e5; margin: 0;">✓ Authentication Successful</h1>
                <p style="color: #64748b; margin-top: 16px;">You can close this window and return to aethermsaid hub.</p>
                <script>setTimeout(() => window.close(), 2000);</script>
              </div>
            </body>
          </html>
        `);
      }
      
      // Send callback to renderer
      if (code) {
        console.log('🟢 MAIN: OAuth code received, sending to renderer');
        mainWindow?.webContents.send('oauth-callback', `http://127.0.0.1:${OAUTH_PORT}/oauth/callback?code=${code}`);
        mainWindow?.focus();
      } else if (error) {
        mainWindow?.webContents.send('oauth-callback', `http://127.0.0.1:${OAUTH_PORT}/oauth/callback?error=${error}`);
        mainWindow?.focus();
      }
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  oauthServer.listen(OAUTH_PORT, '127.0.0.1', () => {
    console.log(`🟢 MAIN: OAuth callback server listening on http://127.0.0.1:${OAUTH_PORT}`);
  });
  
  oauthServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log('🟡 MAIN: OAuth port in use, trying to kill and retry...');
      oauthServer = null;
      // Try again after a short delay
      setTimeout(() => {
        startOAuthServer();
      }, 1000);
    } else {
      console.error('❌ MAIN: OAuth server error:', err);
    }
  });
}

// Window state management
interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

function saveWindowState() {
  if (!mainWindow) return;
  
  const bounds = mainWindow.getBounds();
  const windowState: WindowState = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    isMaximized: mainWindow.isMaximized()
  };
  
  store.set('windowState', windowState);
}

function getWindowState(): WindowState {
  const defaultState: WindowState = {
    width: 1400,
    height: 900,
    isMaximized: false
  };
  
  return store.get('windowState', defaultState) as WindowState;
}

// Validate window position is on a visible screen
function validateWindowPosition(state: WindowState): WindowState {
  const displays = screen.getAllDisplays();
  
  if (state.x !== undefined && state.y !== undefined) {
    const isVisible = displays.some(display => {
      const area = display.workArea;
      return (
        state.x! >= area.x &&
        state.y! >= area.y &&
        state.x! < area.x + area.width &&
        state.y! < area.y + area.height
      );
    });
    
    if (!isVisible) {
      // Reset to center of primary display if window is off-screen
      delete state.x;
      delete state.y;
    }
  }
  
  return state;
}

function createWindow() {
  const windowState = validateWindowPosition(getWindowState());
  
  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 1000,
    minHeight: 600,
    frame: false, // Frameless window for custom titlebar
    backgroundColor: '#f8fafc',
    show: false, // Show when ready to prevent flashing
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    },
    icon: path.join(__dirname, '../build/icons/icon.png'),
    titleBarStyle: 'hidden', // Hide default titlebar
    trafficLightPosition: process.platform === 'darwin' ? { x: 10, y: 10 } : undefined
  });

  // Set CSP headers and handle CORS issues
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    // Add CORS headers to all responses to allow Cross-Origin requests within the app
    const responseHeaders = {
      ...details.responseHeaders,
      'Access-Control-Allow-Origin': ['*'],
      'Access-Control-Allow-Methods': ['GET, POST, OPTIONS, PUT, PATCH, DELETE'],
      'Access-Control-Allow-Headers': ['*'],
      'Content-Security-Policy': [
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: https: blob:; " +
        "media-src 'self' data: blob:; " +
        "connect-src 'self' " +
        "http://localhost:11434 " +
        "https://generativelanguage.googleapis.com " +
        "https://texttospeech.googleapis.com " +
        "https://speech.googleapis.com " +
        "https://*.google.com " +
        "https://*.googleapis.com " +
        "https://oauth2.googleapis.com " +
        "https://gmail.googleapis.com " +
        "https://www.googleapis.com " +
        "https://openrouter.ai " +
        "https://api.openai.com " +
        "https://api.anthropic.com " +
        "https://api.x.ai " +
        "https://*.x.ai " +
        "https://api.groq.com " +
        "https://api.mistral.ai " +
        "https://api.github.com " +
        "https://api.resend.com " +
        "https://api.elevenlabs.io " +
        "https://discord.com " +
        "https://*.discord.com;"
      ]
    };

    callback({ responseHeaders });
  });

  // Load app
  const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
  
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools(); // Open DevTools in development
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    if (windowState.isMaximized) {
      mainWindow?.maximize();
    }
    mainWindow?.show();
  });

  // Save window state on resize/move
  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('maximize', saveWindowState);
  mainWindow.on('unmaximize', saveWindowState);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  createMenu();
  createTray();
  setupGlobalShortcuts();

  // Forward copilot tool execution events to renderer
  copilotService.setEventCallback((event) => {
    mainWindow?.webContents.send('copilot:toolEvent', event);
  });
  
  // Initialize Mic Overlay
  micOverlay.setupOverlayIPC();
  micOverlay.setVisibilityCallback(() => updateTrayMenu());
  micOverlay.createMicOverlay();
  
  // Initialize Notes Overlay
  notesOverlay.setupNotesOverlayIPC();
}

function createMenu() {
  const isMac = process.platform === 'darwin';
  
  const template: (Electron.MenuItemConstructorOptions | Electron.MenuItem)[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { label: 'About aethermsaid hub', role: 'about' as const },
        { type: 'separator' as const },
        // { label: 'Check for Updates...', click: () => autoUpdater.checkForUpdates() },
        { type: 'separator' as const },
        { label: 'Preferences...', accelerator: 'Cmd+,', click: () => mainWindow?.webContents.send('navigate', '/settings') },
        { type: 'separator' as const },
        { label: 'Hide aethermsaid hub', role: 'hide' as const },
        { label: 'Hide Others', role: 'hideOthers' as const },
        { label: 'Show All', role: 'unhide' as const },
        { type: 'separator' as const },
        { label: 'Quit', accelerator: 'Cmd+Q', role: 'quit' as const }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Chat', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('navigate', '/chat') },
        { type: 'separator' },
        isMac ? { label: 'Close Window', role: 'close' as const } : { label: 'Exit', role: 'quit' as const }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', role: 'undo' as const },
        { label: 'Redo', role: 'redo' as const },
        { type: 'separator' },
        { label: 'Cut', role: 'cut' as const },
        { label: 'Copy', role: 'copy' as const },
        { label: 'Paste', role: 'paste' as const },
        { label: 'Select All', role: 'selectAll' as const }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Dashboard', accelerator: 'CmdOrCtrl+1', click: () => mainWindow?.webContents.send('navigate', '/') },
        { label: 'AI Digest', accelerator: 'CmdOrCtrl+2', click: () => mainWindow?.webContents.send('navigate', '/digest') },
        { label: 'Assistant', accelerator: 'CmdOrCtrl+3', click: () => mainWindow?.webContents.send('navigate', '/chat') },
        { label: 'Knowledge Base', accelerator: 'CmdOrCtrl+4', click: () => mainWindow?.webContents.send('navigate', '/knowledge') },
        { type: 'separator' },
        { label: 'Reload', role: 'reload' as const },
        { label: 'Force Reload', role: 'forceReload' as const },
        ...(process.env.NODE_ENV === 'development' ? [{ label: 'Toggle Developer Tools', role: 'toggleDevTools' as const }] : []),
        { type: 'separator' as const },
        { label: 'Actual Size', role: 'resetZoom' as const },
        { label: 'Zoom In', role: 'zoomIn' as const },
        { label: 'Zoom Out', role: 'zoomOut' as const },
        { type: 'separator' },
        { label: 'Toggle Full Screen', role: 'togglefullscreen' as const }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', role: 'minimize' as const },
        { label: 'Zoom', role: 'zoom' as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { label: 'Bring All to Front', role: 'front' as const }
        ] : [
          { label: 'Close', role: 'close' as const }
        ])
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Documentation', click: () => shell.openExternal('https://github.com/mohamedgb00714/aether-hubelectron#readme') },
        { label: 'Report Issue', click: () => shell.openExternal('https://github.com/mohamedgb00714/aether-hubelectron/issues') }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show aethermsaid hub', click: () => mainWindow?.show() },
    { label: 'Hide aethermsaid hub', click: () => mainWindow?.hide() },
    { type: 'separator' },
    { 
      label: 'Voice Assistant Overlay', 
      type: 'checkbox', 
      checked: micOverlay.getMicOverlay()?.isVisible() ?? false, 
      click: () => {
        micOverlay.toggleMicOverlay();
        updateTrayMenu();
      } 
    },
    { type: 'separator' },
    // { label: 'Check for Updates', click: () => autoUpdater.checkForUpdates() },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        console.log('🟢 MAIN: Quit clicked from tray menu');
        // Force quit all windows first
        BrowserWindow.getAllWindows().forEach(win => {
          if (!win.isDestroyed()) {
            win.destroy();
          }
        });
        // Then quit app
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
}

function createTray() {
  // In packaged app, use extraResources; in dev, use build/icons
  let iconPath: string;
  if (app.isPackaged) {
    // extraResources are copied to resources/ folder
    iconPath = path.join(process.resourcesPath, 'icons', 'icon.png');
  } else {
    iconPath = path.join(__dirname, '../build/icons/icon.png');
  }
  
  console.log('🔵 TRAY: Loading icon from:', iconPath);
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  
  updateTrayMenu();
  
  tray.setToolTip('aethermsaid hub Personal Hub');
  
  tray.on('click', () => {
    mainWindow?.isVisible() ? mainWindow?.hide() : mainWindow?.show();
  });
}

function setupGlobalShortcuts() {
  const broadcastToAllWindows = (channel: string, ...args: any[]) => {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, ...args);
      }
    });
  };

  // Global search shortcut
  globalShortcut.register('CommandOrControl+K', () => {
    broadcastToAllWindows('trigger-search');
  });

  // Floating Microphone shortcuts
  // Toggle mic on/off
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    broadcastToAllWindows('mic:toggle');
  });

  // Switch between dictation and AI generate mode
  globalShortcut.register('CommandOrControl+Shift+D', () => {
    broadcastToAllWindows('mic:mode-switch');
  });

  // Push-to-talk start (note: keyup handled in renderer)
  globalShortcut.register('CommandOrControl+Space', () => {
    broadcastToAllWindows('mic:push-to-talk-start');
  });
}

// Auto-updater configuration - DISABLED (dependencies not bundling properly)
// autoUpdater.autoDownload = false;
// autoUpdater.autoInstallOnAppQuit = true;

// autoUpdater.on('update-available', (info) => {
//   dialog.showMessageBox(mainWindow!, {
//     type: 'info',
//     title: 'Update Available',
//     message: `A new version ${info.version} is available. Do you want to download it now?`,
//     buttons: ['Download', 'Later']
//   }).then(result => {
//     if (result.response === 0) {
//       autoUpdater.downloadUpdate();
//     }
//   });
// });

// autoUpdater.on('update-downloaded', () => {
//   dialog.showMessageBox(mainWindow!, {
//     type: 'info',
//     title: 'Update Ready',
//     message: 'Update downloaded. The application will restart to install the update.',
//     buttons: ['Restart Now', 'Later']
//   }).then(result => {
//     if (result.response === 0) {
//       autoUpdater.quitAndInstall();
//     }
//   });
// });

// IPC Handlers
ipcMain.on('window:minimize', (event) => {
  console.log('🟢 MAIN: window:minimize received');
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    console.log('🟢 MAIN: Minimizing window');
    win.minimize();
  } else {
    console.error('❌ MAIN: No window found');
  }
});

ipcMain.on('window:maximize', (event) => {
  console.log('🟢 MAIN: window:maximize received');
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) {
      console.log('🟢 MAIN: Unmaximizing window');
      win.unmaximize();
    } else {
      console.log('🟢 MAIN: Maximizing window');
      win.maximize();
    }
  } else {
    console.error('❌ MAIN: No window found');
  }
});

// Track close button clicks for force quit
let closeClickCount = 0;
let closeClickTimer: NodeJS.Timeout | null = null;

ipcMain.on('window:close', (event) => {
  console.log('🟢 MAIN: window:close received');
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    closeClickCount++;
    
    // If clicked twice within 2 seconds, force quit immediately
    if (closeClickCount >= 2) {
      console.log('🟡 MAIN: Force quit triggered (double click)');
      if (closeClickTimer) clearTimeout(closeClickTimer);
      
      // Immediately force quit without cleanup
      app.exit(0);
      return;
    }
    
    // Reset counter after 2 seconds
    if (closeClickTimer) clearTimeout(closeClickTimer);
    closeClickTimer = setTimeout(() => {
      closeClickCount = 0;
    }, 2000);
    
    console.log('🟢 MAIN: Closing window (click again to force quit)');
    win.close();
  } else {
    console.error('❌ MAIN: No window found');
  }
});

// Forward addon AI response from renderer to addon server
ipcMain.on('addon:ai-response', (event, response) => {
  // Emit the event on webContents so addon-server can receive it
  event.sender.emit('addon:ai-response', event, response);
});

ipcMain.handle('window:isMaximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win?.isMaximized() ?? false;
});

ipcMain.handle('app:getPlatform', () => {
  return process.platform;
});

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// Electron Store IPC handlers
ipcMain.handle('store:get', (_event, key: string) => {
  return store.get(key);
});

ipcMain.handle('store:set', (_event, key: string, value: any) => {
  store.set(key, value);
  
  // Broadcast change to all windows
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) {
      win.webContents.send('settings:changed');
    }
  });

  // Notify windows if mic settings changed
  if (key.startsWith('mic_') && key !== 'mic_position') {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('settings:changed', { key, value });
      }
    });
  }
});

ipcMain.handle('store:delete', (_event, key: string) => {
  store.delete(key);
});

ipcMain.handle('store:clear', () => {
  store.clear();
});

// File dialog handlers
ipcMain.handle('dialog:openFile', async (_event, options) => {
  const result = await dialog.showOpenDialog(mainWindow!, options);
  return result.filePaths;
});

ipcMain.handle('copilot:createSession', async (_event, options) => {
  const sessionId = await copilotService.createSession(options);
  // Persist session to DB
  const projectName = options.projectPath ? options.projectPath.split('/').pop() : 'Project';
  database.chatSessions.create({
    id: sessionId,
    title: `Dev: ${projectName}`,
    metadata: {
      projectPath: options.projectPath,
      agentType: options.agentType,
      tools: options.tools,
      model: options.model,
      systemPrompt: options.systemPrompt
    }
  });
  return sessionId;
});

ipcMain.handle('copilot:sendRequest', async (_event, sessionId, prompt, options?: any) => {
  // Check if session is active in the service (e.g. after restart)
  if (!copilotService.isSessionActive(sessionId)) {
    console.log(`🤖 MAIN: Session ${sessionId} not active, attempting restoration...`);
    
    // 1. Try to get metadata from DB
    const dbSession = database.chatSessions.getById(sessionId);
    let metadata: any = null;
    
    try {
      if (dbSession?.metadata) {
        metadata = JSON.parse(dbSession.metadata);
      }
    } catch (e) {
      console.error('Failed to parse metadata from DB:', e);
    }

    // 2. Use options from renderer as fallback if DB metadata is missing
    if (!metadata && options) {
      console.log(`🤖 MAIN: No metadata in DB for ${sessionId}, using fallback options from renderer`);
      metadata = options;
      // Save this metadata for future use
      database.chatSessions.update(sessionId, { metadata });
    }

    if (metadata && metadata.projectPath) {
      try {
        // Load chat history from DB to provide context
        const dbMessages = database.chatMessages.getBySession(sessionId) || [];
        const chatHistory = dbMessages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        }));

        // Use resumeSession instead of createSession — preserves server-side history
        // Falls back to createSession + history injection if server session expired
        await copilotService.resumeSession({
          sessionId: sessionId,
          projectPath: metadata.projectPath,
          agentType: metadata.agentType || 'standard',
          tools: metadata.tools || [],
          model: metadata.model || 'gpt-4o',
          systemPrompt: metadata.systemPrompt,
          chatHistory: chatHistory,
        });
        console.log(`🤖 MAIN: Session ${sessionId} restored successfully`);
      } catch (err) {
        console.error(`🤖 MAIN: Failed to restore session ${sessionId}:`, err);
      }
    } else {
      console.warn(`🤖 MAIN: Could not find restoration context (metadata/options) for session ${sessionId}`);
    }
  }

  // Save user message
  const userMsgId = Date.now().toString();
  database.chatMessages.create({
    id: userMsgId,
    sessionId: sessionId,
    role: 'user',
    content: prompt
  });

  const response = await copilotService.sendRequest(sessionId, prompt, (chunk) => {
    mainWindow?.webContents.send('copilot:update', { sessionId, chunk });
  });

  // Save assistant response
  const assistantMsgId = (Date.now() + 1).toString();
  database.chatMessages.create({
    id: assistantMsgId,
    sessionId: sessionId,
    role: 'assistant',
    content: response
  });

  return response;
});

ipcMain.handle('copilot:stopSession', async (_event, sessionId) => {
  return await copilotService.stopSession(sessionId);
});

ipcMain.handle('copilot:listSessions', async () => {
  const sessions = database.chatSessions.getAll();
  // Map DB sessions to expected AIDeveloper format
  return sessions.map(s => {
    let metadata: any = {};
    try {
      if (s.metadata) {
        const parsed = JSON.parse(s.metadata);
        if (parsed && typeof parsed === 'object') {
          metadata = parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse session metadata:', e);
    }
    
    return {
      id: s.id,
      title: s.title,
      projectPath: metadata.projectPath || '',
      agentType: metadata.agentType || 'standard',
      tools: metadata.tools || [],
      model: metadata.model || 'gpt-4o',
      status: 'idle'
    };
  });
});

ipcMain.handle('copilot:getMessages', async (_event, sessionId) => {
  return database.chatMessages.getBySession(sessionId);
});

ipcMain.handle('copilot:getAuthStatus', async () => {
  return copilotService.getAuthStatus();
});

ipcMain.handle('copilot:signIn', async () => {
  return await copilotService.signIn((data) => {
    mainWindow?.webContents.send('copilot:auth-status', data);
  });
});

ipcMain.handle('copilot:initiateOAuthFlow', async () => {
  return await copilotService.initiateOAuthFlow();
});

ipcMain.handle('copilot:listModels', async () => {
  return await copilotService.listModels();
});

ipcMain.handle('dialog:saveFile', async (_event, options) => {
  const result = await dialog.showSaveDialog(mainWindow!, options);
  return result.filePath;
});

// Notification handler - show native desktop notification
ipcMain.handle('notification:show', (_event, options: { title: string; body: string; silent?: boolean }) => {
  try {
    console.log(`🔔 MAIN: notification:show called with title: "${options.title}"`);
    
    if (Notification.isSupported()) {
      // Get app path for icon
      const iconPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'build', 'icons', 'icon.png')
        : path.join(__dirname, '..', 'build', 'icons', 'icon.png');
      
      console.log(`🔔 MAIN: Icon path: ${iconPath}`);
      
      const notification = new Notification({
        title: options.title,
        body: options.body,
        silent: options.silent ?? false,
        icon: iconPath
      });
      
      notification.on('click', () => {
        console.log('🔔 MAIN: Notification clicked');
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      });

      notification.on('show', () => {
        console.log('🔔 MAIN: Notification events: show triggered');
      });

      // Note: 'error' event is not available on Notification
      // Remove error handler as it's not part of Electron's Notification API
      
      notification.show();
      console.log('🔔 MAIN: Native notification.show() executed');
      return true;
    } else {
      console.log('🔔 MAIN: Notifications NOT supported on this platform');
      return false;
    }
  } catch (error) {
    console.error('❌ MAIN: Failed to show notification:', error);
    return false;
  }
});

// Clipboard handlers
ipcMain.handle('clipboard:writeText', async (_event, text: string) => {
  const { clipboard } = await import('electron');
  clipboard.writeText(text);
});

ipcMain.handle('clipboard:readText', async () => {
  const { clipboard } = await import('electron');
  return clipboard.readText();
});

// System text input for dictation mode (using clipboard + paste)
ipcMain.handle('system:pasteText', async (_event, text: string) => {
  const { clipboard, BrowserWindow } = await import('electron');
  const { exec } = await import('child_process');
  
  // Set text to clipboard
  clipboard.writeText(text);
  
  // If the focused window is the mic overlay, we need to hide it momentarily 
  // or focus the main window or blur to return focus to the target app
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const overlayWindow = micOverlay.getMicOverlay();
  
  if (focusedWindow && overlayWindow && focusedWindow.id === overlayWindow.id) {
    // Hide overlay momentarily to return focus to previous app
    overlayWindow.hide();
    
    // Give OS a moment to restore focus to previous window
    setTimeout(() => {
      if (process.platform === 'darwin') {
        exec('osascript -e \'tell application "System Events" to keystroke "v" using command down\'');
      } else if (process.platform === 'win32') {
        exec('powershell -Command "[void][System.Reflection.Assembly]::LoadWithPartialName(\'System.Windows.Forms\'); [System.Windows.Forms.SendKeys]::SendWait(\'^v\')"');
      } else if (process.platform === 'linux') {
        exec('xdotool key ctrl+v');
      }
      
      // Reshow overlay after paste
      setTimeout(() => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.show();
        }
      }, 200);
    }, 150);
  } else {
    // Standard direct paste if overlay is not blocking focus
    if (process.platform === 'darwin') {
      exec('osascript -e \'tell application "System Events" to keystroke "v" using command down\'');
    } else if (process.platform === 'win32') {
      exec('powershell -Command "[void][System.Reflection.Assembly]::LoadWithPartialName(\'System.Windows.Forms\'); [System.Windows.Forms.SendKeys]::SendWait(\'^v\')"');
    } else if (process.platform === 'linux') {
      exec('xdotool key ctrl+v');
    }
  }

  return { success: true, text };
});

// Whisper.cpp STT Implementation
const getWhisperBaseDir = () => {
  if (process.platform === 'linux') {
    return path.join(app.getPath('home'), 'aethermsaid hub-Data');
  }
  return app.getPath('userData');
};

const WHISPER_BASE_DIR = getWhisperBaseDir();
const WHISPER_MODELS_DIR = path.join(WHISPER_BASE_DIR, 'whisper-models');
const WHISPER_TEMP_DIR = path.join(WHISPER_BASE_DIR, 'whisper-temp');

// Supported whisper models (smaller = faster, larger = more accurate)
const WHISPER_MODELS = [
  { name: 'tiny', size: '75 MB', url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin' },
  { name: 'base', size: '142 MB', url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin' },
  { name: 'small', size: '466 MB', url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin' },
];

let cachedWhisperPath: string | null = null;
let whisperSearchLogged = false;

// Get whisper binary path based on platform (silent mode - only logs when found or on error)
function getWhisperBinaryPath(verbose: boolean = false): string | null {
  if (cachedWhisperPath && fs.existsSync(cachedWhisperPath)) {
    return cachedWhisperPath;
  }

  // Check common installation paths
  const possiblePaths = [
    // Predefined binary paths (prioritize C++ versions and Snap)
    '/snap/bin/whisper-cpp.cli',
    '/snap/bin/whisper-cpp',
    '/usr/bin/whisper-cpp',
    '/usr/local/bin/whisper-cpp',
    '/opt/homebrew/bin/whisper-cpp',
    // Ambiguous binary names (last resort)
    '/usr/local/bin/whisper',
    '/usr/bin/whisper',
    '/snap/bin/whisper',
    '/opt/homebrew/bin/whisper',
    // Local installation in app data
    path.join(app.getPath('userData'), 'bin', 'whisper'),
    path.join(app.getPath('userData'), 'bin', 'main'),
  ];

  // Platform-specific paths
  if (process.platform === 'win32') {
    possiblePaths.push(
      path.join(app.getPath('userData'), 'bin', 'whisper.exe'),
      path.join(app.getPath('userData'), 'bin', 'main.exe')
    );
  }

  // Check each path
  for (const binPath of possiblePaths) {
    if (fs.existsSync(binPath)) {
      try {
        // Simple verification that the binary is working and is likely whisper.cpp
        // whisper.cpp binaries usually support --help and contain "whisper" or "main"
        const testCmd = `"${binPath}" --help`;
        const output = execSync(testCmd, { encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'ignore'] });
        
        if (output.includes('usage:') || output.includes('options:')) {
           if (verbose || !whisperSearchLogged) {
             console.log(`✅ WHISPER: Verified working binary at ${binPath}`);
             whisperSearchLogged = true;
           }
           cachedWhisperPath = binPath;
           return binPath;
        }
      } catch (error) {
        // Silent unless verbose - most users don't have whisper installed
        if (verbose) {
          console.warn(`⚠️ WHISPER: Binary at ${binPath} exists but failed test:`, error instanceof Error ? error.message : String(error));
        }
      }
    }
  }

  // Try to find in PATH
  try {
    const binaryNames = ['whisper-cpp.cli', 'whisper-cpp', 'whisper', 'whisper-cli', 'main'];

    for (const name of binaryNames) {
      try {
        const whichCmd = process.platform === 'win32' ? `where ${name}` : `which ${name}`;
        const result = execSync(whichCmd, { encoding: 'utf8', env: process.env }).trim().split('\n')[0];
        if (result && fs.existsSync(result)) {
          if (verbose || !whisperSearchLogged) {
            console.log(`✅ WHISPER: Found binary "${name}" via which: ${result}`);
            whisperSearchLogged = true;
          }
          cachedWhisperPath = result;
          return result;
        }
      } catch {
        // Continue to next name
      }
    }
  } catch (error) {
    if (verbose) {
      console.warn('🟡 WHISPER: Error searching for binary in PATH:', error);
    }
  }

  // Only log "not found" once, or when verbose (user actively using whisper)
  if (verbose && !whisperSearchLogged) {
    console.warn('❌ WHISPER: No binary found in any common locations or PATH');
    whisperSearchLogged = true;
  }
  
  return null;
}

// Check if ffmpeg is available for audio conversion
function isFfmpegInstalled(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore', env: process.env });
    return true;
  } catch {
    return false;
  }
}

// Get default whisper model path
function getDefaultModelPath(): string | null {
  // Check for models in order of preference (small to large)
  for (const model of WHISPER_MODELS) {
    const modelPath = path.join(WHISPER_MODELS_DIR, `ggml-${model.name}.bin`);
    if (fs.existsSync(modelPath)) {
      return modelPath;
    }
  }

  return null;
}

// Convert audio buffer to WAV format using ffmpeg
async function convertToWav(inputBuffer: ArrayBuffer, outputPath: string): Promise<void> {
  // Create temp directory if it doesn't exist
  if (!fs.existsSync(WHISPER_TEMP_DIR)) {
    fs.mkdirSync(WHISPER_TEMP_DIR, { recursive: true });
  }

  // Write input buffer to temp file
  const inputPath = path.join(WHISPER_TEMP_DIR, `input-${Date.now()}.webm`);
  fs.writeFileSync(inputPath, Buffer.from(inputBuffer));

  try {
    // Convert to 16kHz mono WAV (required by whisper)
    execSync(`ffmpeg -y -i "${inputPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${outputPath}"`, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env
    });
  } catch (error: any) {
    const stderr = error.stderr?.toString() || '';
    throw new Error(`FFmpeg conversion failed: ${error.message}${stderr ? ' - ' + stderr : ''}`);
  } finally {
    // Clean up input file
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }
  }
}

ipcMain.handle('whisper:checkInstalled', async () => {
  // Pass verbose=true since user is actively checking Whisper status
  const whisperPath = getWhisperBinaryPath(true);
  const modelPath = getDefaultModelPath();
  const hasFfmpeg = isFfmpegInstalled();

  return {
    installed: whisperPath !== null && modelPath !== null,
    whisperPath,
    modelPath,
    hasFfmpeg,
    modelsDir: WHISPER_MODELS_DIR,
    installInstructions: !whisperPath
      ? 'Install whisper.cpp binary: On macOS run "brew install whisper-cpp". On Linux, install "whisper-cpp" via your package manager or build from source.'
      : !hasFfmpeg
        ? 'Install ffmpeg for audio conversion: "brew install ffmpeg" on macOS, "sudo apt install ffmpeg" on Linux'
        : !modelPath
          ? `Download an AI model in Settings > Voice Input, or manually place a ggml-tiny.bin model in ${WHISPER_MODELS_DIR}.`
          : null
  };
});

ipcMain.handle('whisper:transcribe', async (_event, audioData: ArrayBuffer) => {
  // Pass verbose=true since user is actively trying to transcribe
  const whisperPath = getWhisperBinaryPath(true);
  const modelPath = getDefaultModelPath();

  if (!whisperPath) {
    throw new Error('Whisper.cpp is not installed. Install it first using brew install whisper-cpp or build from source.');
  }

  if (!modelPath) {
    throw new Error('No whisper model found. Download a model first.');
  }

  if (!isFfmpegInstalled()) {
    throw new Error('ffmpeg is required for audio conversion. Install it with: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)');
  }

  // Create temp directory
  if (!fs.existsSync(WHISPER_TEMP_DIR)) {
    fs.mkdirSync(WHISPER_TEMP_DIR, { recursive: true });
  }

  const wavPath = path.join(WHISPER_TEMP_DIR, `audio-${Date.now()}.wav`);
  const outputPath = path.join(WHISPER_TEMP_DIR, `output-${Date.now()}`);

  try {
    // Convert audio to WAV
    await convertToWav(audioData, wavPath);

    // Run whisper.cpp
    // Output format: txt (plain text)
    const command = `"${whisperPath}" -m "${modelPath}" -f "${wavPath}" -otxt -of "${outputPath}" --no-timestamps`;
    console.log(`Executing whisper command: ${command}`);

    try {
      execSync(command, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60000, // 60 second timeout
        env: process.env
      });
    } catch (error: any) {
      const stderr = error.stderr?.toString() || '';
      const stdout = error.stdout?.toString() || '';
      console.error('Whisper execution failed:');
      console.error('STDOUT:', stdout);
      console.error('STDERR:', stderr);
      throw new Error(`Transcription failed: ${error.message}${stderr ? ' - ' + stderr : ''}`);
    }

    // Read the output
    const txtPath = `${outputPath}.txt`;
    if (fs.existsSync(txtPath)) {
      const transcript = fs.readFileSync(txtPath, 'utf8').trim();

      // Clean up output file
      fs.unlinkSync(txtPath);

      return {
        transcript,
        confidence: 0.9 // Whisper doesn't provide confidence scores, use default
      };
    }

    throw new Error('Transcription output file was not created');
  } catch (error: any) {
    console.error('Whisper transcription error:', error);
    throw error;
  } finally {
    // Clean up temp files
    if (fs.existsSync(wavPath)) {
      fs.unlinkSync(wavPath);
    }
    const txtPath = `${outputPath}.txt`;
    if (fs.existsSync(txtPath)) {
      fs.unlinkSync(txtPath);
    }
  }
});

ipcMain.handle('whisper:getModels', async () => {
  // Create models directory if it doesn't exist
  if (!fs.existsSync(WHISPER_MODELS_DIR)) {
    fs.mkdirSync(WHISPER_MODELS_DIR, { recursive: true });
  }

  // Check which models are installed
  return WHISPER_MODELS.map(model => {
    const modelPath = path.join(WHISPER_MODELS_DIR, `ggml-${model.name}.bin`);
    const installed = fs.existsSync(modelPath);
    return {
      ...model,
      installed,
      path: installed ? modelPath : null
    };
  });
});

// Download whisper model
ipcMain.handle('whisper:downloadModel', async (_event, modelName: string) => {
  const model = WHISPER_MODELS.find(m => m.name === modelName);
  if (!model) {
    throw new Error(`Unknown model: ${modelName}`);
  }

  // Create models directory
  if (!fs.existsSync(WHISPER_MODELS_DIR)) {
    fs.mkdirSync(WHISPER_MODELS_DIR, { recursive: true });
  }

  const outputPath = path.join(WHISPER_MODELS_DIR, `ggml-${model.name}.bin`);

  const downloadFile = (url: string): Promise<{ success: boolean; path: string }> => {
    return new Promise((resolve, reject) => {
      const request = https.get(url, (response: any) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          downloadFile(response.headers.location).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download model: ${response.statusCode}`));
          return;
        }

        const file = fs.createWriteStream(outputPath);
        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve({ success: true, path: outputPath });
        });

        file.on('error', (err: Error) => {
          fs.unlinkSync(outputPath);
          reject(err);
        });
      });

      request.on('error', (err: Error) => {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        reject(err);
      });
    });
  };

  return downloadFile(model.url);
});

// Browser addon handlers
ipcMain.handle('addon:getSecret', () => {
  return addonServer.getStoredAddonSecret();
});

ipcMain.handle('addon:generateSecret', () => {
  return addonServer.generateAddonSecret();
});

ipcMain.handle('addon:getConnectedClients', () => {
  return addonServer.getConnectedClients();
});

ipcMain.handle('addon:getConnectedCount', () => {
  return addonServer.getConnectedClientsCount();
});

// Download browser extension as ZIP
ipcMain.handle('addon:downloadExtension', async (_event, browser: 'chrome' | 'firefox') => {
  const fs = await import('fs');
  const archiver = (await import('archiver')).default;
  
  // Get the extension folder path
  const isDev = !app.isPackaged;
  let extensionFolder: string;
  
  if (isDev) {
    // In development, use the source folder
    extensionFolder = path.join(__dirname, '..', 'browser-addon', browser === 'chrome' ? 'chrome' : 'firefox');
  } else {
    // In production, browser-addon is in app.asar.unpacked
    extensionFolder = path.join(app.getAppPath().replace('app.asar', 'app.asar.unpacked'), 'browser-addon', browser === 'chrome' ? 'chrome' : 'firefox');
  }
  
  // Check if folder exists
  if (!fs.existsSync(extensionFolder)) {
    return { success: false, error: 'Extension folder not found' };
  }
  
  // Ask user where to save
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: `Save aethermsaid hub ${browser === 'chrome' ? 'Chrome/Edge' : 'Firefox'} Extension`,
    defaultPath: path.join(app.getPath('downloads'), `aether-hub-${browser}-extension.zip`),
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
  });
  
  if (result.canceled || !result.filePath) {
    return { success: false, error: 'Save cancelled' };
  }
  
  try {
    // Create ZIP file
    const output = fs.createWriteStream(result.filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    return new Promise((resolve) => {
      output.on('close', () => {
        console.log(`🟢 ADDON: Extension ZIP created: ${result.filePath} (${archive.pointer()} bytes)`);
        // Open the folder containing the ZIP
        shell.showItemInFolder(result.filePath!);
        resolve({ success: true, path: result.filePath });
      });
      
      archive.on('error', (err: Error) => {
        console.error('🔴 ADDON: ZIP error:', err);
        resolve({ success: false, error: err.message });
      });
      
      archive.pipe(output);
      archive.directory(extensionFolder, false);
      archive.finalize();
    });
  } catch (error: any) {
    console.error('🔴 ADDON: Failed to create ZIP:', error);
    return { success: false, error: error.message };
  }
});

// Handle AI response from renderer for browser addon
ipcMain.on('addon:ai-response', (_event, response: { id: string; success: boolean; data?: any; error?: string }) => {
  console.log('🔵 MAIN: Received AI response for addon request:', response.id);
  addonServer.resolveAIRequest(response.id, response.success, response.data, response.error);
});

// Update checker - DISABLED
// ipcMain.handle('updater:check', () => {
//   autoUpdater.checkForUpdates();
// });

// OAuth handlers
ipcMain.handle('oauth:openExternal', async (_event, url: string) => {
  console.log('🟢 MAIN: Opening OAuth URL in browser');
  await shell.openExternal(url);
  return true;
});

// General shell open handler
ipcMain.handle('shell:openExternal', async (_event, url: string) => {
  console.log('🟢 MAIN: Opening external URL:', url);
  await shell.openExternal(url);
  return true;
});

// Screenshot capture handler
ipcMain.handle('screenshot:capture', async () => {
  try {
    console.log('📸 MAIN: Capturing screenshot...');
    
    // Import desktopCapturer from electron
    const { desktopCapturer } = await import('electron');
    
    // Get available sources (screens)
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });
    
    if (sources.length === 0) {
      throw new Error('No screen sources available');
    }
    
    // Get the primary display (first source)
    const primarySource = sources[0];
    const thumbnail = primarySource.thumbnail;
    
    // Convert to base64 data URL
    const dataUrl = thumbnail.toDataURL();
    
    console.log('✅ MAIN: Screenshot captured successfully');
    return { success: true, dataUrl };
    
  } catch (error: any) {
    console.error('❌ MAIN: Screenshot capture failed:', error);
    return { success: false, error: error.message };
  }
});

// Database cleanup handler
ipcMain.handle('db:cleanupLinkedIn', async () => {
  try {
    console.log('🔵 MAIN: Starting LinkedIn data cleanup...');
    const { cleanupLinkedInData } = await import('./database.js');
    const result = await cleanupLinkedInData();
    console.log('✅ MAIN: LinkedIn cleanup completed', result);
    return result;
  } catch (error) {
    console.error('❌ MAIN: LinkedIn cleanup failed:', error);
    return { error: String(error), success: false };
  }
});



// ==================== RESEND API IPC HANDLERS ====================

ipcMain.handle('resend:validateApiKey', async (_event, apiKey: string) => {
  try {
    const response = await fetch('https://api.resend.com/domains', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    return response.ok;
  } catch (error) {
    console.error('❌ MAIN: Resend API key validation failed:', error);
    return false;
  }
});

ipcMain.handle('resend:getDomains', async (_event, apiKey: string) => {
  try {
    const response = await fetch('https://api.resend.com/domains', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('❌ MAIN: Resend getDomains failed:', error);
    throw error;
  }
});

ipcMain.handle('resend:getAudiences', async (_event, apiKey: string) => {
  try {
    const response = await fetch('https://api.resend.com/audiences', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('❌ MAIN: Resend getAudiences failed:', error);
    throw error;
  }
});

ipcMain.handle('resend:getContacts', async (_event, apiKey: string, audienceId: string) => {
  try {
    const response = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('❌ MAIN: Resend getContacts failed:', error);
    throw error;
  }
});

ipcMain.handle('resend:sendEmail', async (_event, apiKey: string, emailData: any) => {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });
    if (!response.ok) {
      const errorData = await response.json() as { message?: string };
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error('❌ MAIN: Resend sendEmail failed:', err);
    throw err;
  }
});

ipcMain.handle('resend:createAudience', async (_event, apiKey: string, name: string) => {
  try {
    const response = await fetch('https://api.resend.com/audiences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('❌ MAIN: Resend createAudience failed:', error);
    throw error;
  }
});

ipcMain.handle('resend:addContact', async (_event, apiKey: string, audienceId: string, contact: any) => {
  try {
    const response = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contact)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('❌ MAIN: Resend addContact failed:', error);
    throw error;
  }
});

ipcMain.handle('resend:removeContact', async (_event, apiKey: string, audienceId: string, contactId: string) => {
  try {
    const response = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts/${contactId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return true;
  } catch (error) {
    console.error('❌ MAIN: Resend removeContact failed:', error);
    throw error;
  }
});

ipcMain.handle('resend:getEmail', async (_event, apiKey: string, emailId: string) => {
  try {
    const response = await fetch(`https://api.resend.com/emails/${emailId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('❌ MAIN: Resend getEmail failed:', error);
    throw error;
  }
});

ipcMain.handle('resend:getReceivedEmails', async (_event, apiKey: string, limit?: number) => {
  try {
    const url = limit 
      ? `https://api.resend.com/emails/receiving?limit=${limit}`
      : 'https://api.resend.com/emails/receiving';
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('❌ MAIN: Resend getReceivedEmails failed:', error);
    throw error;
  }
});

ipcMain.handle('resend:getSentEmails', async (_event, apiKey: string, limit?: number) => {
  try {
    const url = limit 
      ? `https://api.resend.com/emails?limit=${limit}`
      : 'https://api.resend.com/emails';
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('❌ MAIN: Resend getSentEmails failed:', error);
    throw error;
  }
});

// ==================== DATABASE IPC HANDLERS ====================

// Account operations
ipcMain.handle('db:accounts:getAll', () => {
  try {
    return database.accounts.getAll();
  } catch (error) {
    console.error('❌ MAIN: db:accounts:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:accounts:getById', (_event, id: string) => {
  try {
    return database.accounts.getById(id);
  } catch (error) {
    console.error('❌ MAIN: db:accounts:getById failed:', error);
    throw error;
  }
});

ipcMain.handle('db:accounts:getByPlatform', (_event, platform: string) => {
  try {
    return database.accounts.getByPlatform(platform);
  } catch (error) {
    console.error('❌ MAIN: db:accounts:getByPlatform failed:', error);
    throw error;
  }
});

ipcMain.handle('db:accounts:upsert', (_event, account: any) => {
  try {
    database.accounts.upsert(account);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:accounts:upsert failed:', error);
    throw error;
  }
});

ipcMain.handle('db:accounts:delete', (_event, id: string) => {
  try {
    database.accounts.delete(id);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:accounts:delete failed:', error);
    throw error;
  }
});

ipcMain.handle('db:accounts:deleteNullIds', () => {
  try {
    const count = database.accounts.deleteNullIds();
    console.log(`🗑️ MAIN: Deleted ${count} accounts with null IDs`);
    return count;
  } catch (error) {
    console.error('❌ MAIN: db:accounts:deleteNullIds failed:', error);
    throw error;
  }
});

// Email operations
ipcMain.handle('db:emails:getAll', () => {
  try {
    return database.emails.getAll();
  } catch (error) {
    console.error('❌ MAIN: db:emails:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:emails:getByAccount', (_event, accountId: string) => {
  try {
    return database.emails.getByAccount(accountId);
  } catch (error) {
    console.error('❌ MAIN: db:emails:getByAccount failed:', error);
    throw error;
  }
});

ipcMain.handle('db:emails:getUnread', () => {
  try {
    return database.emails.getUnread();
  } catch (error) {
    console.error('❌ MAIN: db:emails:getUnread failed:', error);
    throw error;
  }
});

ipcMain.handle('db:emails:getByTag', (_event, tag: string) => {
  try {
    return database.emails.getByTag(tag);
  } catch (error) {
    console.error('❌ MAIN: db:emails:getByTag failed:', error);
    throw error;
  }
});

ipcMain.handle('db:emails:bulkUpsert', (_event, emails: any[]) => {
  try {
    database.emails.bulkUpsert(emails);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:emails:bulkUpsert failed:', error);
    throw error;
  }
});

ipcMain.handle('db:emails:update', (_event, id: string, updates: any) => {
  try {
    database.emails.update(id, updates);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:emails:update failed:', error);
    throw error;
  }
});

ipcMain.handle('db:emails:delete', (_event, id: string) => {
  try {
    database.emails.delete(id);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:emails:delete failed:', error);
    throw error;
  }
});

ipcMain.handle('db:emails:clearByAccount', (_event, accountId: string) => {
  try {
    database.emails.clearByAccount(accountId);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:emails:clearByAccount failed:', error);
    throw error;
  }
});

// Event operations
ipcMain.handle('db:events:getAll', () => {
  try {
    return database.events.getAll();
  } catch (error) {
    console.error('❌ MAIN: db:events:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:events:getByAccount', (_event, accountId: string) => {
  try {
    return database.events.getByAccount(accountId);
  } catch (error) {
    console.error('❌ MAIN: db:events:getByAccount failed:', error);
    throw error;
  }
});

ipcMain.handle('db:events:getUpcoming', (_event, limit?: number) => {
  try {
    return database.events.getUpcoming(limit);
  } catch (error) {
    console.error('❌ MAIN: db:events:getUpcoming failed:', error);
    throw error;
  }
});

ipcMain.handle('db:events:getByDateRange', (_event, startDate: string, endDate: string) => {
  try {
    return database.events.getByDateRange(startDate, endDate);
  } catch (error) {
    console.error('❌ MAIN: db:events:getByDateRange failed:', error);
    throw error;
  }
});

ipcMain.handle('db:events:bulkUpsert', (_event, events: any[]) => {
  try {
    database.events.bulkUpsert(events);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:events:bulkUpsert failed:', error);
    throw error;
  }
});

ipcMain.handle('db:events:update', (_event, id: string, updates: any) => {
  try {
    database.events.update(id, updates);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:events:update failed:', error);
    throw error;
  }
});

ipcMain.handle('db:events:delete', (_event, id: string) => {
  try {
    database.events.delete(id);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:events:delete failed:', error);
    throw error;
  }
});

ipcMain.handle('db:events:clearByAccount', (_event, accountId: string) => {
  try {
    database.events.clearByAccount(accountId);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:events:clearByAccount failed:', error);
    throw error;
  }
});

// Folder operations
ipcMain.handle('db:folders:getAll', () => {
  try {
    return database.folders.getAll();
  } catch (error) {
    console.error('❌ MAIN: db:folders:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:folders:getById', (_event, id: string) => {
  try {
    return database.folders.getById(id);
  } catch (error) {
    console.error('❌ MAIN: db:folders:getById failed:', error);
    throw error;
  }
});

ipcMain.handle('db:folders:create', (_event, folder: any) => {
  try {
    database.folders.create(folder);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:folders:create failed:', error);
    throw error;
  }
});

ipcMain.handle('db:folders:update', (_event, id: string, updates: any) => {
  try {
    database.folders.update(id, updates);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:folders:update failed:', error);
    throw error;
  }
});

ipcMain.handle('db:folders:delete', (_event, id: string) => {
  try {
    database.folders.delete(id);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:folders:delete failed:', error);
    throw error;
  }
});

// Notification operations
ipcMain.handle('db:notifications:getAll', () => {
  try {
    return database.notifications.getAll();
  } catch (error) {
    console.error('❌ MAIN: db:notifications:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:notifications:getUnread', () => {
  try {
    return database.notifications.getUnread();
  } catch (error) {
    console.error('❌ MAIN: db:notifications:getUnread failed:', error);
    throw error;
  }
});

ipcMain.handle('db:notifications:bulkUpsert', (_event, notifications: any[]) => {
  try {
    database.notifications.bulkUpsert(notifications);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:notifications:bulkUpsert failed:', error);
    throw error;
  }
});

ipcMain.handle('db:notifications:markAsRead', (_event, id: string) => {
  try {
    database.notifications.markAsRead(id);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:notifications:markAsRead failed:', error);
    throw error;
  }
});

ipcMain.handle('db:notifications:delete', (_event, id: string) => {
  try {
    database.notifications.delete(id);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:notifications:delete failed:', error);
    throw error;
  }
});

// GitHub operations
ipcMain.handle('db:github:getAll', () => {
  try {
    return database.github.getAll();
  } catch (error) {
    console.error('❌ MAIN: db:github:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:github:getByAccount', (_event, accountId: string) => {
  try {
    return database.github.getByAccount(accountId);
  } catch (error) {
    console.error('❌ MAIN: db:github:getByAccount failed:', error);
    throw error;
  }
});

ipcMain.handle('db:github:getByType', (_event, type: string) => {
  try {
    return database.github.getByType(type);
  } catch (error) {
    console.error('❌ MAIN: db:github:getByType failed:', error);
    throw error;
  }
});

ipcMain.handle('db:github:bulkUpsert', (_event, items: any[]) => {
  try {
    database.github.bulkUpsert(items);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:github:bulkUpsert failed:', error);
    throw error;
  }
});

ipcMain.handle('db:github:markAsRead', (_event, id: string) => {
  try {
    database.github.markAsRead(id);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:github:markAsRead failed:', error);
    throw error;
  }
});

ipcMain.handle('db:github:delete', (_event, id: string) => {
  try {
    database.github.delete(id);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:github:delete failed:', error);
    throw error;
  }
});

ipcMain.handle('db:github:clearByAccount', (_event, accountId: string) => {
  try {
    database.github.clearByAccount(accountId);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:github:clearByAccount failed:', error);
    throw error;
  }
});

// Notes operations
ipcMain.handle('db:notes:getAll', () => {
  try {
    return database.notes.getAll();
  } catch (error) {
    console.error('❌ MAIN: db:notes:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:notes:getById', (_event, id: number) => {
  try {
    return database.notes.getById(id);
  } catch (error) {
    console.error('❌ MAIN: db:notes:getById failed:', error);
    throw error;
  }
});

ipcMain.handle('db:notes:getByCategory', (_event, category: string) => {
  try {
    return database.notes.getByCategory(category);
  } catch (error) {
    console.error('❌ MAIN: db:notes:getByCategory failed:', error);
    throw error;
  }
});

ipcMain.handle('db:notes:getPinned', () => {
  try {
    return database.notes.getPinned();
  } catch (error) {
    console.error('❌ MAIN: db:notes:getPinned failed:', error);
    throw error;
  }
});

ipcMain.handle('db:notes:upsert', (_event, note: any) => {
  try {
    database.notes.upsert(note);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:notes:upsert failed:', error);
    throw error;
  }
});

ipcMain.handle('db:notes:delete', (_event, id: number) => {
  try {
    database.notes.delete (id);
    return true;
  } catch (error) {
    console.error('❌ MAIN: db:notes:delete failed:', error);
    throw error;
  }
});

// ========================================
// INVOICING IPC HANDLERS
// ========================================

// Clients
ipcMain.handle('invoicing:clients:getAll', () => {
  try {
    return database.clients.getAll();
  } catch (error) {
    console.error('❌ MAIN: invoicing:clients:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:clients:getById', (_event, id: string) => {
  try {
    return database.clients.getById(id);
  } catch (error) {
    console.error('❌ MAIN: invoicing:clients:getById failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:clients:search', (_event, query: string) => {
  try {
    return database.clients.search(query);
  } catch (error) {
    console.error('❌ MAIN: invoicing:clients:search failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:clients:create', (_event, client: any) => {
  try {
    database.clients.upsert(client);
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:clients:create failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:clients:update', (_event, id: string, updates: any) => {
  try {
    database.clients.upsert({ id, ...updates });
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:clients:update failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:clients:delete', (_event, id: string) => {
  try {
    database.clients.delete(id);
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:clients:delete failed:', error);
    throw error;
  }
});

// Invoices
ipcMain.handle('invoicing:invoices:getAll', () => {
  try {
    return database.invoices.getAll();
  } catch (error) {
    console.error('❌ MAIN: invoicing:invoices:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:invoices:getById', (_event, id: string) => {
  try {
    return database.invoices.getById(id);
  } catch (error) {
    console.error('❌ MAIN: invoicing:invoices:getById failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:invoices:getByStatus', (_event, status: string) => {
  try {
    return database.invoices.getByStatus(status);
  } catch (error) {
    console.error('❌ MAIN: invoicing:invoices:getByStatus failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:invoices:getByClient', (_event, clientId: string) => {
  try {
    return database.invoices.getByClient(clientId);
  } catch (error) {
    console.error('❌ MAIN: invoicing:invoices:getByClient failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:invoices:getByPaymentStatus', (_event, paymentStatus: string) => {
  try {
    return database.invoices.getByPaymentStatus(paymentStatus);
  } catch (error) {
    console.error('❌ MAIN: invoicing:invoices:getByPaymentStatus failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:invoices:getOverdue', () => {
  try {
    return database.invoices.getOverdue();
  } catch (error) {
    console.error('❌ MAIN: invoicing:invoices:getOverdue failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:invoices:getDueSoon', (_event, days: number) => {
  try {
    return database.invoices.getDueSoon(days);
  } catch (error) {
    console.error('❌ MAIN: invoicing:invoices:getDueSoon failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:invoices:getByDateRange', (_event, startDate: string, endDate: string) => {
  try {
    return database.invoices.getByDateRange(startDate, endDate);
  } catch (error) {
    console.error('❌ MAIN: invoicing:invoices:getByDateRange failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:invoices:getNextNumber', () => {
  try {
    return database.invoices.getNextInvoiceNumber();
  } catch (error) {
    console.error('❌ MAIN: invoicing:invoices:getNextNumber failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:invoices:create', (_event, invoice: any) => {
  try {
    database.invoices.upsert(invoice);
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:invoices:create failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:invoices:update', (_event, id: string, updates: any) => {
  try {
    database.invoices.upsert({ id, ...updates });
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:invoices:update failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:invoices:updateStatus', (_event, id: string, status: string) => {
  try {
    database.invoices.updateStatus(id, status);
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:invoices:updateStatus failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:invoices:updatePayment', (_event, id: string, paymentStatus: string, paidAmount: number) => {
  try {
    database.invoices.updatePaymentStatus(id, paymentStatus, paidAmount);
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:invoices:updatePayment failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:invoices:delete', (_event, id: string) => {
  try {
    database.invoices.delete(id);
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:invoices:delete failed:', error);
    throw error;
  }
});

// Invoice Items
ipcMain.handle('invoicing:items:getByInvoice', (_event, invoiceId: string) => {
  try {
    return database.invoiceItems.getByInvoice(invoiceId);
  } catch (error) {
    console.error('❌ MAIN: invoicing:items:getByInvoice failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:items:create', (_event, item: any) => {
  try {
    database.invoiceItems.insert(item);
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:items:create failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:items:update', (_event, id: string, updates: any) => {
  try {
    database.invoiceItems.update(id, updates);
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:items:update failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:items:delete', (_event, id: string) => {
  try {
    database.invoiceItems.delete(id);
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:items:delete failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:items:deleteByInvoice', (_event, invoiceId: string) => {
  try {
    database.invoiceItems.deleteByInvoice(invoiceId);
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:items:deleteByInvoice failed:', error);
    throw error;
  }
});

// Payments
ipcMain.handle('invoicing:payments:getAll', () => {
  try {
    return database.payments.getAll();
  } catch (error) {
    console.error('❌ MAIN: invoicing:payments:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:payments:getByInvoice', (_event, invoiceId: string) => {
  try {
    return database.payments.getByInvoice(invoiceId);
  } catch (error) {
    console.error('❌ MAIN: invoicing:payments:getByInvoice failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:payments:getByDateRange', (_event, startDate: string, endDate: string) => {
  try {
    return database.payments.getByDateRange(startDate, endDate);
  } catch (error) {
    console.error('❌ MAIN: invoicing:payments:getByDateRange failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:payments:getTotalByInvoice', (_event, invoiceId: string) => {
  try {
    return database.payments.getTotalByInvoice(invoiceId);
  } catch (error) {
    console.error('❌ MAIN: invoicing:payments:getTotalByInvoice failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:payments:create', (_event, payment: any) => {
  try {
    database.payments.insert(payment);
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:payments:create failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:payments:delete', (_event, id: string) => {
  try {
    database.payments.delete(id);
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:payments:delete failed:', error);
    throw error;
  }
});

// Taxes
ipcMain.handle('invoicing:taxes:getAll', () => {
  try {
    return database.taxes.getAll();
  } catch (error) {
    console.error('❌ MAIN: invoicing:taxes:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:taxes:getById', (_event, id: string) => {
  try {
    return database.taxes.getById(id);
  } catch (error) {
    console.error('❌ MAIN: invoicing:taxes:getById failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:taxes:getDefault', () => {
  try {
    return database.taxes.getDefault();
  } catch (error) {
    console.error('❌ MAIN: invoicing:taxes:getDefault failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:taxes:create', (_event, tax: any) => {
  try {
    database.taxes.upsert(tax);
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:taxes:create failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:taxes:update', (_event, id: string, updates: any) => {
  try {
    database.taxes.upsert({ id, ...updates });
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:taxes:update failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:taxes:delete', (_event, id: string) => {
  try {
    database.taxes.delete(id);
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:taxes:delete failed:', error);
    throw error;
  }
});

// Recurring Invoices
ipcMain.handle('invoicing:recurring:getAll', () => {
  try {
    return database.recurringInvoices.getAll();
  } catch (error) {
    console.error('❌ MAIN: invoicing:recurring:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:recurring:getById', (_event, id: string) => {
  try {
    return database.recurringInvoices.getById(id);
  } catch (error) {
    console.error('❌ MAIN: invoicing:recurring:getById failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:recurring:getActive', () => {
  try {
    return database.recurringInvoices.getActive();
  } catch (error) {
    console.error('❌ MAIN: invoicing:recurring:getActive failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:recurring:getDueToday', () => {
  try {
    return database.recurringInvoices.getDueToday();
  } catch (error) {
    console.error('❌ MAIN: invoicing:recurring:getDueToday failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:recurring:create', (_event, profile: any) => {
  try {
    database.recurringInvoices.upsert(profile);
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:recurring:create failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:recurring:update', (_event, id: string, updates: any) => {
  try {
    database.recurringInvoices.upsert({ id, ...updates });
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:recurring:update failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:recurring:updateNextDate', (_event, id: string, nextIssueDate: string) => {
  try {
    database.recurringInvoices.updateNextIssueDate(id, nextIssueDate);
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:recurring:updateNextDate failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:recurring:delete', (_event, id: string) => {
  try {
    database.recurringInvoices.delete(id);
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:recurring:delete failed:', error);
    throw error;
  }
});

// Invoice Settings
ipcMain.handle('invoicing:settings:get', () => {
  try {
    return database.invoiceSettings.get();
  } catch (error) {
    console.error('❌ MAIN: invoicing:settings:get failed:', error);
    throw error;
  }
});

ipcMain.handle('invoicing:settings:update', (_event, settings: any) => {
  try {
    database.invoiceSettings.upsert(settings);
    return true;
  } catch (error) {
    console.error('❌ MAIN: invoicing:settings:update failed:', error);
    throw error;
  }
});

// Chat Sessions
ipcMain.handle('db:chatSessions:getAll', () => {
  try {
    return database.chatSessions.getAll();
  } catch (error) {
    console.error('❌ MAIN: db:chatSessions:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:chatSessions:getById', (_event, id: string) => {
  try {
    return database.chatSessions.getById(id);
  } catch (error) {
    console.error('❌ MAIN: db:chatSessions:getById failed:', error);
    throw error;
  }
});

ipcMain.handle('db:chatSessions:create', (_event, session: any) => {
  try {
    return database.chatSessions.create(session);
  } catch (error) {
    console.error('❌ MAIN: db:chatSessions:create failed:', error);
    throw error;
  }
});

ipcMain.handle('db:chatSessions:update', (_event, id: string, updates: any) => {
  try {
    return database.chatSessions.update(id, updates);
  } catch (error) {
    console.error('❌ MAIN: db:chatSessions:update failed:', error);
    throw error;
  }
});

ipcMain.handle('db:chatSessions:delete', (_event, id: string) => {
  try {
    return database.chatSessions.delete(id);
  } catch (error) {
    console.error('❌ MAIN: db:chatSessions:delete failed:', error);
    throw error;
  }
});

// Chat Messages
ipcMain.handle('db:chatMessages:getBySession', (_event, sessionId: string) => {
  try {
    return database.chatMessages.getBySession(sessionId);
  } catch (error) {
    console.error('❌ MAIN: db:chatMessages:getBySession failed:', error);
    throw error;
  }
});

ipcMain.handle('db:chatMessages:create', (_event, message: any) => {
  try {
    return database.chatMessages.create(message);
  } catch (error) {
    console.error('❌ MAIN: db:chatMessages:create failed:', error);
    throw error;
  }
});

ipcMain.handle('db:chatMessages:deleteBySession', (_event, sessionId: string) => {
  try {
    return database.chatMessages.deleteBySession(sessionId);
  } catch (error) {
    console.error('❌ MAIN: db:chatMessages:deleteBySession failed:', error);
    throw error;
  }
});

// Knowledge Base Messages
ipcMain.handle('db:knowledgeMessages:getAll', () => {
  try {
    return database.knowledgeMessages.getAll();
  } catch (error) {
    console.error('❌ MAIN: db:knowledgeMessages:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:knowledgeMessages:create', (_event, message: any) => {
  try {
    return database.knowledgeMessages.create(message);
  } catch (error) {
    console.error('❌ MAIN: db:knowledgeMessages:create failed:', error);
    throw error;
  }
});

ipcMain.handle('db:knowledgeMessages:deleteAll', () => {
  try {
    return database.knowledgeMessages.deleteAll();
  } catch (error) {
    console.error('❌ MAIN: db:knowledgeMessages:deleteAll failed:', error);
    throw error;
  }
});

// Knowledge Base Insights
ipcMain.handle('db:knowledgeInsights:getAll', () => {
  try {
    return database.knowledgeInsights.getAll();
  } catch (error) {
    console.error('❌ MAIN: db:knowledgeInsights:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:knowledgeInsights:create', (_event, insight: any) => {
  try {
    return database.knowledgeInsights.create(insight);
  } catch (error) {
    console.error('❌ MAIN: db:knowledgeInsights:create failed:', error);
    throw error;
  }
});

ipcMain.handle('db:knowledgeInsights:delete', (_event, id: string) => {
  try {
    return database.knowledgeInsights.delete(id);
  } catch (error) {
    console.error('❌ MAIN: db:knowledgeInsights:delete failed:', error);
    throw error;
  }
});

ipcMain.handle('db:knowledgeInsights:deleteAll', () => {
  try {
    return database.knowledgeInsights.deleteAll();
  } catch (error) {
    console.error('❌ MAIN: db:knowledgeInsights:deleteAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:knowledgeInsights:update', (_event, id: string, updates: any) => {
  try {
    return database.knowledgeInsights.update(id, updates);
  } catch (error) {
    console.error('❌ MAIN: db:knowledgeInsights:update failed:', error);
    throw error;
  }
});

// User Activities Database Operations
ipcMain.handle('db:userActivities:getAll', (_event, limit: number) => {
  try {
    return database.userActivities.getAll(limit);
  } catch (error) {
    console.error('❌ MAIN: db:userActivities:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:userActivities:getByPlatform', (_event, platform: string, limit: number) => {
  try {
    return database.userActivities.getByPlatform(platform, limit);
  } catch (error) {
    console.error('❌ MAIN: db:userActivities:getByPlatform failed:', error);
    throw error;
  }
});

ipcMain.handle('db:userActivities:getByDateRange', (_event, startDate: string, endDate: string) => {
  try {
    return database.userActivities.getByDateRange(startDate, endDate);
  } catch (error) {
    console.error('❌ MAIN: db:userActivities:getByDateRange failed:', error);
    throw error;
  }
});

ipcMain.handle('db:userActivities:getByActionType', (_event, actionType: string, limit: number) => {
  try {
    return database.userActivities.getByActionType(actionType, limit);
  } catch (error) {
    console.error('❌ MAIN: db:userActivities:getByActionType failed:', error);
    throw error;
  }
});

ipcMain.handle('db:userActivities:insert', (_event, activity: any) => {
  try {
    return database.userActivities.insert(activity);
  } catch (error) {
    console.error('❌ MAIN: db:userActivities:insert failed:', error);
    throw error;
  }
});

ipcMain.handle('db:userActivities:deleteOlderThan', (_event, days: number) => {
  try {
    return database.userActivities.deleteOlderThan(days);
  } catch (error) {
    console.error('❌ MAIN: db:userActivities:deleteOlderThan failed:', error);
    throw error;
  }
});

// Knowledge Context Database Operations
ipcMain.handle('db:knowledgeContext:getAll', () => {
  try {
    return database.knowledgeContext.getAll();
  } catch (error) {
    console.error('❌ MAIN: db:knowledgeContext:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:knowledgeContext:getByCategory', (_event, category: string) => {
  try {
    return database.knowledgeContext.getByCategory(category);
  } catch (error) {
    console.error('❌ MAIN: db:knowledgeContext:getByCategory failed:', error);
    throw error;
  }
});

ipcMain.handle('db:knowledgeContext:get', (_event, category: string, key: string) => {
  try {
    return database.knowledgeContext.get(category, key);
  } catch (error) {
    console.error('❌ MAIN: db:knowledgeContext:get failed:', error);
    throw error;
  }
});

ipcMain.handle('db:knowledgeContext:upsert', (_event, context: any) => {
  try {
    return database.knowledgeContext.upsert(context);
  } catch (error) {
    console.error('❌ MAIN: db:knowledgeContext:upsert failed:', error);
    throw error;
  }
});

ipcMain.handle('db:knowledgeContext:delete', (_event, id: string) => {
  try {
    return database.knowledgeContext.delete(id);
  } catch (error) {
    console.error('❌ MAIN: db:knowledgeContext:delete failed:', error);
    throw error;
  }
});

// Conversation Summaries Database Operations
ipcMain.handle('db:conversationSummaries:getAll', (_event, limit: number) => {
  try {
    return database.conversationSummaries.getAll(limit);
  } catch (error) {
    console.error('❌ MAIN: db:conversationSummaries:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:conversationSummaries:getByPlatform', (_event, platform: string, limit: number) => {
  try {
    return database.conversationSummaries.getByPlatform(platform, limit);
  } catch (error) {
    console.error('❌ MAIN: db:conversationSummaries:getByPlatform failed:', error);
    throw error;
  }
});

ipcMain.handle('db:conversationSummaries:get', (_event, platform: string, threadId: string) => {
  try {
    return database.conversationSummaries.get(platform, threadId);
  } catch (error) {
    console.error('❌ MAIN: db:conversationSummaries:get failed:', error);
    throw error;
  }
});

ipcMain.handle('db:conversationSummaries:upsert', (_event, summary: any) => {
  try {
    return database.conversationSummaries.upsert(summary);
  } catch (error) {
    console.error('❌ MAIN: db:conversationSummaries:upsert failed:', error);
    throw error;
  }
});

ipcMain.handle('db:conversationSummaries:delete', (_event, id: string) => {
  try {
    return database.conversationSummaries.delete(id);
  } catch (error) {
    console.error('❌ MAIN: db:conversationSummaries:delete failed:', error);
    throw error;
  }
});

// WhatsApp Database Operations
ipcMain.handle('db:whatsapp:getChats', (_event, accountId: string) => {
  try {
    return database.whatsappChats.getAll(accountId);
  } catch (error) {
    console.error('❌ MAIN: db:whatsapp:getChats failed:', error);
    throw error;
  }
});

ipcMain.handle('db:whatsapp:getMessages', (_event, chatId: string, limit?: number) => {
  try {
    return database.whatsappMessages.getByChat(chatId, limit);
  } catch (error) {
    console.error('❌ MAIN: db:whatsapp:getMessages failed:', error);
    throw error;
  }
});

ipcMain.handle('db:whatsapp:getRecentMessages', (_event, accountId: string, limit?: number) => {
  try {
    return database.whatsappMessages.getRecent(accountId, limit);
  } catch (error) {
    console.error('❌ MAIN: db:whatsapp:getRecentMessages failed:', error);
    throw error;
  }
});

ipcMain.handle('db:whatsapp:getAccounts', () => {
  try {
    return database.whatsappAccounts.getAll();
  } catch (error) {
    console.error('❌ MAIN: db:whatsapp:getAccounts failed:', error);
    throw error;
  }
});

// Discord Database Operations
ipcMain.handle('db:discord:getGuilds', (_event, accountId: string) => {
  try {
    return database.discordGuilds.getByAccount(accountId);
  } catch (error) {
    console.error('❌ MAIN: db:discord:getGuilds failed:', error);
    throw error;
  }
});

ipcMain.handle('db:discord:getMessages', (_event, channelId: string, limit?: number) => {
  try {
    return database.discordMessages.getByChannel(channelId, limit);
  } catch (error) {
    console.error('❌ MAIN: db:discord:getMessages failed:', error);
    throw error;
  }
});

ipcMain.handle('db:discord:getRecentMessages', (_event, accountId: string, limit?: number) => {
  try {
    return database.discordMessages.getRecent(accountId, limit);
  } catch (error) {
    console.error('❌ MAIN: db:discord:getRecentMessages failed:', error);
    throw error;
  }
});

// Telegram Database Operations
ipcMain.handle('db:telegram:getConnectedAccount', () => {
  try {
    return database.telegramAccounts.getConnected();
  } catch (error) {
    console.error('❌ MAIN: db:telegram:getConnectedAccount failed:', error);
    throw error;
  }
});

ipcMain.handle('db:telegram:updateAISettings', (_event, id: string, aiSettings: string) => {
  try {
    return database.telegramAccounts.updateAISettings(id, aiSettings);
  } catch (error) {
    console.error('❌ MAIN: db:telegram:updateAISettings failed:', error);
    throw error;
  }
});

ipcMain.handle('db:telegram:getAccounts', () => {
  try {
    return database.telegramAccounts.getAll();
  } catch (error) {
    console.error('❌ MAIN: db:telegram:getAccounts failed:', error);
    throw error;
  }
});

ipcMain.handle('db:telegram:getChats', (_event, accountId: string) => {
  try {
    return database.telegramChats.getAll(accountId);
  } catch (error) {
    console.error('❌ MAIN: db:telegram:getChats failed:', error);
    throw error;
  }
});

ipcMain.handle('db:telegram:getMessages', (_event, chatId: string, limit?: number) => {
  try {
    return database.telegramMessages.getByChat(chatId, limit);
  } catch (error) {
    console.error('❌ MAIN: db:telegram:getMessages failed:', error);
    throw error;
  }
});

ipcMain.handle('db:telegram:upsertAccount', (_event, account: any) => {
  try {
    return database.telegramAccounts.upsert(account);
  } catch (error) {
    console.error('❌ MAIN: db:telegram:upsertAccount failed:', error);
    throw error;
  }
});

// ==================== WATCHED ITEMS IPC HANDLERS ====================

ipcMain.handle('db:watchedItems:getAll', () => {
  try {
    return database.watchedItems.getAll();
  } catch (error) {
    console.error('❌ MAIN: db:watchedItems:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchedItems:getByPlatform', (_event, platform: string) => {
  try {
    return database.watchedItems.getByPlatform(platform);
  } catch (error) {
    console.error('❌ MAIN: db:watchedItems:getByPlatform failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchedItems:getByStatus', (_event, actionStatus: string) => {
  try {
    return database.watchedItems.getByStatus(actionStatus);
  } catch (error) {
    console.error('❌ MAIN: db:watchedItems:getByStatus failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchedItems:getActive', () => {
  try {
    return database.watchedItems.getActive();
  } catch (error) {
    console.error('❌ MAIN: db:watchedItems:getActive failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchedItems:getPending', () => {
  try {
    return database.watchedItems.getPending();
  } catch (error) {
    console.error('❌ MAIN: db:watchedItems:getPending failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchedItems:getById', (_event, id: string) => {
  try {
    return database.watchedItems.getById(id);
  } catch (error) {
    console.error('❌ MAIN: db:watchedItems:getById failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchedItems:getByItemId', (_event, platform: string, itemType: string, itemId: string) => {
  try {
    return database.watchedItems.getByItemId(platform, itemType, itemId);
  } catch (error) {
    console.error('❌ MAIN: db:watchedItems:getByItemId failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchedItems:isWatched', (_event, platform: string, itemType: string, itemId: string) => {
  try {
    return database.watchedItems.isWatched(platform, itemType, itemId);
  } catch (error) {
    console.error('❌ MAIN: db:watchedItems:isWatched failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchedItems:create', (_event, item: any) => {
  try {
    return database.watchedItems.create(item);
  } catch (error) {
    console.error('❌ MAIN: db:watchedItems:create failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchedItems:update', (_event, id: string, updates: any) => {
  try {
    return database.watchedItems.update(id, updates);
  } catch (error) {
    console.error('❌ MAIN: db:watchedItems:update failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchedItems:updateStatus', (_event, id: string, actionStatus: string) => {
  try {
    return database.watchedItems.updateStatus(id, actionStatus);
  } catch (error) {
    console.error('❌ MAIN: db:watchedItems:updateStatus failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchedItems:toggleWatch', (_event, id: string) => {
  try {
    return database.watchedItems.toggleWatch(id);
  } catch (error) {
    console.error('❌ MAIN: db:watchedItems:toggleWatch failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchedItems:delete', (_event, id: string) => {
  try {
    return database.watchedItems.delete(id);
  } catch (error) {
    console.error('❌ MAIN: db:watchedItems:delete failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchedItems:deleteByItemId', (_event, platform: string, itemType: string, itemId: string) => {
  try {
    return database.watchedItems.deleteByItemId(platform, itemType, itemId);
  } catch (error) {
    console.error('❌ MAIN: db:watchedItems:deleteByItemId failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchedItems:clearCompleted', () => {
  try {
    return database.watchedItems.clearCompleted();
  } catch (error) {
    console.error('❌ MAIN: db:watchedItems:clearCompleted failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchedItems:clearDismissed', () => {
  try {
    return database.watchedItems.clearDismissed();
  } catch (error) {
    console.error('❌ MAIN: db:watchedItems:clearDismissed failed:', error);
    throw error;
  }
});

// Watch Actions IPC handlers
ipcMain.handle('db:watchActions:getAll', () => {
  try {
    return database.watchActions.getAll();
  } catch (error) {
    console.error('❌ MAIN: db:watchActions:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchActions:getByStatus', (_event, status: string) => {
  try {
    return database.watchActions.getByStatus(status);
  } catch (error) {
    console.error('❌ MAIN: db:watchActions:getByStatus failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchActions:getByWatchedItem', (_event, watchedItemId: string) => {
  try {
    return database.watchActions.getByWatchedItem(watchedItemId);
  } catch (error) {
    console.error('❌ MAIN: db:watchActions:getByWatchedItem failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchActions:create', (_event, action: { id: string; watched_item_id: string; title: string; description?: string; priority?: string; source_content?: string; source_message_ids?: string }) => {
  try {
    return database.watchActions.create(action);
  } catch (error) {
    console.error('❌ MAIN: db:watchActions:create failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchActions:updateStatus', (_event, id: string, status: string) => {
  try {
    return database.watchActions.updateStatus(id, status);
  } catch (error) {
    console.error('❌ MAIN: db:watchActions:updateStatus failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchActions:delete', (_event, id: string) => {
  try {
    return database.watchActions.delete(id);
  } catch (error) {
    console.error('❌ MAIN: db:watchActions:delete failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchActions:clearCompleted', () => {
  try {
    return database.watchActions.clearCompleted();
  } catch (error) {
    console.error('❌ MAIN: db:watchActions:clearCompleted failed:', error);
    throw error;
  }
});

ipcMain.handle('db:watchActions:clearDismissed', () => {
  try {
    return database.watchActions.clearDismissed();
  } catch (error) {
    console.error('❌ MAIN: db:watchActions:clearDismissed failed:', error);
    throw error;
  }
});

// Analyzed Messages IPC handlers
ipcMain.handle('db:analyzedMessages:isAnalyzed', (_event, watchedItemId: string, messageId: string) => {
  try {
    return database.analyzedMessages.isAnalyzed(watchedItemId, messageId);
  } catch (error) {
    console.error('❌ MAIN: db:analyzedMessages:isAnalyzed failed:', error);
    throw error;
  }
});

ipcMain.handle('db:analyzedMessages:markAsAnalyzed', (_event, watchedItemId: string, messageIds: string[], platform: string) => {
  try {
    return database.analyzedMessages.markAsAnalyzed(watchedItemId, messageIds, platform);
  } catch (error) {
    console.error('❌ MAIN: db:analyzedMessages:markAsAnalyzed failed:', error);
    throw error;
  }
});

ipcMain.handle('db:analyzedMessages:getAnalyzedIds', (_event, watchedItemId: string) => {
  try {
    return database.analyzedMessages.getAnalyzedIds(watchedItemId);
  } catch (error) {
    console.error('❌ MAIN: db:analyzedMessages:getAnalyzedIds failed:', error);
    throw error;
  }
});

ipcMain.handle('db:analyzedMessages:clearByWatchedItem', (_event, watchedItemId: string) => {
  try {
    return database.analyzedMessages.clearByWatchedItem(watchedItemId);
  } catch (error) {
    console.error('❌ MAIN: db:analyzedMessages:clearByWatchedItem failed:', error);
    throw error;
  }
});

// Resend Templates IPC Handlers
ipcMain.handle('db:resendTemplates:getAll', () => {
  try {
    return database.resendTemplates.getAll();
  } catch (error) {
    console.error('❌ MAIN: db:resendTemplates:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:resendTemplates:getById', (_event, id: string) => {
  try {
    return database.resendTemplates.getById(id);
  } catch (error) {
    console.error('❌ MAIN: db:resendTemplates:getById failed:', error);
    throw error;
  }
});

ipcMain.handle('db:resendTemplates:create', (_event, template: any) => {
  try {
    return database.resendTemplates.create(template);
  } catch (error) {
    console.error('❌ MAIN: db:resendTemplates:create failed:', error);
    throw error;
  }
});

ipcMain.handle('db:resendTemplates:update', (_event, id: string, updates: any) => {
  try {
    return database.resendTemplates.update(id, updates);
  } catch (error) {
    console.error('❌ MAIN: db:resendTemplates:update failed:', error);
    throw error;
  }
});

ipcMain.handle('db:resendTemplates:delete', (_event, id: string) => {
  try {
    return database.resendTemplates.delete(id);
  } catch (error) {
    console.error('❌ MAIN: db:resendTemplates:delete failed:', error);
    throw error;
  }
});

// Resend Sent Emails IPC Handlers
ipcMain.handle('db:resendSentEmails:getAll', (_event, limit?: number) => {
  try {
    return database.resendSentEmails.getAll(limit);
  } catch (error) {
    console.error('❌ MAIN: db:resendSentEmails:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:resendSentEmails:getById', (_event, id: string) => {
  try {
    return database.resendSentEmails.getById(id);
  } catch (error) {
    console.error('❌ MAIN: db:resendSentEmails:getById failed:', error);
    throw error;
  }
});

ipcMain.handle('db:resendSentEmails:create', (_event, email: any) => {
  try {
    return database.resendSentEmails.create(email);
  } catch (error) {
    console.error('❌ MAIN: db:resendSentEmails:create failed:', error);
    throw error;
  }
});

ipcMain.handle('db:resendSentEmails:updateEvent', (_event, id: string, lastEvent: string, clicks?: number, opens?: number) => {
  try {
    return database.resendSentEmails.updateEvent(id, lastEvent, clicks, opens);
  } catch (error) {
    console.error('❌ MAIN: db:resendSentEmails:updateEvent failed:', error);
    throw error;
  }
});

ipcMain.handle('db:resendSentEmails:delete', (_event, id: string) => {
  try {
    return database.resendSentEmails.delete(id);
  } catch (error) {
    console.error('❌ MAIN: db:resendSentEmails:delete failed:', error);
    throw error;
  }
});

ipcMain.handle('db:resendSentEmails:deleteAll', () => {
  try {
    return database.resendSentEmails.deleteAll();
  } catch (error) {
    console.error('❌ MAIN: db:resendSentEmails:deleteAll failed:', error);
    throw error;
  }
});

// Intelligence Feeds IPC Handlers
ipcMain.handle('db:intelligenceFeeds:getAll', () => {
  try {
    return database.intelligenceFeeds.getAll();
  } catch (error) {
    console.error('❌ MAIN: db:intelligenceFeeds:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:intelligenceFeeds:getRecent', (_event, limit: number) => {
  try {
    return database.intelligenceFeeds.getRecent(limit);
  } catch (error) {
    console.error('❌ MAIN: db:intelligenceFeeds:getRecent failed:', error);
    throw error;
  }
});

ipcMain.handle('db:intelligenceFeeds:getByCategory', (_event, category: string) => {
  try {
    return database.intelligenceFeeds.getByCategory(category);
  } catch (error) {
    console.error('❌ MAIN: db:intelligenceFeeds:getByCategory failed:', error);
    throw error;
  }
});

ipcMain.handle('db:intelligenceFeeds:getById', (_event, id: string) => {
  try {
    return database.intelligenceFeeds.getById(id);
  } catch (error) {
    console.error('❌ MAIN: db:intelligenceFeeds:getById failed:', error);
    throw error;
  }
});

ipcMain.handle('db:intelligenceFeeds:create', (_event, feed: any) => {
  try {
    return database.intelligenceFeeds.create(feed);
  } catch (error) {
    console.error('❌ MAIN: db:intelligenceFeeds:create failed:', error);
    throw error;
  }
});

ipcMain.handle('db:intelligenceFeeds:delete', (_event, id: string) => {
  try {
    return database.intelligenceFeeds.delete(id);
  } catch (error) {
    console.error('❌ MAIN: db:intelligenceFeeds:delete failed:', error);
    throw error;
  }
});

ipcMain.handle('db:intelligenceFeeds:deleteOlderThan', (_event, days: number) => {
  try {
    return database.intelligenceFeeds.deleteOlderThan(days);
  } catch (error) {
    console.error('❌ MAIN: db:intelligenceFeeds:deleteOlderThan failed:', error);
    throw error;
  }
});

// ==================== YOUTUBE DATABASE IPC HANDLERS ====================

// YouTube Channels
ipcMain.handle('db:youtube:channels:getAll', () => {
  try {
    return database.youtubeChannels.getAll();
  } catch (error) {
    console.error('❌ MAIN: db:youtube:channels:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:youtube:channels:getActive', () => {
  try {
    return database.youtubeChannels.getActive();
  } catch (error) {
    console.error('❌ MAIN: db:youtube:channels:getActive failed:', error);
    throw error;
  }
});

ipcMain.handle('db:youtube:channels:getById', (_event, id: string) => {
  try {
    return database.youtubeChannels.getById(id);
  } catch (error) {
    console.error('❌ MAIN: db:youtube:channels:getById failed:', error);
    throw error;
  }
});

ipcMain.handle('db:youtube:channels:getByChannelId', (_event, channelId: string) => {
  try {
    return database.youtubeChannels.getByChannelId(channelId);
  } catch (error) {
    console.error('❌ MAIN: db:youtube:channels:getByChannelId failed:', error);
    throw error;
  }
});

ipcMain.handle('db:youtube:channels:create', (_event, channel: any) => {
  try {
    return database.youtubeChannels.create(channel);
  } catch (error) {
    console.error('❌ MAIN: db:youtube:channels:create failed:', error);
    throw error;
  }
});

ipcMain.handle('db:youtube:channels:update', (_event, id: string, updates: any) => {
  try {
    return database.youtubeChannels.update(id, updates);
  } catch (error) {
    console.error('❌ MAIN: db:youtube:channels:update failed:', error);
    throw error;
  }
});

ipcMain.handle('db:youtube:channels:toggleActive', (_event, id: string) => {
  try {
    return database.youtubeChannels.toggleActive(id);
  } catch (error) {
    console.error('❌ MAIN: db:youtube:channels:toggleActive failed:', error);
    throw error;
  }
});

ipcMain.handle('db:youtube:channels:delete', (_event, id: string) => {
  try {
    return database.youtubeChannels.delete(id);
  } catch (error) {
    console.error('❌ MAIN: db:youtube:channels:delete failed:', error);
    throw error;
  }
});

// YouTube Videos
ipcMain.handle('db:youtube:videos:getAll', (_event, limit?: number) => {
  try {
    return database.youtubeVideos.getAll(limit);
  } catch (error) {
    console.error('❌ MAIN: db:youtube:videos:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:youtube:videos:getByChannel', (_event, channelId: string, limit?: number) => {
  try {
    return database.youtubeVideos.getByChannel(channelId, limit);
  } catch (error) {
    console.error('❌ MAIN: db:youtube:videos:getByChannel failed:', error);
    throw error;
  }
});

ipcMain.handle('db:youtube:videos:getById', (_event, id: string) => {
  try {
    return database.youtubeVideos.getById(id);
  } catch (error) {
    console.error('❌ MAIN: db:youtube:videos:getById failed:', error);
    throw error;
  }
});

ipcMain.handle('db:youtube:videos:getUnanalyzed', (_event, limit?: number) => {
  try {
    return database.youtubeVideos.getUnanalyzed(limit);
  } catch (error) {
    console.error('❌ MAIN: db:youtube:videos:getUnanalyzed failed:', error);
    throw error;
  }
});

ipcMain.handle('db:youtube:videos:getByDateRange', (_event, startDate: string, endDate: string) => {
  try {
    return database.youtubeVideos.getByDateRange(startDate, endDate);
  } catch (error) {
    console.error('❌ MAIN: db:youtube:videos:getByDateRange failed:', error);
    throw error;
  }
});

ipcMain.handle('db:youtube:videos:getHighValue', (_event, minScore?: number, limit?: number) => {
  try {
    return database.youtubeVideos.getHighValue(minScore, limit);
  } catch (error) {
    console.error('❌ MAIN: db:youtube:videos:getHighValue failed:', error);
    throw error;
  }
});

ipcMain.handle('db:youtube:videos:updateAnalysis', (_event, id: string, analysis: any) => {
  try {
    return database.youtubeVideos.updateAnalysis(id, analysis);
  } catch (error) {
    console.error('❌ MAIN: db:youtube:videos:updateAnalysis failed:', error);
    throw error;
  }
});

ipcMain.handle('db:youtube:videos:markAsWatched', (_event, id: string) => {
  try {
    return database.youtubeVideos.markAsWatched(id);
  } catch (error) {
    console.error('❌ MAIN: db:youtube:videos:markAsWatched failed:', error);
    throw error;
  }
});

ipcMain.handle('db:youtube:videos:delete', (_event, id: string) => {
  try {
    return database.youtubeVideos.delete(id);
  } catch (error) {
    console.error('❌ MAIN: db:youtube:videos:delete failed:', error);
    throw error;
  }
});

// User Interests
ipcMain.handle('db:userInterests:getAll', () => {
  try {
    return database.userInterests.getAll();
  } catch (error) {
    console.error('❌ MAIN: db:userInterests:getAll failed:', error);
    throw error;
  }
});

ipcMain.handle('db:userInterests:getByCategory', (_event, category: string) => {
  try {
    return database.userInterests.getByCategory(category);
  } catch (error) {
    console.error('❌ MAIN: db:userInterests:getByCategory failed:', error);
    throw error;
  }
});

ipcMain.handle('db:userInterests:upsert', (_event, interest: any) => {
  try {
    return database.userInterests.upsert(interest);
  } catch (error) {
    console.error('❌ MAIN: db:userInterests:upsert failed:', error);
    throw error;
  }
});

ipcMain.handle('db:userInterests:delete', (_event, id: string) => {
  try {
    return database.userInterests.delete(id);
  } catch (error) {
    console.error('❌ MAIN: db:userInterests:delete failed:', error);
    throw error;
  }
});

// ==================== YOUTUBE OPERATIONS IPC HANDLERS ====================

// Extract channel ID from URL using Puppeteer
ipcMain.handle('youtube:extractChannelId', async (_event, url: string) => {
  try {
    return await youtube.extractChannelId(url);
  } catch (error) {
    console.error('❌ MAIN: youtube:extractChannelId failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Fetch channel RSS feed
ipcMain.handle('youtube:fetchChannelFeed', async (_event, channelId: string) => {
  try {
    return await youtube.fetchChannelFeed(channelId);
  } catch (error) {
    console.error('❌ MAIN: youtube:fetchChannelFeed failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Get video transcript
ipcMain.handle('youtube:getVideoTranscript', async (_event, videoId: string) => {
  try {
    return await youtube.getVideoTranscript(videoId);
  } catch (error) {
    console.error('❌ MAIN: youtube:getVideoTranscript failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Sync all active channels
ipcMain.handle('youtube:syncAllChannels', async () => {
  try {
    return await youtube.syncAllChannels();
  } catch (error) {
    console.error('❌ MAIN: youtube:syncAllChannels failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Build RSS URL from channel ID
ipcMain.handle('youtube:buildRssUrl', (_event, channelId: string) => {
  return youtube.buildRssUrl(channelId);
});

// ==================== END DATABASE IPC HANDLERS ====================

// ==================== CHROME PROFILE IPC HANDLERS ====================

interface ChromeProfile {
  id: string;
  name: string;
  path: string;
  email?: string;
  avatar?: string;
}

// Get Chrome config directory based on platform
function getChromeConfigDir(): string | null {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  
  switch (process.platform) {
    case 'linux':
      // Try Google Chrome first, then Chromium
      const linuxChrome = path.join(homeDir, '.config', 'google-chrome');
      const linuxChromium = path.join(homeDir, '.config', 'chromium');
      if (fs.existsSync(linuxChrome)) return linuxChrome;
      if (fs.existsSync(linuxChromium)) return linuxChromium;
      return null;
    case 'darwin':
      const macChrome = path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome');
      if (fs.existsSync(macChrome)) return macChrome;
      return null;
    case 'win32':
      const winChrome = path.join(homeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
      if (fs.existsSync(winChrome)) return winChrome;
      return null;
    default:
      return null;
  }
}

// Get list of Chrome profiles
ipcMain.handle('chrome:getProfiles', async (): Promise<ChromeProfile[]> => {
  try {
    const configDir = getChromeConfigDir();
    if (!configDir) {
      console.warn('⚠️ MAIN: Chrome config directory not found');
      return [];
    }

    const profiles: ChromeProfile[] = [];
    const entries = fs.readdirSync(configDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      // Check for Default and Profile N directories
      if (entry.name === 'Default' || entry.name.startsWith('Profile ')) {
        const profilePath = path.join(configDir, entry.name);
        const preferencesPath = path.join(profilePath, 'Preferences');
        
        let profileName = entry.name === 'Default' ? 'Default' : entry.name;
        let email: string | undefined;
        let avatar: string | undefined;

        // Try to read profile preferences for name and email
        if (fs.existsSync(preferencesPath)) {
          try {
            const prefs = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'));
            
            // Get profile name
            if (prefs.profile?.name) {
              profileName = prefs.profile.name;
            }
            
            // Get email from account info
            if (prefs.account_info && prefs.account_info.length > 0) {
              email = prefs.account_info[0].email;
            }
            
            // Get avatar path
            if (prefs.profile?.gaia_info_picture_url) {
              avatar = prefs.profile.gaia_info_picture_url;
            }
          } catch (parseErr) {
            console.warn(`⚠️ MAIN: Failed to parse preferences for ${entry.name}:`, parseErr);
          }
        }

        profiles.push({
          id: entry.name,
          name: profileName,
          path: profilePath,
          email,
          avatar
        });
      }
    }

    console.log(`✅ MAIN: Found ${profiles.length} Chrome profiles`);
    return profiles;
  } catch (error) {
    console.error('❌ MAIN: chrome:getProfiles failed:', error);
    return [];
  }
});

// Get Chrome executable path
ipcMain.handle('chrome:getExecutablePath', (): string | null => {
  switch (process.platform) {
    case 'linux':
      const linuxPaths = [
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium'
      ];
      for (const p of linuxPaths) {
        if (fs.existsSync(p)) return p;
      }
      return null;
    case 'darwin':
      const macPaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium'
      ];
      for (const p of macPaths) {
        if (fs.existsSync(p)) return p;
      }
      return null;
    case 'win32':
      const winPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
      ];
      for (const p of winPaths) {
        if (fs.existsSync(p)) return p;
      }
      return null;
    default:
      return null;
  }
});

// Check if Chrome is installed
ipcMain.handle('chrome:isInstalled', (): boolean => {
  const configDir = getChromeConfigDir();
  return configDir !== null;
});

// ==================== PYTHON & BROWSER-USE IPC HANDLERS ====================

// Check if Python is installed
ipcMain.handle('python:checkInstalled', async () => {
  try {
    const result = execSync('python3 --version', { 
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const version = result.trim().replace('Python ', '');
    return { installed: true, version };
  } catch (error) {
    // Try 'python' command
    try {
      const result = execSync('python --version', { 
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      const version = result.trim().replace('Python ', '');
      return { installed: true, version };
    } catch {
      return { installed: false, version: null };
    }
  }
});

// Check if uv is installed
ipcMain.handle('uv:checkInstalled', async () => {
  try {
    const result = execSync('uv --version', { 
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const versionMatch = result.match(/uv (.+)/);
    const version = versionMatch ? versionMatch[1].trim() : 'unknown';
    return { installed: true, version };
  } catch (error) {
    return { installed: false, version: null };
  }
});

// Install uv package manager
ipcMain.handle('uv:install', async () => {
  try {
    console.log('📦 Installing uv...');
    // Install uv using official installer
    execSync('curl -LsSf https://astral.sh/uv/install.sh | sh', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: '/bin/bash'
    });
    return { success: true };
  } catch (error: any) {
    console.error('❌ uv installation failed:', error);
    return { success: false, error: error.message };
  }
});

// Check if browser-use Python package is installed
ipcMain.handle('browseruse:checkInstalled', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const envPath = path.join(userDataPath, 'python-env');
    const result = execSync('uv pip show browser-use', { 
      encoding: 'utf-8',
      cwd: envPath,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const versionMatch = result.match(/Version: (.+)/);
    const version = versionMatch ? versionMatch[1].trim() : 'unknown';
    return { installed: true, version };
  } catch (error) {
    return { installed: false, version: null };
  }
});

// Install browser-use Python package using uv
ipcMain.handle('browseruse:install', async (event) => {
  try {
    console.log('📦 Installing browser-use with uv...');
    
    // Use user data directory instead of app bundle (asar is read-only)
    const userDataPath = app.getPath('userData');
    const envPath = path.join(userDataPath, 'python-env');
    
    // Ensure directory exists
    if (!fs.existsSync(envPath)) {
      fs.mkdirSync(envPath, { recursive: true });
    }
    
    // Step 1: Initialize uv project
    event.sender.send('browseruse:install-progress', 'Initializing Python environment...');
    execSync('uv init', { 
      encoding: 'utf-8',
      cwd: envPath,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Step 2: Add browser-use package
    event.sender.send('browseruse:install-progress', 'Installing browser-use package...');
    execSync('uv add browser-use', { 
      encoding: 'utf-8',
      cwd: envPath,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Step 3: Sync dependencies
    event.sender.send('browseruse:install-progress', 'Syncing dependencies...');
    execSync('uv sync', { 
      encoding: 'utf-8',
      cwd: envPath,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Step 4: Install Chromium browser via Playwright
    event.sender.send('browseruse:install-progress', 'Installing Chromium browser...');
    execSync('uv run playwright install chromium', { 
      encoding: 'utf-8',
      cwd: envPath,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    event.sender.send('browseruse:install-progress', 'Installation complete!');
    
    return { success: true };
  } catch (error: any) {
    console.error('❌ browser-use installation failed:', error);
    event.sender.send('browseruse:install-progress', `Installation failed: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Execute browser-use Python automation
ipcMain.handle('browseruse:execute', async (_, config: any) => {
  try {
    console.log('🤖 Executing browser automation:', config.task);
    
    // Use user data directory instead of app bundle (asar is read-only)
    const userDataPath = app.getPath('userData');
    const envPath = path.join(userDataPath, 'python-env');
    
    // Create temporary Python script file in the environment directory
    const scriptPath = path.join(envPath, `browser_automation_${Date.now()}.py`);
    
    const pythonScript = `import sys
import json
import asyncio
import logging
import os

# Configure logging to stderr so it doesn't interfere with JSON stdout
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

try:
    from browser_use import Agent, Browser, ChatOpenAI, ChatGoogle
    logger.info("Successfully imported browser-use modules")
except ImportError as e:
    print(json.dumps({"success": False, "error": f"Package not installed: {str(e)}"}))
    sys.exit(1)

async def main():
    config = json.loads(sys.argv[1])
    logger.info(f"Received config: {json.dumps(config, indent=2)}")
    
    try:
        provider = config['llm']['provider']
        logger.info(f"Using LLM provider: {provider}")
        
        if provider == 'gemini':
            llm = ChatGoogle(
                model=config['llm']['model'],
                api_key=config['llm']['api_key'],
                temperature=0.1
            )
            logger.info(f"Initialized ChatGoogle with model: {config['llm']['model']}")
        elif provider == 'openrouter':
            llm = ChatOpenAI(
                model=config['llm']['model'],
                api_key=config['llm']['api_key'],
                base_url="https://openrouter.ai/api/v1",
                temperature=0.1
            )
            logger.info(f"Initialized ChatOpenAI with model: {config['llm']['model']}")
        else:
            raise ValueError(f"Unsupported provider: {provider}")
        
        # Initialize browser with persistent profile
        browser_kwargs = {'headless': False}
        
        if 'chrome_profile_path' in config and config['chrome_profile_path']:
            import shutil
            from pathlib import Path
            
            profile_path = config['chrome_profile_path']
            logger.info(f"Chrome profile path: {profile_path}")
            
            # Create persistent browser-use profile directory
            app_data_dir = os.path.expanduser('~/.config/aether-hub-personal-hub')
            browseruse_profile_dir = os.path.join(app_data_dir, 'browseruse-profiles')
            profile_name = os.path.basename(profile_path)
            target_profile = os.path.join(browseruse_profile_dir, profile_name)
            
            os.makedirs(target_profile, exist_ok=True)
            logger.info(f"Persistent profile directory: {target_profile}")
            
            # Copy important Chrome data if profile is empty or old
            important_files = [
                'Cookies', 'Cookies-journal',
                'Local Storage', 
                'History', 'History-journal',
                'Login Data', 'Login Data-journal',
                'Preferences',
                'Web Data', 'Web Data-journal'
            ]
            
            # Check if we need to sync from Chrome profile
            needs_sync = not os.path.exists(os.path.join(target_profile, 'Cookies'))
            
            if needs_sync:
                logger.info("Syncing Chrome profile data to browser-use profile...")
                for item in important_files:
                    src = os.path.join(profile_path, item)
                    dst = os.path.join(target_profile, item)
                    try:
                        if os.path.isfile(src):
                            shutil.copy2(src, dst)
                            logger.info(f"Copied: {item}")
                        elif os.path.isdir(src):
                            if os.path.exists(dst):
                                shutil.rmtree(dst)
                            shutil.copytree(src, dst)
                            logger.info(f"Copied directory: {item}")
                    except Exception as e:
                        logger.warning(f"Failed to copy {item}: {e}")
                logger.info("Profile sync complete")
            else:
                logger.info("Using existing browser-use profile (already synced)")
            
            # Use the persistent profile
            browser_kwargs['user_data_dir'] = browseruse_profile_dir
            browser_kwargs['profile_directory'] = profile_name
            
            logger.info(f"Browser config: {browser_kwargs}")
        else:
            logger.info("No Chrome profile specified, using default browser settings")
        
        browser = Browser(**browser_kwargs)
        logger.info("Browser initialized successfully")
        
        # Create agent with task, llm, and browser
        agent = Agent(
            task=config['task'],
            llm=llm,
            browser=browser
        )
        logger.info(f"Agent created with task: {config['task']}")
        
        logger.info("Starting agent execution...")
        result = await agent.run()
        logger.info(f"Agent execution completed. Result type: {type(result)}")
        
        print(json.dumps({
            "success": True,
            "output": str(result),
            "task": config['task']
        }))
    except Exception as e:
        import traceback
        logger.error(f"Error occurred: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        print(json.dumps({
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": traceback.format_exc()
        }))

if __name__ == '__main__':
    logger.info("=== Browser Automation Script Started ===")
    asyncio.run(main())
    logger.info("=== Browser Automation Script Finished ===")
`;
    
    // Write script to temp file
    fs.writeFileSync(scriptPath, pythonScript, 'utf-8');
    
    try {
      const configJson = JSON.stringify(config);
      const command = `uv run python "${scriptPath}" '${configJson}'`;
      
      console.log('🔵 Executing command:', command);
      console.log('🔵 Config:', JSON.stringify(config, null, 2));
      
      const result = execSync(command, {
        encoding: 'utf-8',
        cwd: envPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 300000, // 5 minute timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      console.log('🔵 Python stdout:', result);
      
      const output = JSON.parse(result.trim());
      console.log('✅ Browser automation completed:', output.success ? 'Success' : 'Failed');
      
      return output;
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(scriptPath);
      } catch (e) {
        console.warn('Failed to delete temp script:', e);
      }
    }
  } catch (error: any) {
    console.error('❌ Browser automation failed:', error);
    
    // Log stderr if available
    if (error.stderr) {
      console.error('❌ Python stderr:', error.stderr.toString());
    }
    if (error.stdout) {
      console.error('❌ Python stdout:', error.stdout.toString());
    }
    
    return {
      success: false,
      error: error.message || 'Execution failed',
      stderr: error.stderr?.toString() || ''
    };
  }
});

// ==================== AUTOMATION IPC HANDLERS ====================

// Create automation
ipcMain.handle('automation:create', async (_, automation: any) => {
  try {
    const id = createAutomation(automation);
    console.log('✅ Created automation:', id);
    return { success: true, id };
  } catch (error: any) {
    console.error('❌ Failed to create automation:', error);
    return { success: false, error: error.message };
  }
});

// Get all automations
ipcMain.handle('automation:getAll', async () => {
  try {
    const automations = getAutomations();
    return { success: true, automations };
  } catch (error: any) {
    console.error('❌ Failed to get automations:', error);
    return { success: false, error: error.message };
  }
});

// Get automation by ID
ipcMain.handle('automation:get', async (_, id: string) => {
  try {
    const automation = getAutomation(id);
    return { success: true, automation };
  } catch (error: any) {
    console.error('❌ Failed to get automation:', error);
    return { success: false, error: error.message };
  }
});

// Update automation
ipcMain.handle('automation:update', async (_, id: string, updates: any) => {
  try {
    updateAutomation(id, updates);
    console.log('✅ Updated automation:', id);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to update automation:', error);
    return { success: false, error: error.message };
  }
});

// Delete automation
ipcMain.handle('automation:delete', async (_, id: string) => {
  try {
    deleteAutomation(id);
    console.log('✅ Deleted automation:', id);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to delete automation:', error);
    return { success: false, error: error.message };
  }
});

// Create automation history entry
ipcMain.handle('automation:createHistory', async (_, history: any) => {
  try {
    const id = createAutomationHistory(history);
    return { success: true, id };
  } catch (error: any) {
    console.error('❌ Failed to create automation history:', error);
    return { success: false, error: error.message };
  }
});

// Get automation history
ipcMain.handle('automation:getHistory', async (_, automationId: string) => {
  try {
    const history = getAutomationHistory(automationId);
    return { success: true, history };
  } catch (error: any) {
    console.error('❌ Failed to get automation history:', error);
    return { success: false, error: error.message };
  }
});

// Update automation history entry
ipcMain.handle('automation:updateHistory', async (_, id: string, updates: any) => {
  try {
    updateAutomationHistory(id, updates);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to update automation history:', error);
    return { success: false, error: error.message };
  }
});

// Execute automation with queue management
ipcMain.handle('automation:execute', async (_, automationId: string, config: any) => {
  try {
    const result = await automationScheduler.executeAutomation(automationId, config);
    return result;
  } catch (error: any) {
    console.error('❌ Failed to execute automation:', error);
    return { success: false, error: error.message };
  }
});

// Get automation scheduler status
ipcMain.handle('automation:getSchedulerStatus', async () => {
  try {
    return {
      success: true,
      maxConcurrent: automationScheduler.getMaxConcurrentAutomations(),
      runningCount: automationScheduler.getRunningAutomationsCount()
    };
  } catch (error: any) {
    console.error('❌ Failed to get scheduler status:', error);
    return { success: false, error: error.message };
  }
});

// Set max concurrent automations
ipcMain.handle('automation:setMaxConcurrent', async (_, max: number) => {
  try {
    automationScheduler.setMaxConcurrentAutomations(max);
    store.set('max_concurrent_automations', max);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to set max concurrent:', error);
    return { success: false, error: error.message };
  }
});

// Check if automation is running
ipcMain.handle('automation:isRunning', async (_, automationId: string) => {
  try {
    return {
      success: true,
      isRunning: automationScheduler.isAutomationRunning(automationId)
    };
  } catch (error: any) {
    console.error('❌ Failed to check automation status:', error);
    return { success: false, error: error.message };
  }
});

// Reload automation schedules
ipcMain.handle('automation:reloadSchedules', async () => {
  try {
    const getLLMConfig = async () => {
      const provider = store.get('ai_provider', 'google');
      const llmConfig: any = {
        llm: {
          provider: provider === 'google' ? 'gemini' : provider
        }
      };
      
      switch (provider) {
        case 'google':
        case 'gemini':
          llmConfig.llm.api_key = store.get('gemini_api_key', '');
          llmConfig.llm.model = store.get('gemini_model', 'gemini-2.0-flash');
          break;
        case 'openrouter':
          llmConfig.llm.api_key = store.get('openrouter_api_key', '');
          llmConfig.llm.model = store.get('openrouter_model', 'x-ai/grok-2-1212');
          break;
        case 'openai':
          llmConfig.llm.api_key = store.get('openai_api_key', '');
          llmConfig.llm.model = store.get('openai_model', 'gpt-4o-mini');
          break;
        case 'anthropic':
          llmConfig.llm.api_key = store.get('anthropic_api_key', '');
          llmConfig.llm.model = store.get('anthropic_model', 'claude-3-5-sonnet-20241022');
          break;
        case 'ollama':
          llmConfig.llm.model = store.get('ollama_model', 'qwen2:0.5b');
          llmConfig.llm.base_url = store.get('ollama_url', 'http://localhost:11434');
          break;
        case 'local':
          llmConfig.llm.api_key = store.get('local_ai_key', '');
          llmConfig.llm.model = store.get('local_ai_model', 'default');
          llmConfig.llm.base_url = store.get('local_ai_url', 'http://localhost:8080');
          break;
      }
      
      return llmConfig;
    };
    
    automationScheduler.loadAutomationSchedules(getLLMConfig);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to reload schedules:', error);
    return { success: false, error: error.message };
  }
});

// Stop a running automation
ipcMain.handle('automation:stop', async (_, automationId: string) => {
  try {
    const stopped = automationScheduler.stopAutomation(automationId);
    return { success: stopped };
  } catch (error: any) {
    console.error('❌ Failed to stop automation:', error);
    return { success: false, error: error.message };
  }
});

// Analyze automation result with AI
ipcMain.handle('automation:analyzeResult', async (_, result: string, task: string) => {
  try {
    const analysis = await automationScheduler.analyzeAutomationResult(result, task);
    return { success: true, analysis };
  } catch (error: any) {
    console.error('❌ Failed to analyze result:', error);
    return { success: false, error: error.message };
  }
});

// ==================== WHATSAPP IPC HANDLERS ====================

// Initialize WhatsApp client and start QR code flow
ipcMain.handle('whatsapp:initialize', async () => {
  try {
    const sensitiveIntegrations = store.get('sensitive_integrations') as any || {};
    const isEnabled = process.env.ENABLE_WHATSAPP === 'true' || sensitiveIntegrations.whatsapp === true;
    
    if (!isEnabled) {
      throw new Error('WhatsApp integration is disabled. Enable it in Settings → Integrations or your .env file.');
    }
    await whatsapp.initializeWhatsApp();
    return { success: true };
  } catch (error) {
    console.error('❌ MAIN: whatsapp:initialize failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Check if WhatsApp is ready
ipcMain.handle('whatsapp:isReady', () => {
  return whatsapp.isWhatsAppReady();
});

// Check if a saved session exists
ipcMain.handle('whatsapp:hasSession', () => {
  return whatsapp.hasSession();
});

// Get current auth state (includes QR code if available)
ipcMain.handle('whatsapp:getAuthState', () => {
  return whatsapp.getAuthState();
});

// Get current QR code
ipcMain.handle('whatsapp:getQRCode', () => {
  return whatsapp.getCurrentQRCode();
});

// Logout and destroy session
ipcMain.handle('whatsapp:logout', async () => {
  try {
    await whatsapp.logoutWhatsApp();
    return { success: true };
  } catch (error) {
    console.error('❌ MAIN: whatsapp:logout failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Get user info
ipcMain.handle('whatsapp:getInfo', async () => {
  try {
    return await whatsapp.getWhatsAppInfo();
  } catch (error) {
    console.error('❌ MAIN: whatsapp:getInfo failed:', error);
    return null;
  }
});

// Get all chats
ipcMain.handle('whatsapp:getChats', async (_event, limit?: number) => {
  try {
    return await whatsapp.getChats(limit);
  } catch (error) {
    console.error('❌ MAIN: whatsapp:getChats failed:', error);
    throw error;
  }
});

// Get messages from a specific chat
ipcMain.handle('whatsapp:getChatMessages', async (_event, chatId: string, limit?: number) => {
  try {
    return await whatsapp.getChatMessages(chatId, limit);
  } catch (error) {
    console.error('❌ MAIN: whatsapp:getChatMessages failed:', error);
    throw error;
  }
});

// Get recent messages across all chats
ipcMain.handle('whatsapp:getRecentMessages', async (_event, limit?: number) => {
  try {
    return await whatsapp.getRecentMessages(limit);
  } catch (error) {
    console.error('❌ MAIN: whatsapp:getRecentMessages failed:', error);
    throw error;
  }
});

// Get contacts
ipcMain.handle('whatsapp:getContacts', async () => {
  try {
    return await whatsapp.getContacts();
  } catch (error) {
    console.error('❌ MAIN: whatsapp:getContacts failed:', error);
    throw error;
  }
});

// Send a message
ipcMain.handle('whatsapp:sendMessage', async (_event, chatId: string, message: string) => {
  try {
    return await whatsapp.sendMessage(chatId, message);
  } catch (error) {
    console.error('❌ MAIN: whatsapp:sendMessage failed:', error);
    throw error;
  }
});

// Send media (image, audio, video, document)
ipcMain.handle('whatsapp:sendMedia', async (_event, chatId: string, mediaBase64: string, mimetype: string, filename?: string, caption?: string, sendAsVoice?: boolean) => {
  try {
    return await whatsapp.sendMedia(chatId, mediaBase64, mimetype, filename, caption, sendAsVoice);
  } catch (error) {
    console.error('❌ MAIN: whatsapp:sendMedia failed:', error);
    throw error;
  }
});

// Mark chat as read
ipcMain.handle('whatsapp:markAsRead', async (_event, chatId: string) => {
  try {
    await whatsapp.markChatAsRead(chatId);
    // Also update database
    database.whatsappChats.markAsRead(chatId);
    database.whatsappMessages.markAsRead(chatId);
    return { success: true };
  } catch (error) {
    console.error('❌ MAIN: whatsapp:markAsRead failed:', error);
    throw error;
  }
});

// ==================== WHATSAPP DATABASE IPC HANDLERS ====================

// Get WhatsApp accounts from database
ipcMain.handle('whatsapp:db:getAccounts', () => {
  return database.whatsappAccounts.getAll();
});

// Get connected WhatsApp account
ipcMain.handle('whatsapp:db:getConnectedAccount', () => {
  return database.whatsappAccounts.getConnected();
});

// Update AI settings for WhatsApp account
ipcMain.handle('whatsapp:db:updateAISettings', (_event, accountId: string, aiSettings: string) => {
  return database.whatsappAccounts.updateAISettings(accountId, aiSettings);
});

// Get AI settings for WhatsApp account
ipcMain.handle('whatsapp:db:getAISettings', (_event, accountId: string) => {
  const account = database.whatsappAccounts.getById(accountId);
  return account?.ai_settings ? JSON.parse(account.ai_settings) : null;
});

// Get chats from database
ipcMain.handle('whatsapp:db:getChats', (_event, accountId: string) => {
  return database.whatsappChats.getAll(accountId);
});

// Get messages from database
ipcMain.handle('whatsapp:db:getMessages', (_event, chatId: string, limit?: number) => {
  return database.whatsappMessages.getByChat(chatId, limit || 50);
});

// Get recent messages from database
ipcMain.handle('whatsapp:db:getRecentMessages', (_event, accountId: string, limit?: number) => {
  return database.whatsappMessages.getRecent(accountId, limit || 100);
});

// ==================== DATA CLEANUP IPC HANDLERS ====================

// Clear email content while keeping metadata
ipcMain.handle('db:cleanup:clearEmailContent', () => {
  try {
    const result = database.dataCleanup.clearEmailContent();
    console.log('✅ MAIN: Cleared email content:', result);
    return result;
  } catch (error) {
    console.error('❌ MAIN: Failed to clear email content:', error);
    throw error;
  }
});

// Clear WhatsApp message content
ipcMain.handle('db:cleanup:clearWhatsAppMessages', () => {
  try {
    const result = database.dataCleanup.clearWhatsAppMessages();
    console.log('✅ MAIN: Cleared WhatsApp messages:', result);
    return result;
  } catch (error) {
    console.error('❌ MAIN: Failed to clear WhatsApp messages:', error);
    throw error;
  }
});

// Clear Discord message content
ipcMain.handle('db:cleanup:clearDiscordMessages', () => {
  try {
    const result = database.dataCleanup.clearDiscordMessages();
    console.log('✅ MAIN: Cleared Discord messages:', result);
    return result;
  } catch (error) {
    console.error('❌ MAIN: Failed to clear Discord messages:', error);
    throw error;
  }
});

// Clear all chat messages
ipcMain.handle('db:cleanup:clearAllChatMessages', () => {
  try {
    const result = database.dataCleanup.clearAllChatMessages();
    console.log('✅ MAIN: Cleared all chat messages:', result);
    return result;
  } catch (error) {
    console.error('❌ MAIN: Failed to clear chat messages:', error);
    throw error;
  }
});

// Clear knowledge messages
ipcMain.handle('db:cleanup:clearKnowledgeMessages', () => {
  try {
    const result = database.dataCleanup.clearKnowledgeMessages();
    console.log('✅ MAIN: Cleared knowledge messages:', result);
    return result;
  } catch (error) {
    console.error('❌ MAIN: Failed to clear knowledge messages:', error);
    throw error;
  }
});

// Clear knowledge insights
ipcMain.handle('db:cleanup:clearKnowledgeInsights', () => {
  try {
    const result = database.dataCleanup.clearKnowledgeInsights();
    console.log('✅ MAIN: Cleared knowledge insights:', result);
    return result;
  } catch (error) {
    console.error('❌ MAIN: Failed to clear knowledge insights:', error);
    throw error;
  }
});

// Clear conversation summaries
ipcMain.handle('db:cleanup:clearConversationSummaries', () => {
  try {
    const result = database.dataCleanup.clearConversationSummaries();
    console.log('✅ MAIN: Cleared conversation summaries:', result);
    return result;
  } catch (error) {
    console.error('❌ MAIN: Failed to clear conversation summaries:', error);
    throw error;
  }
});

// Clear all sensitive content
ipcMain.handle('db:cleanup:clearAllSensitiveContent', () => {
  try {
    const result = database.dataCleanup.clearAllSensitiveContent();
    console.log('✅ MAIN: Cleared all sensitive content:', result);
    return result;
  } catch (error) {
    console.error('❌ MAIN: Failed to clear all sensitive content:', error);
    throw error;
  }
});

// Delete all data for a specific account
ipcMain.handle('db:cleanup:deleteAccountData', (_event, accountId: string) => {
  try {
    const result = database.dataCleanup.deleteAccountData(accountId);
    console.log('✅ MAIN: Deleted account data for:', accountId, result);
    return result;
  } catch (error) {
    console.error('❌ MAIN: Failed to delete account data:', error);
    throw error;
  }
});

// Vacuum database
ipcMain.handle('db:cleanup:vacuum', () => {
  try {
    database.dataCleanup.vacuum();
    console.log('✅ MAIN: Database vacuumed successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ MAIN: Failed to vacuum database:', error);
    throw error;
  }
});

// Get database statistics
ipcMain.handle('db:cleanup:getStats', () => {
  try {
    const stats = database.dataCleanup.getStats();
    console.log('📊 MAIN: Database stats:', stats);
    return stats;
  } catch (error) {
    console.error('❌ MAIN: Failed to get database stats:', error);
    throw error;
  }
});

// ==================== END DATA CLEANUP IPC HANDLERS ====================

// ==================== END WHATSAPP IPC HANDLERS ====================

// ==================== TELEGRAM IPC HANDLERS ====================

// Initialize Telegram client
ipcMain.handle('telegram:initialize', async () => {
  try {
    const sensitiveIntegrations = store.get('sensitive_integrations') as any || {};
    const isEnabled = process.env.ENABLE_TELEGRAM === 'true' || sensitiveIntegrations.telegram === true;

    if (!isEnabled) {
      throw new Error('Telegram integration is disabled. Enable it in Settings → Integrations or your .env file.');
    }
    await telegram.initializeTelegram();
    return { success: true };
  } catch (error) {
    console.error('❌ MAIN: telegram:initialize failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Check if Telegram is ready
ipcMain.handle('telegram:isReady', () => {
  return telegram.isTelegramReady();
});

// Check if a saved session exists
ipcMain.handle('telegram:hasSession', () => {
  return telegram.hasSession();
});

// Check if API credentials are configured
ipcMain.handle('telegram:hasApiCredentials', () => {
  return telegram.hasApiCredentials();
});

// Set API credentials
ipcMain.handle('telegram:setApiCredentials', (_event, apiId: number, apiHash: string) => {
  telegram.setApiCredentials(apiId, apiHash);
  return { success: true };
});

// Get current auth state
ipcMain.handle('telegram:getAuthState', () => {
  return telegram.getAuthState();
});

// Submit phone number for authentication
ipcMain.handle('telegram:submitPhoneNumber', (_event, phone: string) => {
  telegram.submitPhoneNumber(phone);
  return { success: true };
});

// Submit verification code
ipcMain.handle('telegram:submitCode', (_event, code: string) => {
  telegram.submitCode(code);
  return { success: true };
});

// Submit 2FA password
ipcMain.handle('telegram:submitPassword', (_event, password: string) => {
  telegram.submitPassword(password);
  return { success: true };
});

// Logout
ipcMain.handle('telegram:logout', async () => {
  try {
    await telegram.logoutTelegram();
    return { success: true };
  } catch (error) {
    console.error('❌ MAIN: telegram:logout failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Get user info
ipcMain.handle('telegram:getInfo', async () => {
  try {
    return await telegram.getTelegramInfo();
  } catch (error) {
    console.error('❌ MAIN: telegram:getInfo failed:', error);
    return null;
  }
});

// Get all chats
ipcMain.handle('telegram:getChats', async (_event, limit?: number) => {
  try {
    return await telegram.getChats(limit);
  } catch (error) {
    console.error('❌ MAIN: telegram:getChats failed:', error);
    throw error;
  }
});

// Get messages from a specific chat
ipcMain.handle('telegram:getChatMessages', async (_event, chatId: string, limit?: number) => {
  try {
    return await telegram.getChatMessages(chatId, limit);
  } catch (error) {
    console.error('❌ MAIN: telegram:getChatMessages failed:', error);
    throw error;
  }
});

// Get recent messages across all chats
ipcMain.handle('telegram:getRecentMessages', async (_event, limit?: number) => {
  try {
    return await telegram.getRecentMessages(limit);
  } catch (error) {
    console.error('❌ MAIN: telegram:getRecentMessages failed:', error);
    throw error;
  }
});

// Get contacts
ipcMain.handle('telegram:getContacts', async () => {
  try {
    return await telegram.getContacts();
  } catch (error) {
    console.error('❌ MAIN: telegram:getContacts failed:', error);
    throw error;
  }
});

// Send a message
ipcMain.handle('telegram:sendMessage', async (_event, chatId: string, message: string) => {
  try {
    return await telegram.sendMessage(chatId, message);
  } catch (error) {
    console.error('❌ MAIN: telegram:sendMessage failed:', error);
    throw error;
  }
});

// Send media
ipcMain.handle('telegram:sendMedia', async (_event, chatId: string, mediaBase64: string, mimetype: string, filename?: string, caption?: string) => {
  try {
    return await telegram.sendMedia(chatId, mediaBase64, mimetype, filename, caption);
  } catch (error) {
    console.error('❌ MAIN: telegram:sendMedia failed:', error);
    throw error;
  }
});

// Mark chat as read
ipcMain.handle('telegram:markAsRead', async (_event, chatId: string) => {
  try {
    await telegram.markAsRead(chatId);
    database.telegramChats.markAsRead(chatId);
    database.telegramMessages.markAsRead(chatId);
    return { success: true };
  } catch (error) {
    console.error('❌ MAIN: telegram:markAsRead failed:', error);
    throw error;
  }
});

// ==================== TELEGRAM DATABASE IPC HANDLERS ====================

// Get Telegram accounts from database
ipcMain.handle('telegram:db:getAccounts', () => {
  return database.telegramAccounts.getAll();
});

// Get connected Telegram account
ipcMain.handle('telegram:db:getConnectedAccount', () => {
  return database.telegramAccounts.getConnected();
});

// Update AI settings for Telegram account
ipcMain.handle('telegram:db:updateAISettings', (_event, accountId: string, aiSettings: string) => {
  return database.telegramAccounts.updateAISettings(accountId, aiSettings);
});

// Get AI settings for Telegram account
ipcMain.handle('telegram:db:getAISettings', (_event, accountId: string) => {
  const account = database.telegramAccounts.getById(accountId);
  return account?.ai_settings ? JSON.parse(account.ai_settings) : null;
});

// Get chats from database
ipcMain.handle('telegram:db:getChats', (_event, accountId: string) => {
  return database.telegramChats.getAll(accountId);
});

// Get messages from database
ipcMain.handle('telegram:db:getMessages', (_event, chatId: string, limit?: number) => {
  return database.telegramMessages.getByChat(chatId, limit || 50);
});

// Get recent messages from database
ipcMain.handle('telegram:db:getRecentMessages', (_event, accountId: string, limit?: number) => {
  return database.telegramMessages.getRecent(accountId, limit || 100);
});

// ==================== END TELEGRAM IPC HANDLERS ====================

// ==================== DISCORD SELFBOT IPC HANDLERS ====================
// ⚠️ WARNING: Self-bot usage violates Discord TOS. Users accept the risk.

// Initialize Discord selfbot with token
ipcMain.handle('discord-selfbot:initialize', async (_event, token: string) => {
  try {
    const sensitiveIntegrations = store.get('sensitive_integrations') as any || {};
    const isEnabled = process.env.ENABLE_DISCORD === 'true' || sensitiveIntegrations.discord === true;

    if (!isEnabled) {
      throw new Error('Discord integration is disabled. Enable it in Settings → Integrations or your .env file.');
    }
    console.log('🔵 MAIN: discord-selfbot:initialize called');
    const result = await discordSelfBot.initializeDiscordSelfBot(token);
    return result;
  } catch (error) {
    console.error('❌ MAIN: discord-selfbot:initialize failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Check if Discord selfbot is ready
ipcMain.handle('discord-selfbot:isReady', () => {
  return discordSelfBot.isReady();
});

// Check if selfbot mode is enabled
ipcMain.handle('discord-selfbot:isEnabled', () => {
  return discordSelfBot.isSelfBotEnabled();
});

// Get saved token
ipcMain.handle('discord-selfbot:getSavedToken', () => {
  return discordSelfBot.getSavedToken();
});

// Get current auth state
ipcMain.handle('discord-selfbot:getAuthState', () => {
  return discordSelfBot.getAuthState();
});

// Get user info
ipcMain.handle('discord-selfbot:getUserInfo', () => {
  return discordSelfBot.getUserInfo();
});

// Disconnect
ipcMain.handle('discord-selfbot:disconnect', async () => {
  try {
    await discordSelfBot.disconnectDiscordSelfBot();
    return { success: true };
  } catch (error) {
    console.error('❌ MAIN: discord-selfbot:disconnect failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Get all guilds
ipcMain.handle('discord-selfbot:getGuilds', async () => {
  try {
    return await discordSelfBot.getGuilds();
  } catch (error) {
    console.error('❌ MAIN: discord-selfbot:getGuilds failed:', error);
    return [];
  }
});

// Get DM channels
ipcMain.handle('discord-selfbot:getDMChannels', async () => {
  try {
    return await discordSelfBot.getDMChannels();
  } catch (error) {
    console.error('❌ MAIN: discord-selfbot:getDMChannels failed:', error);
    return [];
  }
});

// Fetch messages from a channel (with pagination support)
ipcMain.handle('discord-selfbot:fetchMessages', async (_event, channelId: string, limit?: number, before?: string) => {
  try {
    return await discordSelfBot.fetchChannelMessages(channelId, limit, before);
  } catch (error) {
    console.error('❌ MAIN: discord-selfbot:fetchMessages failed:', error);
    return [];
  }
});

// Get threads from a channel
ipcMain.handle('discord-selfbot:getThreads', async (_event, channelId: string) => {
  try {
    return await discordSelfBot.getChannelThreads(channelId);
  } catch (error) {
    console.error('❌ MAIN: discord-selfbot:getThreads failed:', error);
    return [];
  }
});

// Sync all data
ipcMain.handle('discord-selfbot:syncAll', async () => {
  try {
    return await discordSelfBot.syncAllData();
  } catch (error) {
    console.error('❌ MAIN: discord-selfbot:syncAll failed:', error);
    return { guilds: 0, dmChannels: 0, messages: 0 };
  }
});

// Auto-connect if token is saved
ipcMain.handle('discord-selfbot:autoConnect', async () => {
  try {
    return await discordSelfBot.autoConnect();
  } catch (error) {
    console.error('❌ MAIN: discord-selfbot:autoConnect failed:', error);
    return false;
  }
});

// ==================== END DISCORD SELFBOT IPC HANDLERS ====================

// ==================== OVERLAY IPC HANDLERS ====================

ipcMain.handle('overlay:show', () => {
  let overlay = micOverlay.getMicOverlay();
  if (!overlay) {
    overlay = micOverlay.createMicOverlay();
  }
  overlay?.show();
  updateTrayMenu();
});

ipcMain.handle('overlay:hide', () => {
  micOverlay.getMicOverlay()?.hide();
  updateTrayMenu();
});

ipcMain.handle('overlay:toggle', () => {
  micOverlay.toggleMicOverlay();
  updateTrayMenu();
});

// ==================== END OVERLAY IPC HANDLERS ====================

// Custom protocol for OAuth callbacks
app.setAsDefaultProtocolClient('aethermsaid');

// Handle protocol on Windows/Linux (second-instance)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    // Windows/Linux: protocol URL is in commandLine
    const url = commandLine.find(arg => arg.startsWith('aethermsaid://'));
    if (url && url.startsWith('aethermsaid://oauth/callback')) {
      console.log('🟢 MAIN: OAuth callback received (second-instance):', url);
      mainWindow?.webContents.send('oauth-callback', url);
    }
    
    // Focus the window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  console.log('🟢 MAIN: OAuth callback received (open-url):', url);
  
  if (url.startsWith('aethermsaid://oauth/callback')) {
    mainWindow?.webContents.send('oauth-callback', url);
  }
});

// Autostart IPC handlers
ipcMain.handle('autostart:get', () => {
  // On Linux, getLoginItemSettings is often unreliable, so we prefer the store value if available
  if (process.platform === 'linux') {
    const savedValue = store.get('settings.autostart', null);
    if (savedValue !== null) return savedValue;
  }
  
  const settings = app.getLoginItemSettings();
  console.log('🔵 MAIN: Get autostart settings:', settings);
  return settings.openAtLogin;
});

ipcMain.handle('autostart:set', (_event, enabled: boolean) => {
  console.log(`🔵 MAIN: Setting autostart to ${enabled}`);
  
  const options: any = {
    openAtLogin: enabled,
    openAsHidden: false,
  };

  // On Linux, we need to be more explicit about the executable path
  // Especially for AppImages or custom installs
  if (process.platform === 'linux') {
    options.path = process.env.APPIMAGE || app.getPath('exe');
  }

  app.setLoginItemSettings(options);
  
  // Persist the preference in our store as well for reliability
  store.set('settings.autostart', enabled);
  
  // Verify the setting was applied
  const newSettings = app.getLoginItemSettings();
  console.log('🔵 MAIN: New autostart settings:', newSettings);
  
  // On Linux, newSettings.openAtLogin might not update immediately or correctly
  // so we return the intended value which we've also saved to the store
  if (process.platform === 'linux') {
    return enabled;
  }
  
  return newSettings.openAtLogin;
});

// App lifecycle
app.whenReady().then(async () => {
  // Set App User Model ID for Windows notifications
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.aether-hub.personalhub');
    console.log('🔵 MAIN: App User Model ID set for Windows');
  }

  // Initialize SQLite database
  try {
    database.initialize();
    console.log('✅ MAIN: Database initialized successfully');
  } catch (error) {
    console.error('❌ MAIN: Database initialization failed:', error);
    dialog.showErrorBox(
      'Database Error',
      'Failed to initialize database. The application may not work correctly.'
    );
  }
  
  createWindow();
  startOAuthServer();
  
  // Start browser addon WebSocket server
  if (mainWindow) {
    addonServer.startAddonServer(mainWindow);
    console.log('🔵 MAIN: Browser addon server started');
  }
  
  // Auto-initialize WhatsApp if session exists
  try {
    const sessionExists = whatsapp.hasSession();
    if (sessionExists) {
      console.log('🔵 MAIN: WhatsApp session found, auto-initializing...');
      await whatsapp.initializeWhatsApp();
    } else {
      console.log('🔵 MAIN: No WhatsApp session found, waiting for user to connect');
    }
  } catch (error) {
    console.error('❌ MAIN: WhatsApp auto-initialization failed:', error);
  }
  
  // Load automation schedules and run startup automations
  try {
    console.log('🔵 MAIN: Loading automation schedules...');
    
    // Helper to get LLM config
    const getLLMConfig = async () => {
      const provider = store.get('ai_provider', 'google');
      const llmConfig: any = {
        llm: {
          provider: provider === 'google' ? 'gemini' : provider
        }
      };
      
      switch (provider) {
        case 'google':
        case 'gemini':
          llmConfig.llm.api_key = store.get('gemini_api_key', '');
          llmConfig.llm.model = store.get('gemini_model', 'gemini-2.0-flash');
          break;
        case 'openrouter':
          llmConfig.llm.api_key = store.get('openrouter_api_key', '');
          llmConfig.llm.model = store.get('openrouter_model', 'x-ai/grok-2-1212');
          break;
        case 'openai':
          llmConfig.llm.api_key = store.get('openai_api_key', '');
          llmConfig.llm.model = store.get('openai_model', 'gpt-4o-mini');
          break;
        case 'anthropic':
          llmConfig.llm.api_key = store.get('anthropic_api_key', '');
          llmConfig.llm.model = store.get('anthropic_model', 'claude-3-5-sonnet-20241022');
          break;
        case 'ollama':
          llmConfig.llm.model = store.get('ollama_model', 'qwen2:0.5b');
          llmConfig.llm.base_url = store.get('ollama_url', 'http://localhost:11434');
          break;
        case 'local':
          llmConfig.llm.api_key = store.get('local_ai_key', '');
          llmConfig.llm.model = store.get('local_ai_model', 'default');
          llmConfig.llm.base_url = store.get('local_ai_url', 'http://localhost:8080');
          break;
      }
      
      return llmConfig;
    };
    
    // Load max concurrent setting
    const maxConcurrent = store.get('max_concurrent_automations', 3) as number;
    automationScheduler.setMaxConcurrentAutomations(maxConcurrent);
    
    // Load cron schedules
    automationScheduler.loadAutomationSchedules(getLLMConfig);
    
    // Run startup automations after a delay
    setTimeout(() => {
      automationScheduler.runStartupAutomations(getLLMConfig);
    }, 5000); // 5 second delay to let app fully load
    
    console.log('✅ MAIN: Automation scheduler initialized');
  } catch (error) {
    console.error('❌ MAIN: Failed to initialize automation scheduler:', error);
  }
  
  // Check for updates on startup - DISABLED
  // if (process.env.NODE_ENV === 'production') {
  //   setTimeout(() => {
  //     autoUpdater.checkForUpdates();
  //   }, 3000);
  // }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', async (event) => {
  console.log('🔵 MAIN: Application quitting, cleaning up...');
  
  // Prevent default to allow cleanup, but with strict timeout
  event.preventDefault();
  
  // Set a hard timeout - force exit after 2 seconds no matter what
  const forceExitTimeout = setTimeout(() => {
    console.log('⚠️ MAIN: Cleanup timeout exceeded, force exiting');
    process.exit(0);
  }, 2000);
  
  try {
    // Unregister shortcuts
    globalShortcut.unregisterAll();
    
    // Close OAuth server immediately
    if (oauthServer) {
      try {
        oauthServer.close();
        oauthServer = null;
        console.log('✅ MAIN: OAuth server closed');
      } catch (err) {
        console.error('❌ MAIN: Error closing OAuth server:', err);
      }
    }
    
    // Stop browser addon server
    try {
      addonServer.stopAddonServer();
      console.log('✅ MAIN: Addon server stopped');
    } catch (error) {
      console.error('❌ MAIN: Error stopping addon server:', error);
    }
    
    // Stop all automations
    try {
      automationScheduler.stopAllAutomations();
      console.log('✅ MAIN: Automation scheduler stopped');
    } catch (error) {
      console.error('❌ MAIN: Error stopping automations:', error);
    }
    
    // Destroy WhatsApp client with timeout (don't await - run in background)
    whatsapp.destroyWhatsApp().catch(err => {
      console.error('❌ MAIN: Error destroying WhatsApp:', err);
    });
    
    // Close database
    try {
      database.close();
      console.log('✅ MAIN: Database closed');
    } catch (error) {
      console.error('❌ MAIN: Error closing database:', error);
    }
    
    console.log('✅ MAIN: Cleanup complete');
  } catch (error) {
    console.error('❌ MAIN: Error during cleanup:', error);
  } finally {
    clearTimeout(forceExitTimeout);
    // Force quit after cleanup
    app.exit(0);
  }
});

// Crash recovery
app.on('web-contents-created', (_event, contents) => {
  contents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process crashed:', details);
    
    if (details.reason !== 'clean-exit') {
      dialog.showErrorBox(
        'Application Crashed',
        'The application has crashed. It will restart now.'
      );
      app.relaunch();
      app.exit(0);
    }
  });
});
