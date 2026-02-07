/**
 * Telegram Integration Service
 * 
 * ⚠️ DISCLAIMER:
 * This module integrates with Telegram using personal account protocols.
 * Improper use may violate Telegram's Terms of Service.
 * For educational and personal research use only. Use at your own risk.
 * 
 * Handles Telegram authentication via QR code and message fetching
 * Uses telegram library (gramjs/telegram) for personal account access
 * Stores data in SQLite database for persistence
 */

import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { app, BrowserWindow, Notification } from 'electron';
import * as aiService from './ai-service.js';
import { database } from './database.js';
import Store from 'electron-store';
import { NewMessage } from 'telegram/events/index.js';
import { getEncryptionKey } from './security.js';

// Electron store for settings
const store = new Store({
  name: 'aether-hub-storage',
  encryptionKey: getEncryptionKey()
});

// AI Auto-Reply settings interface
interface AIAutoReplySettings {
  enabled: boolean;
  guidelines: string;
  excludeGroups: boolean;
  triggerKeywords: string[];
  sendAsVoice: boolean;
  businessHoursOnly: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
}

// Telegram API credentials (users need to get their own from my.telegram.org)
const API_ID = parseInt(store.get('telegram_api_id', '0') as string) || 0;
const API_HASH = store.get('telegram_api_hash', '') as string;

// Current account ID (set when connected)
let currentAccountId: string | null = null;

// Telegram client instance
let telegramClient: TelegramClient | null = null;
let isClientReady = false;
let currentQRCode: string | null = null;
let authState: 'disconnected' | 'qr' | 'phone' | 'code' | 'password' | 'authenticating' | 'ready' | 'error' = 'disconnected';
let authError: string | null = null;
let pendingPhoneCodeHash: string | null = null;

// Event callbacks
let onQRCodeCallback: ((qr: string) => void) | null = null;
let onReadyCallback: (() => void) | null = null;
let onDisconnectedCallback: (() => void) | null = null;
let onAuthFailureCallback: ((error: string) => void) | null = null;
let onPhoneCodeNeededCallback: (() => void) | null = null;
let onPasswordNeededCallback: (() => void) | null = null;

export interface TelegramMessage {
  id: string;
  chatId: string;
  chatName: string;
  body: string;
  from: string;
  fromName: string;
  timestamp: number;
  isFromMe: boolean;
  hasMedia: boolean;
  type: string;
}

export interface TelegramChat {
  id: string;
  name: string;
  isGroup: boolean;
  isChannel: boolean;
  unreadCount: number;
  lastMessage?: {
    body: string;
    timestamp: number;
    fromMe: boolean;
  };
  timestamp: number;
}

export interface TelegramContact {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  username: string;
}

/**
 * Get the data path for Telegram session storage
 */
function getSessionDataPath(): string {
  return path.join(app.getPath('userData'), '.telegram_session');
}

/**
 * Get saved session string
 */
function getSavedSession(): string {
  const sessionPath = getSessionDataPath();
  try {
    if (fs.existsSync(sessionPath)) {
      return fs.readFileSync(sessionPath, 'utf-8');
    }
  } catch (err) {
    console.error('❌ TELEGRAM: Error reading session:', err);
  }
  return '';
}

/**
 * Save session string
 */
function saveSession(session: string): void {
  const sessionPath = getSessionDataPath();
  try {
    fs.writeFileSync(sessionPath, session, 'utf-8');
    console.log('🟢 TELEGRAM: Session saved');
  } catch (err) {
    console.error('❌ TELEGRAM: Error saving session:', err);
  }
}

/**
 * Check if a saved Telegram session exists
 */
export function hasSession(): boolean {
  const sessionPath = getSessionDataPath();
  console.log('🔵 TELEGRAM: Checking session at:', sessionPath);
  try {
    const exists = fs.existsSync(sessionPath);
    const session = exists ? fs.readFileSync(sessionPath, 'utf-8') : '';
    console.log('🔵 TELEGRAM: Session exists:', exists && session.length > 0);
    return exists && session.length > 0;
  } catch (err) {
    console.error('❌ TELEGRAM: Error checking session:', err);
    return false;
  }
}

/**
 * Check if API credentials are configured
 */
export function hasApiCredentials(): boolean {
  const apiId = parseInt(store.get('telegram_api_id', '0') as string) || 0;
  const apiHash = store.get('telegram_api_hash', '') as string;
  return apiId > 0 && apiHash.length > 0;
}

