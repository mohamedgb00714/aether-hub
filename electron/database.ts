import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

// Database path in userData
const DB_PATH = path.join(app.getPath('userData'), 'aether-hub.db');

export interface DbAccount {
  id: string;
  name: string;
  email: string;
  platform: string;
  category: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  is_connected: number; // SQLite boolean
  status: string | null; // 'connected' | 'syncing' | 'error' | 'disconnected' | 'offline'
  last_sync: string | null;
  avatar_url: string | null;
  color: string | null;
  folder_id: string | null;
  ignored: number; // SQLite boolean
  created_at: string;
  updated_at: string;
}

export interface DbEmail {
  id: string;
  account_id: string;
  thread_id: string | null;
  subject: string;
  sender: string;
  recipient: string | null;
  preview: string;
  timestamp: string;
  is_read: number; // SQLite boolean
  is_important: number; // SQLite boolean
  labels: string | null; // JSON string array
  tags: string | null; // JSON string array
  ai_summary: string | null;
  ai_category: string | null;
  ai_priority: number | null;
  ai_suggested_reply: string | null;
  created_at: string;
}

export interface DbEvent {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  attendees: string | null; // JSON string array
  is_all_day: number; // SQLite boolean
  event_link: string | null;
  ai_briefing: string | null;
  ai_action_items: string | null;
  created_at: string;
}

export interface DbFolder {
  id: string;
  name: string;
  color: string;
  account_ids: string; // JSON string array
  created_at: string;
}

export interface DbNotification {
  id: string;
  account_id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  is_read: number; // SQLite boolean
  priority: number;
  action_url: string | null;
  created_at: string;
}

export interface DbGithubItem {
  id: string;
  account_id: string;
  type: string; // 'pr' | 'issue' | 'notification'
  title: string;
  url: string;
  repository: string;
  author: string;
  state: string;
  created_at_github: string;
  updated_at_github: string;
  body: string | null;
  labels: string | null; // JSON string array
  comments_count: number;
  is_read: number; // SQLite boolean
  created_at: string;
}

export interface DbChatSession {
  id: string;
  title: string;
  account_ids: string | null; // JSON string array
  metadata: string | null; // JSON string for arbitrary metadata
  created_at: string;
  updated_at: string;
}

export interface DbChatMessage {
  id: string;
  session_id: string;
  role: string; // 'user' | 'assistant'
  content: string;
  sources: string | null; // JSON string
  tools_used: string | null; // JSON string
  reasoning: string | null; // AI reasoning trace
  created_at: string;
}

export interface DbKnowledgeMessage {
  id: string;
  role: string; // 'user' | 'assistant'
  content: string;
  created_at: string;
}

export interface DbKnowledgeInsight {
  id: string;
  category: string;
  fact: string;
  confidence: number; // 0-100
  created_at: string;
  updated_at: string;
}

// User Activity Database Interface
export interface DbUserActivity {
  id: string;
  timestamp: string;
  action_type: string; // 'email_send' | 'email_read' | 'email_reply' | 'message_send' | 'message_read' | 'event_attend' | 'github_action'
  platform: string; // 'gmail' | 'outlook' | 'whatsapp' | 'discord' | 'github' | 'calendar'
  entity_id: string | null; // ID of the email/message/event
  context_json: string | null; // JSON object with additional context
  participants: string | null; // JSON array of emails/usernames involved
  topics: string | null; // JSON array of detected topics/keywords
  created_at: string;
}

export interface DbAutomation {
  id: string;
  name: string;
  description: string | null;
  task: string;
  profile_id: string;
  headless: number; // SQLite boolean
  run_on_startup: number; // SQLite boolean
  cron_schedule: string | null;
  status: string; // 'idle' | 'running' | 'completed' | 'failed'
  last_run: string | null;
  created_at: string;
}

export interface DbAutomationHistory {
  id: string;
  automation_id: string;
  status: string; // 'running' | 'completed' | 'failed'
  started_at: string;
  completed_at: string | null;
  result: string | null; // JSON string
  error_message: string | null;
  analysis: string | null; // AI analysis of the automation result
  created_at: string;
}

// Knowledge Context Database Interface
export interface DbKnowledgeContext {
  id: string;
  category: string; // 'work_hours' | 'response_style' | 'topics_of_interest' | 'important_contacts' | 'meeting_preferences' | etc
  key: string; // Specific key within category (e.g., 'preferred_start_time', 'tone')
  value: string; // JSON value
  confidence: number; // 0-100 confidence score
  last_updated: string;
  created_at: string;
}

// Conversation Summaries Database Interface
export interface DbConversationSummary {
  id: string;
  platform: string;
  thread_id: string;
  summary: string;
  participants: string | null; // JSON array
  topics: string | null; // JSON array
  message_count: number;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
}

// WhatsApp Database Interfaces
export interface DbWhatsAppAccount {
  id: string;
  phone: string;
  name: string;
  platform: string;
  is_connected: number;
  session_data: string | null;
  ai_settings: string | null; // JSON string for AI auto-reply settings
  created_at: string;
  updated_at: string;
}

export interface DbWhatsAppChat {
  id: string;
  account_id: string;
  name: string;
  is_group: number;
  unread_count: number;
  last_message: string | null;
  last_message_time: string | null;
  last_message_from_me: number;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbWhatsAppMessage {
  id: string;
  chat_id: string;
  account_id: string;
  body: string;
  from_id: string;
  from_name: string;
  timestamp: string;
  is_from_me: number;
  has_media: number;
  media_type: string | null;
  media_url: string | null;
  message_type: string;
  is_read: number;
  ai_response: string | null;
  created_at: string;
}

// Telegram Database Interfaces
export interface DbTelegramAccount {
  id: string;
  phone: string;
  name: string;
  username: string;
  platform: string;
  is_connected: number;
  session_data: string | null;
  ai_settings: string | null; // JSON string for AI auto-reply settings
  created_at: string;
  updated_at: string;
}

export interface DbTelegramChat {
  id: string;
  account_id: string;
  name: string;
  is_group: number;
  is_channel: number;
  unread_count: number;
  last_message: string | null;
  last_message_time: string | null;
  last_message_from_me: number;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbTelegramMessage {
  id: string;
  chat_id: string;
  account_id: string;
  body: string;
  from_id: string;
  from_name: string;
  timestamp: string;
  is_from_me: number;
  has_media: number;
  media_type: string | null;
  media_url: string | null;
  message_type: string;
  is_read: number;
  ai_response: string | null;
  created_at: string;
}

// Discord Database Interfaces
export interface DbDiscordGuild {
  id: string;
  account_id: string;
  name: string;
  icon: string | null;
  owner: number; // boolean
  permissions: string;
  features: string | null; // JSON array
  member_count: number | null;
  presence_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface DbDiscordChannel {
  id: string;
  guild_id: string | null;
  account_id: string;
  type: number;
  name: string | null;
  topic: string | null;
  is_dm: number; // boolean
  recipient_name: string | null;
  last_message_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbDiscordMessage {
  id: string;
  channel_id: string;
  account_id: string;
  author_id: string;
  author_username: string;
  author_avatar: string | null;
  content: string;
  timestamp: string;
  edited_timestamp: string | null;
  attachments: string | null; // JSON array
  embeds: string | null; // JSON array
  mentions: string | null; // JSON array
  message_type: number;
  created_at: string;
}

export interface DbNote {
  id: number;
  title: string;
  content: string;
  category: string;
  is_pinned: number; // SQLite boolean
  style_json: string; // JSON string for NoteStyle
  position_json: string; // JSON string for NotePosition
  created_at: string;
  updated_at: string;
}

// Watched Items Database Interface
export interface DbWatchedItem {
  id: string;
  platform: string; // 'email' | 'discord' | 'whatsapp' | 'telegram' | 'github' | 'calendar'
  item_type: string; // 'email_address' | 'discord_server' | 'discord_channel' | 'whatsapp_chat' | 'telegram_chat' | 'telegram_channel' | 'github_repo' | 'github_user' | 'calendar_event'
  item_id: string;
  item_name: string;
  item_metadata: string | null; // JSON string
  action: string | null;
  action_status: string; // 'pending' | 'in_progress' | 'completed' | 'dismissed'
  watch_status: string; // 'active' | 'paused'
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Intelligence Feed Database Interface
export interface DbIntelligenceFeed {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: number;
  insights: string | null; // JSON string
  action_items: string | null; // JSON string
  sources: string | null; // JSON string
  generated_at: string;
  created_at: string;
}

// YouTube Channel Database Interface
export interface DbYouTubeChannel {
  id: string;
  channel_id: string;
  channel_name: string;
  channel_url: string;
  rss_url: string;
  thumbnail_url: string | null;
  description: string | null;
  subscriber_count: string | null;
  is_active: number; // SQLite boolean
  last_checked: string | null;
  created_at: string;
  updated_at: string;
}

// YouTube Video Database Interface
export interface DbYouTubeVideo {
  id: string;
  channel_id: string;
  video_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  published_at: string;
  duration: string | null;
  view_count: string | null;
  video_url: string;
  transcript: string | null;
  ai_summary: string | null;
  ai_topics: string | null; // JSON array of topics
  ai_value_score: number | null; // 0-100 value rating
  ai_value_reason: string | null;
  is_watched: number; // SQLite boolean
  is_analyzed: number; // SQLite boolean
  created_at: string;
  updated_at: string;
}

// User Interests Database Interface (for content rating)
export interface DbUserInterest {
  id: string;
  category: string; // 'technology', 'business', 'science', etc.
  topic: string; // specific topic within category
  weight: number; // 1-10 importance
  created_at: string;
  updated_at: string;
}

class DatabaseManager {
  private db: Database.Database | null = null;

  initialize() {
    console.log('🗄️  Initializing SQLite database at:', DB_PATH);
    
    this.db = new Database(DB_PATH, { 
      verbose: undefined // Disable SQL logging in terminal
    });
    
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
    
    // Create tables
    this.createTables();
    
    console.log('✅ Database initialized successfully');
  }

  private createTables() {
    if (!this.db) throw new Error('Database not initialized');

    // Accounts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        platform TEXT NOT NULL,
        category TEXT NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TEXT,
        is_connected INTEGER DEFAULT 1,
        status TEXT DEFAULT 'offline',
        last_sync TEXT,
        avatar_url TEXT,
        color TEXT,
        folder_id TEXT,
        ignored INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrate existing accounts table to add new columns if needed
    try {
      this.db.exec('ALTER TABLE accounts ADD COLUMN status TEXT DEFAULT \'offline\'');
    } catch (_) { /* Column already exists */ }
    try {
      this.db.exec('ALTER TABLE accounts ADD COLUMN last_sync TEXT');
    } catch (_) { /* Column already exists */ }
    try {
      this.db.exec('ALTER TABLE accounts ADD COLUMN avatar_url TEXT');
    } catch (_) { /* Column already exists */ }
    try {
      this.db.exec('ALTER TABLE accounts ADD COLUMN color TEXT');
    } catch (_) { /* Column already exists */ }
    try {
      this.db.exec('ALTER TABLE accounts ADD COLUMN folder_id TEXT');
    } catch (_) { /* Column already exists */ }
    try {
      this.db.exec('ALTER TABLE accounts ADD COLUMN ignored INTEGER DEFAULT 0');
    } catch (_) { /* Column already exists */ }

    // Emails table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS emails (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        thread_id TEXT,
        subject TEXT NOT NULL,
        sender TEXT NOT NULL,
        recipient TEXT,
        preview TEXT,
        timestamp TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        is_important INTEGER DEFAULT 0,
        labels TEXT,
        tags TEXT,
        ai_summary TEXT,
        ai_category TEXT,
        ai_priority INTEGER,
        ai_suggested_reply TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);

    // Calendar events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        location TEXT,
        attendees TEXT,
        is_all_day INTEGER DEFAULT 0,
        event_link TEXT,
        ai_briefing TEXT,
        ai_action_items TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);

    // Folders table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        account_ids TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Notifications table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        priority INTEGER DEFAULT 0,
        action_url TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);

    // GitHub items table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS github_items (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        repository TEXT NOT NULL,
        author TEXT NOT NULL,
        state TEXT NOT NULL,
        created_at_github TEXT NOT NULL,
        updated_at_github TEXT NOT NULL,
        body TEXT,
        labels TEXT,
        comments_count INTEGER DEFAULT 0,
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);

    // Chat sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        account_ids TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add metadata column if it doesn't exist (for existing databases)
    try {
      this.db.prepare('ALTER TABLE chat_sessions ADD COLUMN metadata TEXT').run();
    } catch (e) {
      // Column already exists or table doesn't exist yet
    }

