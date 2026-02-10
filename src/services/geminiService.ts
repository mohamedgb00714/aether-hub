
import { GoogleGenAI, Type } from "@google/genai";
import { Notification, CalendarEvent, Category } from "../types";
import storage, { STORAGE_KEYS } from "./electronStore";

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface NewsSummaryResponse {
  text: string;
  sources: GroundingSource[];
}

// AI Provider type
export type AIProvider = 'google' | 'openrouter' | 'openai' | 'anthropic' | 'ollama' | 'local';

// OpenRouter model interface
export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  isFree: boolean;
}

/**
 * Available Gemini models (as of January 2026)
 */
export const GEMINI_MODELS = [
  // Gemini 3 Series (Latest - 2026)
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview', description: 'Latest generation - most advanced reasoning and multimodal capabilities' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', description: 'Latest generation - fast performance with cutting-edge features' },
  
  // Gemini 2.5 Series (Current Stable)
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Current stable - balanced speed and intelligence for most tasks' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Lightweight - optimized for high-volume, cost-efficient tasks' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Premium - maximum intelligence for complex reasoning tasks' },
  
  // Gemini 2.0 Series (Previous Generation)
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Previous gen - reliable performance for general tasks' },
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: 'Previous gen - cost-efficient for simple tasks' },
  
  // Legacy Models (For backward compatibility)
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Legacy)', description: 'Legacy - may be deprecated soon, migrate to 2.5+ recommended' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Legacy)', description: 'Legacy - may be deprecated soon, migrate to 2.5+ recommended' },
] as const;

/**
 * Fallback OpenRouter models (used if API fetch fails)
 */
export const OPENROUTER_MODELS_FALLBACK = [
  // Claude Models
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Best balance of intelligence and speed', isFree: false },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', description: 'Fastest Claude model for simple tasks', isFree: false },
  
  // OpenAI Models
  { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'Latest OpenAI flagship model', isFree: false },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: 'Cost-effective for most tasks', isFree: false },
  
  // Free Models
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)', description: 'Powerful open-source model - FREE', isFree: true },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash Exp (Free)', description: 'Google experimental model - FREE', isFree: true },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)', description: 'DeepSeek reasoning model - FREE', isFree: true },
  { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B (Free)', description: 'Alibaba model - FREE', isFree: true },
  { id: 'mistralai/mistral-small-24b-instruct-2501:free', name: 'Mistral Small (Free)', description: 'Mistral small model - FREE', isFree: true },
];

/**
 * OpenAI models
 */
export const OPENAI_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable model, best for complex tasks' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Affordable and intelligent small model' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous generation flagship' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and cost-effective' },
  { id: 'o1-preview', name: 'o1 Preview', description: 'Advanced reasoning model' },
  { id: 'o1-mini', name: 'o1 Mini', description: 'Faster reasoning model' },
] as const;

/**
 * Anthropic Claude models
 */
export const ANTHROPIC_MODELS = [
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Best balance of intelligence, speed, and cost' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fastest and most compact model' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most powerful model for complex tasks' },
  { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', description: 'Balance of speed and capability' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fastest for simple tasks' },
] as const;

export const DEFAULT_MODEL = 'gemini-2.5-flash';
export const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-3.5-sonnet';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
export const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-sonnet-20241022';
export const DEFAULT_OLLAMA_MODEL = 'qwen2:0.5b';
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

/**
 * Get current date and time context for AI
 */
export function getTemporalContext(): string {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const time = now.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true
  });
  return `Current Date: ${date}. Current Time: ${time}.`;
}

// Cache for OpenRouter models
let cachedOpenRouterModels: OpenRouterModel[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

/**
 * Fetch available models from OpenRouter API
 */
export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  // Return cached models if still valid
  if (cachedOpenRouterModels && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedOpenRouterModels;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch OpenRouter models');
      return OPENROUTER_MODELS_FALLBACK;
    }

    const data = await response.json();
    
    const models: OpenRouterModel[] = data.data
      .filter((m: any) => m.id && m.name)
      .map((m: any) => {
        const promptPrice = parseFloat(m.pricing?.prompt || '0');
        const completionPrice = parseFloat(m.pricing?.completion || '0');
        const isFree = promptPrice === 0 && completionPrice === 0;
        
        return {
          id: m.id,
          name: m.name || m.id.split('/').pop(),
          description: m.description || `Context: ${m.context_length?.toLocaleString() || 'N/A'} tokens`,
          context_length: m.context_length || 0,
          pricing: {
            prompt: m.pricing?.prompt || '0',
            completion: m.pricing?.completion || '0'
          },
          isFree
        };
      })
      .sort((a: OpenRouterModel, b: OpenRouterModel) => {
        // Sort free models first, then by name
        if (a.isFree && !b.isFree) return -1;
        if (!a.isFree && b.isFree) return 1;
        return a.name.localeCompare(b.name);
      });

    cachedOpenRouterModels = models;
    cacheTimestamp = Date.now();
    
    console.log(`🔵 Fetched ${models.length} OpenRouter models (${models.filter(m => m.isFree).length} free)`);
    
    return models;
  } catch (error) {
    console.error('Error fetching OpenRouter models:', error);
    return OPENROUTER_MODELS_FALLBACK;
  }
}