/**
 * Set API credentials
 */
export function setApiCredentials(apiId: number, apiHash: string): void {
  store.set('telegram_api_id', apiId.toString());
  store.set('telegram_api_hash', apiHash);
}

/**
 * Initialize Telegram client with session persistence
 */
export async function initializeTelegram(): Promise<void> {
  if (telegramClient && isClientReady) {
    console.log('🟡 TELEGRAM: Client already initialized');
    return;
  }

  const apiId = parseInt(store.get('telegram_api_id', '0') as string) || 0;
  const apiHash = store.get('telegram_api_hash', '') as string;

  if (!apiId || !apiHash) {
    throw new Error('Telegram API credentials not configured. Please set API ID and API Hash in Settings.');
  }

  console.log('🔵 TELEGRAM: Initializing client...');
  authState = 'authenticating';
  authError = null;

  try {
    const savedSession = getSavedSession();
    const stringSession = new StringSession(savedSession);

    telegramClient = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
      useWSS: true,
    });

    await telegramClient.start({
      phoneNumber: async () => {
        authState = 'phone';
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(win => {
          win.webContents.send('telegram:phoneNeeded');
        });
        // Wait for phone number from renderer
        return new Promise((resolve) => {
          const checkPhone = setInterval(() => {
            const phone = store.get('telegram_pending_phone') as string;
            if (phone) {
              store.delete('telegram_pending_phone');
              clearInterval(checkPhone);
              resolve(phone);
            }
          }, 500);
        });
      },
      phoneCode: async () => {
        authState = 'code';
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(win => {
          win.webContents.send('telegram:codeNeeded');
        });
        // Wait for code from renderer
        return new Promise((resolve) => {
          const checkCode = setInterval(() => {
            const code = store.get('telegram_pending_code') as string;
            if (code) {
              store.delete('telegram_pending_code');
              clearInterval(checkCode);
              resolve(code);
            }
          }, 500);
        });
      },
      password: async () => {
        authState = 'password';
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(win => {
          win.webContents.send('telegram:passwordNeeded');
        });
        // Wait for password from renderer
        return new Promise((resolve) => {
          const checkPassword = setInterval(() => {
            const password = store.get('telegram_pending_password') as string;
            if (password) {
              store.delete('telegram_pending_password');
              clearInterval(checkPassword);
              resolve(password);
            }
          }, 500);
        });
      },
      onError: (err) => {
        console.error('❌ TELEGRAM: Auth error:', err);
        authError = err.message;
        authState = 'error';
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(win => {
          win.webContents.send('telegram:authFailure', err.message);
        });
      },
    });

    // Save session after successful login
    const sessionString = telegramClient.session.save() as unknown as string;
    saveSession(sessionString);

    // Get user info
    const me = await telegramClient.getMe();
    if (me) {
      const id = me.id?.toString() || 'unknown';
      const phone = (me as any).phone || '';
      const firstName = (me as any).firstName || '';
      const lastName = (me as any).lastName || '';
      const username = (me as any).username || '';
      const name = `${firstName} ${lastName}`.trim() || username || phone;

      currentAccountId = id;

      // Save account to database
      database.telegramAccounts.upsert({
        id,
        phone,
        name,
        username,
        is_connected: true
      });

      console.log(`🟢 TELEGRAM: Account saved - ${name} (${phone})`);
    }

    isClientReady = true;
    authState = 'ready';
    currentQRCode = null;

    if (onReadyCallback) {
      onReadyCallback();
    }

    // Send ready event to renderer
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
      win.webContents.send('telegram:ready');
    });

    // Set up message handler
    telegramClient.addEventHandler(handleNewMessage, new NewMessage({}));

    console.log('🟢 TELEGRAM: Client is ready');

  } catch (error) {
    console.error('❌ TELEGRAM: Failed to initialize client:', error);
    authState = 'error';
    authError = error instanceof Error ? error.message : 'Unknown error';
    throw error;
  }
}

/**
 * Handle new incoming messages
 */