    // Chat messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        sources TEXT,
        tools_used TEXT, -- JSON array of tool names
        reasoning TEXT, -- JSON array of reasoning steps
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
      )
    `);

    // Knowledge Base messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Knowledge Base insights table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_insights (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        fact TEXT NOT NULL,
        confidence INTEGER DEFAULT 50,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrate knowledge_insights table to add confidence column if needed
    try {
      this.db.exec('ALTER TABLE knowledge_insights ADD COLUMN confidence INTEGER DEFAULT 50');
    } catch (_) { /* Column already exists */ }
    try {
      this.db.exec('ALTER TABLE knowledge_insights ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP');
    } catch (_) { /* Column already exists */ }
    try {
      this.db.exec('ALTER TABLE knowledge_insights ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP');
    } catch (_) { /* Column already exists */ }

    // User Activities table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_activities (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        action_type TEXT NOT NULL,
        platform TEXT NOT NULL,
        entity_id TEXT,
        context_json TEXT,
        participants TEXT,
        topics TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Knowledge Context table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_context (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        confidence INTEGER DEFAULT 50,
        last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category, key)
      )
    `);

    // Migrate knowledge_context table to add confidence column if needed
    try {
      this.db.exec('ALTER TABLE knowledge_context ADD COLUMN confidence INTEGER DEFAULT 50');
    } catch (_) { /* Column already exists */ }
    try {
      this.db.exec('ALTER TABLE knowledge_context ADD COLUMN last_updated TEXT DEFAULT CURRENT_TIMESTAMP');
    } catch (_) { /* Column already exists */ }
    try {
      this.db.exec('ALTER TABLE knowledge_context ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP');
    } catch (_) { /* Column already exists */ }

