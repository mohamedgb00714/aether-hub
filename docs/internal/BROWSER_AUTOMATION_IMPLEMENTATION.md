# Browser Automation Implementation (browser-use Python)

## Overview
Implemented local browser automation using Python's `browser-use` library with AI-powered task generation from the app's configured LLM (Gemini/OpenRouter).

## Architecture

### Frontend (`src/pages/Automations.tsx`)
- Chrome profile selection grid with icons
- Python installation detection and status display
- browser-use package detection and installation UI
- Installation progress tracking with real-time updates
- AI-powered automation task management
- Expandable automation results with syntax highlighting

### Backend IPC Handlers (`electron/main.ts`)

#### Chrome Profile Detection
- **`chrome:getProfiles`**: Scans platform-specific Chrome config directories
  - Linux: `~/.config/google-chrome`
  - macOS: `~/Library/Application Support/Google/Chrome`
  - Windows: `%LOCALAPPDATA%\Google\Chrome\User Data`
- Reads `Preferences` JSON file to extract profile names
- Returns: `Array<{ name: string; path: string }>`

#### Python Environment
- **`python:checkInstalled`**: Checks for Python 3 installation
  - Tries `python3 --version` first
  - Falls back to `python --version`
  - Returns: `{ installed: boolean; version: string | null }`

#### browser-use Package Management
- **`browseruse:checkInstalled`**: Checks if browser-use is installed via pip
  - Runs `pip show browser-use`
  - Extracts version from pip output
  - Returns: `{ installed: boolean; version: string | null }`

- **`browseruse:install`**: Installs browser-use and Playwright
  - Step 1: `pip install browser-use playwright`
  - Step 2: `playwright install chromium`
  - Emits progress events via `browseruse:install-progress`
  - Returns: `{ success: boolean; error?: string }`

### Preload API (`electron/preload.ts`)
```typescript
chrome: {
  getProfiles: () => Promise<Array<{ name: string; path: string }>>;
  getExecutablePath: () => Promise<string | null>;
  isInstalled: () => Promise<boolean>;
},
python: {
  checkInstalled: () => Promise<{ installed: boolean; version: string | null }>;
},
browseruse: {
  checkInstalled: () => Promise<{ installed: boolean; version: string | null }>;
  install: () => Promise<{ success: boolean; error?: string }>;
  onInstallProgress: (callback: (message: string) => void) => () => void;
}
```

### TypeScript Types (`src/electron.d.ts`)
Added Chrome, Python, and browser-use APIs to `ElectronAPI` interface for full type safety.

## User Workflow

### 1. Initial Setup
1. User navigates to `/automations` page
2. App checks Python installation status
3. If Python not found:
   - Shows installation instructions with link to python.org
   - Displays platform-specific setup steps
   - "Check Again" button to re-detect after installation

### 2. browser-use Installation
1. Once Python detected, app checks for browser-use package
2. If not installed:
   - Shows "Install browser-use" button
   - Click triggers installation via pip
   - Real-time progress updates:
     - "Starting installation..."
     - "Installing browser-use and playwright..."
     - "Installing Chromium browser..."
     - "Installation successful!"
3. Version displayed after successful installation

### 3. Creating Automations
1. Select Chrome profile from grid (Default, Profile 1-7, Guest, etc.)
2. Enter task description (e.g., "Extract my income from Apify Console")
3. AI generates detailed step-by-step automation plan using configured LLM
4. **Note**: Currently generates instructions only - actual execution coming in future update

### 4. Viewing Results
- Expandable automation cards
- Syntax-highlighted JSON/code blocks
- Timestamp and profile information
- Step-by-step instructions from AI

## Installation Detection Flow

```
Page Load
    ↓
Check Python (python3 --version)
    ↓
├─ Not Found → Show Install Instructions
│               ↓
│            User Installs Python
│               ↓
│            Click "Check Again"
│
└─ Found → Check browser-use (pip show browser-use)
            ↓
         ├─ Not Found → Show "Install browser-use" Button
         │               ↓
         │            Click Install
         │               ↓
         │            pip install browser-use playwright
         │               ↓
         │            playwright install chromium
         │               ↓
         │            Show Progress Events
         │               ↓
         │            Update Version Display
         │
         └─ Found → Enable "New Automation" Button
```

## AI Integration

### Current Implementation
- Uses `src/services/browserUseService.ts`
- Calls `langchainService.getChatResponse()` with task prompt
- Generates structured automation plans
- Checks LLM configuration (Gemini API key or OpenRouter)

### LLM Provider Check
```typescript
hasLLMConfigured() {
  const geminiKey = storage.get('gemini_api_key');
  const provider = storage.get('ai_provider');
  const openRouterKey = storage.get('openrouter_api_key');
  
  return (geminiKey && provider === 'gemini') || 
         (openRouterKey && provider === 'openrouter');
}
```

## Dependencies

