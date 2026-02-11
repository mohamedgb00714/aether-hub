/**
 * Base Agent Class
 * All specialized agents extend this base class which handles
 * LangChain initialization, tool binding, and conversation management.
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import storage, { STORAGE_KEYS } from '../electronStore';
import { getAIProvider, getModel, AIProvider } from '../geminiService';
import { AgentInfo, AgentResponse, AgentMessage } from './types';

type LangChainChat = ChatGoogleGenerativeAI | ChatOpenAI;

let sharedChat: LangChainChat | null = null;
let sharedProvider: AIProvider | null = null;

/**
 * Initialize or retrieve the shared LangChain chat instance
 * Reuses across all agents to avoid redundant connections
 */
export async function getSharedChat(): Promise<LangChainChat> {
  const provider = await getAIProvider();
  
  if (sharedChat && provider === sharedProvider) {
    return sharedChat;
  }
  
  sharedProvider = provider;
  
  switch (provider) {
    case 'openrouter': {
      const apiKey = await storage.get(STORAGE_KEYS.OPENROUTER_API_KEY);
      const model = await storage.get(STORAGE_KEYS.OPENROUTER_MODEL) || 'anthropic/claude-3.5-sonnet';
      if (!apiKey) throw new Error('OpenRouter API key not configured. Please add it in Settings.');
      sharedChat = new ChatOpenAI({
        configuration: { baseURL: 'https://openrouter.ai/api/v1' },
        apiKey, model, temperature: 0.7, maxTokens: 4096,
      });
      break;
    }
    case 'openai': {
      const apiKey = await storage.get(STORAGE_KEYS.OPENAI_API_KEY);
      const model = await storage.get(STORAGE_KEYS.OPENAI_MODEL) || 'gpt-4o-mini';
      if (!apiKey) throw new Error('OpenAI API key not configured. Please add it in Settings.');
      sharedChat = new ChatOpenAI({ apiKey, model, temperature: 0.7, maxTokens: 4096 });
      break;
    }
    case 'anthropic': {
      const apiKey = await storage.get(STORAGE_KEYS.ANTHROPIC_API_KEY);
      const model = await storage.get(STORAGE_KEYS.ANTHROPIC_MODEL) || 'claude-3-5-sonnet-20241022';
      if (!apiKey) throw new Error('Anthropic API key not configured. Please add it in Settings.');
      sharedChat = new ChatOpenAI({
        configuration: {
          baseURL: 'https://api.anthropic.com/v1',
          defaultHeaders: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
        },
        apiKey, model, temperature: 0.7, maxTokens: 4096,
      });
      break;
    }
    case 'ollama': {
      const ollamaUrl = await storage.get(STORAGE_KEYS.OLLAMA_URL) || 'http://localhost:11434';
      const model = await getModel();
      sharedChat = new ChatOpenAI({
        configuration: { baseURL: `${ollamaUrl}/v1` },
        apiKey: 'ollama', model, temperature: 0.7, maxTokens: 4096,
      });
      break;
    }
    case 'local': {
      const localUrl = await storage.get(STORAGE_KEYS.LOCAL_AI_URL);
      const localKey = await storage.get(STORAGE_KEYS.LOCAL_AI_KEY) || 'local';
      const model = await storage.get(STORAGE_KEYS.LOCAL_AI_MODEL) || 'default';
      if (!localUrl) throw new Error('Local AI endpoint URL not configured. Please add it in Settings.');
      sharedChat = new ChatOpenAI({
        configuration: { baseURL: localUrl },
        apiKey: localKey, model, temperature: 0.7, maxTokens: 4096,
      });
      break;
    }
    default: {
      const apiKey = await storage.get(STORAGE_KEYS.GEMINI_API_KEY);
      const model = await storage.get(STORAGE_KEYS.GEMINI_MODEL) || 'gemini-2.5-flash';
      if (!apiKey) throw new Error('Gemini API key not configured. Please add it in Settings.');
      sharedChat = new ChatGoogleGenerativeAI({
        apiKey, model, temperature: 0.7, maxOutputTokens: 4096,
      });
      break;
    }
  }
  
  return sharedChat;
}

/**
 * Reset shared chat (call when API key or model changes)
 */
export function resetSharedChat() {
  sharedChat = null;
  sharedProvider = null;
}

/**
 * Abstract BaseAgent that all specialized agents extend
 */
export abstract class BaseAgent {
  abstract info: AgentInfo;
  abstract getSystemPrompt(): string;
  abstract getTools(): DynamicStructuredTool[];

  /**
   * Run the agent with a user message and conversation history
   */
  async run(
    userMessage: string,
    conversationHistory: AgentMessage[] = []
  ): Promise<AgentResponse> {
    try {
      const chatInstance = await getSharedChat();
      const tools = this.getTools();
      const modelWithTools = tools.length > 0 ? chatInstance.bindTools(tools) : chatInstance;
      
      const systemPrompt = this.getSystemPrompt();
      const messages: any[] = [{ role: 'system', content: systemPrompt }];
      
      // Add conversation history
      for (const msg of conversationHistory) {
        if (msg.role === 'system') continue;
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      }
      
      messages.push({ role: 'user', content: userMessage });
      
      // First call
      const response = await modelWithTools.invoke(messages);
      const toolCalls = response.tool_calls || response.additional_kwargs?.tool_calls || [];
      const toolsUsed: string[] = [];
      const reasoning: string[] = [];
      
      if (toolCalls.length > 0 && tools.length > 0) {
        const toolResults: any[] = [];
        
        for (const toolCall of toolCalls) {
          const toolName = toolCall.name || toolCall.function?.name;
          const toolArgs = toolCall.args || (toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {});
          
          toolsUsed.push(toolName);
          reasoning.push(`Using tool: ${toolName}`);
          
          const tool = tools.find(t => t.name === toolName);
          if (tool) {
            const result = await tool.func(toolArgs);
            reasoning.push(`Result: ${result.substring(0, 200)}...`);
            toolResults.push({
              role: 'tool',
              content: result,
              tool_call_id: toolCall.id,
              name: toolName
            });
          }
        }
        
        messages.push({
          role: 'assistant',
          content: response.content || '',
          tool_calls: toolCalls
        });
        
        for (const result of toolResults) {
          messages.push(result);
        }
        
        const finalResponse = await chatInstance.invoke(messages);
        return {
          text: finalResponse.content as string,
          toolsUsed: [...new Set(toolsUsed)],
          reasoning
        };
      }
      
      return { text: response.content as string };
    } catch (error) {
      console.error(`[${this.info.name}] Agent error:`, error);
      
      if (error instanceof Error && error.message.includes('API key')) {
        return { text: 'API key not configured. Please add your API key in Settings → Intelligence Engine.' };
      }
      if (error instanceof Error && (error.message.includes('tool') || error.message.includes('function calling'))) {
        return { text: 'The selected model does not support tool calling. Please switch to a compatible model (Gemini 2.0+, Claude 3.5, GPT-4).' };
      }
      
      return { text: `Sorry, I encountered an error. Please try again. ${error instanceof Error ? error.message : ''}` };
    }
  }
}