    // Intelligence Feed table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS intelligence_feeds (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        insights TEXT,
        action_items TEXT,
        sources TEXT,
        generated_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Browser Automations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS automations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        task TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        headless INTEGER DEFAULT 0,
        run_on_startup INTEGER DEFAULT 0,
        cron_schedule TEXT,
        status TEXT DEFAULT 'idle',
        last_run TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Automation History table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS automation_history (
        id TEXT PRIMARY KEY,
        automation_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        result TEXT,
        error_message TEXT,
        analysis TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
      )
    `);

    // Migrate existing automation_history table to add analysis column if needed
    try {
      this.db.exec('ALTER TABLE automation_history ADD COLUMN analysis TEXT');
    } catch (_) { /* Column already exists */ };

    // YouTube Channels table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS youtube_channels (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL UNIQUE,
        channel_name TEXT NOT NULL,
        channel_url TEXT NOT NULL,
        rss_url TEXT NOT NULL,
        thumbnail_url TEXT,
        description TEXT,
        subscriber_count TEXT,
        is_active INTEGER DEFAULT 1,
        last_checked TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // YouTube Videos table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS youtube_videos (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        video_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        thumbnail_url TEXT,
        published_at TEXT NOT NULL,
        duration TEXT,
        view_count TEXT,
        video_url TEXT NOT NULL,
        transcript TEXT,
        ai_summary TEXT,
        ai_topics TEXT,
        ai_value_score INTEGER,
        ai_value_reason TEXT,
        is_watched INTEGER DEFAULT 0,
        is_analyzed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (channel_id) REFERENCES youtube_channels(channel_id) ON DELETE CASCADE
      )
    `);

    // User Interests table (for content value scoring)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_interests (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        topic TEXT NOT NULL,
        weight INTEGER DEFAULT 5,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category, topic)
      )
    `);

    // Conversation Summaries table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_summaries (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        participants TEXT,
        topics TEXT,
        message_count INTEGER DEFAULT 0,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(platform, thread_id)
      )
    `);

    // WhatsApp accounts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS whatsapp_accounts (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        name TEXT NOT NULL,
        platform TEXT DEFAULT 'whatsapp',
        is_connected INTEGER DEFAULT 0,
        session_data TEXT,
        ai_settings TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // WhatsApp chats table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS whatsapp_chats (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        is_group INTEGER DEFAULT 0,
        unread_count INTEGER DEFAULT 0,
        last_message TEXT,
        last_message_time TEXT,
        last_message_from_me INTEGER DEFAULT 0,
        avatar_url TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES whatsapp_accounts(id) ON DELETE CASCADE
      )
    `);

    // WhatsApp messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        body TEXT,
        from_id TEXT NOT NULL,
        from_name TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        is_from_me INTEGER DEFAULT 0,
        has_media INTEGER DEFAULT 0,
        media_type TEXT,
        media_url TEXT,
        message_type TEXT DEFAULT 'text',
        is_read INTEGER DEFAULT 0,
        ai_response TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES whatsapp_chats(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES whatsapp_accounts(id) ON DELETE CASCADE
      )
    `);

    // Telegram accounts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS telegram_accounts (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        name TEXT NOT NULL,
        username TEXT DEFAULT '',
        platform TEXT DEFAULT 'telegram',
        is_connected INTEGER DEFAULT 0,
        session_data TEXT,
        ai_settings TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Telegram chats table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS telegram_chats (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        is_group INTEGER DEFAULT 0,
        is_channel INTEGER DEFAULT 0,
        unread_count INTEGER DEFAULT 0,
        last_message TEXT,
        last_message_time TEXT,
        last_message_from_me INTEGER DEFAULT 0,
        avatar_url TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES telegram_accounts(id) ON DELETE CASCADE
      )
    `);

    // Telegram messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS telegram_messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        body TEXT,
        from_id TEXT NOT NULL,
        from_name TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        is_from_me INTEGER DEFAULT 0,
        has_media INTEGER DEFAULT 0,
        media_type TEXT,
        media_url TEXT,
        message_type TEXT DEFAULT 'text',
        is_read INTEGER DEFAULT 0,
        ai_response TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES telegram_chats(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES telegram_accounts(id) ON DELETE CASCADE
      )
    `);

    // Discord guilds (servers) table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS discord_guilds (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        icon TEXT,
        owner INTEGER DEFAULT 0,
        permissions TEXT NOT NULL,
        features TEXT,
        member_count INTEGER,
        presence_count INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);

    // Discord channels table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS discord_channels (
        id TEXT PRIMARY KEY,
        guild_id TEXT,
        account_id TEXT NOT NULL,
        type INTEGER NOT NULL,
        name TEXT,
        topic TEXT,
        is_dm INTEGER DEFAULT 0,
        recipient_name TEXT,
        last_message_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES discord_guilds(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);

    // Discord messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS discord_messages (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_username TEXT NOT NULL,
        author_discriminator TEXT NOT NULL,
        author_avatar TEXT,
        content TEXT,
        timestamp TEXT NOT NULL,
        edited_timestamp TEXT,
        attachments TEXT,
        embeds TEXT,
        mentions TEXT,
        type INTEGER DEFAULT 0,
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (channel_id) REFERENCES discord_channels(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);

    // Watched Items table - for monitoring items across platforms
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS watched_items (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        item_type TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        item_metadata TEXT,
        action TEXT,
        action_status TEXT DEFAULT 'pending',
        watch_status TEXT DEFAULT 'active',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(platform, item_type, item_id)
      )
    `);

    // Watch Actions table - AI-generated actions from watched items
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS watch_actions (
        id TEXT PRIMARY KEY,
        watched_item_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'pending',
        source_content TEXT,
        source_message_ids TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        FOREIGN KEY (watched_item_id) REFERENCES watched_items(id) ON DELETE CASCADE
      )
    `);

    // Analyzed Messages table - track which messages have been analyzed
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS analyzed_messages (
        id TEXT PRIMARY KEY,
        watched_item_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        analyzed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(watched_item_id, message_id),
        FOREIGN KEY (watched_item_id) REFERENCES watched_items(id) ON DELETE CASCADE
      )
    `);

    // Resend Email Templates table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS resend_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        html TEXT,
        text TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Resend Sent Emails table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS resend_sent_emails (
        id TEXT PRIMARY KEY,
        from_email TEXT NOT NULL,
        to_emails TEXT NOT NULL,
        subject TEXT NOT NULL,
        html TEXT,
        text TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_event TEXT,
        clicks INTEGER DEFAULT 0,
        opens INTEGER DEFAULT 0
      )
    `);

    // Create indexes for better query performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_emails_account ON emails(account_id);
      CREATE INDEX IF NOT EXISTS idx_emails_timestamp ON emails(timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_account ON events(account_id);
      CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_time);
      CREATE INDEX IF NOT EXISTS idx_notifications_account ON notifications(account_id);
      CREATE INDEX IF NOT EXISTS idx_github_account ON github_items(account_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at);
      CREATE INDEX IF NOT EXISTS idx_knowledge_messages_created ON knowledge_messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_knowledge_insights_created ON knowledge_insights(created_at);
      CREATE INDEX IF NOT EXISTS idx_knowledge_insights_category ON knowledge_insights(category);
      CREATE INDEX IF NOT EXISTS idx_user_activities_timestamp ON user_activities(timestamp);
      CREATE INDEX IF NOT EXISTS idx_user_activities_platform ON user_activities(platform);
      CREATE INDEX IF NOT EXISTS idx_user_activities_action ON user_activities(action_type);
      CREATE INDEX IF NOT EXISTS idx_knowledge_context_category ON knowledge_context(category);
      CREATE INDEX IF NOT EXISTS idx_conversation_summaries_platform ON conversation_summaries(platform);
      CREATE INDEX IF NOT EXISTS idx_conversation_summaries_thread ON conversation_summaries(thread_id);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_account ON whatsapp_chats(account_id);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat ON whatsapp_messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp ON whatsapp_messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_telegram_chats_account ON telegram_chats(account_id);
      CREATE INDEX IF NOT EXISTS idx_telegram_messages_chat ON telegram_messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_telegram_messages_timestamp ON telegram_messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_discord_guilds_account ON discord_guilds(account_id);
      CREATE INDEX IF NOT EXISTS idx_discord_channels_guild ON discord_channels(guild_id);
      CREATE INDEX IF NOT EXISTS idx_discord_channels_account ON discord_channels(account_id);
      CREATE INDEX IF NOT EXISTS idx_discord_messages_channel ON discord_messages(channel_id);
      CREATE INDEX IF NOT EXISTS idx_discord_messages_account ON discord_messages(account_id);
      CREATE INDEX IF NOT EXISTS idx_discord_messages_timestamp ON discord_messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_watched_items_platform ON watched_items(platform);
      CREATE INDEX IF NOT EXISTS idx_watched_items_status ON watched_items(action_status);
      CREATE INDEX IF NOT EXISTS idx_watched_items_watch_status ON watched_items(watch_status);
      CREATE INDEX IF NOT EXISTS idx_watch_actions_watched_item ON watch_actions(watched_item_id);
      CREATE INDEX IF NOT EXISTS idx_watch_actions_status ON watch_actions(status);
      CREATE INDEX IF NOT EXISTS idx_analyzed_messages_watched_item ON analyzed_messages(watched_item_id);
      CREATE INDEX IF NOT EXISTS idx_analyzed_messages_message ON analyzed_messages(message_id);
      CREATE INDEX IF NOT EXISTS idx_youtube_channels_channel_id ON youtube_channels(channel_id);
      CREATE INDEX IF NOT EXISTS idx_youtube_channels_active ON youtube_channels(is_active);
      CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel ON youtube_videos(channel_id);
      CREATE INDEX IF NOT EXISTS idx_youtube_videos_video_id ON youtube_videos(video_id);
      CREATE INDEX IF NOT EXISTS idx_youtube_videos_published ON youtube_videos(published_at);
      CREATE INDEX IF NOT EXISTS idx_youtube_videos_analyzed ON youtube_videos(is_analyzed);
      CREATE INDEX IF NOT EXISTS idx_youtube_videos_value_score ON youtube_videos(ai_value_score);
      CREATE INDEX IF NOT EXISTS idx_user_interests_category ON user_interests(category);
    `);

    // Notes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        category TEXT DEFAULT 'General',
        is_pinned INTEGER DEFAULT 0,
        style_json TEXT, -- JSON NoteStyle
        position_json TEXT, -- JSON NotePosition
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for notes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned);
      CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category);
      CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);
    `);
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('🗄️  Database closed');
    }
  }

  // Account Repository
  accounts = {
    getAll: (): DbAccount[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all() as DbAccount[];
    },

    getById: (id: string): DbAccount | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as DbAccount | undefined;
    },

    getByPlatform: (platform: string): DbAccount[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM accounts WHERE platform = ?').all(platform) as DbAccount[];
    },

    upsert: (account: Partial<DbAccount> & { id: string }): void => {
      if (!this.db) throw new Error('Database not initialized');
      
      const existing = this.accounts.getById(account.id);
      
      if (existing) {
        // Update
        const fields = Object.keys(account).filter(k => k !== 'id' && k !== 'created_at');
        const setClause = fields.map(f => `${f} = @${f}`).join(', ');
        const sql = `UPDATE accounts SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`;
        this.db.prepare(sql).run(account);
      } else {
        // Insert
        const fields = Object.keys(account);
        const placeholders = fields.map(f => `@${f}`).join(', ');
        const sql = `INSERT INTO accounts (${fields.join(', ')}) VALUES (${placeholders})`;
        this.db.prepare(sql).run(account);
      }
    },

    delete: (id: string): void => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    },

    deleteNullIds: (): number => {
      if (!this.db) throw new Error('Database not initialized');
      const result = this.db.prepare('DELETE FROM accounts WHERE id IS NULL').run();
      return result.changes;
    },
  };

  // Email Repository
  emails = {
    getAll: (): DbEmail[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM emails ORDER BY timestamp DESC').all() as DbEmail[];
    },

    getByAccount: (accountId: string): DbEmail[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM emails WHERE account_id = ? ORDER BY timestamp DESC').all(accountId) as DbEmail[];
    },

    getUnread: (): DbEmail[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM emails WHERE is_read = 0 ORDER BY timestamp DESC').all() as DbEmail[];
    },

    getByTag: (tag: string): DbEmail[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare(`SELECT * FROM emails WHERE tags LIKE ? ORDER BY timestamp DESC`)
        .all(`%"${tag}"%`) as DbEmail[];
    },

    bulkUpsert: (emails: (Partial<DbEmail> & { id: string })[]): void => {
      if (!this.db) throw new Error('Database not initialized');
      
      const insert = this.db.prepare(`
        INSERT OR REPLACE INTO emails (
          id, account_id, thread_id, subject, sender, recipient, preview, 
          timestamp, is_read, is_important, labels, tags, ai_summary, 
          ai_category, ai_priority, ai_suggested_reply
        ) VALUES (
          @id, @account_id, @thread_id, @subject, @sender, @recipient, @preview,
          @timestamp, @is_read, @is_important, @labels, @tags, @ai_summary,
          @ai_category, @ai_priority, @ai_suggested_reply
        )
      `);

      const transaction = this.db.transaction((emails: any[]) => {
        for (const email of emails) {
          insert.run({
            id: email.id,
            account_id: email.account_id,
            thread_id: email.thread_id || null,
            subject: email.subject,
            sender: email.sender,
            recipient: email.recipient || null,
            preview: email.preview || '',
            timestamp: email.timestamp,
            is_read: email.is_read || 0,
            is_important: email.is_important || 0,
            labels: email.labels || null,
            tags: email.tags || null,
            ai_summary: email.ai_summary || null,
            ai_category: email.ai_category || null,
            ai_priority: email.ai_priority || null,
            ai_suggested_reply: email.ai_suggested_reply || null,
          });
        }
      });

      transaction(emails);
    },

    update: (id: string, updates: Partial<DbEmail>): void => {
      if (!this.db) throw new Error('Database not initialized');
      const fields = Object.keys(updates);
      const setClause = fields.map(f => `${f} = @${f}`).join(', ');
      const sql = `UPDATE emails SET ${setClause} WHERE id = @id`;
      this.db.prepare(sql).run({ ...updates, id });
    },

    delete: (id: string): void => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM emails WHERE id = ?').run(id);
    },

    clearByAccount: (accountId: string): void => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM emails WHERE account_id = ?').run(accountId);
    },
  };

  // Event Repository
  events = {
    getAll: (): DbEvent[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM events ORDER BY start_time ASC').all() as DbEvent[];
    },

    getByAccount: (accountId: string): DbEvent[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM events WHERE account_id = ? ORDER BY start_time ASC').all(accountId) as DbEvent[];
    },

    getUpcoming: (limit = 10): DbEvent[] => {
      if (!this.db) throw new Error('Database not initialized');
      const now = new Date().toISOString();
      return this.db.prepare('SELECT * FROM events WHERE start_time >= ? ORDER BY start_time ASC LIMIT ?')
        .all(now, limit) as DbEvent[];
    },

    getByDateRange: (startDate: string, endDate: string): DbEvent[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM events WHERE start_time >= ? AND start_time <= ? ORDER BY start_time ASC')
        .all(startDate, endDate) as DbEvent[];
    },

    bulkUpsert: (events: (Partial<DbEvent> & { id: string })[]): void => {
      if (!this.db) throw new Error('Database not initialized');
      
      const insert = this.db.prepare(`
        INSERT OR REPLACE INTO events (
          id, account_id, title, description, start_time, end_time, 
          location, attendees, is_all_day, event_link, ai_briefing, ai_action_items
        ) VALUES (
          @id, @account_id, @title, @description, @start_time, @end_time,
          @location, @attendees, @is_all_day, @event_link, @ai_briefing, @ai_action_items
        )
      `);

      const transaction = this.db.transaction((events: any[]) => {
        for (const event of events) {
          insert.run({
            id: event.id,
            account_id: event.account_id,
            title: event.title,
            description: event.description || null,
            start_time: event.start_time,
            end_time: event.end_time,
            location: event.location || null,
            attendees: event.attendees || null,
            is_all_day: event.is_all_day || 0,
            event_link: event.event_link || null,
            ai_briefing: event.ai_briefing || null,
            ai_action_items: event.ai_action_items || null,
          });
        }
      });

      transaction(events);
    },

    update: (id: string, updates: Partial<DbEvent>): void => {
      if (!this.db) throw new Error('Database not initialized');
      const fields = Object.keys(updates);
      const setClause = fields.map(f => `${f} = @${f}`).join(', ');
      const sql = `UPDATE events SET ${setClause} WHERE id = @id`;
      this.db.prepare(sql).run({ ...updates, id });
    },

    delete: (id: string): void => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM events WHERE id = ?').run(id);
    },

    clearByAccount: (accountId: string): void => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM events WHERE account_id = ?').run(accountId);
    },
  };

  // Folder Repository
  folders = {
    getAll: (): DbFolder[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM folders ORDER BY created_at DESC').all() as DbFolder[];
    },

    getById: (id: string): DbFolder | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as DbFolder | undefined;
    },

    create: (folder: Omit<DbFolder, 'created_at'>): void => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare(`
        INSERT INTO folders (id, name, color, account_ids) 
        VALUES (@id, @name, @color, @account_ids)
      `).run(folder);
    },

    update: (id: string, updates: Partial<Omit<DbFolder, 'id' | 'created_at'>>): void => {
      if (!this.db) throw new Error('Database not initialized');
      const fields = Object.keys(updates);
      const setClause = fields.map(f => `${f} = @${f}`).join(', ');
      const sql = `UPDATE folders SET ${setClause} WHERE id = @id`;
      this.db.prepare(sql).run({ ...updates, id });
    },

    delete: (id: string): void => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM folders WHERE id = ?').run(id);
    },
  };

  // Notification Repository
  notifications = {
    getAll: (): DbNotification[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM notifications ORDER BY timestamp DESC').all() as DbNotification[];
    },

    getUnread: (): DbNotification[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM notifications WHERE is_read = 0 ORDER BY timestamp DESC').all() as DbNotification[];
    },

    bulkUpsert: (notifications: (Partial<DbNotification> & { id: string })[]): void => {
      if (!this.db) throw new Error('Database not initialized');
      
      const insert = this.db.prepare(`
        INSERT OR REPLACE INTO notifications (
          id, account_id, type, title, message, timestamp, is_read, priority, action_url
        ) VALUES (
          @id, @account_id, @type, @title, @message, @timestamp, @is_read, @priority, @action_url
        )
      `);

      const transaction = this.db.transaction((notifications: any[]) => {
        for (const notif of notifications) {
          insert.run({
            id: notif.id,
            account_id: notif.account_id,
            type: notif.type,
            title: notif.title,
            message: notif.message,
            timestamp: notif.timestamp,
            is_read: notif.is_read || 0,
            priority: notif.priority || 0,
            action_url: notif.action_url || null,
          });
        }
      });

      transaction(notifications);
    },

    markAsRead: (id: string): void => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
    },

    delete: (id: string): void => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
    },
  };

  // GitHub Repository
  github = {
    getAll: (): DbGithubItem[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM github_items ORDER BY updated_at_github DESC').all() as DbGithubItem[];
    },

    getByAccount: (accountId: string): DbGithubItem[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM github_items WHERE account_id = ? ORDER BY updated_at_github DESC')
        .all(accountId) as DbGithubItem[];
    },

    getByType: (type: string): DbGithubItem[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM github_items WHERE type = ? ORDER BY updated_at_github DESC')
        .all(type) as DbGithubItem[];
    },

    bulkUpsert: (items: (Partial<DbGithubItem> & { id: string })[]): void => {
      if (!this.db) throw new Error('Database not initialized');
      
      const insert = this.db.prepare(`
        INSERT OR REPLACE INTO github_items (
          id, account_id, type, title, url, repository, author, state,
          created_at_github, updated_at_github, body, labels, comments_count, is_read
        ) VALUES (
          @id, @account_id, @type, @title, @url, @repository, @author, @state,
          @created_at_github, @updated_at_github, @body, @labels, @comments_count, @is_read
        )
      `);

      const transaction = this.db.transaction((items: any[]) => {
        for (const item of items) {
          insert.run({
            id: item.id,
            account_id: item.account_id,
            type: item.type,
            title: item.title,
            url: item.url,
            repository: item.repository,
            author: item.author,
            state: item.state,
            created_at_github: item.created_at_github,
            updated_at_github: item.updated_at_github,
            body: item.body || null,
            labels: item.labels || null,
            comments_count: item.comments_count || 0,
            is_read: item.is_read || 0,
          });
        }
      });

      transaction(items);
    },

    markAsRead: (id: string): void => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('UPDATE github_items SET is_read = 1 WHERE id = ?').run(id);
    },

    delete: (id: string): void => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM github_items WHERE id = ?').run(id);
    },

    clearByAccount: (accountId: string): void => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM github_items WHERE account_id = ?').run(accountId);
    },
  };

  // Chat Sessions Repository
  chatSessions = {
    getAll: (): DbChatSession[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM chat_sessions ORDER BY updated_at DESC').all() as DbChatSession[];
    },

    getById: (id: string): DbChatSession | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id) as DbChatSession | undefined;
    },

    create: (session: { id: string; title: string; accountIds?: string[]; metadata?: any }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT INTO chat_sessions (id, title, account_ids, metadata, created_at, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          session.id, 
          session.title, 
          session.accountIds ? JSON.stringify(session.accountIds) : null,
          session.metadata ? JSON.stringify(session.metadata) : null
        );
        return true;
      } catch (err) {
        console.error('Failed to create chat session:', err);
        return false;
      }
    },

    update: (id: string, updates: { title?: string; accountIds?: string[]; metadata?: any }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        const sets: string[] = [];
        const values: any[] = [];
        
        if (updates.title !== undefined) {
          sets.push('title = ?');
          values.push(updates.title);
        }
        if (updates.accountIds !== undefined) {
          sets.push('account_ids = ?');
          values.push(JSON.stringify(updates.accountIds));
        }
        if (updates.metadata !== undefined) {
          sets.push('metadata = ?');
          values.push(JSON.stringify(updates.metadata));
        }
        
        sets.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        
        this.db.prepare(`UPDATE chat_sessions SET ${sets.join(', ')} WHERE id = ?`).run(...values);
        return true;
      } catch (err) {
        console.error('Failed to update chat session:', err);
        return false;
      }
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(id);
      return true;
    }
  };

  // Chat Messages Repository
  chatMessages = {
    getBySession: (sessionId: string): DbChatMessage[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC').all(sessionId) as DbChatMessage[];
    },

    create: (message: { 
      id: string; 
      sessionId: string; 
      role: string; 
      content: string; 
      sources?: any[];
      tools_used?: any[];
      reasoning?: any;
    }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT INTO chat_messages (id, session_id, role, content, sources, tools_used, reasoning)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          message.id,
          message.sessionId,
          message.role,
          message.content,
          message.sources ? JSON.stringify(message.sources) : null,
          message.tools_used ? JSON.stringify(message.tools_used) : null,
          message.reasoning ? (typeof message.reasoning === 'string' ? message.reasoning : JSON.stringify(message.reasoning)) : null
        );
        
        // Update session's updated_at timestamp
        this.db.prepare('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(message.sessionId);
        return true;
      } catch (err) {
        console.error('Failed to create chat message:', err);
        return false;
      }
    },

    deleteBySession: (sessionId: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(sessionId);
      return true;
    }
  };

  // Knowledge Base Messages Repository
  knowledgeMessages = {
    getAll: (): DbKnowledgeMessage[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM knowledge_messages ORDER BY created_at ASC').all() as DbKnowledgeMessage[];
    },

    create: (message: { id: string; role: string; content: string }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT INTO knowledge_messages (id, role, content, created_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `).run(message.id, message.role, message.content);
        return true;
      } catch (err) {
        console.error('Failed to create knowledge message:', err);
        return false;
      }
    },

    deleteAll: (): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM knowledge_messages').run();
      return true;
    }
  };

  // Knowledge Base Insights Repository
  knowledgeInsights = {
    getAll: (): DbKnowledgeInsight[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM knowledge_insights ORDER BY created_at DESC').all() as DbKnowledgeInsight[];
    },

    create: (insight: { id: string; category: string; fact: string; confidence?: number }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT INTO knowledge_insights (id, category, fact, confidence, created_at, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(insight.id, insight.category, insight.fact, insight.confidence || 50);
        return true;
      } catch (err) {
        console.error('Failed to create knowledge insight:', err);
        return false;
      }
    },

    update: (id: string, updates: { fact?: string; confidence?: number }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        const sets: string[] = [];
        const values: any[] = [];
        
        if (updates.fact !== undefined) {
          sets.push('fact = ?');
          values.push(updates.fact);
        }
        if (updates.confidence !== undefined) {
          sets.push('confidence = ?');
          values.push(updates.confidence);
        }
        
        sets.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        
        this.db.prepare(`UPDATE knowledge_insights SET ${sets.join(', ')} WHERE id = ?`).run(...values);
        return true;
      } catch (err) {
        console.error('Failed to update knowledge insight:', err);
        return false;
      }
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM knowledge_insights WHERE id = ?').run(id);
      return true;
    },

    deleteAll: (): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM knowledge_insights').run();
      return true;
    }
  };

  // User Activities Repository
  userActivities = {
    getAll: (limit: number = 100): DbUserActivity[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM user_activities ORDER BY timestamp DESC LIMIT ?').all(limit) as DbUserActivity[];
    },

    getByPlatform: (platform: string, limit: number = 100): DbUserActivity[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM user_activities WHERE platform = ? ORDER BY timestamp DESC LIMIT ?').all(platform, limit) as DbUserActivity[];
    },

    getByDateRange: (startDate: string, endDate: string): DbUserActivity[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM user_activities WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC').all(startDate, endDate) as DbUserActivity[];
    },

    getByActionType: (actionType: string, limit: number = 100): DbUserActivity[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM user_activities WHERE action_type = ? ORDER BY timestamp DESC LIMIT ?').all(actionType, limit) as DbUserActivity[];
    },

    insert: (activity: Omit<DbUserActivity, 'created_at'>): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT INTO user_activities (id, timestamp, action_type, platform, entity_id, context_json, participants, topics, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          activity.id,
          activity.timestamp,
          activity.action_type,
          activity.platform,
          activity.entity_id || null,
          activity.context_json || null,
          activity.participants || null,
          activity.topics || null
        );
        return true;
      } catch (err) {
        console.error('Failed to insert user activity:', err);
        return false;
      }
    },

    deleteOlderThan: (days: number): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      this.db.prepare('DELETE FROM user_activities WHERE timestamp < ?').run(cutoffDate.toISOString());
      return true;
    },
  };

  // Knowledge Context Repository
  knowledgeContext = {
    getAll: (): DbKnowledgeContext[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM knowledge_context ORDER BY category, key').all() as DbKnowledgeContext[];
    },

    getByCategory: (category: string): DbKnowledgeContext[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM knowledge_context WHERE category = ?').all(category) as DbKnowledgeContext[];
    },

    get: (category: string, key: string): DbKnowledgeContext | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM knowledge_context WHERE category = ? AND key = ?').get(category, key) as DbKnowledgeContext | undefined;
    },

    upsert: (context: Omit<DbKnowledgeContext, 'created_at' | 'last_updated'>): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT INTO knowledge_context (id, category, key, value, confidence, created_at, last_updated)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(category, key) DO UPDATE SET
            value = excluded.value,
            confidence = excluded.confidence,
            last_updated = CURRENT_TIMESTAMP
        `).run(
          context.id,
          context.category,
          context.key,
          context.value,
          context.confidence
        );
        return true;
      } catch (err) {
        console.error('Failed to upsert knowledge context:', err);
        return false;
      }
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM knowledge_context WHERE id = ?').run(id);
      return true;
    },
  };

  // Conversation Summaries Repository
  conversationSummaries = {
    getAll: (limit: number = 50): DbConversationSummary[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM conversation_summaries ORDER BY updated_at DESC LIMIT ?').all(limit) as DbConversationSummary[];
    },

    getByPlatform: (platform: string, limit: number = 50): DbConversationSummary[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM conversation_summaries WHERE platform = ? ORDER BY updated_at DESC LIMIT ?').all(platform, limit) as DbConversationSummary[];
    },

    get: (platform: string, threadId: string): DbConversationSummary | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM conversation_summaries WHERE platform = ? AND thread_id = ?').get(platform, threadId) as DbConversationSummary | undefined;
    },

    upsert: (summary: Omit<DbConversationSummary, 'created_at' | 'updated_at'>): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT INTO conversation_summaries (id, platform, thread_id, summary, participants, topics, message_count, start_time, end_time, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(platform, thread_id) DO UPDATE SET
            summary = excluded.summary,
            participants = excluded.participants,
            topics = excluded.topics,
            message_count = excluded.message_count,
            end_time = excluded.end_time,
            updated_at = CURRENT_TIMESTAMP
        `).run(
          summary.id,
          summary.platform,
          summary.thread_id,
          summary.summary,
          summary.participants || null,
          summary.topics || null,
          summary.message_count,
          summary.start_time,
          summary.end_time
        );
        return true;
      } catch (err) {
        console.error('Failed to upsert conversation summary:', err);
        return false;
      }
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM conversation_summaries WHERE id = ?').run(id);
      return true;
    },
  };

  // WhatsApp Accounts Repository
  whatsappAccounts = {
    getAll: (): DbWhatsAppAccount[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM whatsapp_accounts ORDER BY created_at DESC').all() as DbWhatsAppAccount[];
    },

    getById: (id: string): DbWhatsAppAccount | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM whatsapp_accounts WHERE id = ?').get(id) as DbWhatsAppAccount | undefined;
    },

    getConnected: (): DbWhatsAppAccount | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM whatsapp_accounts WHERE is_connected = 1 LIMIT 1').get() as DbWhatsAppAccount | undefined;
    },

    upsert: (account: { id: string; phone: string; name: string; is_connected?: boolean; session_data?: string; ai_settings?: string }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT INTO whatsapp_accounts (id, phone, name, is_connected, session_data, ai_settings, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            phone = excluded.phone,
            name = excluded.name,
            is_connected = excluded.is_connected,
            session_data = COALESCE(excluded.session_data, session_data),
            ai_settings = COALESCE(excluded.ai_settings, ai_settings),
            updated_at = CURRENT_TIMESTAMP
        `).run(
          account.id,
          account.phone,
          account.name,
          account.is_connected ? 1 : 0,
          account.session_data || null,
          account.ai_settings || null
        );
        return true;
      } catch (err) {
        console.error('Failed to upsert WhatsApp account:', err);
        return false;
      }
    },

    updateAISettings: (id: string, aiSettings: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare('UPDATE whatsapp_accounts SET ai_settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(aiSettings, id);
        return true;
      } catch (err) {
        console.error('Failed to update AI settings:', err);
        return false;
      }
    },

    setConnected: (id: string, connected: boolean): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('UPDATE whatsapp_accounts SET is_connected = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(connected ? 1 : 0, id);
      return true;
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM whatsapp_accounts WHERE id = ?').run(id);
      return true;
    }
  };

  // WhatsApp Chats Repository
  whatsappChats = {
    getAll: (accountId: string): DbWhatsAppChat[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM whatsapp_chats WHERE account_id = ? ORDER BY last_message_time DESC').all(accountId) as DbWhatsAppChat[];
    },

    getById: (id: string): DbWhatsAppChat | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM whatsapp_chats WHERE id = ?').get(id) as DbWhatsAppChat | undefined;
    },

    upsert: (chat: { id: string; account_id: string; name: string; is_group?: boolean; unread_count?: number; last_message?: string; last_message_time?: string; last_message_from_me?: boolean }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT INTO whatsapp_chats (id, account_id, name, is_group, unread_count, last_message, last_message_time, last_message_from_me, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            unread_count = excluded.unread_count,
            last_message = excluded.last_message,
            last_message_time = excluded.last_message_time,
            last_message_from_me = excluded.last_message_from_me,
            updated_at = CURRENT_TIMESTAMP
        `).run(
          chat.id,
          chat.account_id,
          chat.name,
          chat.is_group ? 1 : 0,
          chat.unread_count || 0,
          chat.last_message || null,
          chat.last_message_time || null,
          chat.last_message_from_me ? 1 : 0
        );
        return true;
      } catch (err) {
        console.error('Failed to upsert WhatsApp chat:', err);
        return false;
      }
    },

    bulkUpsert: (chats: Array<{ id: string; account_id: string; name: string; is_group?: boolean; unread_count?: number; last_message?: string; last_message_time?: string; last_message_from_me?: boolean }>): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      const insert = this.db.prepare(`
        INSERT INTO whatsapp_chats (id, account_id, name, is_group, unread_count, last_message, last_message_time, last_message_from_me, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          unread_count = excluded.unread_count,
          last_message = excluded.last_message,
          last_message_time = excluded.last_message_time,
          last_message_from_me = excluded.last_message_from_me,
          updated_at = CURRENT_TIMESTAMP
      `);
      const transaction = this.db.transaction((items: typeof chats) => {
        for (const chat of items) {
          insert.run(
            chat.id,
            chat.account_id,
            chat.name,
            chat.is_group ? 1 : 0,
            chat.unread_count || 0,
            chat.last_message || null,
            chat.last_message_time || null,
            chat.last_message_from_me ? 1 : 0
          );
        }
      });
      try {
        transaction(chats);
        return true;
      } catch (err) {
        console.error('Failed to bulk upsert WhatsApp chats:', err);
        return false;
      }
    },

    markAsRead: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('UPDATE whatsapp_chats SET unread_count = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
      return true;
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM whatsapp_chats WHERE id = ?').run(id);
      return true;
    },

    clearByAccount: (accountId: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM whatsapp_chats WHERE account_id = ?').run(accountId);
      return true;
    }
  };

  // WhatsApp Messages Repository
  whatsappMessages = {
    getByChat: (chatId: string, limit: number = 50): DbWhatsAppMessage[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM whatsapp_messages WHERE chat_id = ? ORDER BY timestamp ASC LIMIT ?').all(chatId, limit) as DbWhatsAppMessage[];
    },

    getById: (id: string): DbWhatsAppMessage | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM whatsapp_messages WHERE id = ?').get(id) as DbWhatsAppMessage | undefined;
    },

    getRecent: (accountId: string, limit: number = 100): DbWhatsAppMessage[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM whatsapp_messages WHERE account_id = ? ORDER BY timestamp DESC LIMIT ?').all(accountId, limit) as DbWhatsAppMessage[];
    },

    create: (message: { id: string; chat_id: string; account_id: string; body: string; from_id: string; from_name: string; timestamp: string; is_from_me?: boolean; has_media?: boolean; media_type?: string; message_type?: string; ai_response?: string }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT OR IGNORE INTO whatsapp_messages (id, chat_id, account_id, body, from_id, from_name, timestamp, is_from_me, has_media, media_type, message_type, ai_response, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          message.id,
          message.chat_id,
          message.account_id,
          message.body,
          message.from_id,
          message.from_name,
          message.timestamp,
          message.is_from_me ? 1 : 0,
          message.has_media ? 1 : 0,
          message.media_type || null,
          message.message_type || 'text',
          message.ai_response || null
        );
        return true;
      } catch (err) {
        console.error('Failed to create WhatsApp message:', err);
        return false;
      }
    },

    bulkCreate: (messages: Array<{ id: string; chat_id: string; account_id: string; body: string; from_id: string; from_name: string; timestamp: string; is_from_me?: boolean; has_media?: boolean; media_type?: string; message_type?: string }>): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      const insert = this.db.prepare(`
        INSERT OR IGNORE INTO whatsapp_messages (id, chat_id, account_id, body, from_id, from_name, timestamp, is_from_me, has_media, media_type, message_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      const transaction = this.db.transaction((items: typeof messages) => {
        for (const msg of items) {
          insert.run(
            msg.id,
            msg.chat_id,
            msg.account_id,
            msg.body,
            msg.from_id,
            msg.from_name,
            msg.timestamp,
            msg.is_from_me ? 1 : 0,
            msg.has_media ? 1 : 0,
            msg.media_type || null,
            msg.message_type || 'text'
          );
        }
      });
      try {
        transaction(messages);
        return true;
      } catch (err) {
        console.error('Failed to bulk create WhatsApp messages:', err);
        return false;
      }
    },

    updateAIResponse: (id: string, aiResponse: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('UPDATE whatsapp_messages SET ai_response = ? WHERE id = ?').run(aiResponse, id);
      return true;
    },

    markAsRead: (chatId: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('UPDATE whatsapp_messages SET is_read = 1 WHERE chat_id = ?').run(chatId);
      return true;
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM whatsapp_messages WHERE id = ?').run(id);
      return true;
    },

    clearByChat: (chatId: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM whatsapp_messages WHERE chat_id = ?').run(chatId);
      return true;
    },

    clearByAccount: (accountId: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM whatsapp_messages WHERE account_id = ?').run(accountId);
      return true;
    }
  };

  // Telegram Accounts Repository
  telegramAccounts = {
    getAll: (): DbTelegramAccount[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM telegram_accounts ORDER BY created_at DESC').all() as DbTelegramAccount[];
    },

    getById: (id: string): DbTelegramAccount | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM telegram_accounts WHERE id = ?').get(id) as DbTelegramAccount | undefined;
    },

    getConnected: (): DbTelegramAccount | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM telegram_accounts WHERE is_connected = 1 LIMIT 1').get() as DbTelegramAccount | undefined;
    },

    upsert: (account: { id: string; phone: string; name: string; username?: string; is_connected?: boolean; session_data?: string; ai_settings?: string }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT INTO telegram_accounts (id, phone, name, username, is_connected, session_data, ai_settings, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            phone = excluded.phone,
            name = excluded.name,
            username = excluded.username,
            is_connected = excluded.is_connected,
            session_data = COALESCE(excluded.session_data, session_data),
            ai_settings = COALESCE(excluded.ai_settings, ai_settings),
            updated_at = CURRENT_TIMESTAMP
        `).run(
          account.id,
          account.phone,
          account.name,
          account.username || '',
          account.is_connected ? 1 : 0,
          account.session_data || null,
          account.ai_settings || null
        );
        return true;
      } catch (err) {
        console.error('Failed to upsert Telegram account:', err);
        return false;
      }
    },

    updateAISettings: (id: string, aiSettings: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare('UPDATE telegram_accounts SET ai_settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(aiSettings, id);
        return true;
      } catch (err) {
        console.error('Failed to update AI settings:', err);
        return false;
      }
    },

    setConnected: (id: string, connected: boolean): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('UPDATE telegram_accounts SET is_connected = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(connected ? 1 : 0, id);
      return true;
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM telegram_accounts WHERE id = ?').run(id);
      return true;
    }
  };

  // Telegram Chats Repository
  telegramChats = {
    getAll: (accountId: string): DbTelegramChat[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM telegram_chats WHERE account_id = ? ORDER BY last_message_time DESC').all(accountId) as DbTelegramChat[];
    },

    getById: (id: string): DbTelegramChat | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM telegram_chats WHERE id = ?').get(id) as DbTelegramChat | undefined;
    },

    upsert: (chat: { id: string; account_id: string; name: string; is_group?: boolean; is_channel?: boolean; unread_count?: number; last_message?: string; last_message_time?: string; last_message_from_me?: boolean }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT INTO telegram_chats (id, account_id, name, is_group, is_channel, unread_count, last_message, last_message_time, last_message_from_me, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            is_channel = excluded.is_channel,
            unread_count = excluded.unread_count,
            last_message = excluded.last_message,
            last_message_time = excluded.last_message_time,
            last_message_from_me = excluded.last_message_from_me,
            updated_at = CURRENT_TIMESTAMP
        `).run(
          chat.id,
          chat.account_id,
          chat.name,
          chat.is_group ? 1 : 0,
          chat.is_channel ? 1 : 0,
          chat.unread_count || 0,
          chat.last_message || null,
          chat.last_message_time || null,
          chat.last_message_from_me ? 1 : 0
        );
        return true;
      } catch (err) {
        console.error('Failed to upsert Telegram chat:', err);
        return false;
      }
    },

    bulkUpsert: (chats: Array<{ id: string; account_id: string; name: string; is_group?: boolean; is_channel?: boolean; unread_count?: number; last_message?: string; last_message_time?: string; last_message_from_me?: boolean }>): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      const insert = this.db.prepare(`
        INSERT INTO telegram_chats (id, account_id, name, is_group, is_channel, unread_count, last_message, last_message_time, last_message_from_me, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          is_channel = excluded.is_channel,
          unread_count = excluded.unread_count,
          last_message = excluded.last_message,
          last_message_time = excluded.last_message_time,
          last_message_from_me = excluded.last_message_from_me,
          updated_at = CURRENT_TIMESTAMP
      `);
      const transaction = this.db.transaction((items: typeof chats) => {
        for (const chat of items) {
          insert.run(
            chat.id,
            chat.account_id,
            chat.name,
            chat.is_group ? 1 : 0,
            chat.is_channel ? 1 : 0,
            chat.unread_count || 0,
            chat.last_message || null,
            chat.last_message_time || null,
            chat.last_message_from_me ? 1 : 0
          );
        }
      });
      try {
        transaction(chats);
        return true;
      } catch (err) {
        console.error('Failed to bulk upsert Telegram chats:', err);
        return false;
      }
    },

    markAsRead: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('UPDATE telegram_chats SET unread_count = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
      return true;
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM telegram_chats WHERE id = ?').run(id);
      return true;
    },

    clearByAccount: (accountId: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM telegram_chats WHERE account_id = ?').run(accountId);
      return true;
    }
  };

  // Telegram Messages Repository
  telegramMessages = {
    getByChat: (chatId: string, limit: number = 50): DbTelegramMessage[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM telegram_messages WHERE chat_id = ? ORDER BY timestamp ASC LIMIT ?').all(chatId, limit) as DbTelegramMessage[];
    },

    getById: (id: string): DbTelegramMessage | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM telegram_messages WHERE id = ?').get(id) as DbTelegramMessage | undefined;
    },

    getRecent: (accountId: string, limit: number = 100): DbTelegramMessage[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM telegram_messages WHERE account_id = ? ORDER BY timestamp DESC LIMIT ?').all(accountId, limit) as DbTelegramMessage[];
    },

    create: (message: { id: string; chat_id: string; account_id: string; body: string; from_id: string; from_name: string; timestamp: string; is_from_me?: boolean; has_media?: boolean; media_type?: string; message_type?: string; ai_response?: string }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT OR IGNORE INTO telegram_messages (id, chat_id, account_id, body, from_id, from_name, timestamp, is_from_me, has_media, media_type, message_type, ai_response, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          message.id,
          message.chat_id,
          message.account_id,
          message.body,
          message.from_id,
          message.from_name,
          message.timestamp,
          message.is_from_me ? 1 : 0,
          message.has_media ? 1 : 0,
          message.media_type || null,
          message.message_type || 'text',
          message.ai_response || null
        );
        return true;
      } catch (err) {
        console.error('Failed to create Telegram message:', err);
        return false;
      }
    },

    bulkCreate: (messages: Array<{ id: string; chat_id: string; account_id: string; body: string; from_id: string; from_name: string; timestamp: string; is_from_me?: boolean; has_media?: boolean; media_type?: string; message_type?: string }>): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      const insert = this.db.prepare(`
        INSERT OR IGNORE INTO telegram_messages (id, chat_id, account_id, body, from_id, from_name, timestamp, is_from_me, has_media, media_type, message_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      const transaction = this.db.transaction((items: typeof messages) => {
        for (const msg of items) {
          insert.run(
            msg.id,
            msg.chat_id,
            msg.account_id,
            msg.body,
            msg.from_id,
            msg.from_name,
            msg.timestamp,
            msg.is_from_me ? 1 : 0,
            msg.has_media ? 1 : 0,
            msg.media_type || null,
            msg.message_type || 'text'
          );
        }
      });
      try {
        transaction(messages);
        return true;
      } catch (err) {
        console.error('Failed to bulk create Telegram messages:', err);
        return false;
      }
    },

    updateAIResponse: (id: string, aiResponse: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('UPDATE telegram_messages SET ai_response = ? WHERE id = ?').run(aiResponse, id);
      return true;
    },

    markAsRead: (chatId: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('UPDATE telegram_messages SET is_read = 1 WHERE chat_id = ?').run(chatId);
      return true;
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM telegram_messages WHERE id = ?').run(id);
      return true;
    },

    clearByChat: (chatId: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM telegram_messages WHERE chat_id = ?').run(chatId);
      return true;
    },

    clearByAccount: (accountId: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM telegram_messages WHERE account_id = ?').run(accountId);
      return true;
    }
  };

  // Discord Guilds Repository
  discordGuilds = {
    getByAccount: (accountId: string): DbDiscordGuild[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM discord_guilds WHERE account_id = ? ORDER BY name ASC').all(accountId) as DbDiscordGuild[];
    },

    getById: (id: string): DbDiscordGuild | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM discord_guilds WHERE id = ?').get(id) as DbDiscordGuild | undefined;
    },

    create: (guild: { id: string; account_id: string; name: string; icon?: string | null; owner?: boolean; permissions: string; features?: string[] | null; member_count?: number | null; presence_count?: number | null }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT OR REPLACE INTO discord_guilds (id, account_id, name, icon, owner, permissions, features, member_count, presence_count, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          guild.id,
          guild.account_id,
          guild.name,
          guild.icon || null,
          guild.owner ? 1 : 0,
          guild.permissions,
          guild.features ? JSON.stringify(guild.features) : null,
          guild.member_count || null,
          guild.presence_count || null
        );
        return true;
      } catch (err) {
        console.error('Failed to create Discord guild:', err);
        return false;
      }
    },

    bulkCreate: (guilds: Array<{ id: string; account_id: string; name: string; icon?: string | null; owner?: boolean; permissions: string; features?: string[] | null; member_count?: number | null; presence_count?: number | null }>): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      const insert = this.db.prepare(`
        INSERT OR REPLACE INTO discord_guilds (id, account_id, name, icon, owner, permissions, features, member_count, presence_count, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      const transaction = this.db.transaction((items: typeof guilds) => {
        for (const guild of items) {
          insert.run(
            guild.id,
            guild.account_id,
            guild.name,
            guild.icon || null,
            guild.owner ? 1 : 0,
            guild.permissions,
            guild.features ? JSON.stringify(guild.features) : null,
            guild.member_count || null,
            guild.presence_count || null
          );
        }
      });
      try {
        transaction(guilds);
        return true;
      } catch (err) {
        console.error('Failed to bulk create Discord guilds:', err);
        return false;
      }
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM discord_guilds WHERE id = ?').run(id);
      return true;
    },

    clearByAccount: (accountId: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM discord_guilds WHERE account_id = ?').run(accountId);
      return true;
    }
  };

  // Discord Channels Repository
  discordChannels = {
    getByGuild: (guildId: string): { id: string; guild_id: string | null; account_id: string; type: number; name: string | null; topic: string | null; is_dm: number; recipient_name: string | null; last_message_id: string | null }[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM discord_channels WHERE guild_id = ? ORDER BY name ASC').all(guildId) as any[];
    },

    getByAccount: (accountId: string): { id: string; guild_id: string | null; account_id: string; type: number; name: string | null; topic: string | null; is_dm: number; recipient_name: string | null; last_message_id: string | null }[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM discord_channels WHERE account_id = ? ORDER BY name ASC').all(accountId) as any[];
    },

    getDMChannels: (accountId: string): { id: string; guild_id: string | null; account_id: string; type: number; name: string | null; topic: string | null; is_dm: number; recipient_name: string | null; last_message_id: string | null }[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM discord_channels WHERE account_id = ? AND is_dm = 1 ORDER BY name ASC').all(accountId) as any[];
    },

    getById: (id: string): { id: string; guild_id: string | null; account_id: string; type: number; name: string | null; topic: string | null; is_dm: number; recipient_name: string | null; last_message_id: string | null } | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM discord_channels WHERE id = ?').get(id) as any;
    },

    create: (channel: { id: string; guild_id?: string | null; account_id: string; type: number; name?: string | null; topic?: string | null; is_dm?: number; recipient_name?: string | null; last_message_id?: string | null }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT OR REPLACE INTO discord_channels (id, guild_id, account_id, type, name, topic, is_dm, recipient_name, last_message_id, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          channel.id,
          channel.guild_id || null,
          channel.account_id,
          channel.type,
          channel.name || null,
          channel.topic || null,
          channel.is_dm || 0,
          channel.recipient_name || null,
          channel.last_message_id || null
        );
        return true;
      } catch (err) {
        console.error('Failed to create Discord channel:', err);
        return false;
      }
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM discord_channels WHERE id = ?').run(id);
      return true;
    },

    clearByGuild: (guildId: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM discord_channels WHERE guild_id = ?').run(guildId);
      return true;
    },

    clearByAccount: (accountId: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM discord_channels WHERE account_id = ?').run(accountId);
      return true;
    }
  };

  // Discord Messages Repository
  discordMessages = {
    getByChannel: (channelId: string, limit: number = 50): DbDiscordMessage[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM discord_messages WHERE channel_id = ? ORDER BY timestamp DESC LIMIT ?').all(channelId, limit) as DbDiscordMessage[];
    },

    getById: (id: string): DbDiscordMessage | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM discord_messages WHERE id = ?').get(id) as DbDiscordMessage | undefined;
    },

    getRecent: (accountId: string, limit: number = 100): DbDiscordMessage[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM discord_messages WHERE account_id = ? ORDER BY timestamp DESC LIMIT ?').all(accountId, limit) as DbDiscordMessage[];
    },

    create: (message: { id: string; channel_id: string; account_id: string; author_id: string; author_username: string; author_discriminator: string; author_avatar?: string | null; content: string; timestamp: string; edited_timestamp?: string | null; attachments?: any[]; embeds?: any[]; mentions?: any[]; type?: number }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT OR IGNORE INTO discord_messages (id, channel_id, account_id, author_id, author_username, author_discriminator, author_avatar, content, timestamp, edited_timestamp, attachments, embeds, mentions, type, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          message.id,
          message.channel_id,
          message.account_id,
          message.author_id,
          message.author_username,
          message.author_discriminator,
          message.author_avatar || null,
          message.content,
          message.timestamp,
          message.edited_timestamp || null,
          message.attachments ? JSON.stringify(message.attachments) : null,
          message.embeds ? JSON.stringify(message.embeds) : null,
          message.mentions ? JSON.stringify(message.mentions) : null,
          message.type || 0
        );
        return true;
      } catch (err) {
        console.error('Failed to create Discord message:', err);
        return false;
      }
    },

    bulkCreate: (messages: Array<{ id: string; channel_id: string; account_id: string; author_id: string; author_username: string; author_discriminator: string; author_avatar?: string | null; content: string; timestamp: string; edited_timestamp?: string | null; attachments?: any[]; embeds?: any[]; mentions?: any[]; type?: number }>): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      const insert = this.db.prepare(`
        INSERT OR IGNORE INTO discord_messages (id, channel_id, account_id, author_id, author_username, author_discriminator, author_avatar, content, timestamp, edited_timestamp, attachments, embeds, mentions, type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      const transaction = this.db.transaction((items: typeof messages) => {
        for (const msg of items) {
          insert.run(
            msg.id,
            msg.channel_id,
            msg.account_id,
            msg.author_id,
            msg.author_username,
            msg.author_discriminator,
            msg.author_avatar || null,
            msg.content,
            msg.timestamp,
            msg.edited_timestamp || null,
            msg.attachments ? JSON.stringify(msg.attachments) : null,
            msg.embeds ? JSON.stringify(msg.embeds) : null,
            msg.mentions ? JSON.stringify(msg.mentions) : null,
            msg.type || 0
          );
        }
      });
      try {
        transaction(messages);
        return true;
      } catch (err) {
        console.error('Failed to bulk create Discord messages:', err);
        return false;
      }
    },

    markAsRead: (channelId: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('UPDATE discord_messages SET is_read = 1 WHERE channel_id = ?').run(channelId);
      return true;
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM discord_messages WHERE id = ?').run(id);
      return true;
    },

    clearByChannel: (channelId: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM discord_messages WHERE channel_id = ?').run(channelId);
      return true;
    },

    clearByAccount: (accountId: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM discord_messages WHERE account_id = ?').run(accountId);
      return true;
    }
  };

  // Watched Items Repository
  watchedItems = {
    getAll: (): DbWatchedItem[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM watched_items ORDER BY created_at DESC').all() as DbWatchedItem[];
    },

    getByPlatform: (platform: string): DbWatchedItem[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM watched_items WHERE platform = ? ORDER BY created_at DESC').all(platform) as DbWatchedItem[];
    },

    getByStatus: (actionStatus: string): DbWatchedItem[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM watched_items WHERE action_status = ? ORDER BY created_at DESC').all(actionStatus) as DbWatchedItem[];
    },

    getActive: (): DbWatchedItem[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare("SELECT * FROM watched_items WHERE watch_status = 'active' ORDER BY created_at DESC").all() as DbWatchedItem[];
    },

    getPending: (): DbWatchedItem[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare("SELECT * FROM watched_items WHERE action_status = 'pending' AND watch_status = 'active' ORDER BY created_at DESC").all() as DbWatchedItem[];
    },

    getById: (id: string): DbWatchedItem | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM watched_items WHERE id = ?').get(id) as DbWatchedItem | undefined;
    },

    getByItemId: (platform: string, itemType: string, itemId: string): DbWatchedItem | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM watched_items WHERE platform = ? AND item_type = ? AND item_id = ?').get(platform, itemType, itemId) as DbWatchedItem | undefined;
    },

    isWatched: (platform: string, itemType: string, itemId: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      const result = this.db.prepare('SELECT id FROM watched_items WHERE platform = ? AND item_type = ? AND item_id = ?').get(platform, itemType, itemId);
      return !!result;
    },

    create: (item: { id: string; platform: string; item_type: string; item_id: string; item_name: string; item_metadata?: string | null; action?: string | null; action_status?: string; watch_status?: string; notes?: string | null }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT INTO watched_items (id, platform, item_type, item_id, item_name, item_metadata, action, action_status, watch_status, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          item.id,
          item.platform,
          item.item_type,
          item.item_id,
          item.item_name,
          item.item_metadata || null,
          item.action || null,
          item.action_status || 'pending',
          item.watch_status || 'active',
          item.notes || null
        );
        return true;
      } catch (err) {
        console.error('Failed to create watched item:', err);
        return false;
      }
    },

    update: (id: string, updates: Partial<{ item_name: string; item_metadata: string | null; action: string | null; action_status: string; watch_status: string; notes: string | null }>): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        const fields = Object.keys(updates).filter(k => k !== 'id');
        if (fields.length === 0) return true;
        
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => (updates as any)[f]);
        
        this.db.prepare(`UPDATE watched_items SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, id);
        return true;
      } catch (err) {
        console.error('Failed to update watched item:', err);
        return false;
      }
    },

    updateStatus: (id: string, actionStatus: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('UPDATE watched_items SET action_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(actionStatus, id);
      return true;
    },

    toggleWatch: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      const item = this.watchedItems.getById(id);
      if (!item) return false;
      const newStatus = item.watch_status === 'active' ? 'paused' : 'active';
      this.db.prepare('UPDATE watched_items SET watch_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, id);
      return true;
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM watched_items WHERE id = ?').run(id);
      return true;
    },

    deleteByItemId: (platform: string, itemType: string, itemId: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM watched_items WHERE platform = ? AND item_type = ? AND item_id = ?').run(platform, itemType, itemId);
      return true;
    },

    clearCompleted: (): number => {
      if (!this.db) throw new Error('Database not initialized');
      const result = this.db.prepare("DELETE FROM watched_items WHERE action_status = 'completed'").run();
      return result.changes;
    },

    clearDismissed: (): number => {
      if (!this.db) throw new Error('Database not initialized');
      const result = this.db.prepare("DELETE FROM watched_items WHERE action_status = 'dismissed'").run();
      return result.changes;
    }
  };

  // Intelligence Feed Repository
  intelligenceFeeds = {
    getAll: (): DbIntelligenceFeed[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM intelligence_feeds ORDER BY generated_at DESC').all() as DbIntelligenceFeed[];
    },

    getRecent: (limit: number = 10): DbIntelligenceFeed[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM intelligence_feeds ORDER BY generated_at DESC LIMIT ?').all(limit) as DbIntelligenceFeed[];
    },

    getByCategory: (category: string): DbIntelligenceFeed[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM intelligence_feeds WHERE category = ? ORDER BY generated_at DESC').all(category) as DbIntelligenceFeed[];
    },

    getById: (id: string): DbIntelligenceFeed | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM intelligence_feeds WHERE id = ?').get(id) as DbIntelligenceFeed | undefined;
    },

    create: (feed: { id: string; title: string; content: string; category: string; priority?: number; insights?: string | null; action_items?: string | null; sources?: string | null; generated_at: string }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT INTO intelligence_feeds (id, title, content, category, priority, insights, action_items, sources, generated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          feed.id,
          feed.title,
          feed.content,
          feed.category,
          feed.priority || 0,
          feed.insights || null,
          feed.action_items || null,
          feed.sources || null,
          feed.generated_at
        );
        return true;
      } catch (err) {
        console.error('Failed to create intelligence feed:', err);
        return false;
      }
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM intelligence_feeds WHERE id = ?').run(id);
      return true;
    },

    deleteOlderThan: (days: number): number => {
      if (!this.db) throw new Error('Database not initialized');
      const date = new Date();
      date.setDate(date.getDate() - days);
      const result = this.db.prepare('DELETE FROM intelligence_feeds WHERE generated_at < ?').run(date.toISOString());
      return result.changes;
    },
  };

  // Watch Actions Repository
  watchActions = {
    getAll: (): any[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare(`
        SELECT wa.*, wi.item_name, wi.platform, wi.item_type 
        FROM watch_actions wa 
        LEFT JOIN watched_items wi ON wa.watched_item_id = wi.id 
        ORDER BY wa.created_at DESC
      `).all();
    },

    getByStatus: (status: string): any[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare(`
        SELECT wa.*, wi.item_name, wi.platform, wi.item_type 
        FROM watch_actions wa 
        LEFT JOIN watched_items wi ON wa.watched_item_id = wi.id 
        WHERE wa.status = ?
        ORDER BY wa.created_at DESC
      `).all(status);
    },

    getByWatchedItem: (watchedItemId: string): any[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM watch_actions WHERE watched_item_id = ? ORDER BY created_at DESC').all(watchedItemId);
    },

    create: (action: { id: string; watched_item_id: string; title: string; description?: string; priority?: string; source_content?: string; source_message_ids?: string }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT INTO watch_actions (id, watched_item_id, title, description, priority, source_content, source_message_ids)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          action.id,
          action.watched_item_id,
          action.title,
          action.description || null,
          action.priority || 'medium',
          action.source_content || null,
          action.source_message_ids || null
        );
        return true;
      } catch (err) {
        console.error('Failed to create watch action:', err);
        return false;
      }
    },

    updateStatus: (id: string, status: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      const completedAt = status === 'completed' ? new Date().toISOString() : null;
      this.db.prepare('UPDATE watch_actions SET status = ?, completed_at = ? WHERE id = ?').run(status, completedAt, id);
      return true;
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM watch_actions WHERE id = ?').run(id);
      return true;
    },

    clearCompleted: (): number => {
      if (!this.db) throw new Error('Database not initialized');
      const result = this.db.prepare("DELETE FROM watch_actions WHERE status = 'completed'").run();
      return result.changes;
    },

    clearDismissed: (): number => {
      if (!this.db) throw new Error('Database not initialized');
      const result = this.db.prepare("DELETE FROM watch_actions WHERE status = 'dismissed'").run();
      return result.changes;
    }
  };

  // Analyzed Messages Repository
  analyzedMessages = {
    isAnalyzed: (watchedItemId: string, messageId: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      const result = this.db.prepare('SELECT id FROM analyzed_messages WHERE watched_item_id = ? AND message_id = ?').get(watchedItemId, messageId);
      return !!result;
    },

    markAsAnalyzed: (watchedItemId: string, messageIds: string[], platform: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        const stmt = this.db.prepare(`
          INSERT OR IGNORE INTO analyzed_messages (id, watched_item_id, message_id, platform)
          VALUES (?, ?, ?, ?)
        `);
        for (const messageId of messageIds) {
          const id = `${watchedItemId}_${messageId}`;
          stmt.run(id, watchedItemId, messageId, platform);
        }
        return true;
      } catch (err) {
        console.error('Failed to mark messages as analyzed:', err);
        return false;
      }
    },

    getAnalyzedIds: (watchedItemId: string): string[] => {
      if (!this.db) throw new Error('Database not initialized');
      const results = this.db.prepare('SELECT message_id FROM analyzed_messages WHERE watched_item_id = ?').all(watchedItemId) as { message_id: string }[];
      return results.map(r => r.message_id);
    },

    clearByWatchedItem: (watchedItemId: string): number => {
      if (!this.db) throw new Error('Database not initialized');
      const result = this.db.prepare('DELETE FROM analyzed_messages WHERE watched_item_id = ?').run(watchedItemId);
      return result.changes;
    }
  };

  // YouTube Channels Repository
  youtubeChannels = {
    getAll: (): DbYouTubeChannel[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM youtube_channels ORDER BY channel_name ASC').all() as DbYouTubeChannel[];
    },

    getActive: (): DbYouTubeChannel[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM youtube_channels WHERE is_active = 1 ORDER BY channel_name ASC').all() as DbYouTubeChannel[];
    },

    getById: (id: string): DbYouTubeChannel | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM youtube_channels WHERE id = ?').get(id) as DbYouTubeChannel | undefined;
    },

    getByChannelId: (channelId: string): DbYouTubeChannel | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM youtube_channels WHERE channel_id = ?').get(channelId) as DbYouTubeChannel | undefined;
    },

    create: (channel: { id: string; channel_id: string; channel_name: string; channel_url: string; rss_url: string; thumbnail_url?: string; description?: string; subscriber_count?: string }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT INTO youtube_channels (id, channel_id, channel_name, channel_url, rss_url, thumbnail_url, description, subscriber_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          channel.id,
          channel.channel_id,
          channel.channel_name,
          channel.channel_url,
          channel.rss_url,
          channel.thumbnail_url || null,
          channel.description || null,
          channel.subscriber_count || null
        );
        return true;
      } catch (err) {
        console.error('Failed to create YouTube channel:', err);
        return false;
      }
    },

    update: (id: string, updates: Partial<DbYouTubeChannel>): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      const allowedFields = ['channel_name', 'thumbnail_url', 'description', 'subscriber_count', 'is_active', 'last_checked'];
      const fields: string[] = [];
      const values: any[] = [];
      
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }
      
      if (fields.length === 0) return false;
      
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      
      this.db.prepare(`UPDATE youtube_channels SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      return true;
    },

    updateLastChecked: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('UPDATE youtube_channels SET last_checked = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
      return true;
    },

    toggleActive: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('UPDATE youtube_channels SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
      return true;
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM youtube_channels WHERE id = ?').run(id);
      return true;
    }
  };

  // YouTube Videos Repository
  youtubeVideos = {
    getAll: (limit: number = 100): DbYouTubeVideo[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM youtube_videos ORDER BY published_at DESC LIMIT ?').all(limit) as DbYouTubeVideo[];
    },

    getByChannel: (channelId: string, limit: number = 50): DbYouTubeVideo[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM youtube_videos WHERE channel_id = ? ORDER BY published_at DESC LIMIT ?').all(channelId, limit) as DbYouTubeVideo[];
    },

    getById: (id: string): DbYouTubeVideo | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM youtube_videos WHERE id = ?').get(id) as DbYouTubeVideo | undefined;
    },

    getByVideoId: (videoId: string): DbYouTubeVideo | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM youtube_videos WHERE video_id = ?').get(videoId) as DbYouTubeVideo | undefined;
    },

    getUnanalyzed: (limit: number = 20): DbYouTubeVideo[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM youtube_videos WHERE is_analyzed = 0 ORDER BY published_at DESC LIMIT ?').all(limit) as DbYouTubeVideo[];
    },

    getByDateRange: (startDate: string, endDate: string): DbYouTubeVideo[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM youtube_videos WHERE published_at >= ? AND published_at <= ? ORDER BY published_at DESC').all(startDate, endDate) as DbYouTubeVideo[];
    },

    getHighValue: (minScore: number = 70, limit: number = 20): DbYouTubeVideo[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM youtube_videos WHERE ai_value_score >= ? ORDER BY ai_value_score DESC, published_at DESC LIMIT ?').all(minScore, limit) as DbYouTubeVideo[];
    },

    create: (video: { id: string; channel_id: string; video_id: string; title: string; description?: string; thumbnail_url?: string; published_at: string; duration?: string; view_count?: string; video_url: string }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT OR IGNORE INTO youtube_videos (id, channel_id, video_id, title, description, thumbnail_url, published_at, duration, view_count, video_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          video.id,
          video.channel_id,
          video.video_id,
          video.title,
          video.description || null,
          video.thumbnail_url || null,
          video.published_at,
          video.duration || null,
          video.view_count || null,
          video.video_url
        );
        return true;
      } catch (err) {
        console.error('Failed to create YouTube video:', err);
        return false;
      }
    },

    bulkCreate: (videos: Array<{ id: string; channel_id: string; video_id: string; title: string; description?: string; thumbnail_url?: string; published_at: string; duration?: string; view_count?: string; video_url: string }>): number => {
      if (!this.db) throw new Error('Database not initialized');
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO youtube_videos (id, channel_id, video_id, title, description, thumbnail_url, published_at, duration, view_count, video_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      let inserted = 0;
      const insertMany = this.db.transaction((items: typeof videos) => {
        for (const video of items) {
          const result = stmt.run(
            video.id,
            video.channel_id,
            video.video_id,
            video.title,
            video.description || null,
            video.thumbnail_url || null,
            video.published_at,
            video.duration || null,
            video.view_count || null,
            video.video_url
          );
          if (result.changes > 0) inserted++;
        }
      });
      
      insertMany(videos);
      return inserted;
    },

    updateAnalysis: (id: string, analysis: { transcript?: string; ai_summary?: string; ai_topics?: string; ai_value_score?: number; ai_value_reason?: string }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare(`
        UPDATE youtube_videos 
        SET transcript = ?, ai_summary = ?, ai_topics = ?, ai_value_score = ?, ai_value_reason = ?, is_analyzed = 1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(
        analysis.transcript || null,
        analysis.ai_summary || null,
        analysis.ai_topics || null,
        analysis.ai_value_score || null,
        analysis.ai_value_reason || null,
        id
      );
      return true;
    },

    markAsWatched: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('UPDATE youtube_videos SET is_watched = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
      return true;
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM youtube_videos WHERE id = ?').run(id);
      return true;
    },

    deleteByChannel: (channelId: string): number => {
      if (!this.db) throw new Error('Database not initialized');
      const result = this.db.prepare('DELETE FROM youtube_videos WHERE channel_id = ?').run(channelId);
      return result.changes;
    }
  };

  // User Interests Repository
  userInterests = {
    getAll: (): DbUserInterest[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM user_interests ORDER BY weight DESC, category ASC').all() as DbUserInterest[];
    },

    getByCategory: (category: string): DbUserInterest[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM user_interests WHERE category = ? ORDER BY weight DESC').all(category) as DbUserInterest[];
    },

    upsert: (interest: { id: string; category: string; topic: string; weight: number }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT INTO user_interests (id, category, topic, weight)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(category, topic) DO UPDATE SET weight = ?, updated_at = CURRENT_TIMESTAMP
        `).run(interest.id, interest.category, interest.topic, interest.weight, interest.weight);
        return true;
      } catch (err) {
        console.error('Failed to upsert user interest:', err);
        return false;
      }
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM user_interests WHERE id = ?').run(id);
      return true;
    },

    deleteAll: (): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM user_interests').run();
      return true;
    }
  };

  // Resend Email Templates Repository
  resendTemplates = {
    getAll: (): any[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM resend_templates ORDER BY created_at DESC').all();
    },

    getById: (id: string): any | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM resend_templates WHERE id = ?').get(id);
    },

    create: (template: { id: string; name: string; subject: string; html?: string; text?: string }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT INTO resend_templates (id, name, subject, html, text)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          template.id,
          template.name,
          template.subject,
          template.html || null,
          template.text || null
        );
        return true;
      } catch (err) {
        console.error('Failed to create resend template:', err);
        return false;
      }
    },

    update: (id: string, updates: { name?: string; subject?: string; html?: string; text?: string }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      const fields = [];
      const values = [];
      
      if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
      if (updates.subject !== undefined) { fields.push('subject = ?'); values.push(updates.subject); }
      if (updates.html !== undefined) { fields.push('html = ?'); values.push(updates.html); }
      if (updates.text !== undefined) { fields.push('text = ?'); values.push(updates.text); }
      
      if (fields.length === 0) return false;
      
      values.push(id);
      this.db.prepare(`UPDATE resend_templates SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      return true;
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM resend_templates WHERE id = ?').run(id);
      return true;
    }
  };

  // Resend Sent Emails Repository
  resendSentEmails = {
    getAll: (limit: number = 100): any[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM resend_sent_emails ORDER BY created_at DESC LIMIT ?').all(limit);
    },

    getById: (id: string): any | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM resend_sent_emails WHERE id = ?').get(id);
    },

    create: (email: { id: string; from_email: string; to_emails: string; subject: string; html?: string; text?: string; created_at?: string }): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      try {
        this.db.prepare(`
          INSERT INTO resend_sent_emails (id, from_email, to_emails, subject, html, text, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          email.id,
          email.from_email,
          email.to_emails,
          email.subject,
          email.html || null,
          email.text || null,
          email.created_at || new Date().toISOString()
        );
        return true;
      } catch (err) {
        console.error('Failed to create resend sent email:', err);
        return false;
      }
    },

    updateEvent: (id: string, lastEvent: string, clicks?: number, opens?: number): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      const updates: string[] = ['last_event = ?'];
      const values: any[] = [lastEvent];
      
      if (clicks !== undefined) {
        updates.push('clicks = ?');
        values.push(clicks);
      }
      if (opens !== undefined) {
        updates.push('opens = ?');
        values.push(opens);
      }
      
      values.push(id);
      this.db.prepare(`UPDATE resend_sent_emails SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      return true;
    },

    delete: (id: string): boolean => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM resend_sent_emails WHERE id = ?').run(id);
      return true;
    },

    deleteAll: (): number => {
      if (!this.db) throw new Error('Database not initialized');
      const result = this.db.prepare('DELETE FROM resend_sent_emails').run();
      return result.changes;
    }
  };

  // Data Cleanup & Privacy Functions
  // Constants for cleanup placeholder text
  private readonly CLEANUP_PLACEHOLDERS = {
    EMAIL_CONTENT: '[Content Removed]',
    MESSAGE_CONTENT: '[Message Removed]',
  };

  dataCleanup = {
    /**
     * Clear email content while keeping metadata
     * Removes: preview, ai_summary, ai_suggested_reply
     * Keeps: id, subject, sender, timestamp, labels, tags, is_read
     */
    clearEmailContent: (): { deleted: number } => {
      if (!this.db) throw new Error('Database not initialized');

      const result = this.db.prepare(`
        UPDATE emails
        SET preview = ?,
            ai_summary = NULL,
            ai_suggested_reply = NULL
        WHERE preview IS NOT NULL OR ai_summary IS NOT NULL OR ai_suggested_reply IS NOT NULL
      `).run(this.CLEANUP_PLACEHOLDERS.EMAIL_CONTENT);

      return { deleted: result.changes };
    },

    /**
     * Clear WhatsApp message content while keeping metadata
     * Removes: body, media_url, ai_response
     * Keeps: id, chat_id, timestamp, from_id, from_name, message_type
     */
    clearWhatsAppMessages: (): { deleted: number } => {
      if (!this.db) throw new Error('Database not initialized');

      const result = this.db.prepare(`
        UPDATE whatsapp_messages
        SET body = ?,
            media_url = NULL,
            ai_response = NULL
        WHERE body IS NOT NULL OR media_url IS NOT NULL OR ai_response IS NOT NULL
      `).run(this.CLEANUP_PLACEHOLDERS.MESSAGE_CONTENT);

      return { deleted: result.changes };
    },

    /**
     * Clear Discord message content while keeping metadata
     * Removes: content, attachments, embeds
     * Keeps: id, channel_id, timestamp, author info
     */
    clearDiscordMessages: (): { deleted: number } => {
      if (!this.db) throw new Error('Database not initialized');

      const result = this.db.prepare(`
        UPDATE discord_messages
        SET content = ?,
            attachments = NULL,
            embeds = NULL
        WHERE content IS NOT NULL OR attachments IS NOT NULL OR embeds IS NOT NULL
      `).run(this.CLEANUP_PLACEHOLDERS.MESSAGE_CONTENT);

      return { deleted: result.changes };
    },

    /**
     * Clear all chat session messages
     * Removes all messages from chat_messages table
     */
    clearAllChatMessages: (): { deleted: number } => {
      if (!this.db) throw new Error('Database not initialized');

      const result = this.db.prepare('DELETE FROM chat_messages').run();

      return { deleted: result.changes };
    },

    /**
     * Clear all knowledge base messages
     */
    clearKnowledgeMessages: (): { deleted: number } => {
      if (!this.db) throw new Error('Database not initialized');

      const result = this.db.prepare('DELETE FROM knowledge_messages').run();

      return { deleted: result.changes };
    },

    /**
     * Clear all AI-generated insights
     */
    clearKnowledgeInsights: (): { deleted: number } => {
      if (!this.db) throw new Error('Database not initialized');

      const result = this.db.prepare('DELETE FROM knowledge_insights').run();

      return { deleted: result.changes };
    },

    /**
     * Clear conversation summaries
     */
    clearConversationSummaries: (): { deleted: number } => {
      if (!this.db) throw new Error('Database not initialized');

      const result = this.db.prepare('DELETE FROM conversation_summaries').run();

      return { deleted: result.changes };
    },

    /**
     * Clear all sensitive email and message content
     * Comprehensive cleanup that removes all sensitive data
     */
    clearAllSensitiveContent: (): {
      emails: number;
      whatsapp: number;
      discord: number;
      chats: number;
      knowledge: number;
      insights: number;
      summaries: number;
    } => {
      if (!this.db) throw new Error('Database not initialized');

      const emailResult = this.dataCleanup.clearEmailContent();
      const whatsappResult = this.dataCleanup.clearWhatsAppMessages();
      const discordResult = this.dataCleanup.clearDiscordMessages();
      const chatResult = this.dataCleanup.clearAllChatMessages();
      const knowledgeResult = this.dataCleanup.clearKnowledgeMessages();
      const insightsResult = this.dataCleanup.clearKnowledgeInsights();
      const summariesResult = this.dataCleanup.clearConversationSummaries();

      return {
        emails: emailResult.deleted,
        whatsapp: whatsappResult.deleted,
        discord: discordResult.deleted,
        chats: chatResult.deleted,
        knowledge: knowledgeResult.deleted,
        insights: insightsResult.deleted,
        summaries: summariesResult.deleted,
      };
    },

    /**
     * Delete all data for a specific account
     */
    deleteAccountData: (accountId: string): {
      emails: number;
      events: number;
      notifications: number;
      github: number;
      whatsappChats: number;
      whatsappMessages: number;
      discordGuilds: number;
      discordMessages: number;
    } => {
      if (!this.db) throw new Error('Database not initialized');

      const emailsDeleted = this.db.prepare('DELETE FROM emails WHERE account_id = ?').run(accountId);
      const eventsDeleted = this.db.prepare('DELETE FROM events WHERE account_id = ?').run(accountId);
      const notificationsDeleted = this.db.prepare('DELETE FROM notifications WHERE account_id = ?').run(accountId);
      const githubDeleted = this.db.prepare('DELETE FROM github_items WHERE account_id = ?').run(accountId);

      // Check if it's a WhatsApp account
      const whatsappChatsDeleted = this.db.prepare('DELETE FROM whatsapp_chats WHERE account_id = ?').run(accountId);
      const whatsappMessagesDeleted = this.db.prepare('DELETE FROM whatsapp_messages WHERE account_id = ?').run(accountId);

      // Check if it's a Discord account
      const discordGuildsDeleted = this.db.prepare('DELETE FROM discord_guilds WHERE account_id = ?').run(accountId);
      const discordMessagesDeleted = this.db.prepare('DELETE FROM discord_messages WHERE account_id = ?').run(accountId);

      return {
        emails: emailsDeleted.changes,
        events: eventsDeleted.changes,
        notifications: notificationsDeleted.changes,
        github: githubDeleted.changes,
        whatsappChats: whatsappChatsDeleted.changes,
        whatsappMessages: whatsappMessagesDeleted.changes,
        discordGuilds: discordGuildsDeleted.changes,
        discordMessages: discordMessagesDeleted.changes,
      };
    },

    /**
     * Vacuum the database to reclaim space after deletions
     */
    vacuum: (): void => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('VACUUM').run();
    },

    /**
     * Get database statistics
     */
    getStats: (): {
      emails: number;
      events: number;
      whatsappMessages: number;
      discordMessages: number;
      chatMessages: number;
      knowledgeInsights: number;
      userActivities: number;
    } => {
      if (!this.db) throw new Error('Database not initialized');

      const emailCount = this.db.prepare('SELECT COUNT(*) as count FROM emails').get() as { count: number };
      const eventCount = this.db.prepare('SELECT COUNT(*) as count FROM events').get() as { count: number };
      const whatsappCount = this.db.prepare('SELECT COUNT(*) as count FROM whatsapp_messages').get() as { count: number };
      const discordCount = this.db.prepare('SELECT COUNT(*) as count FROM discord_messages').get() as { count: number };
      const chatCount = this.db.prepare('SELECT COUNT(*) as count FROM chat_messages').get() as { count: number };
      const insightCount = this.db.prepare('SELECT COUNT(*) as count FROM knowledge_insights').get() as { count: number };
      const activityCount = this.db.prepare('SELECT COUNT(*) as count FROM user_activities').get() as { count: number };

      return {
        emails: emailCount.count,
        events: eventCount.count,
        whatsappMessages: whatsappCount.count,
        discordMessages: discordCount.count,
        chatMessages: chatCount.count,
        knowledgeInsights: insightCount.count,
        userActivities: activityCount.count,
      };
    },
  };

  // Notes Repository
  notes = {
    getAll: (): DbNote[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all() as DbNote[];
    },

    getById: (id: number): DbNote | undefined => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as DbNote | undefined;
    },

    getByCategory: (category: string): DbNote[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM notes WHERE category = ? ORDER BY updated_at DESC').all(category) as DbNote[];
    },

    getPinned: (): DbNote[] => {
      if (!this.db) throw new Error('Database not initialized');
      return this.db.prepare('SELECT * FROM notes WHERE is_pinned = 1 ORDER BY updated_at DESC').all() as DbNote[];
    },

    upsert: (note: Partial<DbNote>): any => {
      if (!this.db) throw new Error('Database not initialized');
      
      const id = note.id;
      const existing = id ? this.notes.getById(id) : undefined;
      
      if (existing) {
        // Update
        const fields = Object.keys(note).filter(k => k !== 'id' && k !== 'created_at');
        const setClause = fields.map(f => `${f} = @${f}`).join(', ');
        const sql = `UPDATE notes SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`;
        return this.db.prepare(sql).run(note);
      } else {
        // Insert
        const fields = Object.keys(note).filter(k => k !== 'id');
        const placeholders = fields.map(f => `@${f}`).join(', ');
        const sql = `INSERT INTO notes (${fields.join(', ')}) VALUES (${placeholders})`;
        return this.db.prepare(sql).run(note);
      }
    },

    delete: (id: number): void => {
      if (!this.db) throw new Error('Database not initialized');
      this.db.prepare('DELETE FROM notes WHERE id = ?').run(id);
    },
  };
}

