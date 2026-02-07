/**
 * Discord OAuth Connector
 * 
 * Handles authentication and data syncing with Discord API
 * Supports guild messages, channels, DMs, and server information
 */

import type { Account, Notification } from '../../types';
import storage, { STORAGE_KEYS } from '../electronStore';

// Discord App Configuration - loaded from secure storage
const DISCORD_REDIRECT_URI = 'http://localhost:8089/oauth/callback';
const DISCORD_SCOPES = [
  'identify',
  'email',
  'guilds',
  'guilds.members.read',
  'messages.read',
].join(' ');

export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface DiscordUserInfo {
  id: string;
  username: string;
  discriminator: string;
  global_name: string | null;
  avatar: string | null;
  email: string;
  verified: boolean;
  flags: number;
  premium_type: number;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
  approximate_member_count?: number;
  approximate_presence_count?: number;
}

export interface DiscordChannel {
  id: string;
  type: number; // 0: text, 1: DM, 2: voice, etc.
  guild_id?: string;
  position?: number;
  name?: string;
  topic?: string | null;
  nsfw?: boolean;
  last_message_id?: string | null;
  recipients?: DiscordUserInfo[];
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  author: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
  };
  content: string;
  timestamp: string;
  edited_timestamp: string | null;
  tts: boolean;
  mention_everyone: boolean;
  mentions: any[];
  attachments: any[];
  embeds: any[];
  type: number;
}

/**
 * Start Discord OAuth flow
 * Opens browser to Discord authorization page
 */
export async function startDiscordAuth(): Promise<string> {
  const DISCORD_CLIENT_ID = await storage.get(STORAGE_KEYS.DISCORD_CLIENT_ID) as string;
  
  if (!DISCORD_CLIENT_ID) {
    throw new Error('Discord Client ID not configured. Please set it in Settings > Integrations.');
  }

  const authUrl = new URL('https://discord.com/oauth2/authorize');
  authUrl.searchParams.append('client_id', DISCORD_CLIENT_ID);
  authUrl.searchParams.append('redirect_uri', DISCORD_REDIRECT_URI);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', DISCORD_SCOPES);
  authUrl.searchParams.append('state', crypto.randomUUID());

  await window.electronAPI.oauth.openExternal(authUrl.toString());
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('OAuth timeout - no response received'));
    }, 300000); // 5 minute timeout

    const cleanup = () => {
      clearTimeout(timeout);
      window.electronAPI.removeListener.oauthCallback();
    };

    window.electronAPI.on.oauthCallback((url: string) => {
      cleanup();
      
      // Parse URL to extract code or error
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');
      const error = urlObj.searchParams.get('error');
      
      if (error) {
        reject(new Error(urlObj.searchParams.get('error_description') || error));
        return;
      }
      
      if (code) {
        resolve(code);
      } else {
        reject(new Error('No authorization code received'));
      }
    });
  });
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string): Promise<DiscordTokenResponse> {
  const DISCORD_CLIENT_ID = await storage.get(STORAGE_KEYS.DISCORD_CLIENT_ID) as string;
  const DISCORD_CLIENT_SECRET = await storage.get(STORAGE_KEYS.DISCORD_CLIENT_SECRET) as string;
  
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    throw new Error('Discord credentials not configured. Please set them in Settings > Integrations.');
  }

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: DISCORD_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to exchange code for token');
  }

  return response.json();
}

/**
 * Refresh Discord access token
 */
export async function refreshDiscordToken(refreshToken: string): Promise<DiscordTokenResponse> {
  const DISCORD_CLIENT_ID = await storage.get(STORAGE_KEYS.DISCORD_CLIENT_ID) as string;
  const DISCORD_CLIENT_SECRET = await storage.get(STORAGE_KEYS.DISCORD_CLIENT_SECRET) as string;
  
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    throw new Error('Discord credentials not configured');
  }

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  return response.json();
}

/**
 * Get current user info
 */
export async function getDiscordUserInfo(accessToken: string): Promise<DiscordUserInfo> {
  const response = await fetch('https://discord.com/api/v10/users/@me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  return response.json();
}

/**
 * Get user's Discord guilds (servers)
 */
export async function getDiscordGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch guilds');
  }

  return response.json();
}

/**
 * Get channels for a specific guild
 */
export async function getGuildChannels(accessToken: string, guildId: string): Promise<DiscordChannel[]> {
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch guild channels');
  }

  return response.json();
}