/**
 * Fetch available models from local Ollama instance
 */
export async function fetchOllamaModels(): Promise<{ id: string; name: string; description: string }[]> {
  try {
    const ollamaUrl = await storage.get(STORAGE_KEYS.OLLAMA_URL) || DEFAULT_OLLAMA_URL;
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch Ollama models - is Ollama running?');
      return [];
    }

    const data = await response.json();
    
    if (!data.models || !Array.isArray(data.models)) {
      return [];
    }
    
    return data.models.map((m: any) => ({
      id: m.name,
      name: m.name,
      description: `Size: ${(m.size / 1024 / 1024 / 1024).toFixed(1)}GB, Modified: ${new Date(m.modified_at).toLocaleDateString()}`
    }));
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    return [];
  }
}

/**
 * Test Ollama connection
 */
export async function testOllamaConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const ollamaUrl = await storage.get(STORAGE_KEYS.OLLAMA_URL) || DEFAULT_OLLAMA_URL;
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      const data = await response.json();
      const modelCount = data.models?.length || 0;
      return { 
        success: true, 
        message: `Connected successfully! Found ${modelCount} models.` 
      };
    } else {
      return { 
        success: false, 
        message: 'Failed to connect. Is Ollama running?' 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Get only free OpenRouter models
 */
export async function getFreeOpenRouterModels(): Promise<OpenRouterModel[]> {
  const models = await fetchOpenRouterModels();
  return models.filter(m => m.isFree);
}

/**
 * Get a random free model for rotation
 */
export async function getRandomFreeModel(): Promise<string> {
  const freeModels = await getFreeOpenRouterModels();
  if (freeModels.length === 0) {
    return 'meta-llama/llama-3.3-70b-instruct:free';
  }
  const randomIndex = Math.floor(Math.random() * freeModels.length);
  return freeModels[randomIndex].id;
}

/**
 * Check if free model rotation is enabled
 */
export async function isFreeModeEnabled(): Promise<boolean> {
  const enabled = await storage.get(STORAGE_KEYS.OPENROUTER_FREE_MODE);
  return enabled === true;
}

/**
 * Get the current AI provider setting
 */
export async function getAIProvider(): Promise<AIProvider> {
  const provider = await storage.get(STORAGE_KEYS.AI_PROVIDER);
  // Default to 'google' if not set or invalid
  const validProviders: AIProvider[] = ['google', 'openrouter', 'openai', 'anthropic', 'ollama', 'local'];
  return validProviders.includes(provider as AIProvider) ? (provider as AIProvider) : 'google';
}

/**
 * Get API key based on current provider
 */
async function getApiKey(): Promise<string> {
  const provider = await getAIProvider();
  
  switch (provider) {
    case 'openrouter': {
      const key = await storage.get(STORAGE_KEYS.OPENROUTER_API_KEY);
      if (key && typeof key === 'string') return key;
      return (process.env.OPENROUTER_API_KEY as string) || '';
    }
    case 'openai': {
      const key = await storage.get(STORAGE_KEYS.OPENAI_API_KEY);
      if (key && typeof key === 'string') return key;
      return (process.env.OPENAI_API_KEY as string) || '';
    }
    case 'anthropic': {
      const key = await storage.get(STORAGE_KEYS.ANTHROPIC_API_KEY);
      if (key && typeof key === 'string') return key;
      return (process.env.ANTHROPIC_API_KEY as string) || '';
    }
    case 'local': {
      const key = await storage.get(STORAGE_KEYS.LOCAL_AI_KEY);
      if (key && typeof key === 'string') return key;
      return (process.env.LOCAL_AI_KEY as string) || '';
    }
    case 'ollama':
      return ''; // Ollama doesn't require API key
    default: {
      // Google Gemini
      const storedKey = await storage.get(STORAGE_KEYS.GEMINI_API_KEY);
      if (storedKey && typeof storedKey === 'string') {
        return storedKey;
      }
      return (process.env.GEMINI_API_KEY as string) || (process.env.API_KEY as string) || '';
    }
  }
}

/**
 * Get selected model based on current provider
 */
export async function getModel(): Promise<string> {
  const provider = await getAIProvider();
  
  switch (provider) {
    case 'openrouter': {
      const model = await storage.get(STORAGE_KEYS.OPENROUTER_MODEL);
      return (model && typeof model === 'string') ? model : DEFAULT_OPENROUTER_MODEL;
    }
    case 'openai': {
      const model = await storage.get(STORAGE_KEYS.OPENAI_MODEL);
      return (model && typeof model === 'string') ? model : DEFAULT_OPENAI_MODEL;
    }
    case 'anthropic': {
      const model = await storage.get(STORAGE_KEYS.ANTHROPIC_MODEL);
      return (model && typeof model === 'string') ? model : DEFAULT_ANTHROPIC_MODEL;
    }
    case 'ollama': {
      const model = await storage.get(STORAGE_KEYS.OLLAMA_MODEL);
      if (model && typeof model === 'string') {
        return model;
      }
      
      // No model set - try to auto-detect from available models
      try {
        const availableModels = await fetchOllamaModels();
        if (availableModels.length > 0) {
          const firstModel = availableModels[0].id;
          // Auto-detect and return the first available model, but do NOT
          // overwrite the user's explicit selection in storage. The
          // Settings UI is the single source of truth for persisting
          // user choices.
          console.log(`🔵 Auto-detected Ollama model: ${firstModel}`);
          return firstModel;
        }
      } catch (error) {
        console.warn('Failed to auto-detect Ollama model:', error);
      }
      
      return DEFAULT_OLLAMA_MODEL;
    }
    case 'local': {
      const model = await storage.get(STORAGE_KEYS.LOCAL_AI_MODEL);
      return (model && typeof model === 'string') ? model : 'default';
    }
    default: {
      const model = await storage.get(STORAGE_KEYS.GEMINI_MODEL);
      return (model && typeof model === 'string') ? model : DEFAULT_MODEL;
    }
  }
}

/**
 * Call OpenRouter API
 */
export async function callOpenRouter(prompt: string, systemInstruction?: string): Promise<string> {
  const apiKey = await storage.get(STORAGE_KEYS.OPENROUTER_API_KEY);
  const freeMode = await isFreeModeEnabled();
  
  let model: string;
  if (freeMode) {
    model = await getRandomFreeModel();
    console.log(`🔵 Free mode: Using ${model}`);
  } else {
    model = await storage.get(STORAGE_KEYS.OPENROUTER_MODEL) || DEFAULT_OPENROUTER_MODEL;
  }
  
  if (!apiKey) {
    return "Please configure your OpenRouter API key in Settings > Intelligence Engine.";
  }

  const temporalContext = getTemporalContext();
  const finalSystemInstruction = systemInstruction 
    ? `${systemInstruction}\n\n[Temporal Context]\n${temporalContext}`
    : temporalContext;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://aethermsaid.com',
        'X-Title': 'aethermsaid hub'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: finalSystemInstruction },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenRouter API error:', error);
      
      // If rate limited or model unavailable in free mode, try another free model
      if (freeMode && (error.error?.code === 429 || error.error?.code === 503)) {
        console.log('🔵 Model unavailable, trying another free model...');
        const alternateModel = await getRandomFreeModel();
        return callOpenRouterWithModel(prompt, alternateModel, apiKey as string, systemInstruction);
      }
      
      return `API Error: ${error.error?.message || 'Unknown error'}`;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Unable to generate response.";
  } catch (error) {
    console.error('OpenRouter call error:', error);
    return "Error communicating with OpenRouter API.";
  }
}

