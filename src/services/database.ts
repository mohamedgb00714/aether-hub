/**
 * Database Service - Renderer-side wrapper for SQLite database access via IPC
 * 
 * This service provides a typed interface to the SQLite database through Electron IPC.
 * All database operations are executed in the main process for safety and efficiency.
 */

import type { 
  Account, 
  Email, 
  CalendarEvent, 
  Folder, 
  Notification,
  Note,
  NoteStyle,
  NotePosition
} from '../types';

// Database row types (SQLite format with snake_case and boolean as integers)
interface DbAccount {
  id: string;
  name: string;
  email: string;
  platform: string;
  category: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  is_connected: number;
  status: string | null;
  last_sync: string | null;
  avatar_url: string | null;
  color: string | null;
  folder_id: string | null;
  ignored: number;
  created_at: string;
  updated_at: string;
}

interface DbEmail {
  id: string;
  account_id: string;
  thread_id: string | null;
  subject: string;
  sender: string;
  recipient: string | null;
  preview: string;
  timestamp: string;
  is_read: number;
  is_important: number;
  labels: string | null;
  tags: string | null;
  ai_summary: string | null;
  ai_category: string | null;
  ai_priority: number | null;
  ai_suggested_reply: string | null;
  created_at: string;
}

interface DbEvent {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  attendees: string | null;
  is_all_day: number;
  event_link: string | null;
  ai_briefing: string | null;
  ai_action_items: string | null;
  created_at: string;
}

interface DbFolder {
  id: string;
  name: string;
  color: string;
  account_ids: string;
  created_at: string;
}

interface DbNotification {
  id: string;
  account_id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  is_read: number;
  priority: number;
  action_url: string | null;
  created_at: string;
}

interface DbNote {
  id: number;
  title: string;
  content: string;
  category: string;
  is_pinned: number;
  style_json: string;
  position_json: string;
  created_at: string;
  updated_at: string;
}

export interface GithubItem {
  id: string;
  accountId: string;
  type: 'pr' | 'issue' | 'notification';
  title: string;
  url: string;
  repository: string;
  author: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  body?: string;
  labels?: string[];
  commentsCount: number;
  isRead: boolean;
}

export interface UserActivity {
  id: string;
  timestamp: string;
  actionType: 'email_send' | 'email_read' | 'email_reply' | 'email_star' | 'email_archive' | 'message_send' | 'message_read' | 'event_attend' | 'event_create' | 'github_action' | 'chat_message';
  platform: string;
  entityId?: string;
  contextJson?: any;
  participants?: string[];
  topics?: string[];
  createdAt: string;
}

