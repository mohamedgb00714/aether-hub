# aethermsaid hub Electron App

## Development

Install dependencies:
```bash
npm install
```

Run in development mode:
```bash
npm run dev:electron
```

## Building

Build the Electron app:
```bash
npm run build:electron
```

Package for distribution:
```bash
# All platforms
npm run package

# Specific platforms
npm run package:win
npm run package:mac
npm run package:linux
```

## Icons

The app uses placeholder icons in `build/icons/`. For production, replace with proper icons:

- **icon.png** (512x512): Used for Linux and as source for other formats
- **icon.ico**: Windows icon (convert icon.png using png2ico or online tools)
- **icon.icns**: macOS icon (convert icon.png using iconutil on macOS: `iconutil -c icns icon.iconset`)

## Features

- ✅ Custom frameless window with platform-adaptive titlebar
- ✅ Window controls (minimize, maximize, close)
- ✅ Secure credential storage with electron-store
- ✅ Auto-updater configured for GitHub releases
- ✅ Custom protocol registration (aethermsaid://)
- ✅ System tray integration
- ✅ Native menus and keyboard shortcuts
- ✅ Multi-monitor support with position validation
- ✅ CSP headers for security
- ✅ OAuth callback handling
- ✅ Crash recovery

## Architecture

- **Main Process** (`electron/main.ts`): Window management, native features, IPC handlers
- **Preload Script** (`electron/preload.ts`): Secure IPC bridge using contextBridge
- **Renderer Process** (React app): UI with custom titlebar
- **Storage** (`services/electronStore.ts`): Encrypted storage wrapper with localStorage migration

## Security

- Context isolation enabled
- Node integration disabled in renderer
- Sandboxed renderer processes
- CSP headers enforced
- Encrypted credential storage

## Notes

- The app automatically migrates localStorage data to electron-store on first launch
- DevTools are only available in development mode
- Window state (size, position) is persisted across sessions
