/**
 * Discord Self-Bot Integration Service (Read-Only)
 * 
 * ⚠️ DISCLAIMER:
 * This module uses unofficial Discord automation methods (self-bot).
 * Using this violates Discord's Terms of Service and will likely result in account suspension.
 * For educational and personal research use only. Use at your own risk.
 * 
 * Handles Discord authentication via user token
 * READ-ONLY: Only fetches messages, never sends or modifies anything
 * Stores data in SQLite database for persistence
 */

import { Client, Message, TextChannel, DMChannel, ThreadChannel, NewsChannel, CategoryChannel } from 'discord.js-selfbot-v13';
import { BrowserWindow } from 'electron';
import { database } from './database.js';
import Store from 'electron-store';
import { getEncryptionKey } from './security.js';

// Electron store for settings
const store = new Store({
  name: 'aether-hub-storage',
  encryptionKey: getEncryptionKey()
});

// Storage keys
const DISCORD_TOKEN_KEY = 'discord_selfbot_token';
const DISCORD_SELFBOT_ENABLED_KEY = 'discord_selfbot_enabled';

// Discord client instance
let discordClient: Client | null = null;
let isClientReady = false;
let authState: 'disconnected' | 'connecting' | 'ready' | 'error' = 'disconnected';
let authError: string | null = null;
let currentAccountId: string | null = null;

export interface DiscordSelfBotChannel {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  parentName: string | null;
  position: number;
  topic?: string | null;
  isThread?: boolean;
  threadMetadata?: {
    archived: boolean;
    locked: boolean;
  } | null;
}

export interface DiscordSelfBotGuild {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  channels: DiscordSelfBotChannel[];
  categories: { id: string; name: string; position: number }[];
}

export interface DiscordSelfBotMessage {
  id: string;
  channelId: string;
  channelName: string;
  guildId: string | null;
  guildName: string | null;
  content: string;
  author: string;
  authorId: string;
  authorAvatar: string | null;
  timestamp: number;
  isFromMe: boolean;
  isDM: boolean;
  attachments: string[];
}

export interface DiscordSelfBotDMChannel {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar: string | null;
  lastMessageId: string | null;
}

/**
 * Check if selfbot mode is enabled
 */
export function isSelfBotEnabled(): boolean {
  return store.get(DISCORD_SELFBOT_ENABLED_KEY, false) as boolean;
}

/**
 * Get saved token (if any)
 */
export function getSavedToken(): string | null {
  return store.get(DISCORD_TOKEN_KEY, null) as string | null;
}

/**
 * Save token to secure storage
 */
export function saveToken(token: string): void {
  store.set(DISCORD_TOKEN_KEY, token);
  store.set(DISCORD_SELFBOT_ENABLED_KEY, true);
}

/**
 * Clear saved token
 */
export function clearToken(): void {
  store.delete(DISCORD_TOKEN_KEY);
  store.set(DISCORD_SELFBOT_ENABLED_KEY, false);
}

/**
 * Get current auth state
 */
export function getAuthState(): { state: typeof authState; error: string | null; isReady: boolean } {
  return {
    state: authState,
    error: authError,
    isReady: isClientReady
  };
}

/**
 * Broadcast event to all windows
 */
function broadcastToWindows(channel: string, data: unknown): void {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(win => {
    win.webContents.send(channel, data);
  });
}

/**
 * Initialize Discord client with user token
 */
