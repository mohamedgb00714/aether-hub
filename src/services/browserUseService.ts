/**
 * Browser Automation Service
 * Provides AI-powered browser automation using your configured LLM
 */

import storage, { STORAGE_KEYS } from './electronStore';
import { getChatResponse } from './langchainService';

interface ChromeProfile {
  id: string;
  name: string;
  path: string;
  email?: string;
  avatar?: string;
}

interface AutomationTask {
  id: string;
  name: string;
  description: string;
  task: string;
  profileId: string;
  schedule?: string;
  lastRun?: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  result?: any;
}

interface TaskResult {
  taskId: string;
  output: any;
  steps: string[];
  status: 'finished' | 'failed' | 'running';
  error?: string;
}

class BrowserAutomationService {
  /**
   * Check if LLM is configured
   */
  async hasLLMConfigured(): Promise<boolean> {
    // Check if Gemini API key is set
    const geminiKey = await storage.get(STORAGE_KEYS.GEMINI_API_KEY);
    if (geminiKey) return true;

    // Check if OpenRouter is configured
    const aiProvider = await storage.get(STORAGE_KEYS.AI_PROVIDER);
    if (aiProvider && aiProvider !== 'gemini') {
      const openRouterKey = await storage.get(STORAGE_KEYS.OPENROUTER_API_KEY);
      return !!openRouterKey;
    }

    return false;
  }

  /**
   * Get the configured AI provider name
   */
  async getProviderName(): Promise<string> {
    const provider = await storage.get(STORAGE_KEYS.AI_PROVIDER) as string || 'google';
    let model = '';
    
    switch (provider) {
      case 'google':
      case 'gemini':
        model = await storage.get(STORAGE_KEYS.GEMINI_MODEL) as string || '2.5 Flash';
        return `Gemini ${model}`;
      case 'openrouter':
        model = await storage.get(STORAGE_KEYS.OPENROUTER_MODEL) as string || '';
        return `OpenRouter ${model}`.trim();
      case 'openai':
        model = await storage.get(STORAGE_KEYS.OPENAI_MODEL) as string || '';
        return `OpenAI ${model}`.trim();
      case 'anthropic':
        model = await storage.get(STORAGE_KEYS.ANTHROPIC_MODEL) as string || '';
        return `Anthropic ${model}`.trim();
      case 'ollama':
        model = await storage.get(STORAGE_KEYS.OLLAMA_MODEL) as string || '';
        return `Ollama ${model}`.trim();
      case 'local':
        model = await storage.get(STORAGE_KEYS.LOCAL_AI_MODEL) as string || '';
        return `Local AI ${model}`.trim();
      default:
        return 'AI Provider';
    }
  }

  /**
   * Create and run an automation task using AI
   */
  async runTask(taskDescription: string, profileId: string, options?: {
    onStep?: (step: string) => void;
  }): Promise<TaskResult> {
    const hasLLM = await this.hasLLMConfigured();
    if (!hasLLM) {
      throw new Error('No AI provider configured. Please configure Gemini or OpenRouter in Settings.');
    }

    const steps: string[] = [];
    const addStep = (step: string) => {
      steps.push(step);
      if (options?.onStep) {
        options.onStep(step);
      }
    };

    try {
      addStep('Initializing AI-powered browser agent...');
      
      // Get LLM configuration
      const provider = await storage.get(STORAGE_KEYS.AI_PROVIDER) as string || 'google';
      let apiKey = '';
      let model = '';
      
      switch (provider) {
        case 'google':
        case 'gemini':
          apiKey = await storage.get(STORAGE_KEYS.GEMINI_API_KEY) as string;
          model = await storage.get(STORAGE_KEYS.GEMINI_MODEL) as string || 'gemini-2.0-flash';
          break;
        case 'openrouter':
          apiKey = await storage.get(STORAGE_KEYS.OPENROUTER_API_KEY) as string;
          model = await storage.get(STORAGE_KEYS.OPENROUTER_MODEL) as string || 'x-ai/grok-2-1212';
          break;
        case 'openai':
          apiKey = await storage.get(STORAGE_KEYS.OPENAI_API_KEY) as string;
          model = await storage.get(STORAGE_KEYS.OPENAI_MODEL) as string || 'gpt-4o-mini';
          break;
        case 'anthropic':
          apiKey = await storage.get(STORAGE_KEYS.ANTHROPIC_API_KEY) as string;
          model = await storage.get(STORAGE_KEYS.ANTHROPIC_MODEL) as string || 'claude-3-5-sonnet-20241022';
          break;
        case 'ollama':
          model = await storage.get(STORAGE_KEYS.OLLAMA_MODEL) as string || 'llama3.2';
          break;
        case 'local':
          apiKey = await storage.get(STORAGE_KEYS.LOCAL_AI_KEY) as string || '';
          model = await storage.get(STORAGE_KEYS.LOCAL_AI_MODEL) as string || 'default';
          break;
      }
      
      addStep('Launching browser automation...');
      
      // Get Chrome profile details
      const profiles = await window.electronAPI.chrome.getProfiles();
      const selectedProfile = profiles.find(p => p.id === profileId);
      
      // Execute browser-use via IPC
      const config = {
        task: taskDescription,
        llm: {
          provider,
          api_key: apiKey,
          model
        },
        chrome_profile: profileId,
        chrome_profile_path: selectedProfile?.path || undefined
      };
      
      const result = await window.electronAPI.browseruse.execute(config);
      
      if (!result.success) {
        throw new Error(result.error || 'Browser automation failed');
      }
      
      addStep('Browser automation completed successfully');
      addStep(`Result: ${result.output}`);

      return {
        taskId: `task_${Date.now()}`,
        output: {
          result: result.output,
          task: result.task,
          status: 'completed',
        },
        steps,
        status: 'finished',
      };
    } catch (error: any) {
      console.error('❌ Task execution failed:', error);
      addStep(`Error: ${error.message}`);
      
      return {
        taskId: 'error',
        output: null,
        steps,
        status: 'failed',
        error: error.message || 'Task execution failed',
      };
    }
  }
}

// Export singleton instance
export const browserAutomationService = new BrowserAutomationService();

// Export types
export type { ChromeProfile, AutomationTask, TaskResult };