/**
 * Call OpenRouter with a specific model (used for retries)
 */
async function callOpenRouterWithModel(prompt: string, model: string, apiKey: string, systemInstruction?: string): Promise<string> {
  const temporalContext = getTemporalContext();
  const finalSystemInstruction = systemInstruction 
    ? `${systemInstruction}\n\n[Temporal Context]\n${temporalContext}`
    : temporalContext;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://aethermsaid.com',
        'X-Title': 'aethermsaid hub'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: finalSystemInstruction },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return `API Error: ${error.error?.message || 'Unknown error'}`;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Unable to generate response.";
  } catch (error) {
    return "Error communicating with OpenRouter API.";
  }
}

/**
 * Call Google Gemini API
 */
async function callGemini(prompt: string, systemInstruction?: string, options?: { tools?: any[] }): Promise<{ text: string; metadata?: any }> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { text: "Please configure your Gemini API key in Settings > Intelligence Engine." };
  }
  
  const model = await getModel();
  const ai = new GoogleGenAI({ apiKey });

  const temporalContext = getTemporalContext();
  const finalSystemInstruction = systemInstruction 
    ? `${systemInstruction}\n\n[Temporal Context]\n${temporalContext}`
    : temporalContext;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: finalSystemInstruction,
        tools: options?.tools
      }
    });
    return { 
      text: response.text || "Unable to generate response.",
      metadata: response.candidates?.[0]?.groundingMetadata
    };
  } catch (error) {
    console.error("Gemini API error:", error);
    return { text: "Error communicating with Gemini API." };
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(prompt: string, systemInstruction?: string): Promise<string> {
  const apiKey = await storage.get(STORAGE_KEYS.OPENAI_API_KEY);
  const model = await storage.get(STORAGE_KEYS.OPENAI_MODEL) || DEFAULT_OPENAI_MODEL;
  
  if (!apiKey) {
    return "Please configure your OpenAI API key in Settings > Intelligence Engine.";
  }

  const temporalContext = getTemporalContext();
  const finalSystemInstruction = systemInstruction 
    ? `${systemInstruction}\n\n[Temporal Context]\n${temporalContext}`
    : temporalContext;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: finalSystemInstruction },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return `OpenAI API Error: ${error.error?.message || 'Unknown error'}`;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Unable to generate response.";
  } catch (error) {
    console.error("OpenAI API error:", error);
    return "Error communicating with OpenAI API.";
  }
}

