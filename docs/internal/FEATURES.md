# aethermsaid hub Personal Hub - Technical Feature Documentation

## Project Overview
*   **Application Name**: aethermsaid hub Personal Hub
*   **Version**: 0.2.4
*   **Description**: A privacy-first, local-only digital cockpit that synchronizes multiple communication and productivity accounts (Gmail, Outlook, Slack, etc.) and utilizes advanced AI (Google Gemini, etc.) to generate cross-platform insights and automate workflows.
*   **Target Users**: Power users, professionals, and developers managing multiple digital identities and communication channels.
*   **Main Problem Solved**: Fragmented digital life across numerous disconnected platforms, leading to cognitive overload and missed information.

## Architecture Overview
*   **Main Process (`electron/`)**: Handles window management, native OS features (Tray, Global Shortcuts), SQLite database, secure storage, and background services (WhatsApp, Telegram, Discord, Automation Scheduler).
*   **Renderer Process (`src/`)**: A React 19 application built with Vite and Tailwind CSS. Responsible for the UI and user interactions.
*   **Preload Bridge (`electron/preload.ts`)**: Implements strict context isolation using `contextBridge` to expose a secure `electronAPI` to the renderer, preventing direct Node.js access in the UI.
*   **Process Isolation Strategy**: Context isolation is enabled; all native/file-system/database operations are routed through IPC (Inter-Process Communication).
*   **Folder Structure**:
    *   `electron/`: Main process source code and background services.
    *   `src/`: React renderer source code.
    *   `browser-addon/`: Source files for Chrome (MV3) and Firefox (MV2) extensions.
    *   `dist-electron/`: Compiled main process and preload scripts.
*   **Dependency Graph Summary**:
    *   **Core**: Electron, React 19, Vite, TypeScript.
    *   **AI**: @google/genai, LangChain suite (@langchain/core, @langchain/google-genai), browser-use-sdk.
    *   **Database**: better-sqlite3.
    *   **Communications**: whatsapp-web.js, telegram (MTProto), discord.js-selfbot-v13.
    *   **Automation**: node-cron, browser-use.

## Core Application Features

### Unified Dashboard & Multi-Account Filtering
*   **Description**: A centralized feed of emails, events, and notifications. Every item is attributed to its source account (e.g., "Work Gmail", "Freelance Slack") with live sync health indicators.
*   **Implementation**: [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx)
*   **Sync Logic**: Background service fetch deltas every 5 minutes from Google, Outlook, Slack, and GitHub.

### LangChain AI Agent ("Atlas")
*   **Description**: An autonomous assistant with 26+ database tools. It uses **ReAct reasoning** pattern to search across emails, messages, and events to answer complex queries.
*   **Visual Troubleshooting**: Utilizes the Electron `desktopCapturer` API to capture screen context via a `screenshot:capture` IPC handler, allowing the agent to "see" and diagnose desktop-level issues.
*   **Context Injection**: Automatically injects temporal context (current date/time) and user identity into system prompts.
*   **Implementation**: [src/services/langchainService.ts](src/services/langchainService.ts)

### Communication Sync (WhatsApp/Telegram/Discord)
*   **Description**: Local synchronization of chats and messages. 
    *   **WhatsApp**: Puppeteer-based browser automation (Main process) with session persistence.
    *   **Telegram**: Native MTProto integration with auth-state persistence.
    *   **Discord**: Read-only tracking via self-bot (limited to personal usage).
*   **Implementation**: [electron/whatsapp.ts](electron/whatsapp.ts), [electron/telegram.ts](electron/telegram.ts), [electron/discord-selfbot.ts](electron/discord-selfbot.ts)

### Watch System & Cross-Platform Monitoring
*   **Description**: Allows users to "Watch" specific repositories, chat threads, or email addresses. The system monitors for updates and generates AI-driven "Watch Actions" (tasks).
*   **Implementation**: [electron/database.ts](electron/database.ts) (Tables: watched_items, watch_actions, analyzed_messages).

### YouTube Intelligence
*   **Description**: RSS-based channel tracking. Uses AI to transcribe videos, score them based on user interest weights, and provide high-value summaries.
*   **Implementation**: [electron/youtube.ts](electron/youtube.ts), [src/pages/YouTube.tsx](src/pages/YouTube.tsx).

### Browser Automation (Browser-Use)
*   **Task Execution**: AI agents control a real browser via the **browser-use** Python library to perform web tasks (e.g., ticket booking, data extraction).
*   **Execution History**: Granular tracking in `automation_history` table, including `duration_ms` and full `error_stack` for debugging tasks.
*   **Process Management**: Implements a robust queue with configurable concurrency (1-10) and clean process termination (SIGTERM → SIGKILL fallback).
*   **Scheduling**: Full cron support via `node-cron` with a 5-second initiation delay for "Run on Startup" tasks to ensure system readiness.
*   **Implementation**: [electron/automation-scheduler.ts](electron/automation-scheduler.ts).

