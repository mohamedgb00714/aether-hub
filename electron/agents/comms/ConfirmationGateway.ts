import { v4 as uuidv4 } from 'uuid';
import type { TelegramBotController } from './TelegramBotController.js';

export interface ConfirmationRequest {
  id: string;
  chatId: string;
  title: string;
  details: string;
  options: { id: string; label: string }[];
  timeoutMs: number;
}

export class ConfirmationGateway {
  private pending = new Map<string, (optionId: string | null) => void>();

  constructor(private bot: TelegramBotController) {}

  async requestConfirmation(request: Omit<ConfirmationRequest, 'id'>): Promise<string | null> {
    const id = uuidv4();
    const payload = {
      id,
      ...request
    };

    const keyboard = {
      inline_keyboard: [
        payload.options.map(option => ({
          text: option.label,
          callback_data: `confirm:${id}:${option.id}`
        }))
      ]
    };

    await this.bot.sendMessage(payload.chatId, `${payload.title}\n\n${payload.details}`, {
      reply_markup: keyboard
    });

    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        resolve(null);
      }, payload.timeoutMs);

      this.pending.set(id, optionId => {
        clearTimeout(timeout);
        this.pending.delete(id);
        resolve(optionId);
      });
    });
  }

  handleCallback(chatId: string, data: string, callbackId: string): boolean {
    if (!data.startsWith('confirm:')) return false;

    const [, requestId, optionId] = data.split(':');
    const resolver = this.pending.get(requestId);
    if (!resolver) return false;

    resolver(optionId || null);
    this.bot.answerCallback(callbackId, 'Received');
    return true;
  }
}