/**
 * Call Anthropic Claude API
 */
async function callAnthropic(prompt: string, systemInstruction?: string): Promise<string> {
  const apiKey = await storage.get(STORAGE_KEYS.ANTHROPIC_API_KEY);
  const model = await storage.get(STORAGE_KEYS.ANTHROPIC_MODEL) || DEFAULT_ANTHROPIC_MODEL;
  
  if (!apiKey) {
    return "Please configure your Anthropic API key in Settings > Intelligence Engine.";
  }

  const temporalContext = getTemporalContext();
  const finalSystemInstruction = systemInstruction 
    ? `${systemInstruction}\n\n[Temporal Context]\n${temporalContext}`
    : temporalContext;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: finalSystemInstruction,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return `Anthropic API Error: ${error.error?.message || 'Unknown error'}`;
    }

    const data = await response.json();
    return data.content?.[0]?.text || "Unable to generate response.";
  } catch (error) {
    console.error("Anthropic API error:", error);
    return "Error communicating with Anthropic API.";
  }
}

/**
 * Call Ollama (local AI)
 * Uses native Ollama Chat API (/api/chat) which supports tool calling.
 */
async function callOllama(prompt: string, systemInstruction?: string): Promise<string> {
  const ollamaUrl = await storage.get(STORAGE_KEYS.OLLAMA_URL) || DEFAULT_OLLAMA_URL;
  const model = await getModel();

  const temporalContext = getTemporalContext();
  const finalSystemInstruction = systemInstruction 
    ? `${systemInstruction}\n\n[Temporal Context]\n${temporalContext}`
    : temporalContext;

  const messages = [
    { role: 'system', content: finalSystemInstruction },
    { role: 'user', content: prompt }
  ];

  try {
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ollama API error:', errorText);
      return "Error: Unable to connect to Ollama. Make sure Ollama is running and accessible at " + ollamaUrl;
    }

    const data = await response.json();
    return data.message?.content || data.response || "Unable to generate response.";
  } catch (error) {
    console.error("Ollama API error:", error);
    return "Error communicating with Ollama. Make sure Ollama is running on " + ollamaUrl;
  }
}

/**
 * Call Local/Custom AI (OpenAI-compatible endpoint)
 */
