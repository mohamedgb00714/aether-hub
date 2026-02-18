import type Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import type { AgentConfig, AgentStatus, AgentTaskResult, HubEvent } from '../types.js';
import type { BrowserRunner } from '../runners/BrowserRunner.js';
import { HubToolsBridge } from '../tools/HubToolsBridge.js';
import { ConfirmationGateway } from '../comms/ConfirmationGateway.js';
import { TelegramBotController } from '../comms/TelegramBotController.js';
import { TelegramLangChainAgent } from '../comms/TelegramLangChainAgent.js';
import { EventBus } from '../event-bus/EventBus.js';

export class BrowserAgent {
  private status: AgentStatus = 'stopped';
  private bot: TelegramBotController | null = null;
  private confirmation: ConfirmationGateway | null = null;
  private readonly hubTools = new HubToolsBridge();
  private langchain: TelegramLangChainAgent | null = null;

  constructor(
    private config: AgentConfig,
    private runner: BrowserRunner,
    private eventBus: EventBus,
    private store: Store,
    private onConfigUpdate?: (updates: Partial<AgentConfig>) => Promise<void>,
    private validateTelegramCode?: (code: string) => string | null
  ) {}

  getId(): string {
    return this.config.id;
  }

  getConfig(): AgentConfig {
    return this.config;
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  async start(): Promise<void> {
    if (this.status === 'running') return;
    this.status = 'running';

    if (this.config.browser.persistent) {
      await this.runner.startPersistent?.(this.config);
    }

    const hasChatIds = (this.config.telegramChatIds || []).length > 0;
    const autoAuthorize = this.config.telegramAutoAuthorize !== false;

    if (this.config.telegramBotToken && (hasChatIds || autoAuthorize)) {
      this.bot = new TelegramBotController({
        token: this.config.telegramBotToken,
        authorizedChatIds: this.config.telegramChatIds || [],
        autoAuthorize: this.config.telegramAutoAuthorize !== false,
        onAuthorized: async (chatId: string) => {
          await this.addAuthorizedChatId(chatId);
        }
      });
      this.confirmation = new ConfirmationGateway(this.bot);
      this.langchain = new TelegramLangChainAgent(this.config, this.runner, this.store);
      this.bot.onCallback((chatId, data, callbackId) => {
        if (this.confirmation?.handleCallback(chatId, data, callbackId)) return;
      });
      this.bot.onRawMessage(async (chatId, text) => {
        try {
          if (!this.validateTelegramCode) return;
          const code = this.extractAuthCode(text);
          if (!code) return;
          const agentId = this.validateTelegramCode(code);
          if (agentId !== this.config.id) return;
          await this.addAuthorizedChatId(chatId);
          await this.bot?.sendMessage(chatId, '✅ You are authorized to use this agent.');
        } catch (error: any) {
          console.error(`Agent ${this.config.id} auth code error:`, error);
        }
      });
      this.bot.onMessage(async (chatId, text) => {
        if (!this.langchain) {
          console.warn(`🤖 Agent ${this.config.id}: langchain not initialized, skipping message`);
          return;
        }
        console.log(`🤖 Agent ${this.config.id}: received message from ${chatId}: "${text.substring(0, 80)}"`);
        try {
          const replies = await this.langchain.handleMessage(chatId, text);
          console.log(`🤖 Agent ${this.config.id}: sending ${replies.length} reply(s)`);
          for (const reply of replies) {
            await this.bot?.sendMessage(chatId, reply);
          }
        } catch (error: any) {
          console.error(`❌ Agent ${this.config.id} message handling error:`, error);
          try {
            await this.bot?.sendMessage(chatId, `⚠️ Error: ${error?.message || 'Something went wrong'}`);
          } catch (sendErr) {
            console.error(`❌ Agent ${this.config.id} failed to send error to Telegram:`, sendErr);
          }
        }
      });
      this.bot.start();
    }
  }

  async stop(): Promise<void> {
    this.status = 'stopped';
    this.bot?.stop();
    await this.runner.stopPersistent?.(this.config.id);
  }

  async runTask(task: string): Promise<AgentTaskResult> {
    const result = await this.runner.run(task, this.config);

    this.eventBus.publish({
      id: uuidv4(),
      type: result.status === 'completed' ? 'agent:task_completed' : 'agent:task_failed',
      data: { agentId: this.config.id, task, result },
      createdAt: new Date().toISOString()
    });

    return result;
  }

  async handleEvent(event: HubEvent): Promise<void> {
    if (event.type === 'watch:item_triggered' || event.type === 'watch:action_created') {
      await this.hubTools.notify('Watch event', `Agent ${this.config.name} received a watch event.`);
    }
  }

  getAuthorizedChatIds(): string[] {
    return this.bot?.getAuthorizedChatIds() || this.config.telegramChatIds || [];
  }

  updateConfig(updates: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...updates };
    this.langchain?.updateConfig(this.config);
  }

  private async addAuthorizedChatId(chatId: string): Promise<void> {
    const existing = this.config.telegramChatIds || [];
    if (existing.includes(chatId)) return;

    const updated = [...existing, chatId];
    this.config = { ...this.config, telegramChatIds: updated };
    if (this.onConfigUpdate) {
      await this.onConfigUpdate({ telegramChatIds: updated });
    }
  }

  private extractAuthCode(text: string): string | null {
    const match = text.toUpperCase().match(/AETH-[A-Z0-9]{4,8}/);
    return match ? match[0] : null;
  }
}
