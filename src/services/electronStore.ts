/**
 * Electron Store Wrapper
 * Provides a clean interface for secure storage via Electron's IPC
 * Includes migration from localStorage for first-time users
 */

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

// Migration flag to track if we've migrated localStorage data
const MIGRATION_KEY = '__aether-hub_migration_complete__';

/**
 * Migrate existing localStorage data to electron-store
 * This runs once on first Electron app launch
 */
async function migrateFromLocalStorage(): Promise<void> {
  if (!isElectron) return;
  
  try {
    // Check if migration already completed
    const migrated = await window.electronAPI.store.get(MIGRATION_KEY);
    if (migrated) return;
    
    console.log('Starting localStorage migration to electron-store...');
    
    // Get all localStorage keys and values
    const keys = Object.keys(localStorage);
    let migratedCount = 0;
    
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        try {
          // Try to parse as JSON, fallback to string
          const parsedValue = JSON.parse(value);
          await window.electronAPI.store.set(key, parsedValue);
        } catch {
          // Store as string if not valid JSON
          await window.electronAPI.store.set(key, value);
        }
        migratedCount++;
      }
    }
    
    // Mark migration as complete
    await window.electronAPI.store.set(MIGRATION_KEY, true);
    
    console.log(`Migration complete: ${migratedCount} items transferred`);
    
    // Optionally clear localStorage after successful migration
    // Uncomment if you want to remove old data
    // localStorage.clear();
    
  } catch (error) {
    console.error('Error during localStorage migration:', error);
  }
}

/**
 * Get value from storage
 */
export async function getStorageItem<T = any>(key: string, defaultValue?: T): Promise<T | null> {
  if (isElectron) {
    try {
      const value = await window.electronAPI.store.get(key);
      return value !== undefined ? value : (defaultValue ?? null);
    } catch (error) {
      console.error(`Error getting storage item "${key}":`, error);
      return defaultValue ?? null;
    }
  } else {
    // Fallback to localStorage for web/dev
    const value = localStorage.getItem(key);
    if (value === null) return defaultValue ?? null;
    
    try {
      return JSON.parse(value);
    } catch {
      return value as T;
    }
  }
}

/**
 * Set value in storage
 */
export async function setStorageItem<T = any>(key: string, value: T): Promise<void> {
  if (isElectron) {
    try {
      await window.electronAPI.store.set(key, value);
    } catch (error) {
      console.error(`Error setting storage item "${key}":`, error);
    }
  } else {
    // Fallback to localStorage
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, stringValue);
  }
}

/**
 * Remove value from storage
 */
export async function removeStorageItem(key: string): Promise<void> {
  if (isElectron) {
    try {
      await window.electronAPI.store.delete(key);
    } catch (error) {
      console.error(`Error removing storage item "${key}":`, error);
    }
  } else {
    localStorage.removeItem(key);
  }
}

/**
 * Clear all storage
 */
