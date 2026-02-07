# aethermsaid hub Electron - Project Structure

## 📁 Directory Organization

```
aether-hubelectron/
│
├── 📂 electron/                  # Electron Main Process
│   ├── main.ts                   # Window management, native features
│   ├── preload.ts                # Secure IPC bridge
│   └── tsconfig.json             # Electron-specific TS config
│
├── 📂 src/                       # React Renderer Process
│   │
│   ├── 📂 components/            # Reusable UI components
│   │   └── TitleBar.tsx          # Custom window titlebar
│   │
│   ├── 📂 pages/                 # Application pages/routes
│   │   ├── Accounts.tsx          # Connection management
│   │   ├── Chat.tsx              # AI assistant chat
│   │   ├── Dashboard.tsx         # Main dashboard
│   │   ├── Digest.tsx            # AI-generated briefing
│   │   ├── KnowledgeBase.tsx     # Knowledge extraction
│   │   └── Settings.tsx          # App settings
│   │
│   ├── 📂 services/              # Business logic & utilities
│   │   ├── electronStore.ts      # Secure storage wrapper
│   │   └── geminiService.ts      # Google AI integration
│   │
│   ├── App.tsx                   # Root component with routing
│   ├── index.tsx                 # React entry point
│   ├── styles.css                # Global styles (Tailwind)
│   └── types.ts                  # TypeScript definitions
│
├── 📂 build/                     # Build resources
│   ├── 📂 icons/                 # Application icons
│   │   ├── icon.png              # 512x512 source icon
│   │   ├── icon.ico              # Windows icon
│   │   └── icon.icns             # macOS icon
│   └── entitlements.mac.plist    # macOS code signing
│
├── 📄 index.html                 # HTML entry point
├── 📄 package.json               # Dependencies & scripts
├── 📄 vite.config.ts             # Vite + Electron config
├── 📄 tsconfig.json              # TypeScript config
├── 📄 tailwind.config.js         # Tailwind CSS config
├── 📄 postcss.config.js          # PostCSS config
├── 📄 electron-builder.json      # Distribution settings
│
├── 📄 README.md                  # Main documentation
├── 📄 ELECTRON_README.md         # Electron-specific docs
├── 📄 QUICK_START.md             # Quick reference guide
└── 📄 start-dev.sh               # Development helper script
```

## 🔄 Application Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Electron App                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────┐         ┌───────────────────────┐  │
│  │   Main Process        │         │  Renderer Process     │  │
│  │   (electron/main.ts)  │◄───────►│  (src/index.tsx)      │  │
│  │                       │   IPC   │                       │  │
│  │  • Window Management  │         │  • React UI           │  │
│  │  • System Tray        │         │  • User Interface     │  │
│  │  • Native Menus       │         │  • Component Tree     │  │
│  │  • Auto Updater       │         │  • Page Routing       │  │
│  │  • File System        │         │                       │  │
│  └───────────────────────┘         └───────────────────────┘  │
│           ▲                                    │                │
│           │                                    │                │
│           │                                    ▼                │
│  ┌────────┴────────────┐         ┌───────────────────────┐    │
│  │  Preload Script     │         │  Services Layer       │    │
│  │  (electron/         │         │  (src/services/)      │    │
│  │   preload.ts)       │         │                       │    │
│  │                     │         │  • electronStore.ts   │    │
│  │  • Secure IPC Bridge│         │  • geminiService.ts   │    │
│  │  • Context Isolation│         │                       │    │
│  └─────────────────────┘         └───────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Key Principles

### Separation of Concerns
- **electron/** - Main process (Node.js, native APIs)
- **src/** - Renderer process (React, UI)
- **build/** - Static assets for distribution

### Security First
- Context isolation enabled
- No node integration in renderer
- Secure IPC via preload script
- Encrypted credential storage

### Type Safety
- TypeScript throughout
- Shared types in `src/types.ts`
- Strict type checking

### Modular Architecture
- Components are reusable
- Services handle business logic
- Pages compose components
- Clear data flow

## 📦 Build Outputs

```
aether-hubelectron/
├── dist/               # Vite build output (renderer)
├── dist-electron/      # Electron build output (main + preload)
└── release/            # Packaged distributables
    └── {version}/
        ├── *.exe       # Windows installer
        ├── *.dmg       # macOS disk image
        └── *.AppImage  # Linux AppImage
```

## 🚀 Development Workflow

1. **Start Dev Server**: `pnpm run dev:electron`
   - Vite serves React app on http://localhost:3003
   - Electron loads app in native window
   - Hot reload enabled

2. **Make Changes**: Edit files in `src/` or `electron/`
   - Vite watches `src/` files
   - vite-plugin-electron watches `electron/` files

3. **Build & Package**: `pnpm run package`
   - Compiles TypeScript
   - Bundles with Vite
   - Creates distributable with electron-builder

## 📝 Import Path Examples

```typescript
// In src/App.tsx
import Dashboard from './pages/Dashboard';          // Relative
import TitleBar from './components/TitleBar';       // Relative
import storage from './services/electronStore';     // Relative
import type { Message } from './types';             // Relative

// Using @ alias (configured in vite.config.ts)
import Dashboard from '@/pages/Dashboard';          // Absolute
import TitleBar from '@/components/TitleBar';       // Absolute
import storage from '@/services/electronStore';     // Absolute
```

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite bundler + Electron plugin |
| `tsconfig.json` | TypeScript for renderer |
| `electron/tsconfig.json` | TypeScript for main process |
| `tailwind.config.js` | TailwindCSS styling |
| `postcss.config.js` | CSS processing |
| `electron-builder.json` | App packaging & distribution |
| `package.json` | Dependencies & scripts |

---

**Clean, Organized, Production-Ready** ✨