async function callLocalAI(prompt: string, systemInstruction?: string): Promise<string> {
  const localUrl = await storage.get(STORAGE_KEYS.LOCAL_AI_URL);
  const localKey = await storage.get(STORAGE_KEYS.LOCAL_AI_KEY);
  const model = await storage.get(STORAGE_KEYS.LOCAL_AI_MODEL) || 'default';
  
  if (!localUrl) {
    return "Please configure your Local AI endpoint URL in Settings > Intelligence Engine.";
  }

  const temporalContext = getTemporalContext();
  const finalSystemInstruction = systemInstruction 
    ? `${systemInstruction}\n\n[Temporal Context]\n${temporalContext}`
    : temporalContext;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (localKey) {
      headers['Authorization'] = `Bearer ${localKey}`;
    }

    const response = await fetch(`${localUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: finalSystemInstruction },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return `Local AI API Error: ${error.error?.message || 'Unknown error'}`;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Unable to generate response.";
  } catch (error) {
    console.error("Local AI API error:", error);
    return "Error communicating with Local AI endpoint.";
  }
}

/**
 * Unified AI call that routes to the correct provider
 */
export async function callAI(prompt: string, systemInstruction?: string): Promise<string> {
  const provider = await getAIProvider();
  
  switch (provider) {
    case 'openrouter':
      return callOpenRouter(prompt, systemInstruction);
    case 'openai':
      return callOpenAI(prompt, systemInstruction);
    case 'anthropic':
      return callAnthropic(prompt, systemInstruction);
    case 'ollama':
      return callOllama(prompt, systemInstruction);
    case 'local':
      return callLocalAI(prompt, systemInstruction);
    default: {
      const result = await callGemini(prompt, systemInstruction);
      return result.text;
    }
  }
}

export async function summarizeNotifications(notifications: Notification[]): Promise<string> {
  const prompt = `
    Summarize the following communications (Emails and Alerts).
    Identify critical tasks, deadline mentions, and group them by project or topic.
    Use Markdown formatting (headers, bullet points, bold text).

    Items:
    ${notifications.map(n => `- [${n.type.toUpperCase()}] From ${n.sender}: ${n.subject}. Content: ${n.excerpt}`).join('\n')}
  `;

  return callAI(prompt, "You are an executive assistant summarizing a professional's inbox. Be sharp, accurate, and focus on actionability.");
}

export async function summarizeCalendar(events: CalendarEvent[]): Promise<string> {
  const prompt = `
    Briefly summarize this schedule. Mention the busiest parts of the day and any gaps for deep work.
    Events: ${JSON.stringify(events)}
  `;

  return callAI(prompt, "You are a time management expert helping someone plan their day.");
}

export async function getEventBriefing(event: CalendarEvent): Promise<string> {
  const prompt = `Provide a "Meeting Intelligence" briefing for this event: 
    Title: ${event.title}
    Attendees: ${event.attendees.join(', ')}
    Location: ${event.location || 'N/A'}
    Description: ${event.description || 'No description provided.'}
    
    Structure it with:
    1. **Context**: Why is this meeting happening?
    2. **Prep Checklist**: 3 actionable things the user should do before the meeting.
    3. **Historical Context**: (Simulate) mention what was last discussed with these people if applicable.
    
    Use a professional, sharp tone.`;

  return callAI(prompt, "You are a high-level executive assistant providing prep-notes for an important meeting.");
}

export async function prioritizeNotifications(notifications: any[]): Promise<Notification[]> {
  const provider = await getAIProvider();
  
  if (provider === 'openrouter') {
    // OpenRouter doesn't support structured JSON output like Gemini, so we use a prompt-based approach
    const prompt = `Analyze these items and return ONLY a valid JSON array with 'id', 'priority' (high/medium/low), and 'category'. 
    No other text, just the JSON array.
    
    Items: ${JSON.stringify(notifications)}`;
    
    const response = await callOpenRouter(prompt, "You are a JSON-only response bot. Return only valid JSON arrays, no explanations.");
    
    try {
      const jsonStr = response.trim().replace(/```json\n?|\n?```/g, '');
      const aiAnalysis = JSON.parse(jsonStr);
      return notifications.map(n => {
        const analysis = aiAnalysis.find((a: any) => a.id === n.id);
        return {
          ...n,
          priority: analysis?.priority || 'low',
          category: analysis?.category || 'Other',
          type: n.type || 'notification'
        };
      });
    } catch (e) {
      return notifications;
    }
  }
  
  // Google Gemini with structured output
  const apiKey = await getApiKey();
  if (!apiKey) {
    return notifications;
  }
  const model = await getModel();
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model,
    contents: `Analyze these items and return a JSON array with 'id', 'priority' (high/medium/low), and 'category'. 
    
    Items: ${JSON.stringify(notifications)}`,
    config: {
      systemInstruction: getTemporalContext(),
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            priority: { type: Type.STRING },
            category: { type: Type.STRING }
          },
          required: ["id", "priority", "category"]
        }
      }
    }
  });

  try {
    const jsonStr = response.text?.trim() || "[]";
    const aiAnalysis = JSON.parse(jsonStr);
    return notifications.map(n => {
      const analysis = aiAnalysis.find((a: any) => a.id === n.id);
      return {
        ...n,
        priority: analysis?.priority || 'low',
        category: analysis?.category || 'Other',
        type: n.type || 'notification'
      };
    });
  } catch (e) {
    return notifications;
  }
}

export async function getAssistantResponse(query: string, context: string): Promise<NewsSummaryResponse> {
  const provider = await getAIProvider();
  const prompt = `Context from user's workspace: ${context}\n\nUser Question: ${query}`;
  const systemInstruction = "You are aethermsaid hub, an intelligent hub for personal information. Provide concise, helpful answers based on the context provided.";
  
  if (provider === 'openrouter') {
    const response = await callOpenRouter(prompt, systemInstruction);
    return { text: response, sources: [] };
  }
  
  // Google Gemini with search grounding
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { text: "Please configure your Gemini API key in Settings > Intelligence Engine.", sources: [] };
  }
  const model = await getModel();
  const ai = new GoogleGenAI({ apiKey });

  try {
    const temporalContext = getTemporalContext();
    const systemInstruction = `You are aethermsaid hub, an intelligent hub for personal information and current events. You have access to the user's local workspace context AND Google Search. Provide concise, helpful answers.\n\n[Temporal Context]\n${temporalContext}`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt + "\n\nUse Google Search if the user is asking about current events, news, or information outside the provided workspace context.",
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      }
    });

    const sources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({ title: chunk.web.title, uri: chunk.web.uri });
        }
      });
    }

    return {
      text: response.text || "I'm sorry, I couldn't process that.",
      sources
    };
  } catch (error) {
    console.error("Chat error:", error);
    return { text: "Something went wrong.", sources: [] };
  }
}

