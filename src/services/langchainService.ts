import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import storage, { STORAGE_KEYS } from './electronStore';
import { db } from './database';
import { getAIProvider, AIProvider } from './geminiService';

// Initialize LangChain with selected provider
type LangChainChat = ChatGoogleGenerativeAI | ChatOpenAI;
let chat: LangChainChat | null = null;
let currentProvider: AIProvider | null = null;

async function initializeChat() {
  const provider = await getAIProvider();
  currentProvider = provider;
  
  switch (provider) {
    case 'openrouter': {
      const apiKey = await storage.get(STORAGE_KEYS.OPENROUTER_API_KEY);
      const model = await storage.get(STORAGE_KEYS.OPENROUTER_MODEL) || 'anthropic/claude-3.5-sonnet';
      
      if (!apiKey) {
        throw new Error('OpenRouter API key not configured. Please add it in Settings.');
      }
      
      chat = new ChatOpenAI({
        configuration: {
          baseURL: 'https://openrouter.ai/api/v1',
        },
        apiKey,
        model,
        temperature: 0.7,
        maxTokens: 2048,
      });
      break;
    }
    
    case 'openai': {
      const apiKey = await storage.get(STORAGE_KEYS.OPENAI_API_KEY);
      const model = await storage.get(STORAGE_KEYS.OPENAI_MODEL) || 'gpt-4o-mini';
      
      if (!apiKey) {
        throw new Error('OpenAI API key not configured. Please add it in Settings.');
      }
      
      chat = new ChatOpenAI({
        apiKey,
        model,
        temperature: 0.7,
        maxTokens: 2048,
      });
      break;
    }
    
    case 'anthropic': {
      const apiKey = await storage.get(STORAGE_KEYS.ANTHROPIC_API_KEY);
      const model = await storage.get(STORAGE_KEYS.ANTHROPIC_MODEL) || 'claude-3-5-sonnet-20241022';
      
      if (!apiKey) {
        throw new Error('Anthropic API key not configured. Please add it in Settings.');
      }
      
      chat = new ChatOpenAI({
        configuration: {
          baseURL: 'https://api.anthropic.com/v1',
          defaultHeaders: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          }
        },
        apiKey, // Still required even though we use x-api-key header
        model,
        temperature: 0.7,
        maxTokens: 2048,
      });
      break;
    }
    
    case 'ollama': {
      const ollamaUrl = await storage.get(STORAGE_KEYS.OLLAMA_URL) || 'http://localhost:11434';
      const model = await storage.get(STORAGE_KEYS.OLLAMA_MODEL) || 'llama3.2';
      
      chat = new ChatOpenAI({
        configuration: {
          baseURL: `${ollamaUrl}/v1`,
        },
        apiKey: 'ollama', // Ollama doesn't validate API key
        model,
        temperature: 0.7,
        maxTokens: 2048,
      });
      break;
    }
    
    case 'local': {
      const localUrl = await storage.get(STORAGE_KEYS.LOCAL_AI_URL);
      const localKey = await storage.get(STORAGE_KEYS.LOCAL_AI_KEY) || 'local';
      const model = await storage.get(STORAGE_KEYS.LOCAL_AI_MODEL) || 'default';
      
      if (!localUrl) {
        throw new Error('Local AI endpoint URL not configured. Please add it in Settings.');
      }
      
      chat = new ChatOpenAI({
        configuration: {
          baseURL: localUrl,
        },
        apiKey: localKey,
        model,
        temperature: 0.7,
        maxTokens: 2048,
      });
      break;
    }
    
    default: {
      // Google Gemini
      const apiKey = await storage.get(STORAGE_KEYS.GEMINI_API_KEY);
      const model = await storage.get(STORAGE_KEYS.GEMINI_MODEL) || 'gemini-2.0-flash-exp';
      
      if (!apiKey) {
        throw new Error('Gemini API key not configured. Please add it in Settings.');
      }
      
      chat = new ChatGoogleGenerativeAI({
        apiKey,
        model,
        temperature: 0.7,
        maxOutputTokens: 2048,
      });
      break;
    }
  }
  
  return chat;
}

/**
 * Create LangChain tools for database queries
 * These tools allow the AI agent to interact with user data
 */
