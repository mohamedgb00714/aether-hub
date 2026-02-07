
export type Platform = 'google' | 'outlook' | 'facebook' | 'slack' | 'github' | 'whatsapp' | 'telegram' | 'discord' | 'google_analytics' | 'clarity' | 'resend' | 'smtp';

export type Category = 'email' | 'communication' | 'development' | 'analytics' | 'Work' | 'Personal' | 'Finance' | 'Security' | 'Social' | 'Web' | 'Other';

export type EmailTag = 'work' | 'personal' | 'important' | 'newsletter' | 'social' | 'promotions' | 'updates' | 'finance' | 'travel' | 'starred' | 'archived';

// WhatsApp specific types
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

// Telegram specific types
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

// Discord specific types
export interface DiscordMessage {
  id: string;
  channelId: string;
  channelName?: string;
  guildId?: string;
  guildName?: string;
  author: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
  };
  content: string;
  timestamp: string;
  editedTimestamp: string | null;
  attachments: any[];
  embeds: any[];
  mentions: any[];
  type: number;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
  memberCount?: number;
  presenceCount?: number;
}

export interface DiscordChannel {
  id: string;
  type: number;
  guildId?: string;
  name?: string;
  topic?: string | null;
  lastMessageId?: string | null;
  isDM: boolean;
  recipientName?: string;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  accountIds: string[]; // Accounts that belong to this folder
}

export type AccountStatus = 'connected' | 'syncing' | 'error' | 'disconnected' | 'offline';

export interface Account {
  id: string;
  name: string;
  email: string;
  platform: Platform;
  category: Category;
  isConnected: boolean;
  status?: AccountStatus;
  lastSync?: string;
  avatarUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  color?: string;
  folderId?: string;
  ignored?: boolean; // If true, don't show in feeds
}

export interface Email {
  id: string;
  accountId: string;
  threadId?: string;
  subject: string;
  sender: string;
  recipient?: string;
  preview: string;
  timestamp: string;
  isRead: boolean;
  isImportant: boolean;
  labels: string[];
  tags: EmailTag[];
  aiSummary?: string;
  aiCategory?: string;
  aiPriority?: number;
  aiSuggestedReply?: string;
}

export type ItemType = 'email' | 'calendar' | 'notification' | 'analytics';

// Watch Types - for monitoring items across platforms
export type WatchPlatform = 'email' | 'discord' | 'whatsapp' | 'telegram' | 'github' | 'calendar';
export type WatchItemType = 'email_address' | 'discord_server' | 'discord_channel' | 'whatsapp_chat' | 'telegram_chat' | 'telegram_channel' | 'github_repo' | 'github_user' | 'calendar_event';
export type WatchStatus = 'active' | 'paused';
export type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'dismissed';

