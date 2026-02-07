
# aethermsaid hub (v2.0 Beta)

aethermsaid hub is a privacy-first, intelligent cockpit for your digital life. It synchronizes multiple accounts locally and uses AI (Gemini, OpenAI, Anthropic, or local models) to provide clarity across your communications and schedule.

## 🛡️ Privacy & Security First

aethermsaid hub is built with privacy as its core principle:
- **Local Storage**: All your messages, emails, and events are stored in a local SQLite database on your machine.
- **Local Encryption**: Sensitive data and API keys are encrypted using Electron's `safeStorage` API, which leverages your OS's native keychain (Keychain on macOS, Secret Service on Linux, DPAPI on Windows).
- **Stateless AI Requests**: AI processing is done via stateless requests. Your data is never used for training models or stored permanently on remote servers.
- **Support for Local AI**: Use **Ollama** or **Local AI** to keep all your data processing entirely on your own hardware.

## ⚠️ Disclaimer on Third-Party Services

aethermsaid hub integrates with third-party platforms such as **WhatsApp**, **Discord**, and **Telegram** using unofficial automation methods.

These integrations:
*   Are **not affiliated with, endorsed by, or supported by** Meta (WhatsApp), Discord Inc., or Telegram FZ-LLC.
*   May violate the Terms of Service of these platforms.
*   May result in **temporary or permanent account restrictions** or bans.
*   Are provided **for personal, educational, and research purposes only**.

By enabling these features, you acknowledge and accept all associated risks. The authors and contributors of aethermsaid hub assume **no responsibility** for account bans, data loss, or policy violations resulting from their use.

## ✨ Features
- **Multi-Account Sync**: Gmail, Outlook, Slack, WhatsApp, Telegram, Discord, and more.
- **Unified Dashboard**: See all your communications and schedule in one place.
- **AI Digest**: Get a cross-referenced summary of your day.
- **Intelligence Engine**: Choose your preferred AI provider (Gemini 3, GPT-4o, Claude 3.5, or local models).
- **Browser Extension**: Access your data and chat with AI directly from your browser.
- **Floating Widgets**: System-wide microphone and notes overlays for ultimate productivity.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or later)
- [pnpm](https://pnpm.io/) (v9 or later)
- Chrome or Chromium installed (required for WhatsApp integration)

### Installation
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/mohamedgb00714/aether-hub.git
    cd aether-hub
    ```

2.  **Install dependencies**:
    ```bash
    pnpm install
    ```

3.  **Configure environment**:
    Copy the example environment file and add your API keys (optional, you can also add them via the app UI).
    ```bash
    cp .env.example .env
    ```

4.  **Start for development**:
    ```bash
    pnpm run dev:electron
    ```

### Building for Production
```bash
pnpm run build:electron
pnpm run package
```

## 🌐 Browser Extension
... (keep existing content or similar)

aethermsaid hub includes browser extensions for Chrome and Firefox that connect to the desktop app via WebSocket, enabling:
- **Quick access** to emails, calendar events, and notifications from your browser
- **AI Chat** with full markdown rendering (headers, lists, code blocks, bold/italic)
- **Actions tab** to view and manage AI-generated action items
- **Page saving** to Knowledge Base with one click
- **Seamless sync** with the desktop app

### Installing the Browser Extension

#### From Packaged App (Recommended)
After installing aethermsaid hub, the browser extension files are located at:
- **Linux**: `/opt/aethermsaid-hub/resources/app.asar.unpacked/browser-addon/`
- **macOS**: `/Applications/aethermsaid-hub.app/Contents/Resources/app.asar.unpacked/browser-addon/`
- **Windows**: `C:\Program Files\aethermsaid-hub\resources\app.asar.unpacked\browser-addon\`

#### Chrome Installation
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `chrome` folder from the addon location above

#### Firefox Installation
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select the `manifest.json` file from the `firefox` folder

### Requirements
- aethermsaid hub desktop app must be running (provides WebSocket server on port 8765)
- Extensions auto-connect when the app is running

### Version Information
- Extension Version: **1.0.0**
- Manifest: Chrome (v3), Firefox (v2)
- Features: Chat with AI, Emails, Calendar, Notifications, Actions, Knowledge Base

## 📦 Building & Distribution

### Quick Release (Automated)

Create a new release for all platforms with one command:

```bash
npm version patch  # or minor, major
git push origin --tags
```

This triggers GitHub Actions to automatically:
- Build installers for Windows, macOS (Intel + Apple Silicon), and Linux
- Create a GitHub Release with all installers
- Takes ~10-20 minutes

### Download Installers

Download the latest release from the [Releases page](https://github.com/mohamedgb00714/aether-hub/releases):

- **Windows**: `aether-hub-{version}-x64-setup.exe`
- **macOS**: `aether-hub-{version}-x64.dmg` (Intel) or `aether-hub-{version}-arm64.dmg` (Apple Silicon)
- **Linux**: `aether-hub-{version}-x64.AppImage` or `aether-hub-{version}-amd64.deb`

### Manual Local Build

```bash
# Install dependencies
npm install

# Build for all platforms
npm run build:electron
npm run package

# Or build for specific platforms
npm run package:win     # Windows
npm run package:mac     # macOS
npm run package:linux   # Linux
```

For detailed instructions, see [RELEASE_GUIDE.md](./RELEASE_GUIDE.md).