export interface KnowledgeContext {
  id: string;
  category: string;
  key: string;
  value: any;
  confidence: number;
  lastUpdated: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  platform: string;
  threadId: string;
  summary: string;
  participants?: string[];
  topics?: string[];
  messageCount: number;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeInsight {
  id: string;
  category: string;
  fact: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

interface DbGithubItem {
  id: string;
  account_id: string;
  type: string;
  title: string;
  url: string;
  repository: string;
  author: string;
  state: string;
  created_at_github: string;
  updated_at_github: string;
  body: string | null;
  labels: string | null;
  comments_count: number;
  is_read: number;
  created_at: string;
}

// Transform functions: Database -> App
function dbToAccount(db: DbAccount): Account {
  return {
    id: db.id,
    name: db.name,
    email: db.email,
    platform: db.platform as any,
    category: db.category as any,
    accessToken: db.access_token || undefined,
    refreshToken: db.refresh_token || undefined,
    tokenExpiresAt: db.token_expires_at || undefined,
    isConnected: Boolean(db.is_connected),
    status: (db.status as any) || (db.is_connected ? 'connected' : 'offline'),
    lastSync: db.last_sync || undefined,
    avatarUrl: db.avatar_url || undefined,
    color: db.color || undefined,
    folderId: db.folder_id || undefined,
    ignored: Boolean(db.ignored),
  };
}

function dbToEmail(db: DbEmail): Email {
  return {
    id: db.id,
    accountId: db.account_id,
    threadId: db.thread_id || undefined,
    subject: db.subject,
    sender: db.sender,
    recipient: db.recipient || undefined,
    preview: db.preview,
    timestamp: db.timestamp,
    isRead: Boolean(db.is_read),
    isImportant: Boolean(db.is_important),
    labels: db.labels ? JSON.parse(db.labels) : [],
    tags: db.tags ? JSON.parse(db.tags) : [],
    aiSummary: db.ai_summary || undefined,
    aiCategory: db.ai_category || undefined,
    aiPriority: db.ai_priority || undefined,
    aiSuggestedReply: db.ai_suggested_reply || undefined,
  };
}

function dbToEvent(db: DbEvent): CalendarEvent {
  return {
    id: db.id,
    accountId: db.account_id,
    title: db.title,
    description: db.description || undefined,
    startTime: db.start_time,
    endTime: db.end_time,
    location: db.location || undefined,
    attendees: db.attendees ? JSON.parse(db.attendees) : [],
    isAllDay: Boolean(db.is_all_day),
    eventLink: db.event_link || undefined,
    aiBriefing: db.ai_briefing || undefined,
    aiActionItems: db.ai_action_items || undefined,
  };
}

function dbToFolder(db: DbFolder): Folder {
  return {
    id: db.id,
    name: db.name,
    color: db.color,
    accountIds: JSON.parse(db.account_ids),
  };
}

function dbToNotification(db: DbNotification): Notification {
  return {
    id: db.id,
    accountId: db.account_id,
    type: db.type as any,
    title: db.title,
    message: db.message,
    timestamp: db.timestamp,
    isRead: Boolean(db.is_read),
    priority: db.priority,
    actionUrl: db.action_url || undefined,
  };
}

function dbToNote(db: DbNote): Note {
  return {
    id: db.id,
    title: db.title,
    content: db.content,
    category: db.category,
    isPinned: Boolean(db.is_pinned),
    style: JSON.parse(db.style_json || '{}'),
    position: JSON.parse(db.position_json || '{"x":0,"y":0}'),
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

function dbToGithubItem(db: DbGithubItem): GithubItem {
  return {
    id: db.id,
    accountId: db.account_id,
    type: db.type as any,
    title: db.title,
    url: db.url,
    repository: db.repository,
    author: db.author,
    state: db.state,
    createdAt: db.created_at_github,
    updatedAt: db.updated_at_github,
    body: db.body || undefined,
    labels: db.labels ? JSON.parse(db.labels) : [],
    commentsCount: db.comments_count,
    isRead: Boolean(db.is_read),
  };
}

function dbToUserActivity(db: any): UserActivity {
  return {
    id: db.id,
    timestamp: db.timestamp,
    actionType: db.action_type,
    platform: db.platform,
    entityId: db.entity_id || undefined,
    contextJson: db.context_json ? JSON.parse(db.context_json) : undefined,
    participants: db.participants ? JSON.parse(db.participants) : undefined,
    topics: db.topics ? JSON.parse(db.topics) : undefined,
    createdAt: db.created_at,
  };
}

function userActivityToDb(activity: Omit<UserActivity, 'createdAt'>): any {
  return {
    id: activity.id,
    timestamp: activity.timestamp,
    action_type: activity.actionType,
    platform: activity.platform,
    entity_id: activity.entityId || null,
    context_json: activity.contextJson ? JSON.stringify(activity.contextJson) : null,
    participants: activity.participants ? JSON.stringify(activity.participants) : null,
    topics: activity.topics ? JSON.stringify(activity.topics) : null,
  };
}

function dbToKnowledgeContext(db: any): KnowledgeContext {
  return {
    id: db.id,
    category: db.category,
    key: db.key,
    value: JSON.parse(db.value),
    confidence: db.confidence,
    lastUpdated: db.last_updated,
    createdAt: db.created_at,
  };
}

function knowledgeContextToDb(context: Omit<KnowledgeContext, 'createdAt' | 'lastUpdated'>): any {
  return {
    id: context.id,
    category: context.category,
    key: context.key,
    value: JSON.stringify(context.value),
    confidence: context.confidence,
  };
}

function dbToConversationSummary(db: any): ConversationSummary {
  return {
    id: db.id,
    platform: db.platform,
    threadId: db.thread_id,
    summary: db.summary,
    participants: db.participants ? JSON.parse(db.participants) : undefined,
    topics: db.topics ? JSON.parse(db.topics) : undefined,
    messageCount: db.message_count,
    startTime: db.start_time,
    endTime: db.end_time,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

function conversationSummaryToDb(summary: Omit<ConversationSummary, 'createdAt' | 'updatedAt'>): any {
  return {
    id: summary.id,
    platform: summary.platform,
    thread_id: summary.threadId,
    summary: summary.summary,
    participants: summary.participants ? JSON.stringify(summary.participants) : null,
    topics: summary.topics ? JSON.stringify(summary.topics) : null,
    message_count: summary.messageCount,
    start_time: summary.startTime,
    end_time: summary.endTime,
  };
}

function dbToKnowledgeInsight(db: any): KnowledgeInsight {
  return {
    id: db.id,
    category: db.category,
    fact: db.fact,
    confidence: db.confidence,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

// Transform functions: App -> Database
function accountToDb(account: Partial<Account> & { id: string }): Partial<DbAccount> & { id: string } {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    platform: account.platform,
    category: account.category,
    access_token: account.accessToken || null,
    refresh_token: account.refreshToken || null,
    token_expires_at: account.tokenExpiresAt || null,
    is_connected: account.isConnected ? 1 : 0,
    status: account.status || null,
    last_sync: account.lastSync || null,
    avatar_url: account.avatarUrl || null,
    color: account.color || null,
    folder_id: account.folderId || null,
    ignored: account.ignored ? 1 : 0,
  };
}

function emailToDb(email: Partial<Email> & { id: string }): Partial<DbEmail> & { id: string } {
  return {
    id: email.id,
    account_id: email.accountId!,
    thread_id: email.threadId || null,
    subject: email.subject!,
    sender: email.sender!,
    recipient: email.recipient || null,
    preview: email.preview || '',
    timestamp: email.timestamp!,
    is_read: email.isRead ? 1 : 0,
    is_important: email.isImportant ? 1 : 0,
    labels: email.labels ? JSON.stringify(email.labels) : null,
    tags: email.tags ? JSON.stringify(email.tags) : null,
    ai_summary: email.aiSummary || null,
    ai_category: email.aiCategory || null,
    ai_priority: email.aiPriority || null,
    ai_suggested_reply: email.aiSuggestedReply || null,
  };
}

function eventToDb(event: Partial<CalendarEvent> & { id: string }): Partial<DbEvent> & { id: string } {
  return {
    id: event.id,
    account_id: event.accountId!,
    title: event.title!,
    description: event.description || null,
    start_time: event.startTime!,
    end_time: event.endTime!,
    location: event.location || null,
    attendees: event.attendees ? JSON.stringify(event.attendees) : null,
    is_all_day: event.isAllDay ? 1 : 0,
    event_link: event.eventLink || null,
    ai_briefing: event.aiBriefing || null,
    ai_action_items: event.aiActionItems || null,
  };
}

function folderToDb(folder: Omit<Folder, 'created_at'>): Omit<DbFolder, 'created_at'> {
  return {
    id: folder.id,
    name: folder.name,
    color: folder.color,
    account_ids: JSON.stringify(folder.accountIds),
  };
}

function githubItemToDb(item: Partial<GithubItem> & { id: string }): Partial<DbGithubItem> & { id: string } {
  return {
    id: item.id,
    account_id: item.accountId!,
    type: item.type!,
    title: item.title!,
    url: item.url!,
    repository: item.repository!,
    author: item.author!,
    state: item.state!,
    created_at_github: item.createdAt!,
    updated_at_github: item.updatedAt!,
    body: item.body || null,
    labels: item.labels ? JSON.stringify(item.labels) : null,
    comments_count: item.commentsCount || 0,
    is_read: item.isRead ? 1 : 0,
  };
}

// Database Service API
class DatabaseService {
  // Account operations
  accounts = {
    getAll: async (): Promise<Account[]> => {
      // First, delete any accounts with null IDs using the proper SQL method
      try {
        const deletedCount = await window.electronAPI.db.accounts.deleteNullIds();
        if (deletedCount > 0) {
          console.log(`🗑️ Auto-deleted ${deletedCount} accounts with null IDs`);
        }
      } catch (e) {
        console.warn('Failed to delete null ID accounts:', e);
      }
      
      const dbAccounts = await window.electronAPI.db.accounts.getAll();
      
      // Filter out any remaining invalid accounts (safety check)
      const validAccounts = dbAccounts.filter((acc: { id: string | null | undefined }) => 
        acc.id && acc.id !== 'null' && acc.id !== 'undefined'
      );
      
      return validAccounts.map(dbToAccount);
    },

    getById: async (id: string): Promise<Account | undefined> => {
      const dbAccount = await window.electronAPI.db.accounts.getById(id);
      return dbAccount ? dbToAccount(dbAccount) : undefined;
    },

    getByPlatform: async (platform: string): Promise<Account[]> => {
      const dbAccounts = await window.electronAPI.db.accounts.getByPlatform(platform);
      return dbAccounts.map(dbToAccount);
    },

    upsert: async (account: Partial<Account> & { id: string }): Promise<void> => {
      await window.electronAPI.db.accounts.upsert(accountToDb(account));
    },

    delete: async (id: string): Promise<void> => {
      await window.electronAPI.db.accounts.delete(id);
    },
  };

  // Email operations
  emails = {
    getAll: async (): Promise<Email[]> => {
      const dbEmails = await window.electronAPI.db.emails.getAll();
      return dbEmails.map(dbToEmail);
    },

    getByAccount: async (accountId: string): Promise<Email[]> => {
      const dbEmails = await window.electronAPI.db.emails.getByAccount(accountId);
      return dbEmails.map(dbToEmail);
    },

    getUnread: async (): Promise<Email[]> => {
      const dbEmails = await window.electronAPI.db.emails.getUnread();
      return dbEmails.map(dbToEmail);
    },

    getByTag: async (tag: string): Promise<Email[]> => {
      const dbEmails = await window.electronAPI.db.emails.getByTag(tag);
      return dbEmails.map(dbToEmail);
    },

    bulkUpsert: async (emails: (Partial<Email> & { id: string })[]): Promise<void> => {
      const dbEmails = emails.map(emailToDb);
      await window.electronAPI.db.emails.bulkUpsert(dbEmails);
    },

    update: async (id: string, updates: Partial<Email>): Promise<void> => {
      const dbUpdates: any = {};
      if (updates.isRead !== undefined) dbUpdates.is_read = updates.isRead ? 1 : 0;
      if (updates.isImportant !== undefined) dbUpdates.is_important = updates.isImportant ? 1 : 0;
      if (updates.tags !== undefined) dbUpdates.tags = JSON.stringify(updates.tags);
      if (updates.aiSummary !== undefined) dbUpdates.ai_summary = updates.aiSummary;
      if (updates.aiCategory !== undefined) dbUpdates.ai_category = updates.aiCategory;
      if (updates.aiPriority !== undefined) dbUpdates.ai_priority = updates.aiPriority;
      if (updates.aiSuggestedReply !== undefined) dbUpdates.ai_suggested_reply = updates.aiSuggestedReply;
      
      await window.electronAPI.db.emails.update(id, dbUpdates);
    },

    delete: async (id: string): Promise<void> => {
      await window.electronAPI.db.emails.delete(id);
    },

    clearByAccount: async (accountId: string): Promise<void> => {
      await window.electronAPI.db.emails.clearByAccount(accountId);
    },
  };

  // Event operations
  events = {
    getAll: async (): Promise<CalendarEvent[]> => {
      const dbEvents = await window.electronAPI.db.events.getAll();
      return dbEvents.map(dbToEvent);
    },

    getByAccount: async (accountId: string): Promise<CalendarEvent[]> => {
      const dbEvents = await window.electronAPI.db.events.getByAccount(accountId);
      return dbEvents.map(dbToEvent);
    },

    getUpcoming: async (limit = 10): Promise<CalendarEvent[]> => {
      const dbEvents = await window.electronAPI.db.events.getUpcoming(limit);
      return dbEvents.map(dbToEvent);
    },

    getByDateRange: async (startDate: string, endDate: string): Promise<CalendarEvent[]> => {
      const dbEvents = await window.electronAPI.db.events.getByDateRange(startDate, endDate);
      return dbEvents.map(dbToEvent);
    },

    bulkUpsert: async (events: (Partial<CalendarEvent> & { id: string })[]): Promise<void> => {
      const dbEvents = events.map(eventToDb);
      await window.electronAPI.db.events.bulkUpsert(dbEvents);
    },

    update: async (id: string, updates: Partial<CalendarEvent>): Promise<void> => {
      const dbUpdates: any = {};
      if (updates.aiBriefing !== undefined) dbUpdates.ai_briefing = updates.aiBriefing;
      if (updates.aiActionItems !== undefined) dbUpdates.ai_action_items = updates.aiActionItems;
      
      await window.electronAPI.db.events.update(id, dbUpdates);
    },

    delete: async (id: string): Promise<void> => {
      await window.electronAPI.db.events.delete(id);
    },

    clearByAccount: async (accountId: string): Promise<void> => {
      await window.electronAPI.db.events.clearByAccount(accountId);
    },
  };

  // Folder operations
  folders = {
    getAll: async (): Promise<Folder[]> => {
      const dbFolders = await window.electronAPI.db.folders.getAll();
      return dbFolders.map(dbToFolder);
    },

    getById: async (id: string): Promise<Folder | undefined> => {
      const dbFolder = await window.electronAPI.db.folders.getById(id);
      return dbFolder ? dbToFolder(dbFolder) : undefined;
    },

    create: async (folder: Omit<Folder, 'created_at'>): Promise<void> => {
      await window.electronAPI.db.folders.create(folderToDb(folder));
    },

    update: async (id: string, updates: Partial<Omit<Folder, 'id'>>): Promise<void> => {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.color !== undefined) dbUpdates.color = updates.color;
      if (updates.accountIds !== undefined) dbUpdates.account_ids = JSON.stringify(updates.accountIds);
      
      await window.electronAPI.db.folders.update(id, dbUpdates);
    },

    delete: async (id: string): Promise<void> => {
      await window.electronAPI.db.folders.delete(id);
    },
  };

  // Notification operations
  notifications = {
    getAll: async (): Promise<Notification[]> => {
      const dbNotifications = await window.electronAPI.db.notifications.getAll();
      return dbNotifications.map(dbToNotification);
    },

    getUnread: async (): Promise<Notification[]> => {
      const dbNotifications = await window.electronAPI.db.notifications.getUnread();
      return dbNotifications.map(dbToNotification);
    },

    bulkUpsert: async (notifications: (Partial<Notification> & { id: string })[]): Promise<void> => {
      const dbNotifications = notifications.map(n => ({
        id: n.id,
        account_id: n.accountId!,
        type: n.type!,
        title: n.title!,
        message: n.message!,
        timestamp: n.timestamp!,
        is_read: n.isRead ? 1 : 0,
        priority: n.priority || 0,
        action_url: n.actionUrl || null,
      }));
      await window.electronAPI.db.notifications.bulkUpsert(dbNotifications);
    },

    markAsRead: async (id: string): Promise<void> => {
      await window.electronAPI.db.notifications.markAsRead(id);
    },

    delete: async (id: string): Promise<void> => {
      await window.electronAPI.db.notifications.delete(id);
    },
  };

  // Chat Sessions operations
  chatSessions = {
    getAll: async () => {
      return await window.electronAPI.db.chatSessions.getAll();
    },

    getById: async (id: string) => {
      return await window.electronAPI.db.chatSessions.getById(id);
    },

    create: async (session: { id: string; title: string; accountIds?: string[] }) => {
      return await window.electronAPI.db.chatSessions.create(session);
    },

    update: async (id: string, updates: { title?: string; accountIds?: string[] }) => {
      return await window.electronAPI.db.chatSessions.update(id, updates);
    },

    delete: async (id: string) => {
      return await window.electronAPI.db.chatSessions.delete(id);
    },
  };

  // Chat Messages operations
  chatMessages = {
    getBySession: async (sessionId: string) => {
      return await window.electronAPI.db.chatMessages.getBySession(sessionId);
    },

    create: async (message: { 
      id: string; 
      sessionId: string; 
      role: string; 
      content: string; 
      sources?: any[];
      toolsUsed?: string[];
      reasoning?: string[];
    }) => {
      // Map frontend camelCase to backend snake_case for DB repository
      const dbMessage = {
        id: message.id,
        sessionId: message.sessionId,
        role: message.role,
        content: message.content,
        sources: message.sources,
        tools_used: message.toolsUsed,
        reasoning: message.reasoning
      };
      return await window.electronAPI.db.chatMessages.create(dbMessage);
    },

    deleteBySession: async (sessionId: string) => {
      return await window.electronAPI.db.chatMessages.deleteBySession(sessionId);
    },
  };

  // WhatsApp operations
  whatsapp = {
    getChats: async (accountId: string) => {
      return await window.electronAPI.db.whatsapp.getChats(accountId);
    },

    getMessages: async (chatId: string, limit?: number) => {
      return await window.electronAPI.db.whatsapp.getMessages(chatId, limit);
    },

    getRecentMessages: async (accountId: string, limit?: number) => {
      return await window.electronAPI.db.whatsapp.getRecentMessages(accountId, limit);
    },

    getAccounts: async () => {
      return await window.electronAPI.db.whatsapp.getAccounts();
    },

    updateAISettings: async (accountId: string, aiSettings: string) => {
      return await window.electronAPI.db.whatsapp.updateAISettings(accountId, aiSettings);
    },
  };

  // Discord operations
  discord = {
    getGuilds: async (accountId: string) => {
      return await window.electronAPI.db.discord.getGuilds(accountId);
    },

    getMessages: async (channelId: string, limit?: number) => {
      return await window.electronAPI.db.discord.getMessages(channelId, limit);
    },

    getRecentMessages: async (accountId: string, limit?: number) => {
      return await window.electronAPI.db.discord.getRecentMessages(accountId, limit);
    },
  };

  // Telegram operations
  telegram = {
    getChats: async (accountId: string) => {
      return await window.electronAPI['telegram.db'].getChats(accountId);
    },

    getMessages: async (chatId: string, limit?: number) => {
      return await window.electronAPI['telegram.db'].getMessages(chatId, limit);
    },

    getRecentMessages: async (accountId: string, limit?: number) => {
      return await window.electronAPI['telegram.db'].getRecentMessages(accountId, limit);
    },

    getAccounts: async () => {
      return await window.electronAPI['telegram.db'].getAccounts();
    },

    getConnectedAccount: async () => {
      return await window.electronAPI['telegram.db'].getConnectedAccount();
    },

    updateAISettings: async (accountId: string, aiSettings: string) => {
      return await window.electronAPI['telegram.db'].updateAISettings(accountId, aiSettings);
    },
  };

  // GitHub operations
  github = {
    getAll: async (): Promise<GithubItem[]> => {
      const dbItems = await window.electronAPI.db.github.getAll();
      return dbItems.map(dbToGithubItem);
    },

    getByAccount: async (accountId: string): Promise<GithubItem[]> => {
      const dbItems = await window.electronAPI.db.github.getByAccount(accountId);
      return dbItems.map(dbToGithubItem);
    },

    getByType: async (type: string): Promise<GithubItem[]> => {
      const dbItems = await window.electronAPI.db.github.getByType(type);
      return dbItems.map(dbToGithubItem);
    },

    bulkUpsert: async (items: (Partial<GithubItem> & { id: string })[]): Promise<void> => {
      const dbItems = items.map(githubItemToDb);
      await window.electronAPI.db.github.bulkUpsert(dbItems);
    },

    markAsRead: async (id: string): Promise<void> => {
      await window.electronAPI.db.github.markAsRead(id);
    },

    delete: async (id: string): Promise<void> => {
      await window.electronAPI.db.github.delete(id);
    },

    clearByAccount: async (accountId: string): Promise<void> => {
      await window.electronAPI.db.github.clearByAccount(accountId);
    },
  };
  // User Activities operations
  userActivities = {
    getAll: async (limit: number = 100): Promise<UserActivity[]> => {
      const activities = await window.electronAPI.db.userActivities.getAll(limit);
      return activities.map(dbToUserActivity);
    },

    getByPlatform: async (platform: string, limit: number = 100): Promise<UserActivity[]> => {
      const activities = await window.electronAPI.db.userActivities.getByPlatform(platform, limit);
      return activities.map(dbToUserActivity);
    },

    getByDateRange: async (startDate: string, endDate: string): Promise<UserActivity[]> => {
      const activities = await window.electronAPI.db.userActivities.getByDateRange(startDate, endDate);
      return activities.map(dbToUserActivity);
    },

    getByActionType: async (actionType: string, limit: number = 100): Promise<UserActivity[]> => {
      const activities = await window.electronAPI.db.userActivities.getByActionType(actionType, limit);
      return activities.map(dbToUserActivity);
    },

    insert: async (activity: Omit<UserActivity, 'createdAt'>): Promise<void> => {
      await window.electronAPI.db.userActivities.insert(userActivityToDb(activity));
    },

    deleteOlderThan: async (days: number): Promise<void> => {
      await window.electronAPI.db.userActivities.deleteOlderThan(days);
    },
  };

  // Knowledge Context operations
  knowledgeContext = {
    getAll: async (): Promise<KnowledgeContext[]> => {
      const contexts = await window.electronAPI.db.knowledgeContext.getAll();
      return contexts.map(dbToKnowledgeContext);
    },

    getByCategory: async (category: string): Promise<KnowledgeContext[]> => {
      const contexts = await window.electronAPI.db.knowledgeContext.getByCategory(category);
      return contexts.map(dbToKnowledgeContext);
    },

    get: async (category: string, key: string): Promise<KnowledgeContext | undefined> => {
      const context = await window.electronAPI.db.knowledgeContext.get(category, key);
      return context ? dbToKnowledgeContext(context) : undefined;
    },

    upsert: async (context: Omit<KnowledgeContext, 'createdAt' | 'lastUpdated'>): Promise<void> => {
      await window.electronAPI.db.knowledgeContext.upsert(knowledgeContextToDb(context));
    },

    delete: async (id: string): Promise<void> => {
      await window.electronAPI.db.knowledgeContext.delete(id);
    },
  };

  // Conversation Summaries operations
  conversationSummaries = {
    getAll: async (limit: number = 50): Promise<ConversationSummary[]> => {
      const summaries = await window.electronAPI.db.conversationSummaries.getAll(limit);
      return summaries.map(dbToConversationSummary);
    },

    getByPlatform: async (platform: string, limit: number = 50): Promise<ConversationSummary[]> => {
      const summaries = await window.electronAPI.db.conversationSummaries.getByPlatform(platform, limit);
      return summaries.map(dbToConversationSummary);
    },

    get: async (platform: string, threadId: string): Promise<ConversationSummary | undefined> => {
      const summary = await window.electronAPI.db.conversationSummaries.get(platform, threadId);
      return summary ? dbToConversationSummary(summary) : undefined;
    },

    upsert: async (summary: Omit<ConversationSummary, 'createdAt' | 'updatedAt'>): Promise<void> => {
      await window.electronAPI.db.conversationSummaries.upsert(conversationSummaryToDb(summary));
    },

    delete: async (id: string): Promise<void> => {
      await window.electronAPI.db.conversationSummaries.delete(id);
    },
  };

  // Knowledge Messages operations
  knowledgeMessages = {
    getAll: async (): Promise<{ id: string; role: string; content: string; created_at: string }[]> => {
      const messages = await window.electronAPI.db.knowledgeMessages.getAll();
      return messages || [];
    },

    create: async (message: { id: string; role: string; content: string }): Promise<void> => {
      await window.electronAPI.db.knowledgeMessages.create(message);
    },

    deleteAll: async (): Promise<void> => {
      await window.electronAPI.db.knowledgeMessages.deleteAll();
    },
  };

  // Knowledge Insights operations (update existing)
  knowledgeInsights = {
    getAll: async (): Promise<KnowledgeInsight[]> => {
      const insights = await window.electronAPI.db.knowledgeInsights.getAll();
      return insights.map(dbToKnowledgeInsight);
    },

    create: async (insight: { id: string; category: string; fact: string; confidence?: number }): Promise<void> => {
      await window.electronAPI.db.knowledgeInsights.create(insight);
    },

    update: async (id: string, updates: { fact?: string; confidence?: number }): Promise<void> => {
      await window.electronAPI.db.knowledgeInsights.update(id, updates);
    },

    delete: async (id: string): Promise<void> => {
      await window.electronAPI.db.knowledgeInsights.delete(id);
    },

    deleteAll: async (): Promise<void> => {
      await window.electronAPI.db.knowledgeInsights.deleteAll();
    },
  };

  // Resend Templates operations
  resendTemplates = {
    getAll: async (): Promise<any[]> => {
      return await window.electronAPI.db.resendTemplates.getAll();
    },

    getById: async (id: string): Promise<any | undefined> => {
      return await window.electronAPI.db.resendTemplates.getById(id);
    },

    create: async (template: { id: string; name: string; subject: string; html?: string; text?: string }): Promise<void> => {
      await window.electronAPI.db.resendTemplates.create(template);
    },

    update: async (id: string, updates: { name?: string; subject?: string; html?: string; text?: string }): Promise<void> => {
      await window.electronAPI.db.resendTemplates.update(id, updates);
    },

    delete: async (id: string): Promise<void> => {
      await window.electronAPI.db.resendTemplates.delete(id);
    },
  };

  // Resend Sent Emails operations
  resendSentEmails = {
    getAll: async (limit?: number): Promise<any[]> => {
      return await window.electronAPI.db.resendSentEmails.getAll(limit);
    },

    getById: async (id: string): Promise<any | undefined> => {
      return await window.electronAPI.db.resendSentEmails.getById(id);
    },

    create: async (email: { id: string; from_email: string; to_emails: string; subject: string; html?: string; text?: string; created_at?: string }): Promise<void> => {
      await window.electronAPI.db.resendSentEmails.create(email);
    },

    updateEvent: async (id: string, lastEvent: string, clicks?: number, opens?: number): Promise<void> => {
      await window.electronAPI.db.resendSentEmails.updateEvent(id, lastEvent, clicks, opens);
    },

    delete: async (id: string): Promise<void> => {
      await window.electronAPI.db.resendSentEmails.delete(id);
    },

    deleteAll: async (): Promise<void> => {
      await window.electronAPI.db.resendSentEmails.deleteAll();
    },
  };

  // Intelligence Feeds operations
  intelligenceFeeds = {
    getAll: async (): Promise<any[]> => {
      return await window.electronAPI.db.intelligenceFeeds.getAll();
    },

    getRecent: async (limit: number = 10): Promise<any[]> => {
      return await window.electronAPI.db.intelligenceFeeds.getRecent(limit);
    },

    getByCategory: async (category: string): Promise<any[]> => {
      return await window.electronAPI.db.intelligenceFeeds.getByCategory(category);
    },

    getById: async (id: string): Promise<any | undefined> => {
      return await window.electronAPI.db.intelligenceFeeds.getById(id);
    },

    create: async (feed: { id: string; title: string; content: string; category: string; priority?: number; insights?: string | null; action_items?: string | null; sources?: string | null; generated_at: string }): Promise<void> => {
      await window.electronAPI.db.intelligenceFeeds.create(feed);
    },

    delete: async (id: string): Promise<void> => {
      await window.electronAPI.db.intelligenceFeeds.delete(id);
    },

    deleteOlderThan: async (days: number): Promise<number> => {
      return await window.electronAPI.db.intelligenceFeeds.deleteOlderThan(days);
    },
  };

  // Notes operations
  notes = {
    getAll: async (): Promise<Note[]> => {
      const dbNotes = await window.electronAPI.db.notes.getAll();
      return dbNotes.map(dbToNote);
    },

    getById: async (id: number): Promise<Note | undefined> => {
      const dbNote = await window.electronAPI.db.notes.getById(id);
      return dbNote ? dbToNote(dbNote) : undefined;
    },

    getByCategory: async (category: string): Promise<Note[]> => {
      const dbNotes = await window.electronAPI.db.notes.getByCategory(category);
      return dbNotes.map(dbToNote);
    },

    getPinned: async (): Promise<Note[]> => {
      const dbNotes = await window.electronAPI.db.notes.getPinned();
      return dbNotes.map(dbToNote);
    },

    upsert: async (note: Partial<Note>): Promise<Note | void> => {
      // Transform Note to DbNote
      const dbNote: any = { ...note };
      
      if (note.isPinned !== undefined) {
        dbNote.is_pinned = note.isPinned ? 1 : 0;
        delete dbNote.isPinned;
      }
      
      if (note.style) {
        dbNote.style_json = JSON.stringify(note.style);
        delete dbNote.style;
      }
      
      if (note.position) {
        dbNote.position_json = JSON.stringify(note.position);
        delete dbNote.position;
      }
      
      // Convert camelCase to snake_case for timestamp fields
      if (note.createdAt !== undefined) {
        dbNote.created_at = note.createdAt;
        delete dbNote.createdAt;
      }
      
      if (note.updatedAt !== undefined) {
        dbNote.updated_at = note.updatedAt;
        delete dbNote.updatedAt;
      }

      const result = await window.electronAPI.db.notes.upsert(dbNote);
      
      // If result is empty or we have an id, return what we have or fetch it
      const id = note.id || (result && result.lastInsertRowid);
      if (id) {
        const all = await window.electronAPI.db.notes.getAll();
        const saved = all.find((n: any) => n.id === id);
        return saved ? dbToNote(saved) : undefined;
      }
    },

    delete: async (id: number): Promise<void> => {
      await window.electronAPI.db.notes.delete(id);
    },
  };
}

// Export singleton instance
export const db = new DatabaseService();

// Helper functions for common operations
export const createChatSession = async (title: string): Promise<{ id: string; title: string }> => {
  const session = {
    id: `session_${Date.now()}`,
    title,
  };
  await db.chatSessions.create(session);
  return session;
};

export const createChatMessage = async (
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  sources?: any[],
  toolsUsed?: string[],
  reasoning?: string[]
): Promise<void> => {
  const message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    sessionId,
    role,
    content,
    sources,
    toolsUsed,
    reasoning
  };
  await db.chatMessages.create(message);
};
