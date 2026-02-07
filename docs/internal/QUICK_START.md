# aethermsaid hub Electron - Quick Start Guide

## 🚀 Running the App

### Development Mode
```bash
# Option 1: Using the helper script
./start-dev.sh

# Option 2: Direct command
pnpm run dev:electron
```

The app will:
- Start Vite dev server on http://localhost:3000
- Launch Electron window with DevTools
- Auto-reload on file changes

### Production Build
```bash
# Build the app
pnpm run build:electron

# Package for distribution
pnpm run package        # All platforms
pnpm run package:win    # Windows only
pnpm run package:mac    # macOS only  
pnpm run package:linux  # Linux only
```

Built packages will be in `release/` directory.

## 🎨 Custom Window Controls

The app features a custom titlebar that adapts to your platform:

- **Windows/Linux**: Controls on the right (minimize, maximize, close)
- **macOS**: Native traffic lights on the left

### Window Features
- ✅ Drag to move window
- ✅ Double-click titlebar to maximize
- ✅ Window state persists (size, position)
- ✅ Multi-monitor support

## 💾 Storage

The app uses **electron-store** for secure, encrypted storage:

### Automatic Migration
On first launch, the app automatically migrates any existing localStorage data to electron-store.

### Using Storage in Code
```typescript
import storage from './services/electronStore';

// Get value
const apiKey = await storage.get('gemini_api_key');

// Set value
await storage.set('gemini_api_key', 'your-key-here');

// Remove value
await storage.remove('gemini_api_key');

// Clear all
await storage.clear();
```

### Storage Location
- **Windows**: `%APPDATA%/aether-hub-config/config.json`
- **macOS**: `~/Library/Application Support/aether-hub-config/config.json`
- **Linux**: `~/.config/aether-hub-config/config.json`

## 🔧 IPC Communication

The app exposes a secure IPC API via `window.electronAPI`:

```typescript
// Window controls
await window.electronAPI?.window.minimize();
await window.electronAPI?.window.maximize();
await window.electronAPI?.window.close();
const isMax = await window.electronAPI?.window.isMaximized();

// Platform info
const platform = await window.electronAPI?.app.getPlatform();
const version = await window.electronAPI?.app.getVersion();

// File dialogs
const files = await window.electronAPI?.dialog.openFile({
  filters: [{ name: 'Images', extensions: ['jpg', 'png'] }]
});

// Clipboard
await window.electronAPI?.clipboard.writeText('Hello');
const text = await window.electronAPI?.clipboard.readText();

// Updates
await window.electronAPI?.updater.checkForUpdates();
```

## 📦 Packaging & Distribution

### Before Packaging
1. Update version in `package.json`
2. Replace placeholder icons in `build/icons/`
3. Set up code signing (optional but recommended)

### Icon Requirements
- **icon.png**: 512x512 PNG (source)
- **icon.ico**: Windows multi-resolution ICO
- **icon.icns**: macOS icon bundle

### Code Signing

**macOS:**
```bash
# Add to package.json or environment
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate-password"
```

**Windows:**
```bash
# Add to electron-builder.json
"win": {
  "certificateFile": "path/to/certificate.pfx",
  "certificatePassword": "certificate-password"
}
```

## 🔐 Security Features

- ✅ Context isolation enabled
- ✅ Node integration disabled in renderer
- ✅ Sandboxed renderer processes
- ✅ Content Security Policy (CSP)
- ✅ Encrypted credential storage
- ✅ IPC validation

## 🎯 Keyboard Shortcuts

### Global
- `Cmd/Ctrl+K`: Open search
- `Cmd/Ctrl+,`: Open settings (macOS)

### Navigation
- `Cmd/Ctrl+1`: Dashboard
- `Cmd/Ctrl+2`: AI Digest
- `Cmd/Ctrl+3`: Assistant
- `Cmd/Ctrl+4`: Knowledge Base

### Window
- `Cmd/Ctrl+W`: Close window
- `Cmd/Ctrl+M`: Minimize
- `Cmd/Ctrl+Q`: Quit app (macOS)

## 🐛 Debugging

### Open DevTools
- Development mode: DevTools open automatically
- Production: Not available (for security)

### Logs
Check console for:
- Storage migration status
- IPC communication
- Error messages

### Common Issues

**Window off-screen after monitor change:**
- Delete window state: Remove `windowState` from storage
- App will reset to center on next launch

**Icons not showing:**
- Ensure icon files exist in `build/icons/`
- Check file permissions
- Rebuild the app

**Auto-updater not working:**
- Ensure GitHub releases are published
- Check `electron-builder.json` publish configuration
- Verify app is signed (required for macOS notarization)

## 📚 Additional Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [electron-builder Guide](https://www.electron.build/)
- [electron-store](https://github.com/sindresorhus/electron-store)
- [Auto-updater](https://www.electronjs.org/docs/latest/api/auto-updater)

## 🌐 Browser Extension

The browser extension connects to aethermsaid hub via WebSocket for seamless browser integration.

### Extension Location (After Install)
- **Linux**: `/opt/aethermsaid hub/resources/app.asar.unpacked/browser-addon/`
- **macOS**: `/Applications/aethermsaid hub.app/Contents/Resources/app.asar.unpacked/browser-addon/`
- **Windows**: `C:\Program Files\aethermsaid hub\resources\app.asar.unpacked\browser-addon\`

### Chrome
1. Go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `chrome` folder

### Firefox
1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...** → select `firefox/manifest.json`

### Features
- AI Chat with markdown rendering
- Emails, Calendar, Notifications tabs
- Actions tab for AI-generated tasks
- Save pages to Knowledge Base

**Note**: aethermsaid hub desktop app must be running for the extension to connect.

## 🆘 Getting Help

Found a bug or need help?
1. Check existing issues on GitHub
2. Create a new issue with details
3. Include app version and platform

---

**Happy Coding! 🎉**