// Export singleton instance
export const database = new DatabaseManager();

/**
 * Cleanup function to remove all LinkedIn accounts and associated data
 */
export async function cleanupLinkedInData() {
  const dbInstance = database['db']; // Access private db property
  if (!dbInstance) throw new Error('Database not initialized');

  const deleteCounts = {
    emails: 0,
    events: 0,
    notifications: 0,
    github_items: 0,
    folders: 0,
    accounts: 0
  };

  try {
    // Begin transaction
    dbInstance.prepare('BEGIN TRANSACTION').run();

    // 1. Find all LinkedIn account IDs
    const linkedinAccounts = dbInstance.prepare(
      "SELECT id FROM accounts WHERE platform = 'linkedin'"
    ).all() as { id: string }[];

    if (linkedinAccounts.length === 0) {
      dbInstance.prepare('ROLLBACK').run();
      return { success: true, message: 'No LinkedIn accounts found', deleteCounts };
    }

    const accountIds = linkedinAccounts.map(acc => acc.id);
    console.log(`📊 Found ${accountIds.length} LinkedIn account(s)`);

    // 2. Delete associated data from all tables
    for (const accountId of accountIds) {
      const emailResult = dbInstance.prepare('DELETE FROM emails WHERE account_id = ?').run(accountId);
      deleteCounts.emails += emailResult.changes;

      const eventResult = dbInstance.prepare('DELETE FROM events WHERE account_id = ?').run(accountId);
      deleteCounts.events += eventResult.changes;

      const notifResult = dbInstance.prepare('DELETE FROM notifications WHERE account_id = ?').run(accountId);
      deleteCounts.notifications += notifResult.changes;

      const githubResult = dbInstance.prepare('DELETE FROM github_items WHERE account_id = ?').run(accountId);
      deleteCounts.github_items += githubResult.changes;
    }

    // 3. Update folders (remove LinkedIn account IDs from account_ids JSON)
    const folders = dbInstance.prepare('SELECT id, account_ids FROM folders').all() as { id: string; account_ids: string }[];
    for (const folder of folders) {
      try {
        const accountIdsArray = JSON.parse(folder.account_ids);
        const filtered = accountIdsArray.filter((id: string) => !accountIds.includes(id));
        
        if (filtered.length !== accountIdsArray.length) {
          if (filtered.length === 0) {
            const result = dbInstance.prepare('DELETE FROM folders WHERE id = ?').run(folder.id);
            deleteCounts.folders += result.changes;
          } else {
            dbInstance.prepare('UPDATE folders SET account_ids = ? WHERE id = ?').run(
              JSON.stringify(filtered),
              folder.id
            );
          }
        }
      } catch (e) {
        console.warn(`⚠️  Could not parse folder ${folder.id} account_ids`);
      }
    }

    // 4. Delete LinkedIn accounts
    const accountResult = dbInstance.prepare("DELETE FROM accounts WHERE platform = 'linkedin'").run();
    deleteCounts.accounts = accountResult.changes;

    // Commit transaction
    dbInstance.prepare('COMMIT').run();

    const total = Object.values(deleteCounts).reduce((a, b) => a + b, 0);
    console.log(`✅ LinkedIn cleanup completed: ${total} items removed`);

    return { 
      success: true, 
      message: `Successfully removed ${total} LinkedIn-related items`, 
      deleteCounts 
    };

  } catch (error) {
    dbInstance.prepare('ROLLBACK').run();
    throw error;
  }
}
// Browser Automations exports
export function createAutomation(automation: Omit<DbAutomation, 'id' | 'created_at' | 'last_run'>) {
  const db = database['db'];
  if (!db) throw new Error('Database not initialized');
  const id = Date.now().toString();
  db.prepare(`
    INSERT INTO automations (id, name, description, task, profile_id, headless, run_on_startup, cron_schedule, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    automation.name,
    automation.description,
    automation.task,
    automation.profile_id,
    automation.headless,
    automation.run_on_startup,
    automation.cron_schedule,
    automation.status
  );
  return id;
}

export function getAutomations(): DbAutomation[] {
  const db = database['db'];
  if (!db) throw new Error('Database not initialized');
  return db.prepare('SELECT * FROM automations ORDER BY created_at DESC').all() as DbAutomation[];
}

export function getAutomation(id: string): DbAutomation | undefined {
  const db = database['db'];
  if (!db) throw new Error('Database not initialized');
  return db.prepare('SELECT * FROM automations WHERE id = ?').get(id) as DbAutomation | undefined;
}

export function updateAutomation(id: string, updates: Partial<Omit<DbAutomation, 'id' | 'created_at'>>) {
  const db = database['db'];
  if (!db) throw new Error('Database not initialized');
  const fields: string[] = [];
  const values: any[] = [];
  
  Object.entries(updates).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });
  
  if (fields.length === 0) return;
  
  values.push(id);
  db.prepare(`UPDATE automations SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteAutomation(id: string) {
  const db = database['db'];
  if (!db) throw new Error('Database not initialized');
  db.prepare('DELETE FROM automations WHERE id = ?').run(id);
  // History will be deleted automatically due to CASCADE
}

export function createAutomationHistory(history: Omit<DbAutomationHistory, 'id' | 'created_at'>) {
  const db = database['db'];
  if (!db) throw new Error('Database not initialized');
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  db.prepare(`
    INSERT INTO automation_history (id, automation_id, status, started_at, completed_at, result, error_message, analysis)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    history.automation_id,
    history.status,
    history.started_at,
    history.completed_at,
    history.result,
    history.error_message,
    history.analysis || null
  );
  return id;
}

export function getAutomationHistory(automationId: string): DbAutomationHistory[] {
  const db = database['db'];
  if (!db) throw new Error('Database not initialized');
  return db.prepare('SELECT * FROM automation_history WHERE automation_id = ? ORDER BY started_at DESC')
    .all(automationId) as DbAutomationHistory[];
}

export function getRecentAutomationHistory(limit: number = 20): DbAutomationHistory[] {
  const db = database['db'];
  if (!db) throw new Error('Database not initialized');
  return db.prepare('SELECT * FROM automation_history ORDER BY started_at DESC LIMIT ?')
    .all(limit) as DbAutomationHistory[];
}

export function updateAutomationHistory(id: string, updates: Partial<Omit<DbAutomationHistory, 'id' | 'automation_id' | 'created_at'>>) {
  const db = database['db'];
  if (!db) throw new Error('Database not initialized');
  const fields: string[] = [];
  const values: any[] = [];
  
  Object.entries(updates).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });
  
  if (fields.length === 0) return;
  
  values.push(id);
  db.prepare(`UPDATE automation_history SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}