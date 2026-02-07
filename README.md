
<div align="center">

# aether hub

**Privacy-first, local-only AI-powered personal productivity hub**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-39-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

[Features](#-features) · [Getting Started](#-getting-started) · [Architecture](#-architecture) · [Download](#-download) · [Contributing](#contributing)

</div>

---

aether hub synchronizes multiple accounts (Gmail, Outlook, Slack, WhatsApp, Telegram, Discord, GitHub) and uses AI to generate insights across all your communications and schedule — **entirely on your machine**.

## 🛡️ Privacy & Security First

- **Local Storage** — All data lives in a local SQLite database on your machine
- **Local Encryption** — API keys and sensitive data encrypted via Electron `safeStorage` (OS keychain)
- **Stateless AI** — AI requests are stateless; your data is never used for training
- **Local AI Support** — Use **Ollama** or **Local AI** to keep everything 100% on your hardware
- **No Telemetry** — Zero analytics, zero tracking

## ⚠️ Disclaimer on Third-Party Services

aether hub integrates with third-party platforms such as **WhatsApp**, **Discord**, and **Telegram** using unofficial automation methods.

These integrations:
- Are **not affiliated with, endorsed by, or supported by** Meta (WhatsApp), Discord Inc., or Telegram FZ-LLC
- May violate the Terms of Service of these platforms
- May result in **temporary or permanent account restrictions** or bans
- Are provided **for personal, educational, and research purposes only**
- Are **disabled by default** via environment variables

By enabling these features, you acknowledge and accept all associated risks. The authors assume **no responsibility** for account bans, data loss, or policy violations.

## ✨ Features

| Category | Details |
|----------|---------|
| **Multi-Account Sync** | Gmail, Outlook, Slack, WhatsApp, Telegram, Discord, GitHub |
| **Unified Dashboard** | All communications and schedule in one place |
| **AI Intelligence Engine** | Gemini, OpenAI, Anthropic, OpenRouter, Ollama, Local AI |
| **AI Digest** | Cross-referenced daily summary of all accounts |
| **LangChain Agent** | 26+ database tools for deep conversational AI |
| **Knowledge Base** | Save, organize, and get AI insights from your content |
| **Automations** | Scheduled browser automation with browser-use |
| **Watch System** | Cross-platform monitoring with AI action generation |
| **Browser Extension** | Chrome (MV3) & Firefox (MV2) sidebar with AI chat |
| **Floating Widgets** | System-wide microphone overlay and sticky notes |
| **Email Campaigns** | Resend integration for email sending and campaigns |
| **YouTube Analysis** | Channel tracking, RSS feeds, transcript extraction |

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [pnpm](https://pnpm.io/) v9+
- Chrome or Chromium (required for WhatsApp integration)

### Installation

```bash
# Clone the repository
git clone https://github.com/mohamedgb00714/aether-hub.git
cd aether-hub

# Install dependencies
pnpm install

# Configure environment (optional — keys can be added via the app UI)
cp .env.example .env

# Start development
pnpm run dev:electron
```

### Building for Production

```bash
# Full build (Vite + TypeScript + esbuild preload)
pnpm run build:electron

# Package for your platform
pnpm run package:linux   # AppImage + .deb
pnpm run package:mac     # .dmg (Intel + Apple Silicon)
pnpm run package:win     # .exe installer
```

## 🏗️ Architecture

```
aether-hub/
├── electron/              # Main process (Node.js)
│   ├── main.ts            # Window management, IPC handlers, native features
│   ├── preload.ts         # Context-isolated IPC bridge (window.electronAPI)
│   ├── database.ts        # SQLite database (16 tables)
│   ├── ai-service.ts      # Centralized multi-provider AI service
│   ├── security.ts        # Encryption key management via safeStorage
│   ├── addon-server.ts    # WebSocket server for browser extensions
│   ├── whatsapp.ts        # WhatsApp Web automation
│   ├── telegram.ts        # Telegram client integration
│   ├── discord-selfbot.ts # Discord self-bot (experimental)
│   └── youtube.ts         # YouTube channel analysis
├── src/                   # Renderer process (React)
│   ├── pages/             # Route pages (Dashboard, Chat, Emails, etc.)
│   ├── components/        # Reusable UI components
│   ├── services/          # AI, database, sync, and connector services
│   └── types.ts           # Shared TypeScript interfaces
├── browser-addon/         # Browser extensions
│   ├── chrome/            # Chrome extension (Manifest V3)
│   └── firefox/           # Firefox extension (Manifest V2)
└── .github/workflows/     # CI/CD (build + release on tag push)
```

### Key Design Principles

- **Context Isolation** — Renderer never imports Node.js modules; all native ops go through IPC
- **No Hardcoded Secrets** — All keys stored encrypted via `safeStorage` + electron-store
- **Centralized AI** — Single service handles all 6 providers (no duplicated logic)
- **Preload via esbuild** — Separate CommonJS build for sandbox compatibility

## 🌐 Browser Extension

The included browser extensions connect to the desktop app via WebSocket (port 8765):

- **AI Chat** with full markdown rendering
- **Quick access** to emails, calendar, notifications
- **Actions tab** for AI-generated action items
- **Page saving** to Knowledge Base with one click

### Chrome
1. Go to `chrome://extensions/` → Enable Developer mode
2. Click **Load unpacked** → Select `browser-addon/chrome/`

### Firefox
1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** → Select `browser-addon/firefox/manifest.json`

> The desktop app must be running for the extension to connect.

## 📦 Download

Download the latest release from the [Releases page](https://github.com/mohamedgb00714/aether-hub/releases):

| Platform | File |
|----------|------|
| **Windows** | `aethermsaid-hub-{version}-x64-setup.exe` |
| **macOS (Intel)** | `aethermsaid-hub-{version}-x64.dmg` |
| **macOS (Apple Silicon)** | `aethermsaid-hub-{version}-arm64.dmg` |
| **Linux (AppImage)** | `aethermsaid-hub-{version}-x64.AppImage` |
| **Linux (Debian)** | `aethermsaid-hub-{version}-amd64.deb` |

### Automated Releases

Pushing a version tag triggers GitHub Actions to build for all platforms:

```bash
git tag -a v1.0.0 -m "v1.0.0"
git push origin v1.0.0
```

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repo
2. Create your branch: `git checkout -b feature/amazing-feature`
3. Commit: `git commit -m "Add amazing feature"`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 🔒 Security

Found a vulnerability? Please report it privately — see [SECURITY.md](SECURITY.md).

## 📄 License

[MIT](LICENSE) © msaid mohamed el hadi