async function handleNewMessage(event: any): Promise<void> {
  try {
    const message = event.message;
    if (!message) return;

    const chat = await message.getChat();
    const sender = await message.getSender();

    const chatId = chat?.id?.toString() || '';
    const chatName = (chat as any)?.title || (chat as any)?.firstName || 'Unknown';
    const isGroup = (chat as any)?.megagroup || (chat as any)?.gigagroup || Boolean((chat as any)?.participantsCount);
    
    let fromName = 'Unknown';
    if (sender) {
      const firstName = (sender as any).firstName || '';
      const lastName = (sender as any).lastName || '';
      fromName = `${firstName} ${lastName}`.trim() || (sender as any).username || 'Unknown';
    }

    const messageData: TelegramMessage = {
      id: message.id?.toString() || '',
      chatId,
      chatName,
      body: message.text || message.message || '',
      from: sender?.id?.toString() || '',
      fromName,
      timestamp: message.date || Math.floor(Date.now() / 1000),
      isFromMe: message.out || false,
      hasMedia: Boolean(message.media),
      type: message.media ? 'media' : 'text'
    };

    // Save message to database
    if (currentAccountId) {
      database.telegramMessages.create({
        id: messageData.id,
        chat_id: messageData.chatId,
        account_id: currentAccountId,
        body: messageData.body,
        from_id: messageData.from,
        from_name: messageData.fromName,
        timestamp: new Date(messageData.timestamp * 1000).toISOString(),
        is_from_me: messageData.isFromMe,
        has_media: messageData.hasMedia,
        message_type: messageData.type
      });

      // Update chat in database
      database.telegramChats.upsert({
        id: messageData.chatId,
        account_id: currentAccountId,
        name: messageData.chatName,
        is_group: isGroup,
        is_channel: Boolean((chat as any)?.broadcast),
        unread_count: messageData.isFromMe ? 0 : 1,
        last_message: messageData.body,
        last_message_time: new Date(messageData.timestamp * 1000).toISOString(),
        last_message_from_me: messageData.isFromMe
      });
    }

    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
      win.webContents.send('telegram:message', messageData);
    });

    // Handle AI auto-reply
    if (!messageData.isFromMe && currentAccountId) {
      handleAIAutoReply(messageData);
    }

    console.log('🔵 TELEGRAM: New message received from', messageData.fromName);
  } catch (err) {
    console.error('❌ TELEGRAM: Error processing message:', err);
  }
}

/**
 * Check if Telegram client is ready
 */
export function isTelegramReady(): boolean {
  return isClientReady && telegramClient !== null;
}

/**
 * Get current authentication state
 */
export function getAuthState(): { state: string; qrCode: string | null; error: string | null } {
  return {
    state: authState,
    qrCode: currentQRCode,
    error: authError
  };
}

/**
 * Submit phone number for authentication
 */
export function submitPhoneNumber(phone: string): void {
  store.set('telegram_pending_phone', phone);
}

/**
 * Submit verification code
 */
export function submitCode(code: string): void {
  store.set('telegram_pending_code', code);
}

/**
 * Submit 2FA password
 */
export function submitPassword(password: string): void {
  store.set('telegram_pending_password', password);
}

/**
 * Logout and destroy session
 */
export async function logoutTelegram(): Promise<void> {
  if (!telegramClient) {
    console.log('🟡 TELEGRAM: No client to logout');
    return;
  }

  console.log('🔵 TELEGRAM: Logging out...');

  try {
    await telegramClient.invoke(new Api.auth.LogOut());
  } catch (err) {
    console.error('❌ TELEGRAM: Error during logout:', err);
  }

  // Delete session file
  const sessionPath = getSessionDataPath();
  try {
    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath);
    }
  } catch (err) {
    console.error('❌ TELEGRAM: Error deleting session:', err);
  }

  // Update database
  if (currentAccountId) {
    database.telegramAccounts.setConnected(currentAccountId, false);
  }

  telegramClient = null;
  isClientReady = false;
  authState = 'disconnected';
  currentQRCode = null;
  authError = null;
  currentAccountId = null;

  console.log('🟢 TELEGRAM: Logged out successfully');
}

/**
 * Destroy client without logging out (keeps session)
 */
export async function destroyTelegram(): Promise<void> {
  if (!telegramClient) {
    return;
  }

  console.log('🔵 TELEGRAM: Destroying client...');

  try {
    await telegramClient.disconnect();
  } catch (err) {
    console.error('❌ TELEGRAM: Error during destroy:', err);
  }

  telegramClient = null;
  isClientReady = false;
  authState = 'disconnected';

  console.log('🟢 TELEGRAM: Client destroyed');
}

/**
 * Get all dialogs (chats)
 */
