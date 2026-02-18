import { EventEmitter } from 'node:events';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number } };
  };
}

export interface TelegramBotConfig {
  token: string;
  authorizedChatIds: string[];
  autoAuthorize?: boolean;
  onAuthorized?: (chatId: string) => void;
}

export class TelegramBotController {
  private readonly token: string;
  private readonly authorizedChatIds: Set<string>;
  private readonly autoAuthorize: boolean;
  private readonly onAuthorized?: (chatId: string) => void;
  private offset = 0;
  private pollingTimer: NodeJS.Timeout | null = null;
  private emitter = new EventEmitter();

  constructor(config: TelegramBotConfig) {
    this.token = config.token;
    this.authorizedChatIds = new Set(config.authorizedChatIds || []);
    this.autoAuthorize = !!config.autoAuthorize;
    this.onAuthorized = config.onAuthorized;
  }

  start(): void {
    if (this.pollingTimer) return;
    this.pollingTimer = setInterval(() => this.pollUpdates(), 2000);
  }

  stop(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  onMessage(handler: (chatId: string, text: string) => void): () => void {
    this.emitter.on('message', handler);
    return () => this.emitter.removeListener('message', handler);
  }

  onRawMessage(handler: (chatId: string, text: string) => void): () => void {
    this.emitter.on('rawMessage', handler);
    return () => this.emitter.removeListener('rawMessage', handler);
  }

  onCallback(handler: (chatId: string, data: string, callbackId: string) => void): () => void {
    this.emitter.on('callback', handler);
    return () => this.emitter.removeListener('callback', handler);
  }

  async sendMessage(chatId: string, text: string, extra?: any): Promise<void> {
    await this.post('sendMessage', {
      chat_id: chatId,
      text,
      ...extra
    });
  }

  async answerCallback(callbackId: string, text?: string): Promise<void> {
    await this.post('answerCallbackQuery', {
      callback_query_id: callbackId,
      text
    });
  }

  private async pollUpdates(): Promise<void> {
    try {
      const response = await this.get('getUpdates', {
        offset: this.offset + 1,
        timeout: 0
      });

      if (!response.ok) return;

      const updates = response.result as TelegramUpdate[];
      for (const update of updates) {
        this.offset = Math.max(this.offset, update.update_id);

        if (update.message?.text && update.message.chat?.id) {
          const chatId = update.message.chat.id.toString();
          this.emitter.emit('rawMessage', chatId, update.message.text);
          if (!this.isAuthorized(chatId) && this.autoAuthorize) {
            this.addAuthorized(chatId);
          }
          if (this.isAuthorized(chatId)) {
            this.emitter.emit('message', chatId, update.message.text);
          }
        }

        if (update.callback_query?.data && update.callback_query.message?.chat?.id) {
          const chatId = update.callback_query.message.chat.id.toString();
          if (!this.isAuthorized(chatId) && this.autoAuthorize) {
            this.addAuthorized(chatId);
          }
          if (this.isAuthorized(chatId)) {
            this.emitter.emit('callback', chatId, update.callback_query.data, update.callback_query.id);
          }
        }
      }
    } catch (error) {
      console.warn('Telegram polling failed:', error);
    }
  }

  getAuthorizedChatIds(): string[] {
    return Array.from(this.authorizedChatIds);
  }

  private isAuthorized(chatId: string): boolean {
    return this.authorizedChatIds.has(chatId);
  }

  private addAuthorized(chatId: string): void {
    if (this.authorizedChatIds.has(chatId)) return;
    this.authorizedChatIds.add(chatId);
    if (this.onAuthorized) {
      this.onAuthorized(chatId);
    }
  }

  private async get(method: string, params: Record<string, any>) {
    const url = new URL(`https://api.telegram.org/bot${this.token}/${method}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));

    const response = await fetch(url.toString());
    return response.json();
  }

  private async post(method: string, payload: Record<string, any>) {
    const response = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.json();
  }
}
