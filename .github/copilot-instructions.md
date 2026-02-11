# aethermsaid hub Electron - AI Agent Instructions

## Architecture Overview

**aethermsaid hub** is a privacy-first, local-only Electron app built with React + TypeScript + Vite. It synchronizes multiple accounts (Gmail, Outlook, Slack, etc.) and uses Google Gemini AI to generate insights across communications and schedules.

### Process Architecture
- **Main Process** (`electron/main.ts`): Window management, native OS features, secure storage via electron-store, IPC handlers
- **Preload Script** (`electron/preload.ts`): Context-isolated IPC bridge exposing `window.electronAPI` to renderer
- **Renderer Process** (`src/`): React app with HashRouter, Tailwind CSS, service layer for AI and storage

### Key Principle: No Node in Renderer
- Context isolation is **enabled** - renderer NEVER imports Node.js modules directly
- ALL native operations go through IPC via `window.electronAPI` (see `electron/preload.ts`)
- Storage uses `src/services/electronStore.ts` wrapper, NOT direct electron-store imports

## Critical Files & Patterns

### Vite Configuration (`vite.config.ts`)
- Uses `vite-plugin-electron` for main process only
- **Preload script**: Built separately with esbuild (see `build-preload.js`) to ensure proper CommonJS output
- Main process outputs to `dist-electron/main.js` (ES modules)
- Preload outputs to `dist-electron/preload.cjs` (CommonJS - required for Electron sandbox)
- External dependencies: `electron`, `electron-store`, `electron-updater`
- **Important**: Never add preload to vite-plugin-electron config - use dedicated esbuild build instead

### Storage Pattern
**ALWAYS use the wrapper** - see `src/services/electronStore.ts`:
```typescript
import storage from './services/electronStore';

// ✅ Correct
const apiKey = await storage.get('gemini_api_key');
await storage.set('settings', { theme: 'dark' });

// ❌ NEVER do this in renderer:
import Store from 'electron-store'; // Will fail - Node module in renderer!
```

**Auto-migration**: First Electron launch migrates `localStorage` to electron-store automatically.

### AI Integration (`src/services/geminiService.ts`)
- Uses `@google/genai` SDK with configurable Gemini models
- API key from secure storage (`STORAGE_KEYS.GEMINI_API_KEY`) with fallback to `process.env.API_KEY`
- Model selection from secure storage (`STORAGE_KEYS.GEMINI_MODEL`) with fallback to `DEFAULT_MODEL`
- Users configure API key and model in Settings > Intelligence Engine (encrypted in electron-store)
- Available models (Jan 2026): Gemini 3 Pro/Flash (preview), 2.5 Pro/Flash/Lite, 2.0 Flash/Lite, 1.5 Flash/Pro (legacy)
- Default model: `gemini-2.5-flash` (current stable)
- All AI functions use `getApiKey()` and `getModel()` helpers - return user-friendly errors if key missing
- Key functions: `summarizeNotifications()`, `summarizeCalendar()`, `getEventBriefing()`, `prioritizeNotifications()`
- Structured output via `responseMimeType: "application/json"` for typed responses

### Centralized AI Service Architecture
**Main Process** (`electron/ai-service.ts`):
- Unified AI service supporting all 6 providers: Google Gemini, OpenRouter, OpenAI, Anthropic, Ollama, Local AI
- Single `callAI()` function handles all provider-specific differences (endpoints, auth, request/response formats)
- Exports convenience functions: `generateChatResponse()`, `analyzeAutomationResult()`
- Automatically reads provider config from electron-store (`ai_provider`, API keys, models)
- Used by: automation-scheduler.ts, whatsapp.ts, and other main process features

**Renderer Process** (`src/services/geminiService.ts`):
- Same multi-provider support for renderer-side AI calls
- Uses `getAIProvider()` to respect global setting
- Provider-specific implementations for Gemini, OpenRouter, OpenAI, Anthropic, Ollama, Local AI
- Used by: langchainService.ts, Chat pages, browser-use, YouTube analysis, etc.

**Critical Rule**: NEVER duplicate AI provider logic - always import and use these centralized services