export async function getChats(limit: number = 50): Promise<TelegramChat[]> {
  if (!isClientReady || !telegramClient) {
    throw new Error('Telegram client is not ready');
  }

  console.log('🔵 TELEGRAM: Fetching chats...');

  try {
    const dialogs = await telegramClient.getDialogs({ limit });

    const formattedChats: TelegramChat[] = dialogs.map((dialog) => {
      const entity = dialog.entity;
      const isGroup = Boolean((entity as any)?.megagroup || (entity as any)?.gigagroup || (entity as any)?.participantsCount);
      const isChannel = Boolean((entity as any)?.broadcast);

      return {
        id: dialog.id?.toString() || '',
        name: dialog.title || dialog.name || 'Unknown',
        isGroup,
        isChannel,
        unreadCount: dialog.unreadCount || 0,
        timestamp: dialog.date || 0,
        lastMessage: dialog.message ? {
          body: dialog.message.text || dialog.message.message || '',
          timestamp: dialog.message.date || 0,
          fromMe: dialog.message.out || false
        } : undefined
      };
    });

    // Save chats to database
    if (currentAccountId && formattedChats.length > 0) {
      database.telegramChats.bulkUpsert(
        formattedChats.map(chat => ({
          id: chat.id,
          account_id: currentAccountId!,
          name: chat.name,
          is_group: chat.isGroup,
          is_channel: chat.isChannel,
          unread_count: chat.unreadCount,
          last_message: chat.lastMessage?.body,
          last_message_time: chat.lastMessage?.timestamp ? new Date(chat.lastMessage.timestamp * 1000).toISOString() : undefined,
          last_message_from_me: chat.lastMessage?.fromMe
        }))
      );
    }

    console.log(`🟢 TELEGRAM: Fetched ${formattedChats.length} chats`);
    return formattedChats;
  } catch (error) {
    console.error('❌ TELEGRAM: Failed to fetch chats:', error);
    throw error;
  }
}

/**
 * Get messages from a specific chat
 */
export async function getChatMessages(chatId: string, limit: number = 50): Promise<TelegramMessage[]> {
  if (!isClientReady || !telegramClient) {
    throw new Error('Telegram client is not ready');
  }

  console.log(`🔵 TELEGRAM: Fetching messages for chat ${chatId}...`);

  try {
    const entity = await telegramClient.getEntity(chatId);
    const messages = await telegramClient.getMessages(entity, { limit });

    const formattedMessages: TelegramMessage[] = [];

    for (const msg of messages) {
      const sender = await msg.getSender();
      let fromName = 'Unknown';
      if (sender) {
        const firstName = (sender as any).firstName || '';
        const lastName = (sender as any).lastName || '';
        fromName = `${firstName} ${lastName}`.trim() || (sender as any).username || 'Unknown';
      }
      if (msg.out) fromName = 'You';

      formattedMessages.push({
        id: msg.id?.toString() || '',
        chatId,
        chatName: (entity as any)?.title || (entity as any)?.firstName || 'Unknown',
        body: msg.text || msg.message || '',
        from: sender?.id?.toString() || '',
        fromName,
        timestamp: msg.date || 0,
        isFromMe: msg.out || false,
        hasMedia: Boolean(msg.media),
        type: msg.media ? 'media' : 'text'
      });
    }

    // Save messages to database
    if (currentAccountId && formattedMessages.length > 0) {
      database.telegramMessages.bulkCreate(
        formattedMessages.map(msg => ({
          id: msg.id,
          chat_id: msg.chatId,
          account_id: currentAccountId!,
          body: msg.body,
          from_id: msg.from,
          from_name: msg.fromName,
          timestamp: new Date(msg.timestamp * 1000).toISOString(),
          is_from_me: msg.isFromMe,
          has_media: msg.hasMedia,
          message_type: msg.type
        }))
      );
    }

    console.log(`🟢 TELEGRAM: Fetched ${formattedMessages.length} messages`);

    // Sort by timestamp ascending (oldest first)
    return formattedMessages.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('❌ TELEGRAM: Failed to fetch messages:', error);
    throw error;
  }
}

/**
 * Get recent messages across all chats
 */