export async function getKnowledgeBuilderResponse(message: string, history: {role: string, content: string}[]): Promise<string> {
  const historyPrompt = history.map(h => `${h.role}: ${h.content}`).join('\n') + `\nUser: ${message}`;
  const systemInstruction = `You are the Nexus Context Builder. Your mission is to interview the user to learn about their preferences, work style, goals, and recurring life events to better serve them in the dashboard.
    - Ask ONE question at a time.
    - Be friendly and curious.
    - Acknowledge what they said before asking the next question.
    - Focus on discovering "Knowledge Insights" like: Preferred work hours, Important people/contacts, Key projects, Personal goals, or Technical interests.`;

  return callAI(historyPrompt, systemInstruction);
}

export async function getTopicNews(topics: string[]): Promise<NewsSummaryResponse> {
  const provider = await getAIProvider();
  const prompt = `Provide a unified news summary for the following topics of interest: ${topics.join(', ')}. 
  Focus on the most recent developments from the last 24-48 hours. Group by topic. Be concise.`;
  
  if (provider === 'openrouter') {
    const response = await callOpenRouter(prompt, "You are a professional news curator. Provide a short briefing on the requested topics.");
    return { text: response, sources: [] };
  }
  
  // Google Gemini with search grounding
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { text: "Please configure your Gemini API key in Settings > Intelligence Engine.", sources: [] };
  }
  const model = await getModel();
  const ai = new GoogleGenAI({ apiKey });

  try {
    const temporalContext = getTemporalContext();
    const systemInstruction = `You are a professional news curator. Provide a short briefing based on the latest web results.\n\n[Temporal Context]\n${temporalContext}`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      }
    });

    const sources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({ title: chunk.web.title, uri: chunk.web.uri });
        }
      });
    }

    return {
      text: response.text || "No news found for these topics.",
      sources
    };
  } catch (error) {
    console.error("News fetch error:", error);
    return { text: "Failed to fetch latest news.", sources: [] };
  }
}

/**
 * Extract user context from recent activities
 */
export async function extractUserContext(
  activities: any[]
): Promise<{
  workHours?: { start: string; end: string; days: string[] };
  responseStyle?: { tone: string; length: string; formality: string };
  topicsOfInterest?: string[];
  importantContacts?: { name: string; platform: string; frequency: number }[];
  meetingPreferences?: { preferredTimes: string[]; averageDuration: number };
}> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }
  const ai = new GoogleGenAI({ apiKey });
  const model = await getModel();
  
  const prompt = `Analyze these user activities and extract key patterns about their work habits and preferences.

Activities (recent ${activities.length}):
${activities.slice(0, 50).map((a: any) => `- ${a.action_type || a.actionType} on ${a.platform} at ${new Date(a.timestamp).toLocaleString()}${a.context_json ? ': ' + (typeof a.context_json === 'string' ? a.context_json : JSON.stringify(a.context_json)) : ''}`).join('\n')}

Extract the following insights:
1. **Work Hours**: Typical start/end times and active days of the week
2. **Response Style**: Communication tone (formal/casual), typical message length, formality level
3. **Topics of Interest**: Main topics/keywords appearing in communications
4. **Important Contacts**: People they communicate with most frequently
5. **Meeting Preferences**: Preferred meeting times, typical duration

Return as structured JSON.`;

  try {
    const result = await ai.models.generateContent({
      model,
      contents: [{
        role: 'user',
        parts: [{ text: prompt }],
      }],
      config: {
        systemInstruction: getTemporalContext(),
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            workHours: {
              type: Type.OBJECT,
              properties: {
                start: { type: Type.STRING },
                end: { type: Type.STRING },
                days: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
            },
            responseStyle: {
              type: Type.OBJECT,
              properties: {
                tone: { type: Type.STRING },
                length: { type: Type.STRING },
                formality: { type: Type.STRING },
              },
            },
            topicsOfInterest: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            importantContacts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  platform: { type: Type.STRING },
                  frequency: { type: Type.NUMBER },
                },
              },
            },
            meetingPreferences: {
              type: Type.OBJECT,
              properties: {
                preferredTimes: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                averageDuration: { type: Type.NUMBER },
              },
            },
          },
        },
      },
    });

    return JSON.parse(result.text);
  } catch (error) {
    console.error('Error extracting user context:', error);
    return {};
  }
}

