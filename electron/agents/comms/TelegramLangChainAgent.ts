import Store from 'electron-store';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import { getEncryptionKey } from '../../security.js';
import type { AgentConfig, AgentTaskResult } from '../types.js';
import type { BrowserRunner } from '../runners/BrowserRunner.js';

const MAX_HISTORY_MESSAGES = 12;
const RUN_TASK_PREFIX = '[[RUN_TASK]]:';

type LangChainChat = ChatGoogleGenerativeAI | ChatOpenAI;

export class TelegramLangChainAgent {
  private store = new Store({
    name: 'aether-hub-config',
    encryptionKey: getEncryptionKey()
  });
  private chat: LangChainChat | null = null;
  private currentProvider: string | null = null;
  private history = new Map<string, BaseMessage[]>();

  constructor(private config: AgentConfig, private runner: BrowserRunner) {}

  updateConfig(config: AgentConfig): void {
    this.config = config;
  }

  async handleMessage(chatId: string, text: string): Promise<string[]> {
    console.log(`🧠 LangChain: handling message from ${chatId}: "${text.substring(0, 80)}"`);
    
    const chat = await this.getChatModel();
    console.log(`🧠 LangChain: using provider=${this.currentProvider}`);
    
    const history = this.history.get(chatId) || [];
    const systemPrompt = this.buildSystemPrompt();
    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...history,
      new HumanMessage(text)
    ];

    console.log(`🧠 LangChain: invoking model with ${messages.length} messages...`);
    const response = await chat.invoke(messages);
    const content = (response.content ?? '').toString().trim();
    console.log(`🧠 LangChain: model responded: "${content.substring(0, 200)}"`);

    this.pushHistory(chatId, new HumanMessage(text));

    if (content.includes(RUN_TASK_PREFIX)) {
      const idx = content.indexOf(RUN_TASK_PREFIX);
      const task = content.slice(idx + RUN_TASK_PREFIX.length).trim();
      if (!task) {
        const fallback = 'I could not extract the task. Please rephrase what you want the browser to do.';
        this.pushHistory(chatId, new AIMessage(fallback));
        return [fallback];
      }

      console.log(`🧠 LangChain: detected browser task: "${task.substring(0, 100)}"`);
      const result = await this.runBrowserTask(task);
      this.pushHistory(chatId, new AIMessage(result));
      return [result];
    }

    this.pushHistory(chatId, new AIMessage(content));
    return [content || 'I am not sure how to respond to that yet.'];
  }

  private async runBrowserTask(task: string): Promise<string> {
    const result: AgentTaskResult = await this.runner.run(task, this.config);
    if (result.status === 'completed') {
      return result.output ? `✅ ${result.output}` : '✅ Task completed.';
    }
    return `❌ Task failed: ${result.error || 'Unknown error'}`;
  }

  private pushHistory(chatId: string, message: BaseMessage): void {
    const history = this.history.get(chatId) || [];
    history.push(message);
    if (history.length > MAX_HISTORY_MESSAGES) {
      history.splice(0, history.length - MAX_HISTORY_MESSAGES);
    }
    this.history.set(chatId, history);
  }

  private buildSystemPrompt(): string {
    const name = this.config.name || 'Browser Agent';
    return `You are ${name}, a Telegram-based browser automation assistant.
You can control a real browser to perform web tasks for the user.

Rules:
1. Respond in the same language as the user.
2. When the user wants you to do something in the browser (navigate, click, search, check a website, etc.), respond ONLY with:
${RUN_TASK_PREFIX} <detailed browser task description>
3. For normal conversation or questions that don't need a browser, reply normally. Be concise.
4. Never explain the ${RUN_TASK_PREFIX} prefix to the user. Just use it when appropriate.

Examples:
User: "check my revenue on apify"
You: ${RUN_TASK_PREFIX} Go to apify.com, log in if needed, navigate to the billing/usage page, and report the current revenue/balance.

User: "hello"
You: Hello! How can I help you today?

User: "open youtube and search for cats"
You: ${RUN_TASK_PREFIX} Open youtube.com and search for "cats" in the search bar.`;
  }

  private async getChatModel(): Promise<LangChainChat> {
    const provider = (this.store.get('ai_provider') as string) || 'google';
    if (this.chat && this.currentProvider === provider) {
      return this.chat;
    }

    this.currentProvider = provider;

    if (provider === 'google' || provider === 'gemini') {
      const apiKey = this.store.get('gemini_api_key') as string;
      const model = (this.store.get('gemini_model') as string) || 'gemini-2.5-flash';
      if (!apiKey) {
        throw new Error('Gemini API key not configured. Please add it in Settings.');
      }
      this.chat = new ChatGoogleGenerativeAI({
        apiKey,
        model,
        temperature: 0.3,
        maxOutputTokens: 1024
      });
      return this.chat;
    }

    if (provider === 'openrouter') {
      const apiKey = this.store.get('openrouter_api_key') as string;
      const model = (this.store.get('openrouter_model') as string) || 'x-ai/grok-2-1212';
      if (!apiKey) {
        throw new Error('OpenRouter API key not configured. Please add it in Settings.');
      }
      this.chat = new ChatOpenAI({
        configuration: { baseURL: 'https://openrouter.ai/api/v1' },
        apiKey,
        model,
        temperature: 0.3,
        maxTokens: 1024
      });
      return this.chat;
    }

    if (provider === 'openai') {
      const apiKey = this.store.get('openai_api_key') as string;
      const model = (this.store.get('openai_model') as string) || 'gpt-4o-mini';
      if (!apiKey) {
        throw new Error('OpenAI API key not configured. Please add it in Settings.');
      }
      this.chat = new ChatOpenAI({
        apiKey,
        model,
        temperature: 0.3,
        maxTokens: 1024
      });
      return this.chat;
    }

    if (provider === 'anthropic') {
      const apiKey = this.store.get('anthropic_api_key') as string;
      const model = (this.store.get('anthropic_model') as string) || 'claude-3-5-sonnet-20241022';
      if (!apiKey) {
        throw new Error('Anthropic API key not configured. Please add it in Settings.');
      }
      this.chat = new ChatOpenAI({
        configuration: {
          baseURL: 'https://api.anthropic.com/v1',
          defaultHeaders: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          }
        },
        apiKey,
        model,
        temperature: 0.3,
        maxTokens: 1024
      });
      return this.chat;
    }

    if (provider === 'ollama') {
      const ollamaUrl = (this.store.get('ollama_url') as string) || 'http://localhost:11434';
      const model = (this.store.get('ollama_model') as string) || 'llama3.1';
      this.chat = new ChatOpenAI({
        configuration: { baseURL: `${ollamaUrl}/v1` },
        apiKey: 'ollama',
        model,
        temperature: 0.3,
        maxTokens: 1024
      });
      return this.chat;
    }

    if (provider === 'local') {
      const localUrl = this.store.get('local_ai_url') as string;
      const localKey = (this.store.get('local_ai_key') as string) || 'local';
      const model = (this.store.get('local_ai_model') as string) || 'default';
      if (!localUrl) {
        throw new Error('Local AI endpoint URL not configured. Please add it in Settings.');
      }
      this.chat = new ChatOpenAI({
        configuration: { baseURL: localUrl },
        apiKey: localKey,
        model,
        temperature: 0.3,
        maxTokens: 1024
      });
      return this.chat;
    }

    throw new Error('Unsupported AI provider.');
  }
}