export async function getRecentMessages(limit: number = 100): Promise<TelegramMessage[]> {
  if (!isClientReady || !telegramClient) {
    throw new Error('Telegram client is not ready');
  }

  console.log('🔵 TELEGRAM: Fetching recent messages...');

  try {
    const dialogs = await telegramClient.getDialogs({ limit: 20 });
    const allMessages: TelegramMessage[] = [];

    for (const dialog of dialogs) {
      if (allMessages.length >= limit) break;

      try {
        const entity = dialog.entity;
        const messages = await telegramClient.getMessages(entity, { limit: 10 });

        for (const msg of messages) {
          if (allMessages.length >= limit) break;

          const sender = await msg.getSender();
          let fromName = 'Unknown';
          if (sender) {
            const firstName = (sender as any).firstName || '';
            const lastName = (sender as any).lastName || '';
            fromName = `${firstName} ${lastName}`.trim() || (sender as any).username || 'Unknown';
          }
          if (msg.out) fromName = 'You';

          allMessages.push({
            id: msg.id?.toString() || '',
            chatId: dialog.id?.toString() || '',
            chatName: dialog.title || dialog.name || 'Unknown',
            body: msg.text || msg.message || '',
            from: sender?.id?.toString() || '',
            fromName,
            timestamp: msg.date || 0,
            isFromMe: msg.out || false,
            hasMedia: Boolean(msg.media),
            type: msg.media ? 'media' : 'text'
          });
        }
      } catch (err) {
        console.warn(`⚠️ TELEGRAM: Failed to fetch messages from dialog`);
      }
    }

    // Sort by timestamp descending
    allMessages.sort((a, b) => b.timestamp - a.timestamp);

    console.log(`🟢 TELEGRAM: Fetched ${allMessages.length} recent messages`);
    return allMessages.slice(0, limit);
  } catch (error) {
    console.error('❌ TELEGRAM: Failed to fetch recent messages:', error);
    throw error;
  }
}

/**
 * Get contacts
 */
export async function getContacts(): Promise<TelegramContact[]> {
  if (!isClientReady || !telegramClient) {
    throw new Error('Telegram client is not ready');
  }

  console.log('🔵 TELEGRAM: Fetching contacts...');

  try {
    // Use 0 for initial contacts fetch
    const result = await telegramClient.invoke(new Api.contacts.GetContacts({ hash: 0 as any }));
    
    if (result instanceof Api.contacts.Contacts) {
      const formattedContacts: TelegramContact[] = result.users.map((user) => ({
        id: (user as any).id?.toString() || '',
        firstName: (user as any).firstName || '',
        lastName: (user as any).lastName || '',
        phone: (user as any).phone || '',
        username: (user as any).username || ''
      }));

      console.log(`🟢 TELEGRAM: Fetched ${formattedContacts.length} contacts`);
      return formattedContacts;
    }

    return [];
  } catch (error) {
    console.error('❌ TELEGRAM: Failed to fetch contacts:', error);
    throw error;
  }
}

/**
 * Get user info
 */
export async function getTelegramInfo(): Promise<{ name: string; phone: string; username: string } | null> {
  if (!isClientReady || !telegramClient) {
    return null;
  }

  try {
    const me = await telegramClient.getMe();
    const firstName = (me as any)?.firstName || '';
    const lastName = (me as any)?.lastName || '';
    return {
      name: `${firstName} ${lastName}`.trim() || (me as any)?.username || 'Telegram User',
      phone: (me as any)?.phone || '',
      username: (me as any)?.username || ''
    };
  } catch (error) {
    console.error('❌ TELEGRAM: Failed to get user info:', error);
    return null;
  }
}

/**
 * Send a text message
 */
export async function sendMessage(chatId: string, message: string): Promise<boolean> {
  if (!isClientReady || !telegramClient) {
    throw new Error('Telegram client is not ready');
  }

  console.log(`🔵 TELEGRAM: Sending message to ${chatId}...`);

  try {
    const entity = await telegramClient.getEntity(chatId);
    await telegramClient.sendMessage(entity, { message });
    console.log('🟢 TELEGRAM: Message sent successfully');
    return true;
  } catch (error) {
    console.error('❌ TELEGRAM: Failed to send message:', error);
    throw error;
  }
}

/**
 * Send a media message
 */