export async function initializeDiscordSelfBot(token: string): Promise<{ success: boolean; error?: string }> {
  if (discordClient && isClientReady) {
    console.log('🟡 DISCORD-SELFBOT: Client already initialized');
    return { success: true };
  }

  console.log('🔵 DISCORD-SELFBOT: Initializing client...');
  authState = 'connecting';
  authError = null;

  try {
    // Create new client
    discordClient = new Client();

    // Ready event
    discordClient.on('ready', async () => {
      console.log('🟢 DISCORD-SELFBOT: Client is ready');
      console.log(`🟢 DISCORD-SELFBOT: Logged in as ${discordClient?.user?.tag}`);
      
      isClientReady = true;
      authState = 'ready';
      authError = null;

      // Save account to database
      if (discordClient?.user) {
        const accountId = `discord-selfbot-${discordClient.user.id}`;
        currentAccountId = accountId;
        
        try {
          database.accounts.upsert({
            id: accountId,
            name: discordClient.user.username,
            email: discordClient.user.tag || '',
            platform: 'discord',
            category: 'social',
            access_token: token,
            refresh_token: null,
            token_expires_at: null,
            is_connected: 1,
            color: '#5865F2',
            folder_id: null,
            ignored: 0
          });
        } catch (err) {
          console.error('❌ DISCORD-SELFBOT: Failed to save account:', err);
        }
      }

      // Save token
      saveToken(token);

      // Broadcast ready event
      broadcastToWindows('discord-selfbot:ready', {
        user: discordClient?.user ? {
          id: discordClient.user.id,
          username: discordClient.user.username,
          tag: discordClient.user.tag,
          avatar: discordClient.user.displayAvatarURL()
        } : null,
        guildCount: discordClient?.guilds.cache.size || 0
      });
    });

    // Message event (for real-time updates - read only)
    discordClient.on('messageCreate', async (message: Message) => {
      if (!isClientReady) return;
      
      // Store message in database (read-only operation)
      try {
        const messageData: DiscordSelfBotMessage = {
          id: message.id,
          channelId: message.channelId,
          channelName: (message.channel as TextChannel).name || 'DM',
          guildId: message.guildId,
          guildName: message.guild?.name || null,
          content: message.content,
          author: message.author.username,
          authorId: message.author.id,
          authorAvatar: message.author.displayAvatarURL(),
          timestamp: message.createdTimestamp,
          isFromMe: message.author.id === discordClient?.user?.id,
          isDM: !message.guildId,
          attachments: message.attachments.map(a => a.url)
        };

        // Store in database
        storeDiscordMessage(messageData);

        // Broadcast new message event
        broadcastToWindows('discord-selfbot:message', messageData);
      } catch (err) {
        console.error('❌ DISCORD-SELFBOT: Error processing message:', err);
      }
    });

    // Error event
    discordClient.on('error', (error: Error) => {
      console.error('❌ DISCORD-SELFBOT: Client error:', error);
      authError = error.message;
      broadcastToWindows('discord-selfbot:error', { error: error.message });
    });

    // Disconnected event
    discordClient.on('invalidated', () => {
      console.log('🔴 DISCORD-SELFBOT: Session invalidated');
      isClientReady = false;
      authState = 'disconnected';
      broadcastToWindows('discord-selfbot:disconnected', {});
    });

    // Login with token
    await discordClient.login(token);

    return { success: true };
  } catch (error) {
    console.error('❌ DISCORD-SELFBOT: Failed to initialize:', error);
    authState = 'error';
    authError = error instanceof Error ? error.message : 'Unknown error';
    discordClient = null;
    isClientReady = false;
    
    return { success: false, error: authError };
  }
}

/**
 * Disconnect and cleanup
 */
export async function disconnectDiscordSelfBot(): Promise<void> {
  console.log('🔵 DISCORD-SELFBOT: Disconnecting...');
  
  if (discordClient) {
    try {
      discordClient.destroy();
    } catch (err) {
      console.error('❌ DISCORD-SELFBOT: Error destroying client:', err);
    }
    discordClient = null;
  }
  
  isClientReady = false;
  authState = 'disconnected';
  authError = null;
  currentAccountId = null;
  
  // Clear token
  clearToken();
  
  broadcastToWindows('discord-selfbot:disconnected', {});
  console.log('🟢 DISCORD-SELFBOT: Disconnected');
}

/**
 * Get all guilds (servers) with full channel information
 */
