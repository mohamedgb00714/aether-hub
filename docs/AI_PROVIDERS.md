# AI Provider Configuration Guide

aethermsaid hub supports **6 AI providers** for flexible, multi-model AI capabilities across the application.

## Supported Providers

### 1. **Google Gemini** (Default)
- **Models**: Gemini 3.0 Pro/Flash, 2.5 Pro/Flash/Lite, 2.0 Flash/Lite, 1.5 Flash/Pro
- **Default Model**: `gemini-2.5-flash`
- **Requirements**: 
  - API Key (get from [Google AI Studio](https://makersuite.google.com/app/apikey))
- **Storage Keys**:
  - `gemini_api_key` - Your Gemini API key
  - `gemini_model` - Selected model

### 2. **OpenRouter**
- **Models**: 100+ models from OpenAI, Anthropic, Meta, Google, etc.
- **Default Model**: `anthropic/claude-3.5-sonnet`
- **Features**:
  - Free model rotation mode (automatically switches between free models)
  - Pay-per-use pricing for premium models
- **Requirements**:
  - API Key (get from [OpenRouter](https://openrouter.ai/))
- **Storage Keys**:
  - `openrouter_api_key` - Your OpenRouter API key
  - `openrouter_model` - Selected model
  - `openrouter_free_mode` - Enable free model rotation

### 3. **OpenAI**
- **Models**: GPT-4o, GPT-4o Mini, GPT-4 Turbo, o1, etc.
- **Default Model**: `gpt-4o-mini`
- **Requirements**:
  - API Key (get from [OpenAI Platform](https://platform.openai.com/))
- **Storage Keys**:
  - `openai_api_key` - Your OpenAI API key
  - `openai_model` - Selected model

### 4. **Anthropic**
- **Models**: Claude 3.5 Sonnet/Haiku, Claude 3 Opus/Sonnet/Haiku
- **Default Model**: `claude-3-5-sonnet-20241022`
- **Requirements**:
  - API Key (get from [Anthropic Console](https://console.anthropic.com/))
- **Storage Keys**:
  - `anthropic_api_key` - Your Anthropic API key
  - `anthropic_model` - Selected model

### 5. **Ollama** (Local, Privacy-First)
- **Models**: Llama 3.2, Mistral, Gemma, and 100+ open-source models
- **Default Model**: `llama3.2`
- **Default URL**: `http://localhost:11434`
- **Features**:
  - **100% Local** - No data leaves your machine
  - **No API Key Required** - Free and private
  - **Offline Capable** - Works without internet
- **Requirements**:
  - Ollama installed locally ([Download](https://ollama.ai/))
  - At least one model pulled (e.g., `ollama pull llama3.2`)
- **Storage Keys**:
  - `ollama_url` - Ollama server URL
  - `ollama_model` - Selected model
- **Setup**:
  ```bash
  # Install Ollama
  curl -fsSL https://ollama.ai/install.sh | sh
  
  # Pull a model
  ollama pull llama3.2
  
  # Verify running
  ollama list
  ```

### 6. **Local AI / Custom OpenAI-Compatible Endpoints**
- **Models**: Any model supported by your custom endpoint
- **Default Model**: `default`
- **Features**:
  - Works with any OpenAI-compatible API
  - Supports LocalAI, LM Studio, vLLM, text-generation-webui, etc.
- **Requirements**:
  - Custom endpoint URL
  - API key (optional, depends on your setup)
- **Storage Keys**:
  - `local_ai_url` - Your endpoint URL (e.g., `http://localhost:8080`)
  - `local_ai_key` - API key (optional)
  - `local_ai_model` - Model name

## Architecture Overview

### Main Process (`electron/`)
- **File**: `electron/ai-service.ts`
- **Usage**: Background tasks, automations, WhatsApp/Telegram auto-replies
- **Functions**:
  - `callAI(request, provider?)` - Unified AI call
  - `generateChatResponse(prompt, systemInstruction?)` - Chat responses
  - `analyzeAutomationResult(result, task)` - Automation analysis

### Renderer Process (`src/services/`)
- **File**: `src/services/geminiService.ts`
- **Usage**: UI interactions, chat, summaries, analysis
- **Functions**:
  - `callAI(prompt, systemInstruction?)` - Unified AI call
  - `summarizeNotifications(notifications)` - Notification summaries
  - `summarizeCalendar(events)` - Calendar summaries
  - `getEventBriefing(event)` - Meeting briefs

### LangChain Service (`src/services/langchainService.ts`)
- **Usage**: Advanced chat with database tools, RAG capabilities
- **Functions**:
  - `getChatResponse(message, sessionId)` - Full AI chat with context

## API Endpoint Formats

All providers are properly implemented with their native/preferred APIs:

### Google Gemini
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`
- **Format**: Native Gemini API
- **Request**: `{ contents: [...], generationConfig: {...} }`

### OpenRouter, OpenAI
- **Endpoint**: Provider-specific
- **Format**: OpenAI Chat Completions
- **Request**: `{ model, messages: [...], temperature, max_tokens }`
- **Authentication**: Bearer token in header

### Anthropic
- **Endpoint**: `https://api.anthropic.com/v1/messages`
- **Format**: Native Anthropic API
- **Request**: `{ model, messages: [...], system, max_tokens }`
- **Authentication**: `x-api-key` header

### Ollama
- **Endpoint**: `{ollamaUrl}/api/generate`
- **Format**: Native Ollama API (maximum compatibility)
- **Request**: `{ model, prompt, stream: false }`
- **Response**: `{ response: "..." }`
- **Authentication**: None required
- **Note**: Works on all Ollama versions. The `/v1/chat/completions` OpenAI-compatible endpoint only exists in v0.1.17+

### Local AI
- **Endpoint**: `{localUrl}/v1/chat/completions`
- **Format**: OpenAI Chat Completions (compatible)
- **Request**: `{ model, messages: [...], temperature, max_tokens }`
- **Authentication**: Bearer token (if configured)

## Configuration in UI

Navigate to **Settings → Intelligence Engine** to configure:

1. Select your AI provider from the dropdown
2. Configure provider-specific settings:
   - **API Keys** (for cloud providers)
   - **Model selection**
   - **Provider-specific options** (e.g., Ollama URL)
3. Click **Save Configuration**
4. Test your connection using **Test Connection** button (where available)

## Provider Selection Priority

The app uses the `ai_provider` setting from electron-store:

```typescript
// Get current provider
const provider = await storage.get(STORAGE_KEYS.AI_PROVIDER);
// Default: 'google' if not set
```

## Common Issues

### Ollama Connection Failed
- Ensure Ollama is running: `ollama serve`
- Check models are pulled: `ollama list`
- Verify URL is correct (default: `http://localhost:11434`)

### API Key Not Working
- Verify key is correctly copied (no extra spaces)
- Check key has sufficient credits/quota
- Ensure key has required permissions

### Model Not Found
- Verify model name is exact (case-sensitive)
- For Ollama: Pull the model first (`ollama pull <model>`)
- Check model is available for your provider tier

## Privacy & Security

- **All API keys are encrypted** using electron-store encryption
- **Ollama runs 100% locally** - zero cloud dependency
- **Local AI** option for complete data control
- **No telemetry** - your AI interactions stay private