export async function sendMedia(
  chatId: string,
  mediaBase64: string,
  mimetype: string,
  filename?: string,
  caption?: string
): Promise<boolean> {
  if (!isClientReady || !telegramClient) {
    throw new Error('Telegram client is not ready');
  }

  console.log(`🔵 TELEGRAM: Sending media to ${chatId}... (${mimetype})`);

  try {
    const entity = await telegramClient.getEntity(chatId);
    const buffer = Buffer.from(mediaBase64, 'base64');
    
    await telegramClient.sendFile(entity, {
      file: buffer,
      caption,
      attributes: filename ? [new Api.DocumentAttributeFilename({ fileName: filename })] : undefined,
      forceDocument: !mimetype.startsWith('image/') && !mimetype.startsWith('video/')
    });

    console.log('🟢 TELEGRAM: Media sent successfully');
    return true;
  } catch (error) {
    console.error('❌ TELEGRAM: Failed to send media:', error);
    throw error;
  }
}

/**
 * Mark messages as read
 */
export async function markAsRead(chatId: string): Promise<void> {
  if (!isClientReady || !telegramClient) {
    throw new Error('Telegram client is not ready');
  }

  try {
    const entity = await telegramClient.getEntity(chatId);
    await telegramClient.markAsRead(entity);
    console.log(`🟢 TELEGRAM: Marked chat ${chatId} as read`);
  } catch (error) {
    console.error('❌ TELEGRAM: Failed to mark as read:', error);
    throw error;
  }
}

// Export event callback setters
export function setOnQRCodeCallback(callback: (qr: string) => void): void {
  onQRCodeCallback = callback;
}

export function setOnReadyCallback(callback: () => void): void {
  onReadyCallback = callback;
}

export function setOnDisconnectedCallback(callback: () => void): void {
  onDisconnectedCallback = callback;
}

export function setOnAuthFailureCallback(callback: (error: string) => void): void {
  onAuthFailureCallback = callback;
}

/**
 * Call AI from main process using centralized AI service
 */
async function callAIFromMain(prompt: string): Promise<string | null> {
  try {
    const now = new Date();
    const dateText = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeText = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const temporalContext = `Current Date: ${dateText}. Current Time: ${timeText}.`;

    const systemInstruction = `You are a helpful assistant that generates concise, professional responses.\n\n[Temporal Context]\n${temporalContext}`;

    return await aiService.generateChatResponse(prompt, systemInstruction);
  } catch (error) {
    console.error('❌ TELEGRAM AI: Failed to generate response:', error);
    return null;
  }
}

/**
 * Handle AI auto-reply for incoming messages
 */
async function handleAIAutoReply(message: TelegramMessage): Promise<void> {
  try {
    const settings = store.get('telegram_ai_settings') as AIAutoReplySettings | undefined;

    if (!settings?.enabled) {
      return;
    }

    console.log('🤖 TELEGRAM AI: Processing message for auto-reply...');

    // Skip group messages if configured
    if (settings.excludeGroups && message.chatId.includes('-')) {
      console.log('⏭️ TELEGRAM AI: Skipping group message');
      return;
    }

    // Check business hours if configured
    if (settings.businessHoursOnly) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      if (currentTime < settings.businessHoursStart || currentTime > settings.businessHoursEnd) {
        console.log('⏭️ TELEGRAM AI: Outside business hours');
        return;
      }
    }

    // Check trigger keywords if any
    if (settings.triggerKeywords && settings.triggerKeywords.length > 0) {
      const msgLower = message.body.toLowerCase();
      const hasKeyword = settings.triggerKeywords.some(kw => msgLower.includes(kw.toLowerCase()));
      if (!hasKeyword) {
        console.log('⏭️ TELEGRAM AI: No trigger keyword found');
        return;
      }
    }

    // Generate AI response
    const prompt = `${settings.guidelines || 'You are a helpful assistant.'}

---
Incoming message from ${message.fromName}:
"${message.body}"

Generate a helpful, professional response. Keep it concise (1-3 sentences). Only output the response text, nothing else.`;

    const response = await callAIFromMain(prompt);

    if (response && telegramClient && isClientReady) {
      console.log('📤 TELEGRAM AI: Sending auto-reply:', response.substring(0, 50) + '...');

      await sendMessage(message.chatId, response);
      console.log('✅ TELEGRAM AI: Auto-reply sent successfully');

      // Save AI response to database
      if (currentAccountId) {
        database.telegramMessages.updateAIResponse(message.id, response);
      }

      // Show notification
      new Notification({
        title: 'Telegram AI Reply Sent',
        body: `Replied to ${message.fromName}: ${response.substring(0, 50)}...`
      }).show();
    }
  } catch (error) {
    console.error('❌ TELEGRAM AI: Auto-reply failed:', error);
  }
}
