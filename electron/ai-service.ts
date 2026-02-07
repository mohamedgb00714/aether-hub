/**
 * Centralized AI Service for Main Process
 * 
 * Handles all AI provider interactions with a unified interface.
 * Supports: Google Gemini, OpenRouter, OpenAI, Anthropic, Ollama, Local AI
 * 
 * ARCHITECTURE:
 * - This service runs in the MAIN PROCESS (electron/)
 * - For RENDERER PROCESS, use src/services/geminiService.ts
 * - Both services respect the global AI_PROVIDER setting from electron-store
 * - All AI features should use these centralized services instead of duplicating provider logic
 * 
 * USAGE:
 * ```typescript
 * import * as aiService from './ai-service.js';
 * 
 * // Simple AI call
 * const response = await aiService.callAI({
 *   prompt: 'Explain quantum computing',
 *   temperature: 0.7
 * });
 * 
 * // With system instruction
 * const chat = await aiService.generateChatResponse(
 *   'Hello!',
 *   'You are a helpful assistant'
 * );
 * 
 * // Automation analysis
 * const analysis = await aiService.analyzeAutomationResult(result, task);
 * ```
 */

import Store from 'electron-store';
import { getEncryptionKey } from './security.js';

const store = new Store({
  encryptionKey: getEncryptionKey(),
  name: 'aether-hub-config'
});

export type AIProvider = 'google' | 'openrouter' | 'openai' | 'anthropic' | 'ollama' | 'local';

export interface AIRequest {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  success: boolean;
  text?: string;
  error?: string;
}

/**
 * Get the currently configured AI provider
 */
export function getProvider(): AIProvider {
  return (store.get('ai_provider') as AIProvider) || 'google';
}

/**
 * Get API configuration for current provider
 */
function getProviderConfig(provider: AIProvider) {
  const configs: Record<AIProvider, any> = {
    google: {
      apiKey: (store.get('gemini_api_key', '') as string) || process.env.GEMINI_API_KEY || '',
      model: store.get('gemini_model', 'gemini-2.0-flash') as string,
      endpoint: (model: string, key: string) => 
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    },
    openrouter: {
      apiKey: (store.get('openrouter_api_key', '') as string) || process.env.OPENROUTER_API_KEY || '',
      model: store.get('openrouter_model', 'x-ai/grok-2-1212') as string,
      endpoint: () => 'https://openrouter.ai/api/v1/chat/completions',
    },
    openai: {
      apiKey: (store.get('openai_api_key', '') as string) || process.env.OPENAI_API_KEY || '',
      model: store.get('openai_model', 'gpt-4o-mini') as string,
      endpoint: () => 'https://api.openai.com/v1/chat/completions',
    },
    anthropic: {
      apiKey: (store.get('anthropic_api_key', '') as string) || process.env.ANTHROPIC_API_KEY || '',
      model: store.get('anthropic_model', 'claude-3-5-sonnet-20241022') as string,
      endpoint: () => 'https://api.anthropic.com/v1/messages',
    },
    ollama: {
      apiKey: '', // Ollama doesn't need API key
      model: store.get('ollama_model', 'llama3.2') as string,
      endpoint: () => {
        const url = store.get('ollama_url', 'http://localhost:11434') as string;
        return `${url}/v1/chat/completions`;
      },
    },
    local: {
      apiKey: store.get('local_ai_key', '') as string,
      model: store.get('local_ai_model', 'default') as string,
      endpoint: () => {
        const url = store.get('local_ai_url', 'http://localhost:8080') as string;
        return `${url}/v1/chat/completions`;
      },
    },
  };

  return configs[provider];
}

/**
 * Build request headers for a provider
 */
function getHeaders(provider: AIProvider, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  switch (provider) {
    case 'openrouter':
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['HTTP-Referer'] = 'https://aether-hub.app';
      headers['X-Title'] = 'aethermsaid hub Personal Hub';
      break;
    case 'openai':
    case 'local':
      headers['Authorization'] = `Bearer ${apiKey}`;
      break;
    case 'anthropic':
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      break;
    case 'ollama':
      // No auth needed
      break;
    case 'google':
      // API key in URL
      break;
  }

  return headers;
}

