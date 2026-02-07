/**
 * Slack OAuth Connector
 * 
 * Handles authentication and data syncing with Slack API
 * Supports workspace messages, channels, and user info
 */

import type { Account, Notification } from '../../types';

// Slack App Configuration
const SLACK_CLIENT_ID = ''; // TODO: Create app at https://api.slack.com/apps
const SLACK_CLIENT_SECRET = ''; // TODO: Get from Slack app settings (handle securely!)
const SLACK_REDIRECT_URI = 'http://localhost:8089/oauth/callback';
const SLACK_SCOPES = [
  'channels:read',
  'channels:history',
  'groups:read',
  'groups:history',
  'im:read',
  'im:history',
  'mpim:read',
  'mpim:history',
  'users:read',
  'team:read',
].join(',');

export interface SlackTokenResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  team: {
    id: string;
    name: string;
  };
  authed_user: {
    id: string;
    access_token?: string;
  };
  error?: string;
}

export interface SlackUserInfo {
  ok: boolean;
  user: {
    id: string;
    name: string;
    real_name: string;
    profile: {
      email: string;
      image_48: string;
    };
  };
}

export interface SlackMessage {
  type: string;
  user: string;
  text: string;
  ts: string;
  thread_ts?: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_member: boolean;
}

/**
 * Start Slack OAuth flow
 * Opens browser to Slack authorization page
 */
export async function startSlackAuth(): Promise<string> {
  if (!SLACK_CLIENT_ID) {
    throw new Error('Slack Client ID not configured. Please set SLACK_CLIENT_ID in slackAuth.ts');
  }

  const authUrl = new URL('https://slack.com/oauth/v2/authorize');
  authUrl.searchParams.append('client_id', SLACK_CLIENT_ID);
  authUrl.searchParams.append('scope', SLACK_SCOPES);
  authUrl.searchParams.append('redirect_uri', SLACK_REDIRECT_URI);
  authUrl.searchParams.append('state', crypto.randomUUID());
  authUrl.searchParams.append('user_scope', 'identity.basic,identity.email');

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
      
      const params = new URLSearchParams(url.split('?')[1]);
      const code = params.get('code');
      const error = params.get('error');

      if (error) {
        reject(new Error(`OAuth error: ${error}`));
      } else if (code) {
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
export async function exchangeSlackCode(code: string): Promise<SlackTokenResponse> {
  if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
    throw new Error('Slack credentials not configured');
  }

  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code: code,
      redirect_uri: SLACK_REDIRECT_URI,
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Token exchange failed: ${data.error}`);
  }

  return data;
}

/**
 * Get Slack user info
 */
export async function getSlackUserInfo(accessToken: string): Promise<SlackUserInfo> {
  const response = await fetch('https://slack.com/api/users.identity', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Failed to fetch user info: ${data.error}`);
  }

  return data;
}

/**
 * Get Slack channels list
 */
export async function getSlackChannels(accessToken: string): Promise<SlackChannel[]> {
  const response = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel,im,mpim', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Failed to fetch channels: ${data.error}`);
  }

  return data.channels;
}

/**
 * Get Slack messages from a channel
 */
export async function getSlackMessages(
  accessToken: string,
  channelId: string,
  limit = 100
): Promise<SlackMessage[]> {
  const response = await fetch(
    `https://slack.com/api/conversations.history?channel=${channelId}&limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Failed to fetch messages: ${data.error}`);
  }

  return data.messages || [];
}

/**
 * Convert Slack messages to notifications
 */
function slackMessagesToNotifications(
  messages: SlackMessage[],
  accountId: string,
  channelName: string
): Notification[] {
  return messages
    .filter(msg => msg.type === 'message' && msg.text)
    .map(msg => ({
      id: `slack-${msg.ts}`,
      accountId: accountId,
      type: 'message' as any,
      title: `${channelName}`,
      message: msg.text.substring(0, 200), // Truncate long messages
      timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
      isRead: false,
      priority: 0,
    }));
}

/**
 * Full Slack account connection flow
 */
export async function connectSlackAccount(): Promise<Account> {
  try {
    // Step 1: Start OAuth flow
    const code = await startSlackAuth();

    // Step 2: Exchange code for tokens
    const tokenResponse = await exchangeSlackCode(code);

    // Step 3: Get user info
    const userInfo = await getSlackUserInfo(tokenResponse.authed_user.access_token || tokenResponse.access_token);

    // Step 4: Create account object
    const account: Account = {
      id: `slack-${tokenResponse.team.id}-${userInfo.user.id}`,
      name: `${userInfo.user.real_name} @ ${tokenResponse.team.name}`,
      email: userInfo.user.profile.email,
      platform: 'slack',
      category: 'communication',
      isConnected: true,
      accessToken: tokenResponse.access_token,
      // Slack tokens don't expire unless revoked
    };

    return account;
  } catch (error) {
    console.error('Slack connection failed:', error);
    throw error;
  }
}

/**
 * Sync Slack account data (recent messages from all channels)
 */
export async function syncSlackAccount(account: Account): Promise<{
  notifications: Notification[];
}> {
  if (!account.accessToken) {
    throw new Error('No access token available');
  }

  try {
    // Get all channels
    const channels = await getSlackChannels(account.accessToken);

    // Fetch messages from all channels (in parallel, limited to prevent rate limits)
    const channelsToSync = channels.filter(c => c.is_member).slice(0, 10); // Limit to 10 channels
    
    const messagePromises = channelsToSync.map(async (channel) => {
      try {
        const messages = await getSlackMessages(account.accessToken!, channel.id, 50);
        return slackMessagesToNotifications(messages, account.id, channel.name);
      } catch (error) {
        console.error(`Failed to fetch messages from channel ${channel.name}:`, error);
        return [];
      }
    });

    const messagesArrays = await Promise.all(messagePromises);
    const notifications = messagesArrays.flat();

    // Sort by timestamp (newest first)
    notifications.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Limit total notifications to prevent overwhelming the database
    const limitedNotifications = notifications.slice(0, 500);

    return { notifications: limitedNotifications };
  } catch (error) {
    console.error('Slack sync failed:', error);
    throw error;
  }
}

/**
 * Revoke Slack access token
 */
export async function disconnectSlackAccount(account: Account): Promise<void> {
  if (account.accessToken) {
    try {
      await fetch('https://slack.com/api/auth.revoke', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Failed to revoke Slack token:', error);
    }
  }

  // Clear tokens from account
  account.accessToken = undefined;
  account.refreshToken = undefined;
  account.tokenExpiresAt = undefined;
  account.isConnected = false;
}