export async function clearStorage(): Promise<void> {
  if (isElectron) {
    try {
      await window.electronAPI.store.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  } else {
    localStorage.clear();
  }
}

/**
 * Initialize storage (run migration if needed)
 * Call this once on app startup
 */
export async function initializeStorage(): Promise<void> {
  if (isElectron) {
    await migrateFromLocalStorage();
  }
}

// Storage keys constants for type safety
export const STORAGE_KEYS = {
  // Account credentials
  GOOGLE_CREDENTIALS: 'google_credentials',
  GOOGLE_TOKENS: 'google_tokens', // OAuth access/refresh tokens
  OUTLOOK_CREDENTIALS: 'outlook_credentials',
  FACEBOOK_CREDENTIALS: 'facebook_credentials',
  SLACK_CREDENTIALS: 'slack_credentials',
  GITHUB_CREDENTIALS: 'github_credentials',
  
  // AI Provider Settings
  AI_PROVIDER: 'ai_provider', // 'google' | 'openrouter' | 'openai' | 'anthropic' | 'ollama' | 'local'
  
  // Google Gemini API Keys
  GEMINI_API_KEY: 'gemini_api_key',
  GEMINI_MODEL: 'gemini_model',
  GOOGLE_SPEECH_API_KEY: 'google_speech_api_key',
  
  // OpenRouter API Keys
  OPENROUTER_API_KEY: 'openrouter_api_key',
  OPENROUTER_MODEL: 'openrouter_model',
  OPENROUTER_FREE_MODE: 'openrouter_free_mode', // Rotate between free models
  
  // OpenAI API Keys
  OPENAI_API_KEY: 'openai_api_key',
  OPENAI_MODEL: 'openai_model',
  
  // Anthropic API Keys
  ANTHROPIC_API_KEY: 'anthropic_api_key',
  ANTHROPIC_MODEL: 'anthropic_model',
  
  // Ollama Settings
  OLLAMA_URL: 'ollama_url', // Default: http://localhost:11434
  OLLAMA_MODEL: 'ollama_model',
  
  // Local/Custom AI Settings (OpenAI-compatible endpoints)
  LOCAL_AI_URL: 'local_ai_url',
  LOCAL_AI_KEY: 'local_ai_key', // Optional API key
  LOCAL_AI_MODEL: 'local_ai_model',
  
  // ElevenLabs TTS
  ELEVENLABS_API_KEY: 'elevenlabs_api_key',
  ELEVENLABS_VOICE_ID: 'elevenlabs_voice_id',
  ELEVENLABS_MODEL_ID: 'elevenlabs_model_id',
  ELEVENLABS_VOICE_SETTINGS: 'elevenlabs_voice_settings',
  ELEVENLABS_ENABLED: 'elevenlabs_enabled',
  
  // Other API Keys
  ANALYTICS_KEY: 'analytics_key',
  CLARITY_KEY: 'clarity_key',
  RESEND_KEY: 'resend_key',
  SMTP_CONFIG: 'smtp_config',
  DISCORD_CLIENT_ID: 'discord_client_id',
  DISCORD_CLIENT_SECRET: 'discord_client_secret',
  
  // Settings
  PRIVACY_SETTINGS: 'privacy_settings',
  AI_SETTINGS: 'ai_settings',
  NOTIFICATION_SETTINGS: 'notification_settings',
  ASSISTANT_NAME: 'assistant_name', // Customizable assistant name (default: Atlas)
  
  // App state
  CONNECTED_ACCOUNTS: 'connected_accounts',
  WINDOW_STATE: 'windowState',
  
  // Knowledge base
  KNOWLEDGE_FACTS: 'knowledge_facts',
  DISCOVERY_OBJECTIVES: 'discovery_objectives', // Custom discovery objectives for knowledge base
  
  // Intelligence Feed
  INTELLIGENCE_FEED_PARAMS: 'intelligence_feed_params', // Persistent feed generation parameters
  
  // Other
  MIGRATION_COMPLETE: MIGRATION_KEY,
  
  // Email filtering
  IGNORED_SENDERS: 'ignored_senders', // Array of sender email addresses to ignore

  // Floating Microphone / Speech-to-Text settings
  MIC_STT_PROVIDER: 'mic_stt_provider', // 'webSpeech' or 'whisper'
  MIC_ACTION_MODE: 'mic_action_mode', // 'dictation' or 'aiGenerate'
  MIC_HOTKEY_TOGGLE: 'mic_hotkey_toggle',
  MIC_HOTKEY_PUSH_TO_TALK: 'mic_hotkey_push_to_talk',
  MIC_HOTKEY_MODE_SWITCH: 'mic_hotkey_mode_switch',
  MIC_POSITION: 'mic_position', // { edge: 'left' | 'right', y: number }
  MIC_VAD_ENABLED: 'mic_vad_enabled',
  MIC_VAD_SILENCE_MS: 'mic_vad_silence_ms',
  MIC_LANGUAGE: 'mic_language',
  MIC_SCREENSHOTS_ENABLED: 'mic_screenshots_enabled', // Enable screenshot capture in AI modes
  
  // Browser Automation Settings
  MAX_CONCURRENT_AUTOMATIONS: 'max_concurrent_automations', // Number of automations that can run simultaneously

  // Sensitive/Unofficial (TOS risk) Integrations
  SENSITIVE_INTEGRATIONS: 'sensitive_integrations', // { whatsapp: boolean, telegram: boolean, discord: boolean }
} as const;

/**
 * Get the list of ignored email senders
 */
export async function getIgnoredSenders(): Promise<string[]> {
  const senders = await getStorageItem<string[]>(STORAGE_KEYS.IGNORED_SENDERS);
  return senders || [];
}

/**
 * Add a sender to the ignored list
 */
export async function addIgnoredSender(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const senders = await getIgnoredSenders();
  if (!senders.includes(normalizedEmail)) {
    senders.push(normalizedEmail);
    await setStorageItem(STORAGE_KEYS.IGNORED_SENDERS, senders);
  }
}

/**
 * Remove a sender from the ignored list
 */
export async function removeIgnoredSender(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const senders = await getIgnoredSenders();
  const filtered = senders.filter(s => s !== normalizedEmail);
  await setStorageItem(STORAGE_KEYS.IGNORED_SENDERS, filtered);
}

/**
 * Check if a sender is ignored
 */
export async function isSenderIgnored(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const senders = await getIgnoredSenders();
  return senders.includes(normalizedEmail);
}

/**
 * Clear all ignored senders
 */
export async function clearIgnoredSenders(): Promise<void> {
  await setStorageItem(STORAGE_KEYS.IGNORED_SENDERS, []);
}

export default {
  get: getStorageItem,
  set: setStorageItem,
  remove: removeStorageItem,
  clear: clearStorage,
  initialize: initializeStorage,
  KEYS: STORAGE_KEYS,
  // Ignored senders helpers
  ignoredSenders: {
    getAll: getIgnoredSenders,
    add: addIgnoredSender,
    remove: removeIgnoredSender,
    isIgnored: isSenderIgnored,
    clear: clearIgnoredSenders,
  },
};