/**
 * Detect communication style from messages
 */
export async function detectCommunicationStyle(
  messages: { body: string; platform: string }[]
): Promise<{ tone: string; formality: string; avgLength: number; commonPhrases: string[] }> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }
  const ai = new GoogleGenAI({ apiKey });
  const model = await getModel();
  
  const prompt = `Analyze these sent messages and determine the user's communication style:

Messages:
${messages.slice(0, 20).map((m, i) => `${i + 1}. [${m.platform}] ${m.body.substring(0, 200)}`).join('\n')}

Determine:
1. Overall tone (professional, casual, friendly, formal, etc.)
2. Formality level (very formal, formal, neutral, casual, very casual)
3. Average message length in words
4. Common phrases or expressions they use

Return as JSON.`;

  try {
    const result = await ai.models.generateContent({
      model,
      contents: [{
        role: 'user',
        parts: [{ text: prompt }],
      }],
      config: {
        systemInstruction: getTemporalContext(),
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tone: { type: Type.STRING },
            formality: { type: Type.STRING },
            avgLength: { type: Type.NUMBER },
            commonPhrases: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
        },
      },
    });

    return JSON.parse(result.text);
  } catch (error) {
    console.error('Error detecting communication style:', error);
    return { tone: 'neutral', formality: 'neutral', avgLength: 50, commonPhrases: [] };
  }
}

/**
 * Identify frequent contacts from activities
 */
export async function identifyFrequentContacts(
  activities: any[]
): Promise<{ email: string; name?: string; platforms: string[]; interactionCount: number }[]> {
  const contactMap = new Map<string, { name?: string; platforms: Set<string>; count: number }>();

  for (const activity of activities) {
    const participants = activity.participants 
      ? (typeof activity.participants === 'string' ? JSON.parse(activity.participants) : activity.participants)
      : [];
      
    if (participants && Array.isArray(participants)) {
      for (const participant of participants) {
        const existing = contactMap.get(participant) || { platforms: new Set(), count: 0 };
        existing.platforms.add(activity.platform);
        existing.count++;
        contactMap.set(participant, existing);
      }
    }
  }

  const contacts = Array.from(contactMap.entries())
    .map(([email, data]) => ({
      email,
      platforms: Array.from(data.platforms),
      interactionCount: data.count,
    }))
    .sort((a, b) => b.interactionCount - a.interactionCount)
    .slice(0, 20);

  return contacts;
}

/**
 * Analyze work patterns from activities
 */
export async function analyzeWorkPatterns(
  activities: any[]
): Promise<{
  peakHours: string[];
  activeDays: string[];
  avgEmailsPerDay: number;
  avgMeetingsPerWeek: number;
}> {
  const hourCounts = new Map<number, number>();
  const dayCounts = new Map<string, number>();
  const emailDates = new Map<string, number>();
  let meetingCount = 0;

  for (const activity of activities) {
    const date = new Date(activity.timestamp);
    const hour = date.getHours();
    const day = date.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = date.toISOString().split('T')[0];

    // Track hourly distribution
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);

    // Track daily distribution
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);

    const actionType = activity.action_type || activity.actionType;
    
    // Count emails per day
    if (actionType && actionType.startsWith('email_')) {
      emailDates.set(dateStr, (emailDates.get(dateStr) || 0) + 1);
    }

    // Count meetings
    if (actionType === 'event_attend') {
      meetingCount++;
    }
  }

  // Find peak hours (top 3)
  const peakHours = Array.from(hourCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => `${hour}:00-${hour + 1}:00`);

  // Find active days (sorted by activity)
  const activeDays = Array.from(dayCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([day]) => day);

  // Calculate averages
  const avgEmailsPerDay = emailDates.size > 0 
    ? Array.from(emailDates.values()).reduce((a, b) => a + b, 0) / emailDates.size 
    : 0;
  
  const daysSpan = activities.length > 0 
    ? (new Date().getTime() - new Date(activities[activities.length - 1].timestamp).getTime()) / (1000 * 60 * 60 * 24)
    : 1;
  const avgMeetingsPerWeek = (meetingCount / Math.max(daysSpan, 1)) * 7;

  return {
    peakHours,
    activeDays,
    avgEmailsPerDay: Math.round(avgEmailsPerDay),
    avgMeetingsPerWeek: Math.round(avgMeetingsPerWeek),
  };
}

/**
 * Generate email reply with knowledge context
 */
