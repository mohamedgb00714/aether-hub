/**
 * WhatsApp Web.js Integration Service
 * 
 * ⚠️ DISCLAIMER:
 * This module uses unofficial WhatsApp automation methods via Puppeteer.
 * Using this may violate WhatsApp's Terms of Service and result in account bans.
 * For educational and personal research use only. Use at your own risk.
 * 
 * Handles WhatsApp authentication via QR code and message fetching
 * Uses whatsapp-web.js library with Puppeteer for browser automation
 * Stores data in SQLite database for persistence
 */

// CommonJS module import for whatsapp-web.js
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
type Message = pkg.Message;
type Chat = pkg.Chat;
type Contact = pkg.Contact;

import QRCode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs';
import * as aiService from './ai-service.js';
import { app, BrowserWindow, Notification } from 'electron';
import { database } from './database.js';
import Store from 'electron-store';
import { execSync } from 'child_process';
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

// Current account ID (set when connected)
let currentAccountId: string | null = null;

// WhatsApp client instance
let whatsappClient: InstanceType<typeof Client> | null = null;
let isClientReady = false;
let currentQRCode: string | null = null;
let authState: 'disconnected' | 'qr' | 'authenticating' | 'ready' | 'error' = 'disconnected';
let authError: string | null = null;

// Event callbacks
let onQRCodeCallback: ((qr: string) => void) | null = null;
let onReadyCallback: (() => void) | null = null;
let onDisconnectedCallback: (() => void) | null = null;
let onAuthFailureCallback: ((error: string) => void) | null = null;

export interface WhatsAppMessage {
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

export interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  unreadCount: number;
  lastMessage?: {
    body: string;
    timestamp: number;
    fromMe: boolean;
  };
  timestamp: number;
}

export interface WhatsAppContact {
  id: string;
  name: string;
  pushname: string;
  number: string;
  isMyContact: boolean;
  isGroup: boolean;
  profilePicUrl?: string;
}

/**
 * Get the data path for WhatsApp session storage
 */
function getSessionDataPath(): string {
  return path.join(app.getPath('userData'), '.wwebjs_auth');
}

/**
 * Check if a saved WhatsApp session exists
 */
export function hasSession(): boolean {
  const sessionDataPath = getSessionDataPath();
  const sessionPath = path.join(sessionDataPath, 'session-aether-hub-whatsapp');
  
  console.log('🔵 WHATSAPP: Checking session at:', sessionDataPath);
  console.log('🔵 WHATSAPP: Session folder:', sessionPath);
  
  try {
    // Check if session directory exists
    if (fs.existsSync(sessionPath)) {
      console.log('🟢 WHATSAPP: Session exists');
      return true;
    }
    
    // Also check for .wwebjs_auth directory (created by whatsapp-web.js)
    if (fs.existsSync(sessionDataPath)) {
      const files = fs.readdirSync(sessionDataPath);
      console.log('🔵 WHATSAPP: Files in auth directory:', files);
      
      // Check if there are any session files
      const hasSessionFiles = files.some(file => file.startsWith('session-'));
      if (hasSessionFiles) {
        console.log('🟢 WHATSAPP: Session files found');
        return true;
      }
    }
    
    console.log('🔴 WHATSAPP: No session found');
    return false;
  } catch (err) {
    console.error('❌ WHATSAPP: Error checking session:', err);
    return false;
  }
}

/**
 * Initialize WhatsApp client with LocalAuth for session persistence
 */