## User Interface & Experience
*   **Custom Framework**: React 19 + Tailwind CSS + Framer Motion.
*   **Overlay Windows**:
    *   **Mic Overlay**: Minimalist floating bar for global STT and AI commands.
    *   **Notes Overlay**: Floating, resizable notepad that persists across all desktop applications.
*   **Floating Chat**: A persistent bubble appearing on most pages for instant Atlas access.
*   **Adaptive TitleBar**: Frameless design with platform-aware controls.
*   **Universal Search**: Global `Ctrl/⌘ + K` shortcut launches a cross-platform semantic search across all local data.

## System & Background Services
*   **Addon Server**: A WebSocket server (Port 8765) connecting desktop app to browser extensions.
*   **Protocol Registry**: Custom `aethermsaid://` scheme handles OAuth callbacks and deep-linking into specific chat threads or Knowledge Base items.
*   **Automation Scheduler**: Manages cron jobs for account syncing, YouTube checks, and AI automations.
*   **Native OS Hooks**: Global shortcuts for microphone toggle and window visibility.
*   **Crash Recovery**: Integrated auto-restart logic in the Main process to recover from service failures (e.g., WhatsApp login loops).

## Data & Knowledge Management
*   **Activity Batching**: Implements a 2-second insertion delay for `user_activities` to prevent SQLite write-locking during high-frequency telemetry events.
*   **Knowledge Base Insight Engine**: A background analyzer running every 60 minutes to extract niche behaviors: *Work Hours*, *Tone/Formality*, *Common Phrases*, and *Peak Velocity*.
*   **Knowledge Infrastructure**:
    *   **Conversation Threads**: Dedicated `conversation_summaries` table to aggregate multi-message interactions.
    *   **Confidence Scoring**: Every insight is assigned a `confidence_score` (0.0 to 1.0) used by the Atlas agent for reasoning.
*   **Retention Policies**: Automated `autoVault` logic to prune activity logs and maintain optimal database size.
*   **Privacy Cleanup**: Specialized "LinkedIn Nuclear Option" selectively wipes all LinkedIn data while preserving structural email/calendar sync metadata.

## Integrations & External APIs

### Communication & Social Integrations
*   **WhatsApp**: Real-time message sync and media support via Puppeteer.
*   **Telegram**: MTProto-based sync for messages, channels, and groups.
*   **Discord**: Read-only tracking of servers and DMs.
*   **Slack**: OAuth-based workspace sync with console deep-linking for permission management.
*   **LinkedIn**: Specialized cleanup and structural wipe tools (`cleanup-linkedin.js`).

### Productivity & Email
*   **Google (Gmail/Calendar)**: Full OAuth integration via local callback server (Port 8089).
*   **Microsoft (Outlook/Office365)**: OAuth-based email and calendar synchronization.
*   **GitHub**: Repository monitoring, PR tracking, and issue management.
*   **Custom SMTP/IMAP**: Direct server connection for custom mailboxes.

### Marketing & Analytics
*   **Resend**: Integration for managing email audiences and templates with AI content generation. Uses lazy loading tabs for history/audiences to mitigate API rate limiting (HTTP 429).
*   **Google Analytics**: GA4 property tracking metrics.
*   **Microsoft Clarity**: Visualized session insights and heatmap tracking.

### AI & Media Services
*   **Multi-Provider AI**: Shared service supporting Google Gemini, OpenAI, Anthropic, OpenRouter, and Ollama (Local).
*   **ElevenLabs**: Neural voice synthesis. Supports high-fidelity models (`multilingual_v2`, `turbo_v2_5`) and specific voice registries (Rachel/Adam).
*   **Neural Parameters**: UI-exposed weights for *Stability*, *Clarity*, *Style Exaggeration*, and *Latent Overdrive*.
*   **Whisper.cpp**: Local speech-to-text integration for offline dictation.
*   **YouTube**: RSS tracking with automated AI transcription and value scoring.

## Performance & Build
*   **Preload Bundling**: Custom `build-preload.js` using `esbuild` for fast, sandboxed IPC initialization.
*   **SQLite Rebuild**: Optimized binary (`better-sqlite3`) with dedicated rebuild script for consistency.
*   **Packaging Strategy**: The `browser-addon` directory is explicitly excluded from ASAR compression (`asarUnpack`) to allow extensions to load local assets effectively.

## Distribution & Updates
*   **Platform Support**: Windows (NSIS), macOS (DMG - Intel & ARM), Linux (AppImage & DEB).
*   **Linux Compliance**: Explicit `Office;Productivity` category assignment for `.desktop` file generation.
*   **File Associations**: Registered association with `.aether-hub` file extensions for Knowledge Base files.

## Known Limitations
*   **Self-Bot Warnings**: Discord integration carries risk of account suspension.
*   **System Dependencies**: Requires external Chrome/Chromium for browser-driven services in a packaged state.
*   **Hardware Requirements**: AI features vary based on local RAM/GPU (especially for Ollama/Whisper).

## Roadmap
*   **Vector Search**: Integration of ChromaDB for persistent long-term semantic memory.
*   **Cross-Device Sync**: Optional encrypted peer-to-peer sync.
*   **Automation Library**: Marketplace for community-built `browser-use` automation scripts.
