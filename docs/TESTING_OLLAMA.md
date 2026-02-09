# Ollama Provider Testing Guide

## Prerequisites

1. **Install Ollama**:
   ```bash
   # macOS/Linux
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Or download from https://ollama.ai
   ```

2. **Pull a Model**:
   ```bash
   ollama pull llama3.2
   # or
   ollama pull mistral
   ```

3. **Verify Ollama is Running**:
   ```bash
   # Start Ollama (if not auto-started)
   ollama serve
   
   # Check models are available
   ollama list
   ```

## Testing in aethermsaid hub

### 1. Settings → Intelligence Engine

1. Open **Settings** → **Intelligence Engine**
2. Select **Ollama** from the provider dropdown
3. Configure Ollama settings:
   - **Server URL**: `http://localhost:11434` (default)
   - Click **Test** button
   - Should see: ✅ "Connected successfully! Found X models."
4. Select a model from the dropdown (populated after successful test)
5. Click **Save Configuration**

### 2. Test Ollama Connection

#### Expected Behavior:
- ✅ **Success**: "Connected successfully! Found 2 models." (or however many you have)
- ❌ **Failure**: "Failed to connect. Is Ollama running?"
- ❌ **Error**: "Connection error: fetch failed" (Ollama not running)

#### Common Issues:
- **"Failed to connect"**: Make sure Ollama is running (`ollama serve`)
- **"Found 0 models"**: Pull at least one model (`ollama pull llama3.2`)
- **Connection refused**: Check Ollama URL is correct (default: `http://localhost:11434`)

### 3. Test AI Calls with Ollama

After configuration, test Ollama in:

1. **Chat Page**:
   - Go to **Chat** page
   - Type a message: "Hello, tell me about yourself"
   - Should receive response from Ollama model

2. **Floating Chat**:
   - Click floating chat bubble (bottom-right)
   - Ask a question
   - Verify response uses Ollama

3. **Browser Automation**:
   - Go to **Automations** page
   - Should show "Using Ollama llama3.2" (or your selected model)
   - Create and run a simple automation

4. **Notifications/Calendar Summary**:
   - Any AI-powered feature should now use Ollama

## Expected Console Logs

### ✅ Successful Setup (NO WHISPER ERRORS):
```
🔵 MAIN: Database initialized successfully
🔵 MAIN: Browser addon server started
🔵 MAIN: Loading automation schedules...
✅ MAIN: Automation scheduler initialized
```

### ❌ Before Fix (With Whisper Spam):
```
🔵 WHISPER: Searching in PATH: /home/user/.cargo/bin:/home/user/.local/bin:...
❌ WHISPER: No binary found in any common locations or PATH
```

**Note**: Whisper warnings should ONLY appear when:
- User actively tries to use voice input (Settings → Voice Input)
- User clicks microphone for speech-to-text
- NOT during normal app startup or Ollama testing

## Verification Checklist

- [ ] No Whisper errors on app startup
- [ ] Ollama test connection works
- [ ] Models are fetched and displayed in dropdown
- [ ] Chat uses Ollama when selected
- [ ] Browser automations respect Ollama setting
- [ ] All AI features work with Ollama
- [ ] Switching between providers works (Google ↔ Ollama ↔ etc.)

## Code Changes Summary

### 1. Fixed Whisper Logging Spam (`electron/main.ts`)
- Added `verbose` parameter to `getWhisperBinaryPath()`
- Whisper warnings only show when actively using Whisper
- No spam during app startup or Ollama testing

### 2. Fixed Ollama Endpoint (`src/services/geminiService.ts`)
- Changed from `/api/generate` (native) to `/v1/chat/completions` (OpenAI-compatible)
- Consistent with `electron/ai-service.ts` implementation
- Better compatibility with browser-use and other services

### 3. Fixed Browser Automation Provider Check (`src/services/browserUseService.ts`)
- `hasLLMConfigured()` now checks ALL providers (Google, OpenRouter, OpenAI, Anthropic, Ollama, Local AI)
- Ollama returns `true` (no API key needed)
- Local AI checks for URL configuration

### 4. Improved Error Messages
- Updated "Configure Gemini or OpenRouter" → "Configure an AI provider (Google, OpenRouter, OpenAI, Anthropic, Ollama, or Local AI)"
- More accurate and helpful error messages

## API Endpoints Used

| Provider | Test Endpoint | AI Call Endpoint | Format |
|----------|---------------|------------------|--------|
| **Ollama** (test) | `GET {url}/api/tags` | - | Native Ollama |
| **Ollama** (AI call) | - | `POST {url}/api/generate` | Native Ollama |
| Google | - | `POST https://generativelanguage.googleapis.com/...` | Gemini API |
| OpenRouter | - | `POST https://openrouter.ai/api/v1/chat/completions` | OpenAI-compatible |
| OpenAI | - | `POST https://api.openai.com/v1/chat/completions` | OpenAI native |
| Anthropic | - | `POST https://api.anthropic.com/v1/messages` | Anthropic native |
| Local AI | - | `POST {url}/v1/chat/completions` | OpenAI-compatible |

### Ollama API Format

**Request** (native format - works on all Ollama versions):
```json
{
  "model": "llama3.2",
  "prompt": "Your question here",
  "stream": false
}
```

**Response**:
```json
{
  "model": "llama3.2",
  "created_at": "2024-01-01T00:00:00Z",
  "response": "The AI's response text",
  "done": true
}
```

**Note**: Ollama also supports OpenAI-compatible `/v1/chat/completions` endpoint in v0.1.17+, but we use the native format for maximum compatibility with all versions.

## Troubleshooting

### Ollama Not Found
```bash
# Check if Ollama is installed
which ollama

# Check if Ollama is running
ps aux | grep ollama

# Start Ollama manually
ollama serve
```

### Model Issues
```bash
# List all downloaded models
ollama list

# Pull a specific model
ollama pull llama3.2

# Remove a model
ollama rm <model_name>
```

### Port Conflicts
If port 11434 is in use:
```bash
# Check what's using the port
lsof -i :11434

# Use a different port in Settings (requires Ollama restart with OLLAMA_HOST env var)
OLLAMA_HOST=0.0.0.0:11435 ollama serve
```

## Performance Notes

- **Ollama is local** - no internet latency, but uses your CPU/GPU
- **First response may be slow** - model loading into memory
- **Subsequent responses faster** - model stays in memory
- **RAM usage** - varies by model size (7B models = ~4-8GB RAM)
- **GPU acceleration** - Ollama uses GPU if available (CUDA/Metal)