### Production
- `browser-use` (Python package, user-installed)
- `playwright` (Python package, user-installed)
- Chromium browser (installed via Playwright)

### Development
- `browser-use-sdk@2.0.14` (npm package for types/reference)

## File Structure

```
src/
  pages/Automations.tsx          - Main UI component
  services/browserUseService.ts  - AI automation service
  electron.d.ts                  - TypeScript API definitions
electron/
  main.ts                        - IPC handlers (Python, browser-use, Chrome)
  preload.ts                     - Context bridge API exposure
```

## Platform Support

### Chrome Profile Paths
- **Linux**: `~/.config/google-chrome/`
- **macOS**: `~/Library/Application Support/Google/Chrome/`
- **Windows**: `%LOCALAPPDATA%\Google\Chrome\User Data\`

### Python Detection
- Tries `python3` first (Linux/macOS standard)
- Falls back to `python` (Windows standard)
- Requires Python 3.8+ for browser-use

### Playwright Chromium
- Installed to user's Playwright cache directory
- Automatically managed by Playwright CLI
- System Chrome/Chromium also supported

## Future Enhancements

### Phase 2: Actual Execution
- [ ] Create Python script wrapper for browser-use execution
- [ ] Pass Chrome profile path to Python script
- [ ] Execute AI-generated tasks in real browser
- [ ] Stream execution progress back to UI
- [ ] Capture screenshots/results
- [ ] Error handling and retry logic

### Phase 3: Advanced Features
- [ ] Schedule automations (cron-like)
- [ ] Save automation templates
- [ ] Multi-step automation chains
- [ ] Conditional branching (if/else logic)
- [ ] Data extraction and storage
- [ ] Integration with other app features (Knowledge Base, etc.)

## Security Considerations

### Chrome Profile Access
- Only reads local Chrome profile metadata
- Does not access cookies, passwords, or session data
- User explicitly selects profile for automation

### Python Execution
- Uses subprocess isolation
- User-triggered installation only
- No automatic package updates
- pip packages from official PyPI registry

### AI Task Generation
- Uses user's configured LLM (local control)
- No cloud API required (optional browser-use-sdk not used)
- Tasks reviewed before execution (currently manual only)

## Testing

### Manual Test Checklist
- [x] Python detection (installed/not installed)
- [x] browser-use detection (installed/not installed)
- [x] browser-use installation via pip
- [x] Progress events during installation
- [x] Chrome profile detection (all platforms)
- [x] AI task generation with Gemini
- [ ] Actual automation execution (pending Phase 2)

### Test Cases
1. **No Python**: Shows install instructions, external link works
2. **Python but no browser-use**: Shows install button, installation succeeds
3. **Full setup**: "New Automation" button enabled, profile selection works
4. **AI generation**: Task description generates valid automation plan
5. **Chrome profiles**: Detects Default, Profile 1-N, Guest profiles

## Known Issues

1. **Chrome profile names**: Some profiles show generic "Profile N" instead of custom names
   - Root cause: Chrome stores custom names in different location
   - Workaround: Use profile path for unique identification

2. **Installation progress**: Events may arrive out of order on slow connections
   - Root cause: Asynchronous pip output buffering
   - Workaround: Final success/error message is always reliable

3. **Python version detection**: May fail if Python not in system PATH
   - Root cause: Relies on shell `which` command
   - Workaround: User must add Python to PATH during installation

## Debugging

### Check Installation Status
```typescript
// In browser console
const pythonStatus = await window.electronAPI.python.checkInstalled();
console.log('Python:', pythonStatus);

const browseruseStatus = await window.electronAPI.browseruse.checkInstalled();
console.log('browser-use:', browseruseStatus);

const profiles = await window.electronAPI.chrome.getProfiles();
console.log('Chrome Profiles:', profiles);
```

### Test Installation
```bash
# Manually test Python detection
python3 --version || python --version

# Manually test browser-use installation
pip show browser-use

# Manually test Chrome profile detection
ls ~/.config/google-chrome/  # Linux
ls ~/Library/Application\ Support/Google/Chrome/  # macOS
dir %LOCALAPPDATA%\Google\Chrome\User Data  # Windows
```

### IPC Debugging
- Main process logs: Check Electron console
- Renderer process logs: Check DevTools console
- Preload logs: Look for `🔵 PRELOAD:` prefix

## Related Documentation

- [QUICK_START.md](./QUICK_START.md) - General app setup
- [ELECTRON_README.md](./ELECTRON_README.md) - Electron architecture
- [DATABASE_API_REFERENCE.md](./DATABASE_API_REFERENCE.md) - Database schema

## References

- [browser-use Python Library](https://github.com/gregpr07/browser-use)
- [Playwright Documentation](https://playwright.dev/python/)
- [Chrome Profile Structure](https://chromium.googlesource.com/chromium/src/+/master/docs/user_data_dir.md)