export async function initializeWhatsApp(): Promise<void> {
  // If client exists and is ready, just notify UI
  if (whatsappClient && isClientReady) {
    console.log('🟢 WHATSAPP: Client already initialized and ready');
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
      win.webContents.send('whatsapp:ready');
    });
    return;
  }
  
  // If client is initializing, wait for it
  if (whatsappClient && !isClientReady) {
    console.log('🟡 WHATSAPP: Client is initializing, please wait...');
    return;
  }

  console.log('🔵 WHATSAPP: Initializing client...');
  authState = 'authenticating';
  authError = null;

  try {
    // Find system Chrome/Chromium (required even in dev for whatsapp-web.js)
    const getChromePath = (): string | undefined => {
      // Common Chrome/Chromium paths on Linux
      const linuxPaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
        '/var/lib/flatpak/exports/bin/com.google.Chrome',
      ];
      
      // macOS paths
      const macPaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ];
      
      // Windows paths
      const winPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      ];
      
      const paths = process.platform === 'darwin' ? macPaths 
                  : process.platform === 'win32' ? winPaths 
                  : linuxPaths;
      
      for (const chromePath of paths) {
        if (fs.existsSync(chromePath)) {
          console.log('🔵 WHATSAPP: Found Chrome at:', chromePath);
          return chromePath;
        }
      }
      
      console.warn('⚠️ WHATSAPP: No Chrome/Chromium found, puppeteer may fail');
      return undefined;
    };
    
    const chromePath = getChromePath();
    
    // Cleanup stale lock files if they exist (common issue with Chromium/Puppeteer)
    // This prevents "Failed to create a ProcessSingleton" errors on launch
    try {
      const sessionPath = path.join(getSessionDataPath(), 'session-aether-hub-whatsapp');
      const lockFiles = [
        path.join(sessionPath, 'SingletonLock'),
        path.join(sessionPath, 'Default', 'SingletonLock'),
        path.join(sessionPath, 'lockfile')
      ];
      
      lockFiles.forEach(lockPath => {
        if (fs.existsSync(lockPath)) {
          console.log('🔵 WHATSAPP: Removing stale lock file:', lockPath);
          try {
            fs.unlinkSync(lockPath);
          } catch (err) {
            console.warn('⚠️ WHATSAPP: Could not remove lock file:', err);
          }
        }
      });
      
      // Also try to kill any stray Chrome processes for this userDataDir
      if (process.platform === 'linux') {
        try {
          // Find and kill Chrome processes using our user data directory
          execSync(`pkill -f "chrome.*${sessionPath}" || true`, { stdio: 'ignore' });
          console.log('🔵 WHATSAPP: Cleaned up stray Chrome processes');
        } catch (err) {
          // Ignore errors - process might not exist
        }
      }
    } catch (err) {
      console.warn('⚠️ WHATSAPP: Error during lock file cleanup:', err);
    }
    
    whatsappClient = new Client({
      authStrategy: new LocalAuth({
        dataPath: getSessionDataPath(),
        clientId: 'aether-hub-whatsapp'
      }),
      puppeteer: {
        headless: true,
        executablePath: chromePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    // QR Code event - emitted when QR code needs to be scanned
    whatsappClient.on('qr', async (qr: string) => {
      console.log('🔵 WHATSAPP: QR Code received');
      authState = 'qr';
      
      try {
        // Generate QR code as data URL for display in UI
        currentQRCode = await QRCode.toDataURL(qr, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
        
        if (onQRCodeCallback) {
          onQRCodeCallback(currentQRCode);
        }
        
        // Send to renderer
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(win => {
          win.webContents.send('whatsapp:qr', currentQRCode);
        });
      } catch (err) {
        console.error('❌ WHATSAPP: Failed to generate QR code:', err);
      }
    });

    // Authenticated event - QR code scanned successfully
    whatsappClient.on('authenticated', () => {
      console.log('🟢 WHATSAPP: Authenticated successfully');
      authState = 'authenticating';
      currentQRCode = null;
    });

    // Ready event - client is ready to use
    whatsappClient.on('ready', async () => {
      console.log('🟢 WHATSAPP: Client is ready');
      isClientReady = true;
      authState = 'ready';
      currentQRCode = null;
      
      // Get account info and save to database
      try {
        const info = await whatsappClient!.info;
        if (info) {
          const wid = info.wid?._serialized || info.wid?.user || 'unknown';
          const phone = info.wid?.user || 'unknown';
          const name = info.pushname || phone;
          
          currentAccountId = wid;
          
          // Save/update account in database
          database.whatsappAccounts.upsert({
            id: wid,
            phone: phone,
            name: name,
            is_connected: true
          });
          
          console.log(`🟢 WHATSAPP: Account saved - ${name} (${phone})`);
        }
      } catch (err) {
        console.error('❌ WHATSAPP: Failed to save account info:', err);
      }
      
      if (onReadyCallback) {
        onReadyCallback();
      }
      
      // Send ready event to renderer
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(win => {
        win.webContents.send('whatsapp:ready');
      });
    });

    // Auth failure event
    whatsappClient.on('auth_failure', (msg: string) => {
      console.error('❌ WHATSAPP: Authentication failed:', msg);
      authState = 'error';
      authError = msg;
      isClientReady = false;
      
      if (onAuthFailureCallback) {
        onAuthFailureCallback(msg);
      }
      
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(win => {
        win.webContents.send('whatsapp:authFailure', msg);
      });
    });

    // Disconnected event
    whatsappClient.on('disconnected', (reason: string) => {
      console.log('🟡 WHATSAPP: Disconnected:', reason);
      isClientReady = false;
      authState = 'disconnected';
      
      // Update database
      if (currentAccountId) {
        database.whatsappAccounts.setConnected(currentAccountId, false);
      }
      currentAccountId = null;
      whatsappClient = null;
      
      if (onDisconnectedCallback) {
        onDisconnectedCallback();
      }
      
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(win => {
        win.webContents.send('whatsapp:disconnected', reason);
      });
    });

    // Message event for real-time notifications
    whatsappClient.on('message', async (msg: Message) => {
      console.log('🔵 WHATSAPP: New message received');
      
      try {
        const chat = await msg.getChat();
        
        // Extract sender name without using getContact (which can fail)
        let fromName = 'Unknown';
        try {
          // Try to get notifyName from message data (most reliable)
          if ((msg as any)._data?.notifyName) {
            fromName = (msg as any)._data.notifyName;
          } else if (msg.fromMe) {
            fromName = 'You';
          } else if (msg.author) {
            // For group messages, use author phone number
            fromName = msg.author.split('@')[0];
          } else {
            // Use from field, extract phone number
            fromName = msg.from?.split('@')[0] || 'Unknown';
          }
        } catch {
          // Keep fallback name
        }
        
        const messageData: WhatsAppMessage = {
          id: msg.id._serialized,
          chatId: chat.id._serialized,
          chatName: chat.name || fromName || 'Unknown',
          body: msg.body,
          from: msg.from,
          fromName: fromName,
          timestamp: msg.timestamp,
          isFromMe: msg.fromMe,
          hasMedia: msg.hasMedia,
          type: msg.type
        };
        
        // Save message to database
        if (currentAccountId) {
          database.whatsappMessages.create({
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
          database.whatsappChats.upsert({
            id: messageData.chatId,
            account_id: currentAccountId,
            name: messageData.chatName,
            is_group: messageData.chatId.includes('@g.us'),
            unread_count: messageData.isFromMe ? 0 : 1,
            last_message: messageData.body,
            last_message_time: new Date(messageData.timestamp * 1000).toISOString(),
            last_message_from_me: messageData.isFromMe
          });
        }
        
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(win => {
          win.webContents.send('whatsapp:message', messageData);
        });
        
        // Handle AI auto-reply in main process (works even when WhatsApp page is closed)
        if (!messageData.isFromMe && currentAccountId) {
          handleAIAutoReply(messageData);
        }
      } catch (err) {
        console.error('❌ WHATSAPP: Error processing message:', err);
      }
    });

    // Initialize the client
    await whatsappClient.initialize();
    console.log('🔵 WHATSAPP: Client initialization started');

  } catch (error) {
    console.error('❌ WHATSAPP: Failed to initialize client:', error);
    authState = 'error';
    authError = error instanceof Error ? error.message : 'Unknown error';
    throw error;
  }
}

/**
 * Check if WhatsApp client is ready
 */
export function isWhatsAppReady(): boolean {
  return isClientReady && whatsappClient !== null;
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
 * Get current QR code if available
 */
export function getCurrentQRCode(): string | null {
  return currentQRCode;
}

/**
 * Logout and destroy session
 */
export async function logoutWhatsApp(): Promise<void> {
  if (!whatsappClient) {
    console.log('🟡 WHATSAPP: No client to logout');
    return;
  }

  console.log('🔵 WHATSAPP: Logging out...');
  
  try {
    await whatsappClient.logout();
    await whatsappClient.destroy();
  } catch (err) {
    console.error('❌ WHATSAPP: Error during logout:', err);
  }
  
  whatsappClient = null;
  isClientReady = false;
  authState = 'disconnected';
  currentQRCode = null;
  authError = null;
  
  console.log('🟢 WHATSAPP: Logged out successfully');
}

/**
 * Destroy client without logging out (keeps session)
 */
export async function destroyWhatsApp(): Promise<void> {
  if (!whatsappClient) {
    console.log('🔵 WHATSAPP: No client to destroy');
    return;
  }

  console.log('🔵 WHATSAPP: Destroying client...');
  
  try {
    // Force destroy the client regardless of state to ensure browser closes
    // Use a timeout to prevent hanging
    const destroyPromise = whatsappClient.destroy();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Destroy timeout')), 5000)
    );
    
    await Promise.race([destroyPromise, timeoutPromise]).catch(err => {
      console.warn('⚠️ WHATSAPP: Destroy timed out or failed:', err);
      // Force kill the puppeteer browser if it exists
      try {
        const pupPage = (whatsappClient as any).pupPage;
        const pupBrowser = (whatsappClient as any).pupBrowser;
        if (pupBrowser) {
          pupBrowser.close().catch(() => {});
        }
        if (pupPage) {
          pupPage.close().catch(() => {});
        }
      } catch (e) {
        console.warn('⚠️ WHATSAPP: Could not force close browser:', e);
      }
    });
    
    console.log('🟢 WHATSAPP: Client destroyed successfully');
  } catch (err) {
    console.error('❌ WHATSAPP: Error during destroy:', err);
  }
  
  whatsappClient = null;
  isClientReady = false;
  authState = 'disconnected';
  
  console.log('🟢 WHATSAPP: Client cleanup complete');
}

/**
 * Get all chats with recent messages
 */
export async function getChats(limit: number = 50): Promise<WhatsAppChat[]> {
  if (!isClientReady || !whatsappClient) {
    throw new Error('WhatsApp client is not ready');
  }

  console.log('🔵 WHATSAPP: Fetching chats...');
  
  try {
    const chats = await whatsappClient.getChats();
    const limitedChats = chats.slice(0, limit);
    
    const formattedChats: WhatsAppChat[] = await Promise.all(
      limitedChats.map(async (chat: Chat) => {
        const lastMsg = chat.lastMessage;
        
        return {
          id: chat.id._serialized,
          name: chat.name || 'Unknown',
          isGroup: chat.isGroup,
          unreadCount: chat.unreadCount,
          timestamp: chat.timestamp || 0,
          lastMessage: lastMsg ? {
            body: lastMsg.body || '',
            timestamp: lastMsg.timestamp || 0,
            fromMe: lastMsg.fromMe || false
          } : undefined
        };
      })
    );

    // Save chats to database
    if (currentAccountId && formattedChats.length > 0) {
      database.whatsappChats.bulkUpsert(
        formattedChats.map(chat => ({
          id: chat.id,
          account_id: currentAccountId!,
          name: chat.name,
          is_group: chat.isGroup,
          unread_count: chat.unreadCount,
          last_message: chat.lastMessage?.body,
          last_message_time: chat.lastMessage?.timestamp ? new Date(chat.lastMessage.timestamp * 1000).toISOString() : undefined,
          last_message_from_me: chat.lastMessage?.fromMe
        }))
      );
    }

    console.log(`🟢 WHATSAPP: Fetched ${formattedChats.length} chats`);
    return formattedChats;
  } catch (error) {
    console.error('❌ WHATSAPP: Failed to fetch chats:', error);
    throw error;
  }
}

/**
 * Get messages from a specific chat
 */
export async function getChatMessages(chatId: string, limit: number = 50): Promise<WhatsAppMessage[]> {
  if (!isClientReady || !whatsappClient) {
    throw new Error('WhatsApp client is not ready');
  }

  console.log(`🔵 WHATSAPP: Fetching messages for chat ${chatId}...`);
  
  try {
    const chat = await whatsappClient.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit });
    
    const formattedMessages: WhatsAppMessage[] = messages.map((msg: Message) => {
      // Get sender name from message author info (avoid getContact which can fail)
      let fromName = 'Unknown';
      try {
        // For group chats, use author info
        if (msg.author) {
          fromName = msg.author.split('@')[0]; // Use phone number as fallback
        } else if (msg.fromMe) {
          fromName = 'You';
        } else {
          // Use the from field, extract phone number
          fromName = msg.from?.split('@')[0] || 'Unknown';
        }
        // Try to get notifyName if available (sender's display name)
        if ((msg as any)._data?.notifyName) {
          fromName = (msg as any)._data.notifyName;
        }
      } catch {
        // Keep fallback name
      }
      
      return {
        id: msg.id._serialized,
        chatId: chatId,
        chatName: chat.name || 'Unknown',
        body: msg.body,
        from: msg.from,
        fromName: fromName,
        timestamp: msg.timestamp,
        isFromMe: msg.fromMe,
        hasMedia: msg.hasMedia,
        type: msg.type
      };
    });

    // Save messages to database
    if (currentAccountId && formattedMessages.length > 0) {
      database.whatsappMessages.bulkCreate(
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

    console.log(`🟢 WHATSAPP: Fetched ${formattedMessages.length} messages`);
    
    // Sort by timestamp ascending (oldest first) for proper chat display
    return formattedMessages.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('❌ WHATSAPP: Failed to fetch messages:', error);
    throw error;
  }
}

/**
 * Get recent messages across all chats (for notifications/digest)
 */
export async function getRecentMessages(limit: number = 100): Promise<WhatsAppMessage[]> {
  if (!isClientReady || !whatsappClient) {
    throw new Error('WhatsApp client is not ready');
  }

  console.log('🔵 WHATSAPP: Fetching recent messages...');
  
  try {
    const chats = await whatsappClient.getChats();
    const allMessages: WhatsAppMessage[] = [];
    
    // Get recent messages from each chat (up to 10 per chat)
    for (const chat of chats.slice(0, 20)) {
      try {
        const messages = await chat.fetchMessages({ limit: 10 });
        
        for (const msg of messages) {
          if (allMessages.length >= limit) break;
          
          // Get sender name from message data (avoid getContact which can fail)
          let fromName = 'Unknown';
          try {
            if (msg.author) {
              fromName = msg.author.split('@')[0];
            } else if (msg.fromMe) {
              fromName = 'You';
            } else {
              fromName = msg.from?.split('@')[0] || 'Unknown';
            }
            if ((msg as any)._data?.notifyName) {
              fromName = (msg as any)._data.notifyName;
            }
          } catch {
            // Keep fallback name
          }
          
          allMessages.push({
            id: msg.id._serialized,
            chatId: chat.id._serialized,
            chatName: chat.name || 'Unknown',
            body: msg.body,
            from: msg.from,
            fromName: fromName,
            timestamp: msg.timestamp,
            isFromMe: msg.fromMe,
            hasMedia: msg.hasMedia,
            type: msg.type
          });
        }
        
        if (allMessages.length >= limit) break;
      } catch (err) {
        console.warn(`⚠️ WHATSAPP: Failed to fetch messages from chat ${chat.id._serialized}`);
      }
    }
    
    // Sort by timestamp descending
    allMessages.sort((a, b) => b.timestamp - a.timestamp);
    
    console.log(`🟢 WHATSAPP: Fetched ${allMessages.length} recent messages`);
    return allMessages.slice(0, limit);
  } catch (error) {
    console.error('❌ WHATSAPP: Failed to fetch recent messages:', error);
    throw error;
  }
}

/**
 * Get contacts
 */
export async function getContacts(): Promise<WhatsAppContact[]> {
  if (!isClientReady || !whatsappClient) {
    throw new Error('WhatsApp client is not ready');
  }

  console.log('🔵 WHATSAPP: Fetching contacts...');
  
  try {
    const contacts = await whatsappClient.getContacts();
    
    const formattedContacts: WhatsAppContact[] = contacts
      .filter((contact: Contact) => contact.isMyContact || contact.isGroup)
      .map((contact: Contact) => ({
        id: contact.id._serialized,
        name: contact.name || '',
        pushname: contact.pushname || '',
        number: contact.number || '',
        isMyContact: contact.isMyContact,
        isGroup: contact.isGroup
      }));

    console.log(`🟢 WHATSAPP: Fetched ${formattedContacts.length} contacts`);
    return formattedContacts;
  } catch (error) {
    console.error('❌ WHATSAPP: Failed to fetch contacts:', error);
    throw error;
  }
}

/**
 * Get user info (the connected WhatsApp account)
 */
export async function getWhatsAppInfo(): Promise<{ name: string; number: string; platform: string } | null> {
  if (!isClientReady || !whatsappClient) {
    return null;
  }

  try {
    const info = whatsappClient.info;
    return {
      name: info.pushname || 'WhatsApp User',
      number: info.wid.user || '',
      platform: info.platform || 'unknown'
    };
  } catch (error) {
    console.error('❌ WHATSAPP: Failed to get user info:', error);
    return null;
  }
}

/**
 * Send a text message
 */
export async function sendMessage(chatId: string, message: string): Promise<boolean> {
  if (!isClientReady || !whatsappClient) {
    throw new Error('WhatsApp client is not ready');
  }

  console.log(`🔵 WHATSAPP: Sending message to ${chatId}...`);
  
  try {
    await whatsappClient.sendMessage(chatId, message);
    console.log('🟢 WHATSAPP: Message sent successfully');
    return true;
  } catch (error) {
    console.error('❌ WHATSAPP: Failed to send message:', error);
    throw error;
  }
}

/**
 * Send a media message (image, audio, video, document)
 * @param chatId - The chat ID to send to
 * @param mediaBase64 - Base64 encoded media data
 * @param mimetype - MIME type of the media (e.g., 'audio/mp3', 'image/jpeg')
 * @param filename - Optional filename for the media
 * @param caption - Optional caption for the media
 * @param sendAsVoice - If true and media is audio, sends as voice message (PTT)
 */
export async function sendMedia(
  chatId: string, 
  mediaBase64: string, 
  mimetype: string, 
  filename?: string, 
  caption?: string,
  sendAsVoice?: boolean
): Promise<boolean> {
  if (!isClientReady || !whatsappClient) {
    throw new Error('WhatsApp client is not ready');
  }

  console.log(`🔵 WHATSAPP: Sending media to ${chatId}... (${mimetype})`);
  
  try {
    // Create MessageMedia from base64 (MessageMedia imported at top)
    const media = new MessageMedia(mimetype, mediaBase64, filename);
    
    // Send options
    const sendOptions: any = {};
    if (caption) {
      sendOptions.caption = caption;
    }
    
    // If it's audio and should be sent as voice message (Push-to-Talk)
    if (sendAsVoice && mimetype.startsWith('audio/')) {
      sendOptions.sendAudioAsVoice = true;
    }
    
    await whatsappClient.sendMessage(chatId, media, sendOptions);
    console.log('🟢 WHATSAPP: Media sent successfully');
    return true;
  } catch (error) {
    console.error('❌ WHATSAPP: Failed to send media:', error);
    throw error;
  }
}

/**
 * Mark chat as read
 */
export async function markChatAsRead(chatId: string): Promise<void> {
  if (!isClientReady || !whatsappClient) {
    throw new Error('WhatsApp client is not ready');
  }

  try {
    const chat = await whatsappClient.getChatById(chatId);
    await chat.sendSeen();
    console.log(`🟢 WHATSAPP: Marked chat ${chatId} as read`);
  } catch (error) {
    console.error('❌ WHATSAPP: Failed to mark chat as read:', error);
    throw error;
  }
}

// Export event callback setters for use in main.ts
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
    console.error('❌ WHATSAPP AI: Error calling AI service:', error);
    return null;
  }
}

/**
 * Handle AI auto-reply for incoming messages (runs in main process)
 */
async function handleAIAutoReply(message: WhatsAppMessage): Promise<void> {
  try {
    // Get AI settings from storage
    const settings = store.get('whatsapp_ai_settings') as AIAutoReplySettings | undefined;
    
    if (!settings?.enabled) {
      return;
    }
    
    console.log('🤖 WHATSAPP AI: Processing message for auto-reply...');
    
    // Skip group messages if configured
    if (settings.excludeGroups && message.chatId.includes('@g.us')) {
      console.log('⏭️ WHATSAPP AI: Skipping group message');
      return;
    }
    
    // Check business hours if configured
    if (settings.businessHoursOnly) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      if (currentTime < settings.businessHoursStart || currentTime > settings.businessHoursEnd) {
        console.log('⏭️ WHATSAPP AI: Outside business hours');
        return;
      }
    }
    
    // Check trigger keywords if any
    if (settings.triggerKeywords && settings.triggerKeywords.length > 0) {
      const msgLower = message.body.toLowerCase();
      const hasKeyword = settings.triggerKeywords.some(kw => msgLower.includes(kw.toLowerCase()));
      if (!hasKeyword) {
        console.log('⏭️ WHATSAPP AI: No trigger keyword found');
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
    
    if (response && whatsappClient && isClientReady) {
      console.log('📤 WHATSAPP AI: Sending auto-reply:', response.substring(0, 50) + '...');
      
      await whatsappClient.sendMessage(message.chatId, response);
      console.log('✅ WHATSAPP AI: Auto-reply sent successfully');
      
      // Save AI response to database
      if (currentAccountId) {
        database.whatsappMessages.updateAIResponse(message.id, response);
      }
      
      // Show notification
      new Notification({
        title: 'WhatsApp AI Reply Sent',
        body: `Replied to ${message.fromName}: ${response.substring(0, 50)}...`
      }).show();
    }
  } catch (error) {
    console.error('❌ WHATSAPP AI: Auto-reply failed:', error);
  }
}