### Resend Integration (`src/services/connectors/resendConnector.ts`)
- Email campaign management using Resend API (https://resend.com)
- API key stored securely via `STORAGE_KEYS.RESEND_KEY`
- Key functions: `sendEmail()`, `sendCampaign()`, `getAudiences()`, `getContacts()`, `getTemplates()`
- Sent emails tracked locally in electron-store (`resend_sent_emails`)
- Email templates stored locally (`resend_templates`)
- Campaigns page (`src/pages/Resend.tsx`) provides UI for:
  - Composing and sending individual emails or bulk campaigns
  - Managing audiences (contact lists)
  - Saving/loading email templates
  - Viewing sent email history with delivery status
  - Managing verified domains
- AI-powered email content generation using Gemini
- Sent emails also visible in Emails page under "Sent" tab

### WhatsApp Integration (`electron/whatsapp.ts`)
- Uses `whatsapp-web.js` library with Puppeteer for browser automation
- Runs entirely in main process (requires Node.js)
- Session persistence via `LocalAuth` strategy in app's userData folder
- QR code authentication flow with real-time IPC events to renderer
- Key functions: `initializeWhatsApp()`, `getChats()`, `getRecentMessages()`, `sendMessage()`
- IPC events: `whatsapp:qr`, `whatsapp:ready`, `whatsapp:disconnected`, `whatsapp:message`
- Access via `window.electronAPI.whatsapp.*` methods in renderer

**CRITICAL: Packaged App Requirements**
- **System Chrome/Chromium Required**: Bundled Puppeteer Chromium cannot run from asar archive
- The `getChromePath()` function detects system Chrome/Chromium installation:
  - **Linux**: `/usr/bin/google-chrome-stable`, `/usr/bin/chromium-browser`, `/usr/bin/chromium`, `/snap/bin/chromium`
  - **macOS**: `/Applications/Google Chrome.app/.../Google Chrome`, `/Applications/Chromium.app/.../Chromium`
  - **Windows**: `C:\Program Files\Google\Chrome\Application\chrome.exe`, `C:\Program Files (x86)\...`
- If no Chrome found, falls back to bundled Chromium (works in dev, fails in packaged)
- **User must have Chrome or Chromium installed** for WhatsApp to work in packaged app

**Preload Rebuild Requirement**
- After modifying `electron/preload.ts`, **always rebuild preload** with:
  ```bash
  node build-preload.js
  ```
- This is separate from Vite build - preload uses esbuild for CommonJS output
- Forgetting to rebuild preload causes IPC methods to be undefined in renderer

### LangChain AI Agent (`src/services/langchainService.ts`)
- Full AI agent with 26+ database access tools for comprehensive data retrieval
- Tools include: emails, events, notifications, GitHub, WhatsApp, Discord, chat sessions, cross-platform search
- Uses ReAct reasoning pattern with Google Gemini or OpenRouter models
- Configurable assistant name stored in `STORAGE_KEYS.ASSISTANT_NAME` (default: "Atlas")
- System prompt dynamically loads assistant name from storage
- Response format: `{ text: string }` - extract `.text` property from responses
- Chat history stored in SQLite database (`chat_sessions`, `chat_messages` tables)

### AI Agents System (`src/services/agents/`)
**Architecture**: 11 specialized agents organized in 3 categories (Core Life, Productivity, Lifestyle)

**Files**:
- `types.ts`: Central type definitions (`AgentInfo`, `AgentMessage`, `AgentConversation`, `AgentResponse`, `AgentTool`)
- `baseAgent.ts`: Shared base class with `run()` method, LangChain integration, conversation history
- `registry.ts`: Singleton manager with `getAllAgents()`, `getAgentsByCategory()`, `searchAgents()`
- `index.ts`: Clean module exports

**Categories & Agents**:
1. **Core Life** (`core-life/`):
   - `financialPlanner.ts` 💰: Budget tracking, debt payoff, investment advice (tools: calculate_budget, calculate_debt_payoff, investment_allocation)
   - `legalInfo.ts` ⚖️: Contract analysis, legal research, compliance (tools: analyze_contract, legal_database_search)
   - `planner.ts` 📅: Calendar management, task prioritization (tools: get_todays_events, save_tasks, schedule_reminder)
   - `study.ts` 📚: Quiz generation, flashcards, explanations (tools: generate_quiz, create_flashcard, explain_topic)

2. **Productivity** (`productivity/`):
   - `emailAssistant.ts` ✉️: Draft emails, filter spam (tools: draft_email, search_emails, filter_spam)
   - `notesKnowledge.ts` 📝: Note organization, tagging (tools: search_notes, tag_note, get_all_tags)
   - `freelancerAssistant.ts` 💼: Invoices, client tracking (tools: generate_invoice, track_client_hours)
   - `codingTechnical.ts` 💻: Code review, debugging (tools: review_code, suggest_debugging_steps)

3. **Lifestyle** (`lifestyle/`):
   - `wellnessRoutine.ts` 🏥: Habit tracking, meal planning (tools: track_habit, generate_meal_plan)
   - `shoppingDecision.ts` 🛒: Product comparisons, budgets (tools: compare_products, budget_recommendation)
   - `travelPlanner.ts` 🧳: Trip itineraries, packing lists (tools: generate_itinerary, create_packing_list)

**Key Patterns**:
- All agents extend `BaseAgent` class
- Use `DynamicStructuredTool` from LangChain with zod schemas for type safety
- Storage keys for persistent data: `FINANCE_STORAGE_KEY`, `STUDY_STORAGE_KEY`, etc.
- Tool naming: lowercase_with_underscores (e.g., `calculate_budget`, `generate_quiz`)
- Response extraction: Always use `response.text` from LangChain return value
- Shared chat instance: `getSharedChat()` reuses AI model across agents for efficiency

**Creating New Agents**:
1. Create file in category folder: `src/services/agents/{category}/{agentName}.ts`
2. Extend `BaseAgent` class
3. Define `AgentInfo` with name, description, category, icon, color, example prompts
4. Implement custom tools with zod schemas
5. Add to `registry.ts` imports and `ALL_AGENTS` array
6. Export from category `index.ts`

**UI Integration** (`src/pages/Agents.tsx`):
- Category-based grid view with search
- Individual chat interfaces per agent
- Example prompts as clickable buttons
- Tool usage tracking displayed in messages
- Markdown rendering with ReactMarkdown

### Floating Chat Interface
**FloatingChatBubble** (`src/components/FloatingChatBubble.tsx`):
- Appears on all pages except `/chat` route
- Gradient blue-to-purple button with pulse animation
- Toggles `FloatingChatWindow` on click
- Icon changes to X when window is open

**FloatingChatWindow** (`src/components/FloatingChatWindow.tsx`):
- Small popup window (384px × 512px) at bottom-right
- Full AI chat integration with markdown rendering
- External links open in system browser via `window.electronAPI.shell.openExternal()`
- Auto-creates chat sessions and saves all messages to database
- Response handling: Extracts `response.text` from LangChain return value
- Markdown components: Custom link handler, code blocks with syntax highlighting

### Database Architecture (`electron/database.ts`)
- SQLite database with 16 tables storing all application data
- Tables: accounts, emails, events, notifications, github_items, whatsapp_accounts, whatsapp_chats, whatsapp_messages, discord_guilds, discord_channels, discord_messages, chat_sessions, chat_messages, knowledge_messages, knowledge_insights, folders
- Chat messages table structure: `id, session_id, role, content, sources` (created_at auto-generated)
- **Critical**: When inserting with DEFAULT columns, omit them from column list to avoid parameter mismatch
- All IPC database operations exposed via `electron/preload.ts` db namespace
- Renderer accesses via wrapper in `src/services/database.ts`
- Helper functions: `createChatSession(title)`, `createChatMessage(sessionId, role, content)`

### IPC Communication
When adding new IPC channels, update **both** files:
1. **Preload** (`electron/preload.ts`): Add method to `electronAPI` object
2. **Main** (`electron/main.ts`): Add `ipcMain.handle()` or `ipcMain.on()` handler

Example - adding clipboard support:
```typescript
// preload.ts
clipboard: {
  writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text)
}

// main.ts
ipcMain.handle('clipboard:writeText', async (_, text: string) => {
  clipboard.writeText(text);
});
```

### Window Management
- **Frameless window** with custom `TitleBar.tsx` component
- Platform-adaptive: macOS shows native traffic lights, Windows/Linux show custom controls
- State persistence in electron-store (size, position, maximized state)
- Multi-monitor validation in `validateWindowPosition()` - resets to primary if off-screen

## Development Workflow

### Running the App
```bash
pnpm run dev:electron    # Vite + Electron with hot reload
pnpm run build:electron  # Vite build + TypeScript + esbuild for preload
pnpm run package         # Create distributable (uses electron-builder)
pnpm run package:linux   # Build AppImage and .deb for Linux
```

**DevTools**: Automatically open in dev mode (see `electron/main.ts` line ~120: `mainWindow.webContents.openDevTools()`)

**Build process**: 
1. `vite build` - Builds React renderer
2. `tsc -p electron/tsconfig.json` - Compiles main process
3. `node build-preload.js` - Bundles preload with esbuild (CommonJS output)
4. `electron-builder` - Packages for distribution

**Linux Installation**:
```bash
sudo dpkg -i release/0.1.0/aethermsaid hub-0.1.0-amd64.deb
aether-hub-personal-hub  # Launch installed app
```

### Required Dependencies
- **Production**: `fs-extra` required by `electron-updater` - must be in dependencies, not devDependencies
- **Native modules**: `better-sqlite3` requires rebuild for Electron (`postinstall` script handles this)
- **Package.json**: Author email required for .deb packages: `{ "name": "...", "email": "..." }`

### TypeScript Configuration
- **Root** (`tsconfig.json`): Renderer process (React)
- **Electron** (`electron/tsconfig.json`): Main + preload with Node types
- Use `types.ts` for shared interfaces (`Account`, `Notification`, `CalendarEvent`, etc.)

### Styling
- **Tailwind CSS** via PostCSS (local build, not CDN)
- Global styles in `src/styles.css` with `@tailwind` directives
- Custom titlebar uses `app-region: drag` CSS for window dragging

## Security & Distribution

### Content Security Policy
Set in `electron/main.ts` - allows Google AI endpoints, blocks unsafe-eval

### Encryption
- electron-store uses `encryptionKey: 'aether-hub-secure-key-v1'` (hardcoded for dev)
- **TODO for production**: Use environment variable or OS keychain
- Gemini API key stored encrypted via `STORAGE_KEYS.GEMINI_API_KEY`
- Users configure API key in Settings > Intelligence Engine with show/hide toggle

### Code Signing
- macOS entitlements in `build/entitlements.mac.plist`
- electron-builder config in `electron-builder.json` with GitHub releases publish target
- Icons: `build/icons/icon.{png,ico,icns}`

## Browser Extension (`browser-addon/`)

aethermsaid hub includes browser extensions for Chrome (Manifest V3) and Firefox (Manifest V2).

### Architecture
- **WebSocket Connection**: Extensions connect to Electron app's addon-server on port 8765
- **Addon Server** (`electron/addon-server.ts`): Handles all browser extension requests
- **Version**: 1.0.0 (both Chrome and Firefox)

### File Structure
```
browser-addon/
├── chrome/          # Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── sidepanel.html/js/css
│   ├── background.js
│   ├── content.js/css
│   ├── lib/         # Local libraries (marked.js, purify.js)
│   └── icons/
└── firefox/         # Firefox extension (Manifest V2)
    ├── manifest.json
    ├── sidebar.html/js/css
    ├── background.js
    ├── content.js/css
    ├── lib/         # Local libraries (marked.js, purify.js)
    └── icons/
```

### Key Features
- **Tabs**: Chat, Emails, Calendar, Notifications, Actions, Knowledge
- **AI Chat**: Full markdown rendering using marked.js + DOMPurify (bundled locally)
- **Actions Tab**: View and manage AI-generated action items from Watch system
- **Page Saving**: Save current page to Knowledge Base via context menu

### Critical: Local Libraries
- **CSP Restriction**: Browser extensions block CDN scripts
- **Solution**: Libraries bundled in `lib/` folder:
  - `marked.min.js` - Markdown parser
  - `purify.min.js` - HTML sanitizer (DOMPurify)
- These are loaded via local `<script>` tags, not CDN

### Packaging
- Extensions included in Electron package via `electron-builder.json`:
  - `asarUnpack: ["browser-addon/**/*"]` - Unpacks for user access
  - `files: ["browser-addon/**/*"]` - Includes in build
- **Installed location**:
  - Linux: `/opt/aethermsaid hub/resources/app.asar.unpacked/browser-addon/`
  - macOS: `/Applications/aethermsaid hub.app/Contents/Resources/app.asar.unpacked/browser-addon/`
  - Windows: `C:\Program Files\aethermsaid hub\resources\app.asar.unpacked\browser-addon\`

### Adding New Extension Features
1. Add message handler in `browser-addon/chrome/background.js`
2. Mirror for Firefox in `browser-addon/firefox/background.js`
3. Add server-side handler in `electron/addon-server.ts`
4. Update UI in `sidepanel.js`/`sidebar.js` and corresponding HTML/CSS

### Adding LangChain Database Tool
1. Define tool in `src/services/langchainService.ts` using `DynamicStructuredTool`
2. Add to `createDatabaseTools()` array
3. Specify schema with zod for input validation
4. Access database via `src/services/database.ts` wrapper

### Adding AI Agent
1. Create file in `src/services/agents/{category}/{agentName}.ts` (category: `core-life`, `productivity`, `lifestyle`)
2. Import and extend `BaseAgent` from `../baseAgent`
3. Define `AgentInfo` object with: `id`, `name`, `description`, `category`, `icon`, `color`, `systemPrompt`, `examplePrompts`
4. Create custom tools using `DynamicStructuredTool` with zod schemas
5. Specify storage key for persistent data: `const STORAGE_KEY = 'agent_your_agent_name';`
6. Add agent class to `src/services/agents/registry.ts` imports and `ALL_AGENTS` array
7. Export from category `index.ts` and main `src/services/agents/index.ts`

**Agent Tool Pattern**:
```typescript
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

const customTool = new DynamicStructuredTool({
  name: "tool_name_lowercase",
  description: "Clear description for AI to understand when to use this",
  schema: z.object({
    param1: z.string().describe("Description of param1"),
    param2: z.number().optional().describe("Optional param2")
  }),
  func: async ({ param1, param2 }) => {
    // Implementation using storage, db, or other services
    return JSON.stringify({ result: "success" });
  }
});
```

### Accessing Native Features
- File dialogs: `window.electronAPI.dialog.openFile()`
- Notifications: `window.electronAPI.notification.show()`
- Clipboard: `window.electronAPI.clipboard.writeText()`
- External links: `window.electronAPI.shell.openExternal(url
1. Create page component in `src/pages/YourPage.tsx`
2. Import and add `<Route>` in `src/App.tsx`
3. Add sidebar link with Heroicon in `SidebarLink` section

### Adding Gemini AI Feature
1. Add function to `src/services/geminiService.ts`
2. Use `GoogleGenAI` with system instruction for context
3. Call with `await ai.models.generateContent({ model: 'gemini-3-flash-preview', ... })`

### Accessing Native Features
- File dialogs: `window.electronAPI.dialog.openFile()`
- Notifications: `window.electronAPI.notification.show()`
- Clipboard: `window.electronAPI.clipboard.writeText()`

See full API surface in `electron/preload.ts` context bridge.

- **Assistant naming**: Configurable in Settings, default "Atlas", stored in `STORAGE_KEYS.ASSISTANT_NAME`
- **Chat responses**: LangChain returns `{ text: string }` - always extract `.text` property
- **External links**: All links in chat markdown open externally via shell API
- **Floating chat**: Available on all pages except `/chat` for quick AI access

## Debugging Tips

- Check preload console logs: `🔵 PRELOAD:` prefix
- Window state: Inspect `store.get('windowState')` in main DevTools
- IPC failures: Verify channel names match exactly between preload and main
- Build errors: Check `dist-electron/` for compiled output, ensure externals are excluded in Vite config
- Chat debugging: Check LangChain response structure, ensure `.text` extraction
- Database errors: Verify SQL parameter count matches placeholders, check for DEFAULT columns
- Package errors: Ensure all production dependencies are in `dependencies` not `devDependencies`

##  Debugging Tips

- Check preload console logs: `🔵 PRELOAD:` prefix
- Window state: Inspect `store.get('windowState')` in main DevTools
- IPC failures: Verify channel names match exactly between preload and main
- Build errors: Check `dist-electron/` for compiled output, ensure externals are excluded in Vite config

##must be kept up to date with codebase changes to remain accurate.