import { Notification } from 'electron';
import { database } from '../../database.js';
import { sendMessage as sendWhatsAppMessage } from '../../whatsapp.js';
import { sendMessage as sendTelegramMessage } from '../../telegram.js';

export class HubToolsBridge {
  async notify(title: string, body: string): Promise<void> {
    new Notification({ title, body }).show();
  }

  async sendWhatsApp(chatId: string, message: string): Promise<boolean> {
    return sendWhatsAppMessage(chatId, message);
  }

  async sendTelegram(chatId: string, message: string): Promise<boolean> {
    return sendTelegramMessage(chatId, message);
  }

  async createWatchAction(payload: {
    id: string;
    watched_item_id: string;
    title: string;
    description?: string;
    priority?: string;
    source_content?: string;
    source_message_ids?: string;
  }): Promise<boolean> {
    return database.watchActions.create(payload);
  }
}