export async function getGuilds(): Promise<DiscordSelfBotGuild[]> {
  if (!discordClient || !isClientReady) {
    console.log('🟡 DISCORD-SELFBOT: Client not ready');
    return [];
  }

  try {
    const guilds: DiscordSelfBotGuild[] = [];
    
    for (const [, guild] of discordClient.guilds.cache) {
      // Get categories
      const categories = guild.channels.cache
        .filter(c => c.type === 'GUILD_CATEGORY')
        .map(c => ({
          id: c.id,
          name: c.name,
          position: (c as CategoryChannel).position || 0
        }))
        .sort((a, b) => a.position - b.position);
      
      // Get all text-based channels (text, news, voice-text, forums, threads)
      const channels: DiscordSelfBotChannel[] = [];
      
      for (const [, channel] of guild.channels.cache) {
        // Skip categories - they're separate
        if (channel.type === 'GUILD_CATEGORY') continue;
        
        // Include text channels, news channels, voice channels, stage channels, forum channels
        const isTextBased = channel.isText?.() || 
          channel.type === 'GUILD_TEXT' || 
          channel.type === 'GUILD_NEWS' ||
          channel.type === 'GUILD_VOICE' ||
          channel.type === 'GUILD_FORUM' ||
          channel.type === 'GUILD_STAGE_VOICE';
        
        if (isTextBased) {
          const parentCategory = (channel as TextChannel).parent;
          channels.push({
            id: channel.id,
            name: channel.name,
            type: channel.type,
            parentId: parentCategory?.id || null,
            parentName: parentCategory?.name || null,
            position: (channel as TextChannel).position || 0,
            topic: (channel as TextChannel).topic || null,
            isThread: false,
            threadMetadata: null
          });
        }
      }
      
      // Sort channels by position
      channels.sort((a, b) => a.position - b.position);

      guilds.push({
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL(),
        memberCount: guild.memberCount,
        channels,
        categories
      });
    }

    console.log(`🟢 DISCORD-SELFBOT: Found ${guilds.length} guilds`);
    return guilds;
  } catch (error) {
    console.error('❌ DISCORD-SELFBOT: Error getting guilds:', error);
    return [];
  }
}

/**
 * Get DM channels
 */
export async function getDMChannels(): Promise<DiscordSelfBotDMChannel[]> {
  if (!discordClient || !isClientReady) {
    console.log('🟡 DISCORD-SELFBOT: Client not ready');
    return [];
  }

  try {
    const dmChannels: DiscordSelfBotDMChannel[] = [];
    
    for (const [, channel] of discordClient.channels.cache) {
      if (channel.type === 'DM') {
        const dmChannel = channel as DMChannel;
        dmChannels.push({
          id: dmChannel.id,
          recipientId: dmChannel.recipient?.id || '',
          recipientName: dmChannel.recipient?.username || 'Unknown',
          recipientAvatar: dmChannel.recipient?.displayAvatarURL() || null,
          lastMessageId: dmChannel.lastMessageId
        });
      }
    }

    console.log(`🟢 DISCORD-SELFBOT: Found ${dmChannels.length} DM channels`);
    return dmChannels;
  } catch (error) {
    console.error('❌ DISCORD-SELFBOT: Error getting DM channels:', error);
    return [];
  }
}

/**
 * Fetch messages from a channel (read-only)
 * @param channelId - The channel ID to fetch messages from
 * @param limit - Maximum number of messages to fetch (default 50, max 100)
 * @param before - Fetch messages before this message ID (for pagination)
 */