/**
 * Build request body for a provider
 */
function getRequestBody(
  provider: AIProvider,
  prompt: string,
  systemInstruction: string | undefined,
  model: string,
  temperature: number,
  maxTokens: number
): any {
  // Google Gemini uses different format
  if (provider === 'google') {
    return {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
      ...(systemInstruction && {
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        }
      })
    };
  }

  // Anthropic uses different format
  if (provider === 'anthropic') {
    return {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [{
        role: 'user',
        content: prompt
      }],
      ...(systemInstruction && { system: systemInstruction })
    };
  }

  // OpenRouter, OpenAI, Ollama, Local AI use OpenAI-compatible format
  const messages: Array<{role: string, content: string}> = [];
  
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  
  messages.push({ role: 'user', content: prompt });

  return {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
}

/**
 * Parse response from a provider
 */
function parseResponse(provider: AIProvider, data: any): string {
  try {
    switch (provider) {
      case 'google':
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      case 'anthropic':
        return data.content?.[0]?.text || '';
      default:
        // OpenRouter, OpenAI, Ollama, Local AI
        return data.choices?.[0]?.message?.content || '';
    }
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    return '';
  }
}

/**
 * Send a request to the AI provider
 * 
 * @param request - The AI request configuration
 * @param provider - Optional provider override (uses global setting if not specified)
 * @returns Promise with AI response
 */
export async function callAI(
  request: AIRequest,
  provider?: AIProvider
): Promise<AIResponse> {
  try {
    const selectedProvider = provider || getProvider();
    const config = getProviderConfig(selectedProvider);
    
    // Validate API key (except for Ollama which doesn't need one)
    if (!config.apiKey && selectedProvider !== 'ollama') {
      return {
        success: false,
        error: `API key not configured for ${selectedProvider}. Please add it in Settings.`
      };
    }

    // Build request
    const url = typeof config.endpoint === 'function' 
      ? config.endpoint(config.model, config.apiKey)
      : config.endpoint;
      
    const headers = getHeaders(selectedProvider, config.apiKey);
    const temperature = request.temperature ?? 0.7;
    const maxTokens = request.maxTokens ?? 2048;
    
    const body = getRequestBody(
      selectedProvider,
      request.prompt,
      request.systemInstruction,
      config.model,
      temperature,
      maxTokens
    );

    // Make API call
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI API Error (${selectedProvider}):`, errorText);
      return {
        success: false,
        error: `API request failed: ${response.status} ${response.statusText}`
      };
    }

    const data = await response.json();
    const text = parseResponse(selectedProvider, data);

    if (!text) {
      console.error('Empty response from AI:', data);
      return {
        success: false,
        error: 'AI returned empty response'
      };
    }

    return {
      success: true,
      text
    };

  } catch (error: any) {
    console.error('AI service error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}

/**
 * Analyze automation results with AI
 */
export async function analyzeAutomationResult(
  result: string,
  task: string
): Promise<string> {
  const prompt = `Analyze this browser automation result and provide a clear, concise summary:

Task: ${task}

Raw Result:
${result}

Provide:
1. A brief summary of what was accomplished
2. Key findings or data extracted
3. Any errors or issues encountered
4. Actionable insights or next steps`;

  const response = await callAI({
    prompt,
    temperature: 0.3,
    maxTokens: 1000
  });

  if (!response.success) {
    return `Analysis failed: ${response.error}`;
  }

  return response.text || 'Failed to analyze';
}

/**
 * Generate a chat response
 */
export async function generateChatResponse(
  prompt: string,
  systemInstruction?: string
): Promise<string | null> {
  const response = await callAI({
    prompt,
    systemInstruction,
    temperature: 0.7,
    maxTokens: 2048
  });

  return response.success ? response.text || null : null;
}