export function createDatabaseTools(accountIds?: string[]) {
  // Tool: Search Emails
  const searchEmailsTool = new DynamicStructuredTool({
    name: 'search_emails',
    description: 'Search emails by keywords in subject or sender. Returns matching emails with subject, sender, preview, and timestamp. Use this when user asks about emails or specific senders.',
    schema: z.object({
      query: z.string().describe('Keywords to search for in email subject or sender'),
      limit: z.number().optional().describe('Maximum number of results to return (default: 10)')
    }),
    func: async ({ query, limit = 10 }) => {
      const allEmails = await db.emails.getAll();
      const emails = accountIds && accountIds.length > 0
        ? allEmails.filter(e => accountIds.includes(e.accountId))
        : allEmails;
      
      const searchLower = query.toLowerCase();
      const matches = emails.filter(e => 
        e.subject.toLowerCase().includes(searchLower) || 
        e.sender.toLowerCase().includes(searchLower)
      ).slice(0, limit);
      
      if (matches.length === 0) {
        return `No emails found matching "${query}"`;
      }
      
      return JSON.stringify(matches.map(e => ({
        subject: e.subject,
        sender: e.sender,
        preview: e.preview,
        timestamp: new Date(e.timestamp).toLocaleString(),
        isRead: e.isRead,
        isImportant: e.isImportant
      })), null, 2);
    }
  });

  // Tool: Find Calendar Events
  const findEventsTool = new DynamicStructuredTool({
    name: 'find_calendar_events',
    description: 'Find calendar events for a specific date or date range. Returns events with title, time, location, and attendees. Use when user asks about schedule, meetings, or events.',
    schema: z.object({
      startDate: z.string().describe('Start date in YYYY-MM-DD format'),
      endDate: z.string().optional().describe('End date in YYYY-MM-DD format (optional)'),
    }),
    func: async ({ startDate, endDate }) => {
      const allEvents = await db.events.getAll();
      const events = accountIds && accountIds.length > 0
        ? allEvents.filter(e => accountIds.includes(e.accountId))
        : allEvents;
      
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : new Date(startDate);
      end.setHours(23, 59, 59, 999);
      
      const matches = events.filter(e => {
        const eventDate = new Date(e.startTime);
        return eventDate >= start && eventDate <= end;
      });
      
      if (matches.length === 0) {
        return `No events found between ${startDate} and ${endDate || startDate}`;
      }
      
      return JSON.stringify(matches.map(e => ({
        title: e.title,
        startTime: new Date(e.startTime).toLocaleString(),
        endTime: new Date(e.endTime).toLocaleString(),
        location: e.location || 'No location',
        attendees: e.attendees ? JSON.parse(e.attendees) : [],
        description: e.description
      })), null, 2);
    }
  });

  // Tool: Check Notifications
  const checkNotificationsTool = new DynamicStructuredTool({
    name: 'check_notifications',
    description: 'Check notifications from specific platforms (Gmail, Slack, GitHub, etc.) or get all unread notifications. Use when user asks about notifications, alerts, or updates.',
    schema: z.object({
      platform: z.string().optional().describe('Filter by platform (e.g., "gmail", "slack", "github") or omit for all'),
      unreadOnly: z.boolean().optional().describe('Only show unread notifications (default: true)')
    }),
    func: async ({ platform, unreadOnly = true }) => {
      const allNotifications = await db.notifications.getAll();
      let notifications = accountIds && accountIds.length > 0
        ? allNotifications.filter(n => accountIds.includes(n.accountId))
        : allNotifications;
      
      if (unreadOnly) {
        notifications = notifications.filter(n => !n.isRead);
      }
      
      if (platform) {
        const accounts = await db.accounts.getAll();
        const platformAccounts = accounts.filter(a => 
          a.platform.toLowerCase().includes(platform.toLowerCase())
        );
        const platformAccountIds = platformAccounts.map(a => a.id);
        notifications = notifications.filter(n => platformAccountIds.includes(n.accountId));
      }
      
      if (notifications.length === 0) {
        return `No ${unreadOnly ? 'unread ' : ''}notifications${platform ? ` from ${platform}` : ''}`;
      }
      
      return JSON.stringify(notifications.slice(0, 20).map(n => ({
        title: n.title,
        message: n.message,
        timestamp: new Date(n.timestamp).toLocaleString(),
        type: n.type,
        isRead: n.isRead,
        priority: n.priority
      })), null, 2);
    }
  });

  // Tool: Query GitHub Activity
  const queryGitHubTool = new DynamicStructuredTool({
    name: 'query_github',
    description: 'Query GitHub pull requests and issues. Can filter by type (pr/issue) and state (open/closed). Use when user asks about GitHub, code reviews, or issues.',
    schema: z.object({
      type: z.enum(['pr', 'issue', 'all']).optional().describe('Type of items to query: "pr", "issue", or "all"'),
      state: z.enum(['open', 'closed', 'all']).optional().describe('State filter: "open", "closed", or "all"')
    }),
    func: async ({ type = 'all', state = 'all' }) => {
      try {
        const allItems = await db.github.getAll();
        let items = accountIds && accountIds.length > 0
          ? allItems.filter(i => accountIds.includes(i.accountId))
          : allItems;
        
        if (type !== 'all') {
          items = items.filter(i => i.type === type);
        }
        
        if (state !== 'all') {
          items = items.filter(i => i.state === state);
        }
        
        if (items.length === 0) {
          return `No GitHub ${type === 'all' ? 'items' : type === 'pr' ? 'pull requests' : 'issues'} found${state !== 'all' ? ` with state: ${state}` : ''}`;
        }
        
        return JSON.stringify(items.slice(0, 15).map(i => ({
          type: i.type,
          title: i.title,
          repository: i.repository,
          state: i.state,
          author: i.author,
          url: i.url,
          createdAt: new Date(i.createdAtGithub).toLocaleString(),
          commentsCount: i.commentsCount
        })), null, 2);
      } catch (error) {
        return 'GitHub data not available. Please connect a GitHub account.';
      }
    }
  });

  // Tool: Get Current Time
  const getCurrentTimeTool = new DynamicStructuredTool({
    name: 'get_current_time',
    description: 'Get the current date and time. Useful for understanding temporal context in queries like "today", "tomorrow", "this week".',
    schema: z.object({}),
    func: async () => {
      const now = new Date();
      return JSON.stringify({
        datetime: now.toLocaleString(),
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
        timestamp: now.toISOString()
      }, null, 2);
    }
  });

  // Tool: Get Account Summary
  const getAccountSummaryTool = new DynamicStructuredTool({
    name: 'get_account_summary',
    description: 'Get a summary of connected accounts and their data statistics. Use when user asks about their accounts or overview.',
    schema: z.object({}),
    func: async () => {
      const allAccounts = await db.accounts.getAll();
      const accounts = accountIds && accountIds.length > 0
        ? allAccounts.filter(a => accountIds.includes(a.id))
        : allAccounts;
      
      const allEmails = await db.emails.getAll();
      const emails = accountIds && accountIds.length > 0
        ? allEmails.filter(e => accountIds.includes(e.accountId))
        : allEmails;
      
      const allEvents = await db.events.getAll();
      const events = accountIds && accountIds.length > 0
        ? allEvents.filter(e => accountIds.includes(e.accountId))
        : allEvents;
      
      const allNotifications = await db.notifications.getAll();
      const notifications = accountIds && accountIds.length > 0
        ? allNotifications.filter(n => accountIds.includes(n.accountId))
        : allNotifications;
      
      return JSON.stringify({
        accounts: accounts.map(a => ({
          name: a.name,
          platform: a.platform,
          email: a.email
        })),
        stats: {
          totalEmails: emails.length,
          unreadEmails: emails.filter(e => !e.isRead).length,
          totalEvents: events.length,
          upcomingEvents: events.filter(e => new Date(e.startTime) > new Date()).length,
          unreadNotifications: notifications.filter(n => !n.isRead).length
        }
      }, null, 2);
    }
  });

  // Tool: Get All Accounts
  const getAllAccountsTool = new DynamicStructuredTool({
    name: 'get_all_accounts',
    description: 'Get detailed list of all connected accounts with platform, email, connection status. Use when user asks about connected accounts or wants to know what platforms are available.',
    schema: z.object({}),
    func: async () => {
      const allAccounts = await db.accounts.getAll();
      const accounts = accountIds && accountIds.length > 0
        ? allAccounts.filter(a => accountIds.includes(a.id))
        : allAccounts;
      
      if (accounts.length === 0) {
        return 'No accounts connected yet.';
      }
      
      return JSON.stringify(accounts.map(a => ({
        name: a.name,
        email: a.email,
        platform: a.platform,
        category: a.category,
        isConnected: a.isConnected,
        color: a.color
      })), null, 2);
    }
  });

  // Tool: Get Unread Emails
  const getUnreadEmailsTool = new DynamicStructuredTool({
    name: 'get_unread_emails',
    description: 'Get all unread emails with details. Use when user asks about unread messages or inbox status.',
    schema: z.object({
      limit: z.number().optional().describe('Maximum number of results (default: 20)')
    }),
    func: async ({ limit = 20 }) => {
      const allUnread = await db.emails.getUnread();
      const emails = accountIds && accountIds.length > 0
        ? allUnread.filter(e => accountIds.includes(e.accountId))
        : allUnread;
      
      if (emails.length === 0) {
        return 'No unread emails.';
      }
      
      return JSON.stringify(emails.slice(0, limit).map(e => ({
        subject: e.subject,
        sender: e.sender,
        preview: e.preview,
        timestamp: new Date(e.timestamp).toLocaleString(),
        labels: e.labels,
        isImportant: e.isImportant
      })), null, 2);
    }
  });

  // Tool: Get Important Emails
  const getImportantEmailsTool = new DynamicStructuredTool({
    name: 'get_important_emails',
    description: 'Get emails marked as important or high priority. Use when user asks about important messages.',
    schema: z.object({
      limit: z.number().optional().describe('Maximum number of results (default: 15)')
    }),
    func: async ({ limit = 15 }) => {
      const allEmails = await db.emails.getAll();
      const emails = accountIds && accountIds.length > 0
        ? allEmails.filter(e => accountIds.includes(e.accountId))
        : allEmails;
      
      const important = emails.filter(e => e.isImportant);
      
      if (important.length === 0) {
        return 'No important emails found.';
      }
      
      return JSON.stringify(important.slice(0, limit).map(e => ({
        subject: e.subject,
        sender: e.sender,
        preview: e.preview,
        timestamp: new Date(e.timestamp).toLocaleString(),
        isRead: e.isRead,
        aiPriority: e.aiPriority
      })), null, 2);
    }
  });

  // Tool: Get Upcoming Events
  const getUpcomingEventsTool = new DynamicStructuredTool({
    name: 'get_upcoming_events',
    description: 'Get upcoming calendar events sorted by start time. Use when user asks about schedule, upcoming meetings, or what\'s next.',
    schema: z.object({
      limit: z.number().optional().describe('Number of upcoming events to return (default: 10)')
    }),
    func: async ({ limit = 10 }) => {
      const allEvents = await db.events.getUpcoming(limit);
      const events = accountIds && accountIds.length > 0
        ? allEvents.filter(e => accountIds.includes(e.accountId))
        : allEvents;
      
      if (events.length === 0) {
        return 'No upcoming events scheduled.';
      }
      
      return JSON.stringify(events.map(e => ({
        title: e.title,
        startTime: new Date(e.startTime).toLocaleString(),
        endTime: new Date(e.endTime).toLocaleString(),
        location: e.location || 'No location',
        attendees: e.attendees || [],
        description: e.description,
        aiBriefing: e.aiBriefing
      })), null, 2);
    }
  });

  // Tool: Search Events by Date Range
  const searchEventsByDateTool = new DynamicStructuredTool({
    name: 'search_events_by_date',
    description: 'Search events within a specific date range. Use for questions like "meetings this week" or "events next month".',
    schema: z.object({
      startDate: z.string().describe('Start date in YYYY-MM-DD format'),
      endDate: z.string().describe('End date in YYYY-MM-DD format')
    }),
    func: async ({ startDate, endDate }) => {
      const allEvents = await db.events.getByDateRange(startDate, endDate);
      const events = accountIds && accountIds.length > 0
        ? allEvents.filter(e => accountIds.includes(e.accountId))
        : allEvents;
      
      if (events.length === 0) {
        return `No events found between ${startDate} and ${endDate}`;
      }
      
      return JSON.stringify(events.map(e => ({
        title: e.title,
        startTime: new Date(e.startTime).toLocaleString(),
        endTime: new Date(e.endTime).toLocaleString(),
        location: e.location,
        attendees: e.attendees,
        isAllDay: e.isAllDay
      })), null, 2);
    }
  });

  // Tool: Get Folders
  const getFoldersTool = new DynamicStructuredTool({
    name: 'get_folders',
    description: 'Get all folders/groups organizing accounts. Use when user asks about organization or grouped accounts.',
    schema: z.object({}),
    func: async () => {
      const folders = await db.folders.getAll();
      
      if (folders.length === 0) {
        return 'No folders created yet.';
      }
      
      return JSON.stringify(folders.map(f => ({
        name: f.name,
        color: f.color,
        accountCount: f.accountIds.length
      })), null, 2);
    }
  });

  // Tool: Get Account by Platform
  const getAccountsByPlatformTool = new DynamicStructuredTool({
    name: 'get_accounts_by_platform',
    description: 'Get accounts filtered by platform (gmail, outlook, slack, github, whatsapp, telegram, discord). Use when user asks about specific platform accounts.',
    schema: z.object({
      platform: z.string().describe('Platform name: gmail, outlook, slack, github, whatsapp, telegram, discord')
    }),
    func: async ({ platform }) => {
      const accounts = await db.accounts.getByPlatform(platform.toLowerCase());
      
      if (accounts.length === 0) {
        return `No ${platform} accounts connected.`;
      }
      
      return JSON.stringify(accounts.map(a => ({
        name: a.name,
        email: a.email,
        isConnected: a.isConnected
      })), null, 2);
    }
  });

  // Tool: Get Emails by Tag
  const getEmailsByTagTool = new DynamicStructuredTool({
    name: 'get_emails_by_tag',
    description: 'Get emails filtered by tag/label. Use when user asks about tagged or labeled emails.',
    schema: z.object({
      tag: z.string().describe('Tag/label name to filter by'),
      limit: z.number().optional().describe('Maximum results (default: 15)')
    }),
    func: async ({ tag, limit = 15 }) => {
      const allEmails = await db.emails.getByTag(tag);
      const emails = accountIds && accountIds.length > 0
        ? allEmails.filter(e => accountIds.includes(e.accountId))
        : allEmails;
      
      if (emails.length === 0) {
        return `No emails found with tag: ${tag}`;
      }
      
      return JSON.stringify(emails.slice(0, limit).map(e => ({
        subject: e.subject,
        sender: e.sender,
        timestamp: new Date(e.timestamp).toLocaleString(),
        tags: e.tags,
        isRead: e.isRead
      })), null, 2);
    }
  });

  // Tool: Get Email by Account
  const getEmailsByAccountTool = new DynamicStructuredTool({
    name: 'get_emails_by_account',
    description: 'Get emails from a specific account. Use when user asks about emails from a particular account.',
    schema: z.object({
      accountId: z.string().describe('Account ID to get emails from'),
      limit: z.number().optional().describe('Maximum results (default: 20)')
    }),
    func: async ({ accountId, limit = 20 }) => {
      const emails = await db.emails.getByAccount(accountId);
      
      if (emails.length === 0) {
        return `No emails found for account: ${accountId}`;
      }
      
      return JSON.stringify(emails.slice(0, limit).map(e => ({
        subject: e.subject,
        sender: e.sender,
        preview: e.preview,
        timestamp: new Date(e.timestamp).toLocaleString(),
        isRead: e.isRead
      })), null, 2);
    }
  });

  // Tool: Get Unread Notifications
  const getUnreadNotificationsTool = new DynamicStructuredTool({
    name: 'get_unread_notifications',
    description: 'Get all unread notifications across all platforms. Use when user asks about new notifications or alerts.',
    schema: z.object({
      limit: z.number().optional().describe('Maximum results (default: 25)')
    }),
    func: async ({ limit = 25 }) => {
      const allUnread = await db.notifications.getUnread();
      const notifications = accountIds && accountIds.length > 0
        ? allUnread.filter(n => accountIds.includes(n.accountId))
        : allUnread;
      
      if (notifications.length === 0) {
        return 'No unread notifications.';
      }
      
      return JSON.stringify(notifications.slice(0, limit).map(n => ({
        title: n.title,
        message: n.message,
        type: n.type,
        priority: n.priority,
        timestamp: new Date(n.timestamp).toLocaleString(),
        actionUrl: n.actionUrl
      })), null, 2);
    }
  });

  // Tool: Get GitHub Items by Type
  const getGitHubByTypeTool = new DynamicStructuredTool({
    name: 'get_github_by_type',
    description: 'Get GitHub items filtered by type (pr or issue). Use when user specifically asks about pull requests or issues.',
    schema: z.object({
      type: z.enum(['pr', 'issue']).describe('Type: "pr" for pull requests or "issue" for issues')
    }),
    func: async ({ type }) => {
      try {
        const items = await db.github.getByType(type);
        const filtered = accountIds && accountIds.length > 0
          ? items.filter(i => accountIds.includes(i.accountId))
          : items;
        
        if (filtered.length === 0) {
          return `No ${type === 'pr' ? 'pull requests' : 'issues'} found.`;
        }
        
        return JSON.stringify(filtered.slice(0, 20).map(i => ({
          title: i.title,
          repository: i.repository,
          state: i.state,
          author: i.author,
          url: i.url,
          commentsCount: i.commentsCount,
          labels: i.labels,
          createdAt: new Date(i.createdAt).toLocaleString()
        })), null, 2);
      } catch (error) {
        return 'GitHub data not available.';
      }
    }
  });

  // Tool: Get Chat Sessions
  const getChatSessionsTool = new DynamicStructuredTool({
    name: 'get_chat_sessions',
    description: 'Get all previous chat sessions/conversations. Use when user asks about chat history or previous conversations.',
    schema: z.object({}),
    func: async () => {
      try {
        const sessions = await db.chatSessions.getAll();
        
        if (sessions.length === 0) {
          return 'No previous chat sessions.';
        }
        
        return JSON.stringify(sessions.map(s => ({
          id: s.id,
          title: s.title,
          accountIds: s.account_ids ? JSON.parse(s.account_ids) : [],
          createdAt: new Date(s.created_at).toLocaleString(),
          updatedAt: new Date(s.updated_at).toLocaleString()
        })), null, 2);
      } catch (error) {
        return 'Unable to retrieve chat sessions.';
      }
    }
  });

  // Tool: Get WhatsApp Chats
  const getWhatsAppChatsTool = new DynamicStructuredTool({
    name: 'get_whatsapp_chats',
    description: 'Get WhatsApp chats and conversations. Returns chat names, last messages, and unread counts. Use when user asks about WhatsApp messages or conversations.',
    schema: z.object({
      accountId: z.string().optional().describe('WhatsApp account ID (optional, uses first connected account if omitted)'),
      limit: z.number().optional().describe('Maximum number of chats (default: 20)')
    }),
    func: async ({ accountId, limit = 20 }) => {
      try {
        let accId = accountId;
        
        // If no accountId provided, get the first WhatsApp account
        if (!accId) {
          const accounts = await db.whatsapp.getAccounts();
          if (accounts.length === 0) {
            return 'No WhatsApp account connected.';
          }
          accId = accounts[0].id;
        }
        
        const chats = await db.whatsapp.getChats(accId);
        
        if (chats.length === 0) {
          return 'No WhatsApp chats found.';
        }
        
        return JSON.stringify(chats.slice(0, limit).map(c => ({
          name: c.name,
          isGroup: Boolean(c.is_group),
          unreadCount: c.unread_count,
          lastMessage: c.last_message,
          lastMessageTime: c.last_message_time ? new Date(c.last_message_time).toLocaleString() : null
        })), null, 2);
      } catch (error) {
        return 'WhatsApp data not available. Please connect WhatsApp.';
      }
    }
  });

  // Tool: Get WhatsApp Recent Messages
  const getWhatsAppMessagesTool = new DynamicStructuredTool({
    name: 'get_whatsapp_messages',
    description: 'Get recent WhatsApp messages across all chats. Use when user asks about recent WhatsApp activity or specific message content.',
    schema: z.object({
      accountId: z.string().optional().describe('WhatsApp account ID (optional)'),
      limit: z.number().optional().describe('Number of messages (default: 30)')
    }),
    func: async ({ accountId, limit = 30 }) => {
      try {
        let accId = accountId;
        
        if (!accId) {
          const accounts = await db.whatsapp.getAccounts();
          if (accounts.length === 0) {
            return 'No WhatsApp account connected.';
          }
          accId = accounts[0].id;
        }
        
        const messages = await db.whatsapp.getRecentMessages(accId, limit);
        
        if (messages.length === 0) {
          return 'No WhatsApp messages found.';
        }
        
        return JSON.stringify(messages.map(m => ({
          from: m.from_name,
          body: m.body,
          timestamp: new Date(m.timestamp).toLocaleString(),
          isFromMe: Boolean(m.is_from_me),
          hasMedia: Boolean(m.has_media),
          messageType: m.message_type
        })), null, 2);
      } catch (error) {
        return 'Unable to retrieve WhatsApp messages.';
      }
    }
  });

  // Tool: Get Discord Servers
  const getDiscordServersTool = new DynamicStructuredTool({
    name: 'get_discord_servers',
    description: 'Get Discord servers/guilds the user is member of. Returns server names, member counts, and permissions. Use when user asks about Discord servers.',
    schema: z.object({
      accountId: z.string().describe('Discord account ID')
    }),
    func: async ({ accountId }) => {
      try {
        const guilds = await db.discord.getGuilds(accountId);
        
        if (guilds.length === 0) {
          return 'No Discord servers found for this account.';
        }
        
        return JSON.stringify(guilds.map(g => ({
          name: g.name,
          isOwner: Boolean(g.owner),
          memberCount: g.member_count,
          presenceCount: g.presence_count,
          features: g.features ? JSON.parse(g.features) : []
        })), null, 2);
      } catch (error) {
        return 'Discord data not available. Please connect Discord.';
      }
    }
  });

  // Tool: Get Discord Recent Messages
  const getDiscordMessagesTool = new DynamicStructuredTool({
    name: 'get_discord_messages',
    description: 'Get recent Discord messages across channels. Use when user asks about Discord conversations or recent activity.',
    schema: z.object({
      accountId: z.string().describe('Discord account ID'),
      limit: z.number().optional().describe('Number of messages (default: 50)')
    }),
    func: async ({ accountId, limit = 50 }) => {
      try {
        const messages = await db.discord.getRecentMessages(accountId, limit);
        
        if (messages.length === 0) {
          return 'No Discord messages found.';
        }
        
        return JSON.stringify(messages.map(m => ({
          author: m.author_username,
          content: m.content,
          timestamp: new Date(m.timestamp).toLocaleString(),
          hasAttachments: m.attachments ? JSON.parse(m.attachments).length > 0 : false,
          hasEmbeds: m.embeds ? JSON.parse(m.embeds).length > 0 : false
        })), null, 2);
      } catch (error) {
        return 'Unable to retrieve Discord messages.';
      }
    }
  });

  // Tool: Get Telegram Chats
  const getTelegramChatsTool = new DynamicStructuredTool({
    name: 'get_telegram_chats',
    description: 'Get Telegram chats and conversations. Returns chat names, last messages, and unread counts. Use when user asks about Telegram messages or conversations.',
    schema: z.object({
      accountId: z.string().optional().describe('Telegram account ID (optional, uses first connected account if omitted)'),
      limit: z.number().optional().describe('Maximum number of chats (default: 20)')
    }),
    func: async ({ accountId, limit = 20 }) => {
      try {
        let accId = accountId;
        
        // If no accountId provided, get the first Telegram account
        if (!accId) {
          const accounts = await db.telegram.getAccounts();
          if (accounts.length === 0) {
            return 'No Telegram account connected.';
          }
          accId = accounts[0].id;
        }
        
        const chats = await db.telegram.getChats(accId);
        
        if (chats.length === 0) {
          return 'No Telegram chats found.';
        }
        
        return JSON.stringify(chats.slice(0, limit).map(c => ({
          name: c.name,
          isGroup: Boolean(c.is_group),
          isChannel: Boolean(c.is_channel),
          unreadCount: c.unread_count,
          lastMessage: c.last_message,
          lastMessageTime: c.last_message_time ? new Date(c.last_message_time).toLocaleString() : null
        })), null, 2);
      } catch (error) {
        return 'Telegram data not available. Please connect Telegram.';
      }
    }
  });

  // Tool: Get Telegram Recent Messages
  const getTelegramMessagesTool = new DynamicStructuredTool({
    name: 'get_telegram_messages',
    description: 'Get recent Telegram messages across all chats. Use when user asks about recent Telegram activity or specific message content.',
    schema: z.object({
      accountId: z.string().optional().describe('Telegram account ID (optional)'),
      limit: z.number().optional().describe('Number of messages (default: 30)')
    }),
    func: async ({ accountId, limit = 30 }) => {
      try {
        let accId = accountId;
        
        if (!accId) {
          const accounts = await db.telegram.getAccounts();
          if (accounts.length === 0) {
            return 'No Telegram account connected.';
          }
          accId = accounts[0].id;
        }
        
        const messages = await db.telegram.getRecentMessages(accId, limit);
        
        if (messages.length === 0) {
          return 'No Telegram messages found.';
        }
        
        return JSON.stringify(messages.map(m => ({
          from: m.from_name,
          body: m.body,
          timestamp: new Date(m.timestamp).toLocaleString(),
          isFromMe: Boolean(m.is_from_me),
          hasMedia: Boolean(m.has_media),
          messageType: m.message_type
        })), null, 2);
      } catch (error) {
        return 'Unable to retrieve Telegram messages.';
      }
    }
  });

  // Tool: Search All Communications
  const searchAllCommunicationsTool = new DynamicStructuredTool({
    name: 'search_all_communications',
    description: 'Search across ALL communication sources (emails, WhatsApp, Telegram, Discord, chat sessions) by keywords. Use when user wants to find specific information across all platforms.',
    schema: z.object({
      query: z.string().describe('Keywords to search for'),
      limit: z.number().optional().describe('Max results per source (default: 10)')
    }),
    func: async ({ query, limit = 10 }) => {
      const results: any = {
        emails: [],
        whatsappMessages: [],
        telegramMessages: [],
        discordMessages: [],
        chatSessions: []
      };
      
      const searchLower = query.toLowerCase();
      
      // Search emails
      try {
        const allEmails = await db.emails.getAll();
        const filtered = accountIds && accountIds.length > 0
          ? allEmails.filter(e => accountIds.includes(e.accountId))
          : allEmails;
        
        results.emails = filtered
          .filter(e => 
            e.subject.toLowerCase().includes(searchLower) || 
            e.preview.toLowerCase().includes(searchLower) ||
            e.sender.toLowerCase().includes(searchLower)
          )
          .slice(0, limit)
          .map(e => ({
            source: 'email',
            subject: e.subject,
            from: e.sender,
            preview: e.preview.substring(0, 100),
            timestamp: new Date(e.timestamp).toLocaleString()
          }));
      } catch (error) {
        // Skip if no email access
      }
      
      // Search WhatsApp messages
      try {
        const accounts = await db.whatsapp.getAccounts();
        if (accounts.length > 0) {
          const messages = await db.whatsapp.getRecentMessages(accounts[0].id, 100);
          results.whatsappMessages = messages
            .filter(m => 
              m.body.toLowerCase().includes(searchLower) ||
              m.from_name.toLowerCase().includes(searchLower)
            )
            .slice(0, limit)
            .map(m => ({
              source: 'whatsapp',
              from: m.from_name,
              message: m.body.substring(0, 100),
              timestamp: new Date(m.timestamp).toLocaleString()
            }));
        }
      } catch (error) {
        // Skip if no WhatsApp access
      }
      
      // Search Telegram messages
      try {
        const accounts = await db.telegram.getAccounts();
        if (accounts.length > 0) {
          const messages = await db.telegram.getRecentMessages(accounts[0].id, 100);
          results.telegramMessages = messages
            .filter(m => 
              m.body.toLowerCase().includes(searchLower) ||
              m.from_name.toLowerCase().includes(searchLower)
            )
            .slice(0, limit)
            .map(m => ({
              source: 'telegram',
              from: m.from_name,
              message: m.body.substring(0, 100),
              timestamp: new Date(m.timestamp).toLocaleString()
            }));
        }
      } catch (error) {
        // Skip if no Telegram access
      }
      
      // Search Discord messages
      try {
        const allAccounts = await db.accounts.getAll();
        const discordAccounts = allAccounts.filter(a => a.platform === 'discord');
        
        for (const account of discordAccounts.slice(0, 1)) {
          const messages = await db.discord.getRecentMessages(account.id, 100);
          results.discordMessages.push(...messages
            .filter(m => 
              m.content.toLowerCase().includes(searchLower) ||
              m.author_username.toLowerCase().includes(searchLower)
            )
            .slice(0, limit)
            .map(m => ({
              source: 'discord',
              author: m.author_username,
              content: m.content.substring(0, 100),
              timestamp: new Date(m.timestamp).toLocaleString()
            })));
        }
      } catch (error) {
        // Skip if no Discord access
      }
      
      // Search chat sessions
      try {
        const sessions = await db.chatSessions.getAll();
        results.chatSessions = sessions
          .filter(s => s.title.toLowerCase().includes(searchLower))
          .slice(0, limit)
          .map(s => ({
            source: 'chat_session',
            title: s.title,
            updated: new Date(s.updated_at).toLocaleString()
          }));
      } catch (error) {
        // Skip if no chat access
      }
      
      const totalResults = results.emails.length + 
                          results.whatsappMessages.length + 
                          results.telegramMessages.length +
                          results.discordMessages.length + 
                          results.chatSessions.length;
      
      if (totalResults === 0) {
        return `No results found for "${query}" across any communication platform.`;
      }
      
      return JSON.stringify({
        query,
        totalResults,
        results
      }, null, 2);
    }
  });

  // Tool: Get Communication Stats
  const getCommunicationStatsTool = new DynamicStructuredTool({
    name: 'get_communication_stats',
    description: 'Get comprehensive statistics across all communication platforms (emails, WhatsApp, Discord, chat). Use when user asks about overall activity or wants a summary.',
    schema: z.object({}),
    func: async () => {
      const stats: any = {
        platforms: [],
        totalMessages: 0,
        unreadCount: 0
      };
      
      // Email stats
      try {
        const emails = await db.emails.getAll();
        const filtered = accountIds && accountIds.length > 0
          ? emails.filter(e => accountIds.includes(e.accountId))
          : emails;
        
        stats.platforms.push({
          platform: 'email',
          total: filtered.length,
          unread: filtered.filter(e => !e.isRead).length,
          important: filtered.filter(e => e.isImportant).length
        });
        stats.totalMessages += filtered.length;
        stats.unreadCount += filtered.filter(e => !e.isRead).length;
      } catch (error) {
        // Skip
      }
      
      // WhatsApp stats
      try {
        const accounts = await db.whatsapp.getAccounts();
        if (accounts.length > 0) {
          const chats = await db.whatsapp.getChats(accounts[0].id);
          const messages = await db.whatsapp.getRecentMessages(accounts[0].id, 1000);
          
          stats.platforms.push({
            platform: 'whatsapp',
            chats: chats.length,
            unreadChats: chats.filter(c => c.unread_count > 0).length,
            totalMessages: messages.length,
            recentMessages: messages.filter(m => 
              new Date(m.timestamp) > new Date(Date.now() - 24*60*60*1000)
            ).length
          });
          stats.totalMessages += messages.length;
        }
      } catch (error) {
        // Skip
      }
      
      // Telegram stats
      try {
        const accounts = await db.telegram.getAccounts();
        if (accounts.length > 0) {
          const chats = await db.telegram.getChats(accounts[0].id);
          const messages = await db.telegram.getRecentMessages(accounts[0].id, 1000);
          
          stats.platforms.push({
            platform: 'telegram',
            chats: chats.length,
            unreadChats: chats.filter(c => c.unread_count > 0).length,
            totalMessages: messages.length,
            recentMessages: messages.filter(m => 
              new Date(m.timestamp) > new Date(Date.now() - 24*60*60*1000)
            ).length
          });
          stats.totalMessages += messages.length;
        }
      } catch (error) {
        // Skip
      }
      
      // Discord stats
      try {
        const allAccounts = await db.accounts.getAll();
        const discordAccounts = allAccounts.filter(a => a.platform === 'discord');
        
        if (discordAccounts.length > 0) {
          const messages = await db.discord.getRecentMessages(discordAccounts[0].id, 1000);
          
          stats.platforms.push({
            platform: 'discord',
            totalMessages: messages.length,
            recentMessages: messages.filter(m => 
              new Date(m.timestamp) > new Date(Date.now() - 24*60*60*1000)
            ).length
          });
          stats.totalMessages += messages.length;
        }
      } catch (error) {
        // Skip
      }
      
      // Chat sessions stats
      try {
        const sessions = await db.chatSessions.getAll();
        stats.platforms.push({
          platform: 'ai_chat',
          totalSessions: sessions.length,
          recentSessions: sessions.filter(s => 
            new Date(s.updated_at) > new Date(Date.now() - 7*24*60*60*1000)
          ).length
        });
      } catch (error) {
        // Skip
      }
      
      return JSON.stringify(stats, null, 2);
    }
  });

  // Tool: Get Recent Activity Across All Platforms
  const getRecentActivityTool = new DynamicStructuredTool({
    name: 'get_recent_activity',
    description: 'Get recent activity timeline across all platforms (emails, WhatsApp, Telegram, Discord, calendar). Shows what happened recently across all sources. Use when user asks "what\'s new" or "recent activity".',
    schema: z.object({
      hoursAgo: z.number().optional().describe('How many hours back to look (default: 24)')
    }),
    func: async ({ hoursAgo = 24 }) => {
      const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
      const activity: any[] = [];
      
      // Recent emails
      try {
        const emails = await db.emails.getAll();
        const filtered = accountIds && accountIds.length > 0
          ? emails.filter(e => accountIds.includes(e.accountId))
          : emails;
        
        filtered
          .filter(e => new Date(e.timestamp) > cutoff)
          .forEach(e => activity.push({
            platform: 'email',
            type: 'email_received',
            from: e.sender,
            subject: e.subject,
            timestamp: e.timestamp,
            isRead: e.isRead
          }));
      } catch (error) {
        // Skip
      }
      
      // Recent WhatsApp
      try {
        const accounts = await db.whatsapp.getAccounts();
        if (accounts.length > 0) {
          const messages = await db.whatsapp.getRecentMessages(accounts[0].id, 100);
          messages
            .filter(m => new Date(m.timestamp) > cutoff)
            .forEach(m => activity.push({
              platform: 'whatsapp',
              type: 'message',
              from: m.from_name,
              message: m.body.substring(0, 50),
              timestamp: m.timestamp,
              isFromMe: Boolean(m.is_from_me)
            }));
        }
      } catch (error) {
        // Skip
      }
      
      // Recent Telegram
      try {
        const accounts = await db.telegram.getAccounts();
        if (accounts.length > 0) {
          const messages = await db.telegram.getRecentMessages(accounts[0].id, 100);
          messages
            .filter(m => new Date(m.timestamp) > cutoff)
            .forEach(m => activity.push({
              platform: 'telegram',
              type: 'message',
              from: m.from_name,
              message: m.body.substring(0, 50),
              timestamp: m.timestamp,
              isFromMe: Boolean(m.is_from_me)
            }));
        }
      } catch (error) {
        // Skip
      }
      
      // Recent Discord
      try {
        const allAccounts = await db.accounts.getAll();
        const discordAccounts = allAccounts.filter(a => a.platform === 'discord');
        
        if (discordAccounts.length > 0) {
          const messages = await db.discord.getRecentMessages(discordAccounts[0].id, 100);
          messages
            .filter(m => new Date(m.timestamp) > cutoff)
            .forEach(m => activity.push({
              platform: 'discord',
              type: 'message',
              author: m.author_username,
              content: m.content.substring(0, 50),
              timestamp: m.timestamp
            }));
        }
      } catch (error) {
        // Skip
      }
      
      // Recent calendar events
      try {
        const events = await db.events.getUpcoming(20);
        const filtered = accountIds && accountIds.length > 0
          ? events.filter(e => accountIds.includes(e.accountId))
          : events;
        
        filtered
          .filter(e => new Date(e.startTime) > cutoff && new Date(e.startTime) < new Date(Date.now() + 7*24*60*60*1000))
          .forEach(e => activity.push({
            platform: 'calendar',
            type: 'upcoming_event',
            title: e.title,
            startTime: e.startTime,
            location: e.location
          }));
      } catch (error) {
        // Skip
      }
      
      // Sort by timestamp
      activity.sort((a, b) => 
        new Date(b.timestamp || b.startTime).getTime() - 
        new Date(a.timestamp || a.startTime).getTime()
      );
      
      if (activity.length === 0) {
        return `No activity in the last ${hoursAgo} hours.`;
      }
      
      return JSON.stringify({
        timeRange: `Last ${hoursAgo} hours`,
        totalItems: activity.length,
        activity: activity.slice(0, 30).map(a => ({
          ...a,
          timestamp: new Date(a.timestamp || a.startTime).toLocaleString()
        }))
      }, null, 2);
    }
  });

  // Tool: Create Digital Sticky Note
  const createNoteTool = new DynamicStructuredTool({
    name: 'create_note',
    description: 'Create a new digital sticky note with a title, content, and optional category and color style. Styles include: default (yellow), blue, green, purple, red, dark. Use this when user wants to remember something, take a note, or create a reminder.',
    schema: z.object({
      title: z.string().describe('Short title for the note'),
      content: z.string().describe('Detailed content of the note'),
      category: z.string().optional().describe('Category for the note (e.g., Work, Personal, Ideas)'),
      style: z.enum(['default', 'blue', 'green', 'purple', 'red', 'dark']).optional().describe('Color style for the note'),
      isPinned: z.boolean().optional().describe('Whether the note should be pinned to the screen (float over other windows)')
    }),
    func: async ({ title, content, category = 'General', style = 'default', isPinned = false }) => {
      try {
        const note = await db.notes.upsert({
          title,
          content,
          category,
          isPinned,
          style: {
            color: style,
            fontSize: 'base'
          }
        });
        return `Successfully created note: "${title}" (ID: ${note.id}). ${isPinned ? 'It is pinned and floating on screen.' : ''}`;
      } catch (err: any) {
        return `Error creating note: ${err.message}`;
      }
    }
  });

  // Tool: Get Notes
  const getNotesTool = new DynamicStructuredTool({
    name: 'get_notes',
    description: 'Retrieve user notes, optionally filtered by category or pinning status. Use this when user asks what notes they have or to look up something they previously saved.',
    schema: z.object({
      category: z.string().optional().describe('Filter by category'),
      pinnedOnly: z.boolean().optional().describe('Only return pinned notes')
    }),
    func: async ({ category, pinnedOnly }) => {
      try {
        let notes = await db.notes.getAll();
        if (category) {
          notes = notes.filter(n => n.category.toLowerCase() === category.toLowerCase());
        }
        if (pinnedOnly) {
          notes = notes.filter(n => n.isPinned);
        }
        
        if (notes.length === 0) {
          return `No notes found${category ? ` in category "${category}"` : ''}${pinnedOnly ? ' that are pinned' : ''}.`;
        }
        
        return JSON.stringify(notes.map(n => ({
          id: n.id,
          title: n.title,
          content: n.content,
          category: n.category,
          isPinned: n.isPinned,
          updatedAt: n.updatedAt
        })), null, 2);
      } catch (err: any) {
        return `Error retrieving notes: ${err.message}`;
      }
    }
  });

  // Tool: Update Note
  const updateNoteTool = new DynamicStructuredTool({
    name: 'update_note',
    description: 'Update an existing note by ID. You can change the title, content, category, style, or pinning status. Use this to edit notes, pin/unpin them, or move them to different categories.',
    schema: z.object({
      id: z.number().describe('The ID of the note to update'),
      title: z.string().optional().describe('New title'),
      content: z.string().optional().describe('New content'),
      category: z.string().optional().describe('New category'),
      style: z.enum(['default', 'blue', 'green', 'purple', 'red', 'dark']).optional().describe('New color style'),
      isPinned: z.boolean().optional().describe('Update pinning status')
    }),
    func: async ({ id, title, content, category, style, isPinned }) => {
      try {
        const allNotes = await db.notes.getAll();
        const existing = allNotes.find(n => n.id === id);
        
        if (!existing) {
          return `Note with ID ${id} not found.`;
        }
        
        const updated = await db.notes.upsert({
          ...existing,
          ...(title !== undefined && { title }),
          ...(content !== undefined && { content }),
          ...(category !== undefined && { category }),
          ...(style !== undefined && { style: { ...existing.style, color: style } }),
          ...(isPinned !== undefined && { isPinned })
        });
        
        return `Successfully updated note ${id}.`;
      } catch (err: any) {
        return `Error updating note: ${err.message}`;
      }
    }
  });

  // Tool: Delete Note
  const deleteNoteTool = new DynamicStructuredTool({
    name: 'delete_note',
    description: 'Delete a note by its ID.',
    schema: z.object({
      id: z.number().describe('ID of the note to delete')
    }),
    func: async ({ id }) => {
      try {
        await db.notes.delete(id);
        return `Successfully deleted note ${id}.`;
      } catch (err: any) {
        return `Error deleting note: ${err.message}`;
      }
    }
  });

  return [
    searchEmailsTool,
    findEventsTool,
    checkNotificationsTool,
    queryGitHubTool,
    getCurrentTimeTool,
    getAccountSummaryTool,
    getAllAccountsTool,
    getUnreadEmailsTool,
    getImportantEmailsTool,
    getUpcomingEventsTool,
    searchEventsByDateTool,
    getFoldersTool,
    getAccountsByPlatformTool,
    getEmailsByTagTool,
    getEmailsByAccountTool,
    getUnreadNotificationsTool,
    getGitHubByTypeTool,
    getChatSessionsTool,
    getWhatsAppChatsTool,
    getWhatsAppMessagesTool,
    getTelegramChatsTool,
    getTelegramMessagesTool,
    getDiscordServersTool,
    getDiscordMessagesTool,
    searchAllCommunicationsTool,
    getCommunicationStatsTool,
    getRecentActivityTool,
    createNoteTool,
    getNotesTool,
    updateNoteTool,
    deleteNoteTool
  ];

  // Tool: Get Knowledge Context
  const getKnowledgeContextTool = new DynamicStructuredTool({
    name: 'get_knowledge_context',
    description: 'Get learned user context and preferences (work hours, communication style, topics of interest, frequent contacts, meeting preferences, work patterns). Use when personalizing responses or understanding user patterns.',
    schema: z.object({
      category: z.string().optional().describe('Category filter: work_hours, response_style, topics_of_interest, important_contacts, meeting_preferences, communication_style, work_patterns')
    }),
    func: async ({ category }) => {
      try {
        const contexts = category 
          ? await db.knowledgeContext.getByCategory(category)
          : await db.knowledgeContext.getAll();
        
        if (contexts.length === 0) {
          return `No knowledge context found${category ? ` for category: ${category}` : ''}. User should interact with Knowledge Base to build their profile.`;
        }
        
        return JSON.stringify(contexts.map(c => ({
          category: c.category,
          key: c.key,
          value: c.value,
          confidence: c.confidence,
          lastUpdated: c.lastUpdated
        })), null, 2);
      } catch (error) {
        return 'Knowledge context not yet available. User needs to build their profile in Knowledge Base.';
      }
    }
  });

  // Tool: Get Knowledge Insights
  const getKnowledgeInsightsTool = new DynamicStructuredTool({
    name: 'get_knowledge_insights',
    description: 'Get AI-extracted insights about user (work habits, interests, communication patterns). Use when user asks "what do you know about me?" or for personalization.',
    schema: z.object({}),
    func: async () => {
      try {
        const insights = await db.knowledgeInsights.getAll();
        
        if (insights.length === 0) {
          return 'No insights generated yet. User needs to provide more context in Knowledge Base or wait for background extraction to analyze their activities.';
        }
        
        const byCategory: { [key: string]: any[] } = {};
        insights.forEach(i => {
          if (!byCategory[i.category]) byCategory[i.category] = [];
          byCategory[i.category].push({
            fact: i.fact,
            confidence: i.confidence
          });
        });
        
        return JSON.stringify({
          totalInsights: insights.length,
          knowledgeMaturity: `${insights.length * 15}%`,
          categories: Object.keys(byCategory),
          insights: byCategory
        }, null, 2);
      } catch (error) {
        return 'Insights not available yet.';
      }
    }
  });

  // Tool: Get User Activities
  const getUserActivitiesTool = new DynamicStructuredTool({
    name: 'get_user_activities',
    description: 'Get recent user activity timeline (emails sent, messages, events attended, GitHub actions). Use for activity summaries or pattern analysis.',
    schema: z.object({
      platform: z.string().optional().describe('Filter by platform: gmail, outlook, whatsapp, telegram, discord, github, calendar'),
      actionType: z.string().optional().describe('Filter by action: email_send, email_read, message_send, event_attend, github_action, etc.'),
      limit: z.number().optional().describe('Number of activities (default: 50)')
    }),
    func: async ({ platform, actionType, limit = 50 }) => {
      try {
        let activities;
        
        if (platform) {
          activities = await db.userActivities.getByPlatform(platform, limit);
        } else if (actionType) {
          activities = await db.userActivities.getByActionType(actionType, limit);
        } else {
          activities = await db.userActivities.getAll(limit);
        }
        
        if (activities.length === 0) {
          return `No user activities recorded${platform ? ` for ${platform}` : ''}${actionType ? ` of type ${actionType}` : ''}. Activities are logged as the user interacts with emails, messages, and other platforms.`;
        }
        
        return JSON.stringify(activities.slice(0, limit).map(a => ({
          action: a.actionType,
          platform: a.platform,
          timestamp: new Date(a.timestamp).toLocaleString(),
          context: a.contextJson,
          participants: a.participants,
          topics: a.topics
        })), null, 2);
      } catch (error) {
        return 'Activity data not available yet.';
      }
    }
  });

  // Tool: Save Knowledge Insight
  const saveKnowledgeInsightTool = new DynamicStructuredTool({
    name: 'save_knowledge_insight',
    description: 'Save a new insight about the user to their knowledge base. Use this when learning new facts during conversation (work hours, preferences, habits, goals). CRITICAL: Use this IMMEDIATELY after identifying a personal fact.',
    schema: z.object({
      category: z.string().describe('Category: Work, Preferences, Communication, Schedule, Projects, Interests, Contacts, or Goals'),
      fact: z.string().describe('The insight/fact about the user (concise, specific)'),
      confidence: z.number().min(0).max(100).optional().describe('Confidence level 0-100 (default: 80)')
    }),
    func: async ({ category, fact, confidence = 80 }) => {
      try {
        console.log(`🧠 AI is saving insight: [${category}] ${fact}`);
        const insightId = `insight_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        await db.knowledgeInsights.create({
          id: insightId,
          category,
          fact,
          confidence
        });
        
        return `✅ SUCCESS: Saved insight to knowledge base: "${fact}" in category "${category}"`;
      } catch (error) {
        console.error('Failed to save insight:', error);
        return `Failed to save insight: ${error}`;
      }
    }
  });

  return [
    getCurrentTimeTool,
    searchEmailsTool,
    getUnreadEmailsTool,
    getImportantEmailsTool,
    searchEventsTool,
    getUpcomingEventsTool,
    searchEventsByDateTool,
    searchNotificationsTool,
    getUnreadNotificationsTool,
    getNotificationsByPlatformTool,
    getGitHubItemsTool,
    getGitHubByTypeTool,
    getGitHubByStateTool,
    getAccountSummaryTool,
    getAllAccountsTool,
    getFoldersTool,
    getAccountsByPlatformTool,
    getEmailsByTagTool,
    getEmailsByAccountTool,
    getChatSessionsTool,
    getWhatsAppChatsTool,
    getWhatsAppMessagesTool,
    getTelegramChatsTool,
    getTelegramMessagesTool,
    getDiscordServersTool,
    getDiscordMessagesTool,
    searchAllCommunicationsTool,
    getCommunicationStatsTool,
    getRecentActivityTool,
    getKnowledgeContextTool,
    getKnowledgeInsightsTool,
    getUserActivitiesTool,
    saveKnowledgeInsightTool
  ];
}

/**
 * Get chat response using tool-calling agent
 * @param userMessage - The user's text message
 * @param conversationHistory - Previous conversation messages
 * @param accountIds - Optional account IDs to filter data
 * @param imageBase64 - Optional base64 encoded image for vision capabilities
 */
export async function getChatResponse(
  userMessage: string,
  conversationHistory: { role: string; content: string }[],
  accountIds?: string[],
  imageBase64?: string | null
): Promise<{ text: string; sources?: any[]; toolsUsed?: string[]; reasoning?: string[] }> {
  try {
    // Reinitialize if provider changed
    const provider = await getAIProvider();
    if (provider !== currentProvider) {
      chat = null;
      currentProvider = null;
    }
    
    const chatInstance = chat || await initializeChat();
    const tools = createDatabaseTools(accountIds);
    
    // Bind tools to model for function calling
    const modelWithTools = chatInstance.bindTools(tools);
    
    // Get assistant name from storage
    const assistantName = await storage.get(STORAGE_KEYS.ASSISTANT_NAME) || 'Atlas';
    
    // Build system prompt with ReAct-style instructions
    const systemPrompt = `You are ${assistantName}, an intelligent personal assistant with COMPLETE ACCESS to ALL user data stored in the local database. Every email, message, event, notification, and conversation is permanently stored and searchable.

DATABASE COVERAGE:
✅ Emails (Gmail, Outlook) - ALL messages stored
✅ Calendar Events - ALL events stored
✅ WhatsApp - ALL chats and messages stored
✅ Telegram - ALL chats and messages stored
✅ Discord - ALL servers and messages stored
✅ GitHub - ALL PRs, issues, notifications stored
✅ Notifications - ALL platform notifications stored
✅ Chat Sessions - ALL AI conversations stored
✅ Accounts - ALL connected accounts tracked
✅ Knowledge Base - User preferences, work patterns, insights stored

You have access to comprehensive tools that retrieve real user data from the local database. Think step-by-step using the ReAct pattern:

1. **Analyze** what information you need
2. **Use tools** to get that data (you can use multiple tools in parallel)
3. **Synthesize** the results into a helpful, conversational answer

Available Tools:

🔍 CROSS-PLATFORM SEARCH TOOLS:
- search_all_communications: Search across ALL platforms (emails, WhatsApp, Discord, chats) by keywords
- get_communication_stats: Get comprehensive statistics across all platforms
- get_recent_activity: Get timeline of recent activity across all sources

📧 EMAIL TOOLS:
- search_emails: Search emails by keywords/sender
- get_unread_emails: Get all unread emails
- get_important_emails: Get important/high-priority emails
- get_emails_by_tag: Get emails filtered by tag/label
- get_emails_by_account: Get emails from specific account

📅 CALENDAR TOOLS:
- find_calendar_events: Find events for specific dates
- get_upcoming_events: Get upcoming events sorted by time
- search_events_by_date: Search events in date range

🔔 NOTIFICATION TOOLS:
- check_notifications: Check notifications by platform
- get_unread_notifications: Get all unread notifications

🐙 GITHUB TOOLS:
- query_github: Query PRs and issues with filters
- get_github_by_type: Get PRs or issues specifically

💬 WHATSAPP TOOLS:
- get_whatsapp_chats: Get WhatsApp conversations and chat list
- get_whatsapp_messages: Get recent WhatsApp messages

💬 DISCORD TOOLS:
- get_discord_servers: Get Discord servers/guilds
- get_discord_messages: Get recent Discord messages

👤 ACCOUNT TOOLS:
- get_all_accounts: Get list of all connected accounts
- get_accounts_by_platform: Get accounts by platform (gmail, outlook, slack, etc.)
- get_account_summary: Get account overview with statistics

📁 ORGANIZATION TOOLS:
- get_folders: Get folders/groups organizing accounts

💬 CHAT TOOLS:
- get_chat_sessions: Get previous chat sessions/history

🧠 KNOWLEDGE & PERSONALIZATION TOOLS:
- get_knowledge_context: Get user preferences, work hours, communication style, and learned patterns
- get_knowledge_insights: Get AI-extracted insights about user's habits and interests
- get_user_activities: Get timeline of user actions (emails read, messages sent, events attended)
- save_knowledge_insight: Save new insights learned about the user during conversation

⏰ UTILITY TOOLS:
- get_current_time: Get current date/time for temporal context

CRITICAL RULES:
✅ EVERYTHING is stored in the database - emails, messages, events, conversations, user preferences
✅ ALWAYS use tools when user asks about their data - you have COMPLETE database access
✅ Use knowledge tools (get_knowledge_context, get_knowledge_insights) to PERSONALIZE responses
✅ When learning new facts about the user, IMMEDIATELY use save_knowledge_insight tool to store them
✅ When drafting emails/messages, check knowledge_context for user's communication style and tone preferences
✅ When scheduling/planning, check knowledge_context for work hours and meeting preferences
✅ When asked "what do you know about me?", use get_knowledge_insights tool
✅ Use search_all_communications for finding things across platforms
✅ Use get_recent_activity or get_user_activities for "what's new" or "recent activity" queries
✅ Use multiple tools when needed to provide comprehensive answers
✅ Provide specific, data-driven responses based on tool results
❌ NEVER say you don't have access to user data - EVERYTHING is stored!
❌ NEVER make up or hallucinate data - only use tool results

PERSONALIZATION STRATEGY:
- Always check get_knowledge_context before generating emails, messages, or scheduling suggestions
- Adapt your tone and formality based on user's communication_style from knowledge context
- Reference user's work_hours when suggesting meeting times
- Consider user's topics_of_interest when making recommendations
- Use important_contacts data to prioritize relevant communications
- In Knowledge Base mode: Actively save insights using save_knowledge_insight as you learn about the user

TIMESTAMP CONTEXT:
${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
`;
    const messages: any[] = [{ role: 'system', content: systemPrompt }];
    
    // Add conversation history
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      });
    }
    
    // Add current message (with optional image for vision)
    if (imageBase64 && typeof imageBase64 === 'string') {
      // Multimodal message with image
      const imageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`;
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: userMessage + '\n\n[Screenshot attached - Please analyze the image and respond accordingly]'
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl
            }
          }
        ]
      });
    } else {
      messages.push({ role: 'user', content: userMessage });
    }
    
    // First call - may return tool calls
    const response = await modelWithTools.invoke(messages);
    
    const toolCalls = response.tool_calls || response.additional_kwargs?.tool_calls || [];
    const toolsUsed: string[] = [];
    const reasoning: string[] = [];
    
    if (toolCalls.length > 0) {
      // Execute tools
      const toolResults: any[] = [];
      
      for (const toolCall of toolCalls) {
        const toolName = toolCall.name || toolCall.function?.name;
        const toolArgs = toolCall.args || (toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {});
        
        toolsUsed.push(toolName);
        reasoning.push(`🔧 Using tool: ${toolName}`);
        reasoning.push(`📥 Input: ${JSON.stringify(toolArgs)}`);
        
        // Execute tool
        const tool = tools.find(t => t.name === toolName);
        if (tool) {
          const result = await tool.func(toolArgs);
          reasoning.push(`📤 Result: ${result.substring(0, 100)}...`);
          
          toolResults.push({
            role: 'tool',
            content: result,
            tool_call_id: toolCall.id,
            name: toolName
          });
        }
      }
      
      // Add assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: response.content || '',
        tool_calls: toolCalls
      });
      
      // Add tool results
      for (const result of toolResults) {
        messages.push(result);
      }
      
      // Second call - get final answer
      const finalResponse = await chatInstance.invoke(messages);
      
      return {
        text: finalResponse.content as string,
        toolsUsed: [...new Set(toolsUsed)],
        reasoning,
        sources: accountIds && accountIds.length > 0 ? [{
          type: 'account_data',
          accountIds
        }] : undefined
      };
    }
    
    // No tools used, direct response
    return {
      text: response.content as string,
      sources: accountIds && accountIds.length > 0 ? [{
        type: 'account_data',
        accountIds
      }] : undefined
    };
  } catch (error) {
    console.error('Agent error:', error);
    
    if (error instanceof Error && error.message.includes('API key')) {
      return {
        text: 'API key not configured. Please add your API key in Settings → Intelligence Engine.'
      };
    }
    
    if (error instanceof Error && (error.message.includes('tool') || error.message.includes('function calling'))) {
      return {
        text: 'The selected model does not support tool calling. Please switch to a model with function calling support (e.g., Gemini 2.0+, Claude 3.5, or GPT-4).'
      };
    }
    
    return {
      text: 'Sorry, I encountered an error. Please try again.'
    };
  }
}

/**
 * Re-initialize chat and agent when API key or model changes
 */
export async function reinitializeChat() {
  chat = null;
  currentProvider = null;
  await initializeChat();
}