export async function generateEmailReply(
  email: {
    subject: string;
    sender: string;
    body: string;
  },
  knowledgeContext: {
    responseStyle?: { tone: string; formality: string };
    senderHistory?: any[];
    relevantTopics?: string[];
  } = {}
): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }
  const ai = new GoogleGenAI({ apiKey });
  const model = await getModel();
  
  const styleContext = knowledgeContext.responseStyle 
    ? `Your typical communication style is ${knowledgeContext.responseStyle.tone} with ${knowledgeContext.responseStyle.formality} formality.`
    : '';
  
  const historyContext = knowledgeContext.senderHistory && knowledgeContext.senderHistory.length > 0
    ? `Previous interactions with ${email.sender}:\n${knowledgeContext.senderHistory.slice(0, 3).map((h: any) => `- ${h.subject || h.preview}`).join('\n')}`
    : '';

  const topicContext = knowledgeContext.relevantTopics && knowledgeContext.relevantTopics.length > 0
    ? `Relevant context: ${knowledgeContext.relevantTopics.join(', ')}`
    : '';

  const prompt = `Generate a professional email reply based on the user's typical communication style.

Email to reply to:
From: ${email.sender}
Subject: ${email.subject}
Body: ${email.body}

${styleContext}
${historyContext}
${topicContext}

Generate a contextually appropriate reply that:
1. Matches the user's typical tone and formality
2. Addresses the key points from the email
3. Is concise and clear
4. Includes an appropriate greeting and sign-off

Return ONLY the email body text, no subject line.`;

  try {
    const result = await ai.models.generateContent({
      model,
      contents: [{
        role: 'user',
        parts: [{ text: prompt }],
      }],
      config: {
        systemInstruction: getTemporalContext(),
        temperature: 0.7,
      },
    });

    return result.text.trim();
  } catch (error) {
    console.error('Error generating email reply:', error);
    throw new Error('Failed to generate reply');
  }
}

/**
 * Generate message reply (WhatsApp/Discord) with knowledge context
 */
export async function generateMessageReply(
  message: {
    sender: string;
    body: string;
    platform: string;
  },
  knowledgeContext: {
    responseStyle?: { tone: string; formality: string };
    conversationHistory?: any[];
  } = {}
): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }
  const ai = new GoogleGenAI({ apiKey });
  const model = await getModel();
  
  const styleContext = knowledgeContext.responseStyle 
    ? `Your typical messaging style is ${knowledgeContext.responseStyle.tone} with ${knowledgeContext.responseStyle.formality} formality.`
    : '';
  
  const historyContext = knowledgeContext.conversationHistory && knowledgeContext.conversationHistory.length > 0
    ? `Recent conversation:\n${knowledgeContext.conversationHistory.slice(-5).map((m: any) => `${m.from_name || m.sender}: ${m.body}`).join('\n')}`
    : '';

  const prompt = `Generate a brief ${message.platform} message reply based on the user's communication style.

Message to reply to:
From: ${message.sender}
${message.body}

${styleContext}
${historyContext}

Generate a response that:
1. Matches the user's typical messaging style
2. Is appropriate for ${message.platform} (brief, conversational)
3. Addresses the message naturally
4. No formal greetings/sign-offs (casual messaging style)

Return ONLY the message text.`;

  try {
    const result = await ai.models.generateContent({
      model,
      contents: [{
        role: 'user',
        parts: [{ text: prompt }],
      }],
      config: {
        systemInstruction: getTemporalContext(),
        temperature: 0.8,
      },
    });

    return result.text.trim();
  } catch (error) {
    console.error('Error generating message reply:', error);
    throw new Error('Failed to generate reply');
  }
}

/**
 * Summarize a conversation thread
 */
export async function summarizeConversation(
  messages: { sender: string; body: string; timestamp: string }[],
  platform: string
): Promise<{
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  topics: string[];
}> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }
  const ai = new GoogleGenAI({ apiKey });
  const model = await getModel();
  
  const prompt = `Summarize this ${platform} conversation thread.

Messages (${messages.length} total):
${messages.map((m, i) => `[${new Date(m.timestamp).toLocaleString()}] ${m.sender}: ${m.body}`).join('\n')}

Provide:
1. A brief summary (2-3 sentences)
2. Key points discussed
3. Action items or decisions (if any)
4. Main topics/themes

Return as JSON.`;

  try {
    const result = await ai.models.generateContent({
      model,
      contents: [{
        role: 'user',
        parts: [{ text: prompt }],
      }],
      config: {
        systemInstruction: getTemporalContext(),
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            keyPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            actionItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            topics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
        },
      },
    });

    return JSON.parse(result.text);
  } catch (error) {
    console.error('Error summarizing conversation:', error);
    return {
      summary: 'Unable to generate summary',
      keyPoints: [],
      actionItems: [],
      topics: [],
    };
  }
}