export interface WatchedItem {
  id: string;
  platform: WatchPlatform;
  itemType: WatchItemType;
  itemId: string; // The ID of the item being watched (email address, channel id, chat id, etc.)
  itemName: string; // Human-readable name
  itemMetadata?: string; // JSON string with additional info (server name, avatar, etc.)
  action?: string; // What action needs to be done
  actionStatus: ActionStatus;
  watchStatus: WatchStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// AI-generated action from watch monitoring
export interface WatchAction {
  id: number;
  watchedItemId: string;
  action: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: ActionStatus;
  sourceItemType: ItemType;
  sourceItemId: string;
  createdAt: string;
}

export interface NoteStyle {
  backgroundColor?: string;
  color?: string;
  fontFamily?: string;
  fontSize?: string;
  rotate?: string;
}

export interface NotePosition {
  x: number;
  y: number;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  category: string;
  isPinned: boolean;
  style: NoteStyle;
  position: NotePosition;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  accountId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees: string[];
  isAllDay: boolean;
  eventLink?: string;
  aiBriefing?: string;
  aiActionItems?: string;
}

export interface Notification {
  id: string;
  accountId: string;
  type: 'message' | 'mention' | 'alert' | 'update';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  priority: number;
  actionUrl?: string;
}

export type FeedItem = Notification | CalendarEvent;

export interface AISummary {
  id: string;
  content: string;
  timestamp: string;
  topics: string[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface KnowledgeInsight {
  id: string;
  category: string;
  fact: string;
  confidence?: number;
  created_at?: string;
  updated_at?: string;
}

// Electron API Types
export interface ElectronAPI {
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    isMaximized: () => Promise<boolean>;
  };
  app: {
    getPlatform: () => Promise<NodeJS.Platform>;
    getVersion: () => Promise<string>;
  };
  store: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    delete: (key: string) => Promise<void>;
    clear: () => Promise<void>;
  };
  dialog: {
    openFile: (options: any) => Promise<string[]>;
    saveFile: (options: any) => Promise<string | undefined>;
  };
  notification: {
    show: (options: { title: string; body: string }) => Promise<boolean>;
  };
  clipboard: {
    writeText: (text: string) => Promise<void>;
    readText: () => Promise<string>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  system: {
    pasteText: (text?: string) => Promise<void>;
  };
  updater: {
    checkForUpdates: () => Promise<void>;
  };
  on: {
    navigate: (callback: (path: string) => void) => void;
    triggerSearch: (callback: () => void) => void;
    oauthCallback: (callback: (url: string) => void) => void;
    whatsappQR: (callback: (qr: string) => void) => void;
    whatsappReady: (callback: () => void) => void;
    whatsappDisconnected: (callback: (reason: string) => void) => void;
    whatsappAuthFailure: (callback: (error: string) => void) => void;
    whatsappMessage: (callback: (message: WhatsAppMessage) => void) => void;
  };
  removeListener: {
    navigate: () => void;
    triggerSearch: () => void;
    oauthCallback: () => void;
    whatsappQR: () => void;
    whatsappReady: () => void;
    whatsappDisconnected: () => void;
    whatsappAuthFailure: () => void;
    whatsappMessage: () => void;
  };
  mic: any;
  overlay: {
    updatePosition: (position: any) => Promise<void>;
    toggle: () => Promise<void>;
    show: () => Promise<void>;
    hide: () => Promise<void>;
    isVisible: () => Promise<boolean>;
    resize: (width: number, height: number) => void;
    sendMessage: (message: any) => Promise<void>;
    toMainWindow: (message: any) => Promise<boolean>;
    onMessage: (callback: (message: any) => void) => () => void;
    onSettingsChanged: (callback: () => void) => () => void;
  };
  whisper: any;
  addon: any;
  whatsapp: {
    initialize: () => Promise<{ success: boolean; error?: string }>;
    isReady: () => Promise<boolean>;
    hasSession: () => Promise<boolean>;
    getAuthState: () => Promise<{ state: string; qrCode: string | null; error: string | null }>;
    getQRCode: () => Promise<string | null>;
    logout: () => Promise<{ success: boolean; error?: string }>;
    getInfo: () => Promise<{ name: string; number: string; platform: string } | null>;
    getChats: (limit?: number) => Promise<WhatsAppChat[]>;
    getChatMessages: (chatId: string, limit?: number) => Promise<WhatsAppMessage[]>;
    getRecentMessages: (limit?: number) => Promise<WhatsAppMessage[]>;
    getContacts: () => Promise<WhatsAppContact[]>;
    sendMessage: (chatId: string, message: string) => Promise<boolean>;
    markAsRead: (chatId: string) => Promise<{ success: boolean }>;
  };
  resend: {
    validateApiKey: (apiKey: string) => Promise<boolean>;
    getDomains: (apiKey: string) => Promise<{ data: any[] }>;
    getAudiences: (apiKey: string) => Promise<{ data: any[] }>;
    getContacts: (apiKey: string, audienceId: string) => Promise<{ data: any[] }>;
    sendEmail: (apiKey: string, emailData: any) => Promise<any>;
    createAudience: (apiKey: string, name: string) => Promise<any>;
    addContact: (apiKey: string, audienceId: string, contact: any) => Promise<any>;
    removeContact: (apiKey: string, audienceId: string, contactId: string) => Promise<boolean>;
    getEmail: (apiKey: string, emailId: string) => Promise<any | null>;
    getReceivedEmails: (apiKey: string, limit?: number) => Promise<{ data: any[] }>;
    getSentEmails: (apiKey: string, limit?: number) => Promise<{ data: any[] }>;
  };
  oauth: {
    openExternal: (url: string) => Promise<void>;
  };
  db: any;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