export async function fetchChannelMessages(
  channelId: string, 
  limit: number = 50,
  before?: string
): Promise<DiscordSelfBotMessage[]> {
  if (!discordClient || !isClientReady) {
    console.log('🟡 DISCORD-SELFBOT: Client not ready');
    return [];
  }

  try {
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel?.isText?.()) {
      console.log('🟡 DISCORD-SELFBOT: Channel not found or not a text channel');
      return [];
    }

    const fetchOptions: { limit: number; before?: string } = { limit: Math.min(limit, 100) };
    if (before) {
      fetchOptions.before = before;
    }

    const messages = await (channel as TextChannel).messages.fetch(fetchOptions);
    const result: DiscordSelfBotMessage[] = [];

    for (const [, message] of messages) {
      const messageData: DiscordSelfBotMessage = {
        id: message.id,
        channelId: message.channelId,
        channelName: (channel as TextChannel).name || 'DM',
        guildId: message.guildId,
        guildName: message.guild?.name || null,
        content: message.content,
        author: message.author.username,
        authorId: message.author.id,
        authorAvatar: message.author.displayAvatarURL(),
        timestamp: message.createdTimestamp,
        isFromMe: message.author.id === discordClient?.user?.id,
        isDM: !message.guildId,
        attachments: message.attachments.map(a => a.url)
      };
      
      result.push(messageData);
      
      // Store in database
      storeDiscordMessage(messageData);
    }

    console.log(`🟢 DISCORD-SELFBOT: Fetched ${result.length} messages from channel ${channelId}${before ? ' (before: ' + before + ')' : ''}`);
    return result;
  } catch (error) {
    console.error('❌ DISCORD-SELFBOT: Error fetching messages:', error);
    return [];
  }
}

/**
 * Get threads (subchannels) from a channel
 */
export async function getChannelThreads(channelId: string): Promise<DiscordSelfBotChannel[]> {
  if (!discordClient || !isClientReady) {
    console.log('🟡 DISCORD-SELFBOT: Client not ready');
    return [];
  }

  try {
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel) {
      console.log('🟡 DISCORD-SELFBOT: Channel not found');
      return [];
    }

    const threads: DiscordSelfBotChannel[] = [];
    
    // Get active threads
    if ('threads' in channel && channel.threads) {
      const activeThreads = await channel.threads.fetchActive();
      for (const [, thread] of activeThreads.threads) {
        threads.push({
          id: thread.id,
          name: thread.name,
          type: thread.type,
          parentId: channelId,
          parentName: (channel as TextChannel).name || null,
          position: 0,
          topic: null,
          isThread: true,
          threadMetadata: {
            archived: thread.archived || false,
            locked: thread.locked || false
          }
        });
      }

      // Get archived threads
      try {
        const archivedThreads = await channel.threads.fetchArchived();
        for (const [, thread] of archivedThreads.threads) {
          threads.push({
            id: thread.id,
            name: thread.name,
            type: thread.type,
            parentId: channelId,
            parentName: (channel as TextChannel).name || null,
            position: 0,
            topic: null,
            isThread: true,
            threadMetadata: {
              archived: thread.archived || false,
              locked: thread.locked || false
            }
          });
        }
      } catch (err) {
        console.log('🟡 DISCORD-SELFBOT: Could not fetch archived threads:', err);
      }
    }

    console.log(`🟢 DISCORD-SELFBOT: Found ${threads.length} threads in channel ${channelId}`);
    return threads;
  } catch (error) {
    console.error('❌ DISCORD-SELFBOT: Error getting threads:', error);
    return [];
  }
}

/**
 * Sync all guilds and recent messages
 */
