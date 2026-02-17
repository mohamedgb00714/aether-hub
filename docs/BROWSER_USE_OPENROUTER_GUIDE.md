# Using browser-use with OpenRouter

## Overview

aethermsaid hub uses [browser-use](https://github.com/browser-use/browser-use), a Python library that enables AI-powered browser automation. This guide explains how to configure and use browser-use with OpenRouter as your AI provider.

## Why OpenRouter?

OpenRouter provides access to 100+ AI models from various providers (OpenAI, Anthropic, Meta, Google, etc.) through a single API. Key benefits:

- **Multiple Models**: Access Claude, GPT-4, Llama, and more
- **Cost-Effective**: Pay-per-use pricing or free model rotation
- **Unified API**: Single endpoint for all models
- **No Lock-In**: Switch between models easily

## Prerequisites

### 1. Python Environment

Browser automation requires Python 3.8+ and the `uv` package manager:

```bash
# Check Python installation
python3 --version

# Install uv (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 2. browser-use Package

The app will help you install browser-use automatically, but you can also install manually:

```bash
# Using uv (recommended)
uv pip install browser-use playwright

# Using pip
pip install browser-use playwright

# Install browser binaries
playwright install chromium
```

### 3. OpenRouter API Key

1. Sign up at [openrouter.ai](https://openrouter.ai/)
2. Navigate to [Keys](https://openrouter.ai/keys)
3. Create a new API key
4. Copy your key (starts with `sk-or-v1-...`)

## Configuration

### Step 1: Configure OpenRouter in aethermsaid hub

1. Open **Settings** (⚙️ icon in sidebar)
2. Navigate to **Intelligence Engine** section
3. Select **OpenRouter** from provider dropdown
4. Paste your API key in the **OpenRouter API Key** field
5. Select your preferred model (recommended: `anthropic/claude-3.5-sonnet` for best results)
6. Click **Save Configuration**

### Step 2: Verify Installation

1. Navigate to **Automations** page
2. Check installation status panel:
   - ✅ **Python**: Should show installed with version
   - ✅ **uv**: Should show installed with version
   - ✅ **browser-use**: Should show installed with version

If browser-use is not installed, click the **Install** button next to it.

### Step 3: Test with a Simple Automation

1. Click **New Automation** button
2. Fill in the form:
   - **Name**: `Test OpenRouter Automation`
   - **Description**: `Simple browser test`
   - **Task**: `Go to example.com and tell me what you see`
   - **Chrome Profile**: Select your preferred profile
3. Click **Create Automation**
4. Click the **▶️ Play** button to run the automation

## How It Works

### Architecture

```
aethermsaid hub (Electron)
    ↓
IPC Bridge (preload.ts)
    ↓
Main Process (main.ts)
    ↓
Python Script (automation-scheduler.ts)
    ↓
browser-use Library
    ↓
OpenRouter API (claude-3.5-sonnet)
    ↓
Chrome Browser (Playwright)
```

### Code Flow

1. **Frontend** (`src/pages/Automations.tsx`):
   - User creates automation with task description
   - Calls `browserAutomationService.runTask()`

2. **Service Layer** (`src/services/browserUseService.ts`):
   - Retrieves AI provider config from storage
   - Prepares LLM configuration for browser-use

3. **Main Process** (`electron/main.ts`):
   - Receives IPC request via `browseruse:execute`
   - Generates Python script with embedded config
   - Executes Python script with browser-use

4. **Python Execution** (dynamic script):
   - Imports browser-use modules
   - Configures LLM with OpenRouter credentials
   - Creates agent with task description
   - Runs browser automation
   - Returns results to Electron

### OpenRouter Configuration

The app automatically configures browser-use with OpenRouter using the following Python code:

```python
from langchain_openai import ChatOpenAI
from browser_use import Agent
import asyncio

# Configure OpenRouter LLM
llm = ChatOpenAI(
    model="anthropic/claude-3.5-sonnet",  # Your selected model
    api_key="sk-or-v1-...",               # Your API key
    base_url="https://openrouter.ai/api/v1",
    temperature=0.7
)

# Create browser agent
agent = Agent(
    task="Your task description here",
    llm=llm,
    browser=browser,
    controller=controller
)

# Run automation
result = await agent.run()
```

## Recommended Models for Browser Automation

Browser automation requires models with good reasoning and planning capabilities. Here are recommended models on OpenRouter:

### Best Performance (Premium)
- **`anthropic/claude-3.5-sonnet`** - Best overall for complex tasks
- **`openai/gpt-4o`** - Excellent reasoning and consistency
- **`google/gemini-2.0-flash-thinking-exp`** - Fast with built-in reasoning

### Budget-Friendly
- **`anthropic/claude-3.5-haiku`** - Fast and cost-effective
- **`openai/gpt-4o-mini`** - Good balance of cost/performance
- **`x-ai/grok-2-1212`** - Competitive pricing

### Free Models (Free Mode)
- **`meta-llama/llama-3.2-11b-vision-instruct:free`**
- **`mistralai/mistral-7b-instruct:free`**
- **`google/gemini-flash-1.5:free`** (limited quota)

> **Note**: Free models may have rate limits and lower reliability. Premium models are recommended for production use.

## Advanced Features

### Chrome Profile Management

Browser automations can use your existing Chrome profiles to access logged-in accounts:

```typescript
// Select profile when creating automation
const config = {
  task: "Check my Gmail inbox",
  llm: { provider: 'openrouter', ... },
  chrome_profile: "Profile 1",  // Your work profile
  chrome_profile_path: "/home/user/.config/google-chrome/Profile 1"
};
```

This allows automations to:
- Access authenticated web apps
- Use saved passwords and cookies
- Maintain separate contexts (work, personal, etc.)

### Headless Mode

Run automations invisibly in the background:

```typescript
const automation = {
  name: "Background Email Check",
  task: "Check my email for urgent messages",
  headless: true,  // No visible browser window
  run_on_startup: true,
  cron_schedule: "*/30 * * * *"  // Every 30 minutes
};
```

### Scheduled Automations (Cron)

Run automations on a schedule using cron expressions:

```typescript
// Examples
"0 9 * * *"      // Every day at 9:00 AM
"*/15 * * * *"   // Every 15 minutes
"0 */2 * * *"    // Every 2 hours
"0 0 * * 1"      // Every Monday at midnight
"30 14 * * 1-5"  // 2:30 PM on weekdays
```

Format: `minute hour day month weekday`

### AI Analysis of Results

After automation completes, you can get AI-powered analysis:

1. Expand the automation card in the UI
2. Click **View History**
3. Find the completed run
4. Click **AI Analysis** button
5. Get insights about the automation result

## Example Use Cases

### 1. Check Apify Earnings
```typescript
{
  name: "Daily Earnings Check",
  task: "Go to my Apify console and tell me my earnings for the past 7 days",
  profile_id: "Work Profile",
  cron_schedule: "0 9 * * *"  // 9 AM daily
}
```

### 2. Monitor Website Changes
```typescript
{
  name: "Price Monitor",
  task: "Go to example.com/product and check the current price. Tell me if it changed.",
  headless: true,
  cron_schedule: "0 */6 * * *"  // Every 6 hours
}
```

### 3. Form Automation
```typescript
{
  name: "Submit Daily Report",
  task: "Go to internal.company.com, log in, navigate to Reports, fill in today's metrics, and submit",
  profile_id: "Work Profile",
  cron_schedule: "0 17 * * 1-5"  // 5 PM on weekdays
}
```

### 4. Data Extraction
```typescript
{
  name: "Extract Product Data",
  task: "Go to example.com/products and extract the name, price, and rating of the top 10 products",
  headless: true
}
```

## Troubleshooting

### "OpenRouter API key not configured"

**Solution**: 
1. Go to Settings → Intelligence Engine
2. Select OpenRouter from dropdown
3. Enter your API key
4. Click Save Configuration

### "browser-use not installed"

**Solution**:
1. Ensure Python 3.8+ is installed
2. Install uv: `curl -LsSf https://astral.sh/uv/install.sh | sh`
3. Click Install button in Automations page
4. Or manually install: `uv pip install browser-use playwright`

### "Chrome not found"

**Solution**:
- **Linux**: Install Chrome/Chromium via package manager
  ```bash
  # Ubuntu/Debian
  sudo apt install google-chrome-stable
  # or
  sudo apt install chromium-browser
  ```
- **macOS**: Download from [google.com/chrome](https://www.google.com/chrome/)
- **Windows**: Download from [google.com/chrome](https://www.google.com/chrome/)

### Automation Fails Immediately

**Possible causes**:
1. **API Key Invalid**: Verify key in Settings
2. **Model Not Available**: Try a different model
3. **Rate Limited**: Wait and try again, or upgrade plan
4. **Task Too Vague**: Be more specific in task description

### Automation Hangs/Timeout

**Solutions**:
- Break complex tasks into smaller ones
- Use more powerful models (Claude 3.5 Sonnet)
- Increase timeout in automation settings
- Check if website has bot protection

## API Reference

### browserAutomationService

```typescript
import { browserAutomationService } from '../services/browserUseService';

// Run a browser automation task
const result = await browserAutomationService.runTask(
  taskDescription: string,
  profileId: string,
  options?: {
    onStep?: (step: string) => void;
  }
);

// Check if LLM is configured
const hasLLM = await browserAutomationService.hasLLMConfigured();

// Get provider name
const provider = await browserAutomationService.getProviderName();
// Returns: "OpenRouter anthropic/claude-3.5-sonnet"
```

### Storage Keys

```typescript
import storage, { STORAGE_KEYS } from './services/electronStore';

// OpenRouter configuration
await storage.set(STORAGE_KEYS.OPENROUTER_API_KEY, 'sk-or-v1-...');
await storage.set(STORAGE_KEYS.OPENROUTER_MODEL, 'anthropic/claude-3.5-sonnet');
await storage.set(STORAGE_KEYS.AI_PROVIDER, 'openrouter');

// Retrieve configuration
const apiKey = await storage.get(STORAGE_KEYS.OPENROUTER_API_KEY);
const model = await storage.get(STORAGE_KEYS.OPENROUTER_MODEL);
const provider = await storage.get(STORAGE_KEYS.AI_PROVIDER);
```

### IPC API

```typescript
// Execute browser automation
const result = await window.electronAPI.browseruse.execute({
  task: "Go to example.com and extract the title",
  llm: {
    provider: 'openrouter',
    api_key: 'sk-or-v1-...',
    model: 'anthropic/claude-3.5-sonnet'
  },
  chrome_profile: "Default",
  chrome_profile_path: "/home/user/.config/google-chrome/Default"
});

// Check browser-use installation
const status = await window.electronAPI.browseruse.checkInstalled();
// Returns: { installed: boolean, version: string | null }

// Install browser-use
const result = await window.electronAPI.browseruse.install();
// Returns: { success: boolean, error?: string }

// Listen to installation progress
const removeListener = window.electronAPI.browseruse.onInstallProgress((msg) => {
  console.log(msg);
});
```

## Security Considerations

### API Key Storage

- API keys are encrypted using electron-store with encryption
- Keys never leave your machine except when calling OpenRouter API
- Stored in OS-specific secure locations:
  - **Linux**: `~/.config/aethermsaid hub/config.json` (encrypted)
  - **macOS**: `~/Library/Application Support/aethermsaid hub/config.json` (encrypted)
  - **Windows**: `%APPDATA%\aethermsaid hub\config.json` (encrypted)

### Chrome Profile Access

- Automations can access your logged-in accounts
- Only run trusted automations with sensitive profiles
- Create a separate Chrome profile for automation testing
- Review automation tasks before enabling auto-run

### Network Security

- All API calls use HTTPS
- OpenRouter API: `https://openrouter.ai/api/v1`
- No data is logged or sent to third parties
- Browser automation runs entirely on your machine

## Best Practices

### 1. Task Descriptions

**Good**:
- ✅ "Go to apify.com, log in, navigate to My Actors, and tell me the run count for my latest actor"
- ✅ "Search Google for 'aether hub github' and extract the first 5 results"
- ✅ "Go to example.com/products, filter by 'electronics', sort by price, and extract the top 10 items"

**Bad**:
- ❌ "Check my stuff" (too vague)
- ❌ "Do the thing" (no context)
- ❌ "Go to the website" (which website?)

### 2. Profile Management

- **Personal**: General browsing, testing
- **Work**: Work-related automations with company logins
- **Shopping**: E-commerce, price monitoring
- **Testing**: Experimental automations

### 3. Scheduling

- Avoid overly frequent schedules (respect rate limits)
- Schedule heavy tasks during off-hours
- Use headless mode for background tasks
- Monitor your OpenRouter credits

### 4. Error Handling

- Check execution history regularly
- Use AI Analysis to understand failures
- Adjust tasks based on error patterns
- Start with simple tasks before complex ones

## Further Resources

- [browser-use GitHub](https://github.com/browser-use/browser-use)
- [browser-use Documentation](https://docs.browser-use.com/)
- [OpenRouter Models](https://openrouter.ai/models)
- [OpenRouter Pricing](https://openrouter.ai/docs#pricing)
- [Cron Expression Guide](https://crontab.guru/)
- [aether hub AI Providers Guide](./AI_PROVIDERS.md)

## Support

If you encounter issues:

1. Check the [troubleshooting section](#troubleshooting)
2. Review execution history and AI analysis
3. Verify your OpenRouter credit balance
4. Try a different model
5. Open an issue on GitHub with:
   - Task description
   - Error message
   - Provider and model used
   - Execution history logs

---

**Happy Automating!** 🤖✨