/**
 * Get DM channels
 */
export async function getDMChannels(accessToken: string): Promise<DiscordChannel[]> {
  const response = await fetch('https://discord.com/api/v10/users/@me/channels', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch DM channels');
  }

  return response.json();
}

/**
 * Get messages from a channel (limited to last 50)
 * Note: Reading message history requires bot token, not user OAuth token
 * User tokens can only read messages in DM channels they participate in
 */
export async function getChannelMessages(accessToken: string, channelId: string, limit = 50): Promise<DiscordMessage[]> {
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    // Note: This will fail for guild channels with user tokens
    // Only works for DM channels
    throw new Error('Failed to fetch messages. Note: User tokens can only read DM messages.');
  }

  return response.json();
}

/**
 * Complete Discord OAuth flow and save account
 */
export async function connectDiscordAccount(): Promise<Account> {
  try {
    // Step 1: Start OAuth flow
    const code = await startDiscordAuth();

    // Step 2: Exchange code for token
    const tokenData = await exchangeCodeForToken(code);

    // Step 3: Get user info
    const userInfo = await getDiscordUserInfo(tokenData.access_token);

    // Step 4: Create account object
    const account: Account = {
      id: `discord-${userInfo.id}`,
      name: userInfo.global_name || userInfo.username,
      email: userInfo.email,
      platform: 'discord',
      category: 'communication',
      isConnected: true,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      color: '#5865F2', // Discord brand color
    };

    return account;
  } catch (error) {
    console.error('Discord auth error:', error);
    throw error;
  }
}

/**
 * Sync Discord data (guilds and DM messages)
 * Note: DM channel access requires special permissions. If unavailable, we'll return an empty array.
 */
export async function syncDiscordData(account: Account): Promise<{ guilds: DiscordGuild[]; dmMessages: DiscordMessage[] }> {
  if (!account.accessToken) {
    throw new Error('No access token available');
  }

  let accessToken = account.accessToken;

  // Check if token is expired and try to refresh
  if (account.tokenExpiresAt) {
    const expiresAt = new Date(account.tokenExpiresAt);
    const now = new Date();
    
    // Refresh if token expires within 5 minutes
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      if (account.refreshToken) {
        try {
          console.log('Discord token expiring soon, refreshing...');
          const newTokenData = await refreshDiscordToken(account.refreshToken);
          accessToken = newTokenData.access_token;
          
          // Update account with new token (caller should save this)
          account.accessToken = newTokenData.access_token;
          account.refreshToken = newTokenData.refresh_token;
          account.tokenExpiresAt = new Date(Date.now() + newTokenData.expires_in * 1000).toISOString();
        } catch (refreshError) {
          console.error('Failed to refresh Discord token:', refreshError);
          throw new Error('Discord token expired. Please reconnect your Discord account.');
        }
      } else {
        throw new Error('Discord token expired and no refresh token available. Please reconnect your Discord account.');
      }
    }
  }

  try {
    // Fetch guilds
    const guilds = await getDiscordGuilds(accessToken);

    // Try to fetch DM channels and their messages
    // Note: This may fail with 401/403 if the OAuth app doesn't have the required permissions
    let dmMessages: DiscordMessage[] = [];
    
    try {
      const dmChannels = await getDMChannels(accessToken);
      
      for (const channel of dmChannels) {
        try {
          const messages = await getChannelMessages(accessToken, channel.id, 20);
          dmMessages.push(...messages);
        } catch (error) {
          console.error(`Failed to fetch messages for DM channel ${channel.id}:`, error);
        }
      }
    } catch (dmError: any) {
      // DM channel access requires special OAuth2 permissions that may not be available
      // Log the error but don't fail the entire sync
      console.warn('Could not fetch DM channels (this is normal for OAuth2 user tokens):', dmError.message);
    }

    return { guilds, dmMessages };
  } catch (error) {
    console.error('Discord sync error:', error);
    throw error;
  }
}

/**
 * Convert Discord DM messages to Notification format
 */
export function discordMessagesToNotifications(messages: DiscordMessage[], accountId: string): Notification[] {
  return messages.map(msg => ({
    id: msg.id,
    accountId: accountId,
    title: `${msg.author.username}`,
    message: msg.content,
    timestamp: msg.timestamp,
    isRead: false,
    type: 'message',
    platform: 'discord' as const,
    actionUrl: `https://discord.com/channels/@me/${msg.channel_id}`,
  }));
}