export async function syncAllData(): Promise<{
  guilds: number;
  dmChannels: number;
  messages: number;
}> {
  if (!discordClient || !isClientReady) {
    console.log('🟡 DISCORD-SELFBOT: Client not ready');
    return { guilds: 0, dmChannels: 0, messages: 0 };
  }

  console.log('🔵 DISCORD-SELFBOT: Starting full sync...');
  
  let totalMessages = 0;
  const guilds = await getGuilds();
  const dmChannels = await getDMChannels();

  // Store guilds in database
  for (const guild of guilds) {
    try {
      database.discordGuilds.create({
        id: guild.id,
        account_id: currentAccountId || 'discord-selfbot',
        name: guild.name,
        icon: guild.icon,
        permissions: '0',
        member_count: guild.memberCount
      });
    } catch (err) {
      console.error('❌ DISCORD-SELFBOT: Error storing guild:', err);
    }
  }

  // Fetch recent messages from each DM channel
  for (const dm of dmChannels) {
    try {
      const messages = await fetchChannelMessages(dm.id, 25);
      totalMessages += messages.length;
      // DM channels are stored via messages
    } catch (err) {
      console.error('❌ DISCORD-SELFBOT: Error syncing DM channel:', err);
    }
  }

  // Fetch recent messages from first text channel of each guild (limited to avoid rate limits)
  for (const guild of guilds.slice(0, 10)) {
    const textChannel = guild.channels.find(c => c.type === 'GUILD_TEXT');
    if (textChannel) {
      try {
        const messages = await fetchChannelMessages(textChannel.id, 10);
        totalMessages += messages.length;
        // Messages are stored via fetchChannelMessages
      } catch (err) {
        console.error('❌ DISCORD-SELFBOT: Error syncing guild channel:', err);
      }
    }
  }

  console.log(`🟢 DISCORD-SELFBOT: Sync complete - ${guilds.length} guilds, ${dmChannels.length} DMs, ${totalMessages} messages`);
  
  broadcastToWindows('discord-selfbot:sync-complete', {
    guilds: guilds.length,
    dmChannels: dmChannels.length,
    messages: totalMessages
  });

  return {
    guilds: guilds.length,
    dmChannels: dmChannels.length,
    messages: totalMessages
  };
}

/**
 * Store a message in the database
 * Uses direct SQL with FK checks disabled to handle real-time messages from unsynced channels
 */
function storeDiscordMessage(message: DiscordSelfBotMessage): void {
  try {
    const accountId = currentAccountId || 'discord-selfbot';
    const db = (database as any).db;
    
    if (!db) {
      console.log('🟡 DISCORD-SELFBOT: Database not initialized, skipping message storage');
      return;
    }
    
    // Temporarily disable foreign key checks for real-time message storage
    // This allows storing messages from channels that haven't been synced yet
    db.exec('PRAGMA foreign_keys = OFF');
    
    try {
      // First, ensure the channel exists in the database
      db.prepare(`
        INSERT OR IGNORE INTO discord_channels (id, guild_id, account_id, type, name, topic, is_dm, recipient_name, last_message_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        message.channelId,
        message.guildId,
        accountId,
        message.isDM ? 1 : 0,
        message.channelName,
        message.isDM ? 1 : 0,
        message.isDM ? message.author : null,
        message.id
      );
      
      // Now insert the message
      db.prepare(`
        INSERT OR IGNORE INTO discord_messages (id, channel_id, account_id, author_id, author_username, author_discriminator, author_avatar, content, timestamp, edited_timestamp, attachments, embeds, mentions, type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, 0, CURRENT_TIMESTAMP)
      `).run(
        message.id,
        message.channelId,
        accountId,
        message.authorId,
        message.author,
        '0',
        message.authorAvatar,
        message.content,
        new Date(message.timestamp).toISOString(),
        JSON.stringify(message.attachments)
      );
    } finally {
      // Re-enable foreign key checks
      db.exec('PRAGMA foreign_keys = ON');
    }
  } catch (err) {
    // Ignore duplicate key errors for messages
    if (!(err instanceof Error && err.message.includes('UNIQUE constraint'))) {
      console.error('Failed to store Discord message:', err);
    }
  }
}

/**
 * Get user info
 */
export function getUserInfo(): { id: string; username: string; tag: string; avatar: string } | null {
  if (!discordClient?.user) {
    return null;
  }
  
  return {
    id: discordClient.user.id,
    username: discordClient.user.username,
    tag: discordClient.user.tag || '',
    avatar: discordClient.user.displayAvatarURL()
  };
}

/**
 * Check if client is ready
 */
export function isReady(): boolean {
  return isClientReady;
}

/**
 * Auto-reconnect if token is saved
 */
export async function autoConnect(): Promise<boolean> {
  const savedToken = getSavedToken();
  if (savedToken && isSelfBotEnabled()) {
    console.log('🔵 DISCORD-SELFBOT: Auto-connecting with saved token...');
    const result = await initializeDiscordSelfBot(savedToken);
    return result.success;
  }
  return false;
}
