# Multi-Provider AI Implementation

## Overview
aethermsaid hub now supports **6 AI providers** including local options:
- ✅ **Google Gemini** (original)
- ✅ **OpenRouter** (original)
- ✅ **OpenAI** (NEW)
- ✅ **Anthropic Claude** (NEW)
- ✅ **Ollama** (NEW - Local AI)
- ✅ **Local AI** (NEW - Custom OpenAI-compatible endpoints)

## Implementation Summary

### Files Modified
1. **src/services/electronStore.ts**
   - Added storage keys for OpenAI, Anthropic, Ollama, and Local AI
   - Keys: API keys, models, URLs for each provider

2. **src/services/geminiService.ts**
   - Extended `AIProvider` type to include 6 providers
   - Added model constants for OpenAI and Anthropic
   - Implemented provider-specific API call functions:
     - `callOpenAI()` - OpenAI API integration
     - `callAnthropic()` - Anthropic Claude API integration
     - `callOllama()` - Local Ollama integration
     - `callLocalAI()` - Generic OpenAI-compatible endpoints
   - Added `fetchOllamaModels()` - Query local Ollama for available models
   - Added `testOllamaConnection()` - Test local Ollama connectivity
   - Updated `getApiKey()`, `getModel()`, and `callAI()` with switch statements

3. **src/services/langchainService.ts**
   - Refactored `initializeChat()` to support all 6 providers
   - Each provider uses appropriate LangChain chat model
   - Ollama and Local AI use ChatOpenAI with custom baseURL

4. **src/pages/Settings.tsx**
   - Redesigned `AIProviderSelector` with 3-column grid showing all providers
   - Added conditional rendering for provider-specific configurations
   - Updated LangChain Chat Agent description to reflect current provider
   - Updated imports to include new model constants and functions

5. **src/components/AIProviderConfigs.tsx** (NEW)
   - `OpenAIConfigSection` - API key, model selection
   - `AnthropicConfigSection` - API key, model selection
   - `OllamaConfigSection` - URL, connection test, model auto-discovery
   - `LocalAIConfigSection` - URL, optional API key, model name

## Provider Features

### OpenAI
- **Models**: GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo, o1 Preview, o1 Mini
- **API**: https://api.openai.com/v1/chat/completions
- **Config**: API key required
- **Get Key**: https://platform.openai.com/api-keys

### Anthropic Claude
- **Models**: Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus, Claude 3 Sonnet/Haiku
- **API**: https://api.anthropic.com/v1/messages
- **Config**: API key required (uses `x-api-key` header)
- **Get Key**: https://console.anthropic.com/

### Ollama (Local)
- **Models**: Auto-detected from local installation (Llama, Mistral, etc.)
- **API**: http://localhost:11434/api/generate
- **Config**: URL (default: localhost:11434), no API key
- **Install**: https://ollama.ai
- **Features**: 
  - Connection test button
  - Auto-discovery of pulled models
  - Shows model size and last modified date

### Local AI (Custom)
- **Compatible with**: LM Studio, vLLM, text-generation-webui, LocalAI, etc.
- **API**: Custom URL + /v1/chat/completions
- **Config**: URL, optional API key, model name
- **Format**: OpenAI-compatible API

## Usage

### For Users
1. Go to Settings > Intelligence Engine
2. Select your preferred AI provider from the grid
3. Configure provider-specific settings (API key, model, etc.)
4. For Ollama: Click "Test" to verify connection and discover models
5. All AI features (Chat, Summaries, Intelligence Feed) will use the selected provider

### For Developers
```typescript
// Unified AI call - automatically routes to selected provider
import { callAI } from '../services/geminiService';

const response = await callAI('Summarize my emails', 'You are a helpful assistant');

// Get current provider
import { getAIProvider } from '../services/geminiService';
const provider = await getAIProvider(); // 'google' | 'openrouter' | 'openai' | 'anthropic' | 'ollama' | 'local'

// Test Ollama connection
import { testOllamaConnection } from '../services/geminiService';
const result = await testOllamaConnection();
if (result.success) {
  console.log(result.message); // "Connected successfully! Found 3 models."
}
```

## Temporal Context
All providers receive temporal context (current date/time, day of week) automatically appended to system instructions for time-aware responses.

## LangChain Integration
The LangChain chat agent supports all providers:
- Google Gemini: Uses `ChatGoogleGenerativeAI`
- OpenAI: Uses `ChatOpenAI` with default configuration
- OpenRouter: Uses `ChatOpenAI` with OpenRouter baseURL
- Anthropic: Uses `ChatOpenAI` with Anthropic baseURL and headers
- Ollama: Uses `ChatOpenAI` with Ollama baseURL (/v1)
- Local AI: Uses `ChatOpenAI` with custom baseURL

## Testing

### Ollama Setup
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.2

# Start Ollama (if not running)
ollama serve
```

### Local AI Setup (LM Studio Example)
1. Download LM Studio from https://lmstudio.ai
2. Load a model
3. Start local server (usually http://localhost:1234)
4. In aethermsaid hub Settings:
   - Select "Local AI"
   - Set URL to http://localhost:1234
   - Set model name (check LM Studio)

## Known Issues
- Accessibility warnings on select elements (cosmetic, does not affect functionality)
- Some local models may not support tool calling (function calling) used by LangChain agent

## Future Enhancements
- Add Hugging Face Inference API support
- Add Together AI support
- Automatic model capability detection
- Provider-specific feature toggles
- Cost tracking per provider
