/**
 * Google OAuth 2.0 Authentication Service
 * Handles OAuth flow, token management, and API calls for Gmail/Calendar
 */

import storage, { STORAGE_KEYS } from '../electronStore';
import { Account, Email, CalendarEvent as InternalCalendarEvent } from '../../types';

// For development, we use a local HTTP server to handle OAuth callbacks
// This avoids the custom protocol issues with unverified apps
const OAUTH_PORT = 8089;
const REDIRECT_URI = `http://127.0.0.1:${OAUTH_PORT}/oauth/callback`;

// Scopes updated to match types
export type GooglePlatforms = 'google';

// OAuth Scopes for Gmail and Calendar read-only access
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
].join(' ');

export interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  token_type: string;
  scope: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  labelIds: string[];
  isUnread: boolean;
  isImportant?: boolean;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  attendees?: { email: string; responseStatus: string }[];
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { uri: string; entryPointType: string }[] };
}

/**
 * Get Google OAuth credentials from settings
 */
export async function getCredentials(): Promise<GoogleCredentials | null> {
  const saved = await storage.get('nexus_keys_google cloud') as Record<string, string> | null;
  
  if (!saved || !saved['Client ID'] || !saved['Client Secret']) {
    console.error('❌ Google OAuth credentials not configured in Settings');
    return null;
  }
  
  return {
    clientId: saved['Client ID'],
    clientSecret: saved['Client Secret']
  };
}

/**
 * Get the redirect URI for OAuth
 */
export function getRedirectUri(): string {
  return REDIRECT_URI;
}

/**
 * Get the OAuth port for the local callback server
 */
export function getOAuthPort(): number {
  return OAUTH_PORT;
}

/**
 * Generate the Google OAuth authorization URL
 */
export async function getAuthUrl(): Promise<string | null> {
  const creds = await getCredentials();
  if (!creds) {
    return null;
  }

  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true'
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const creds = await getCredentials();
  if (!creds) {
    throw new Error('Google OAuth credentials not configured. Please add them in Settings → Integrations.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Token exchange error:', error);
    throw new Error(error.error_description || 'Failed to exchange code for tokens');
  }

  const data = await response.json();
  
  console.log('🔑 Token exchange response - has refresh_token:', !!data.refresh_token, 
    'expires_in:', data.expires_in, 'seconds');
  
  if (!data.refresh_token) {
    console.warn('⚠️ No refresh token received! You may need to revoke app access at https://myaccount.google.com/permissions and reconnect');
  }
  
  const tokens: GoogleTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in * 1000),
    token_type: data.token_type,
    scope: data.scope
  };

  // Store tokens securely
  await storage.set(STORAGE_KEYS.GOOGLE_TOKENS, tokens);
  console.log('✅ Google tokens stored, expires at:', new Date(tokens.expires_at).toISOString());
  
  return tokens;
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const creds = await getCredentials();
  if (!creds) {
    throw new Error('Google OAuth credentials not configured');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('❌ Google Token Refresh Error:', errorData);
    throw new Error(errorData.error_description || errorData.error || 'Failed to refresh token');
  }

  const data = await response.json();
  console.log(`✅ Token successfully refreshed for ${refreshToken.substring(0, 10)}...`);
  
  // Get existing tokens to preserve refresh_token
  const existingTokens = await storage.get(STORAGE_KEYS.GOOGLE_TOKENS) as GoogleTokens | null;
  
  const tokens: GoogleTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken, // Use new one if provided, else keep original
    expires_at: Date.now() + (Number(data.expires_in) * 1000),
    token_type: data.token_type,
    scope: data.scope || existingTokens?.scope || ''
  };

  // Only update global storage if this matches the primary account in storage
  if (existingTokens && existingTokens.refresh_token === refreshToken) {
    await storage.set(STORAGE_KEYS.GOOGLE_TOKENS, tokens);
  }
  
  return tokens;
}

/**
 * Get valid access token (refreshes if expired)
 * Updated to check database if global storage is empty
 */
export async function getValidAccessToken(): Promise<string | null> {
  let tokens = await storage.get(STORAGE_KEYS.GOOGLE_TOKENS) as GoogleTokens | null;
  
  // If not in global storage, try to find first connected Google account in DB
  if (!tokens) {
    try {
      const db = await import('../database');
      const accounts = await db.default.accounts.getAll();
      const googleAccount = accounts.find(acc => acc.platform === 'google' && acc.isConnected && acc.refreshToken);
      
      if (googleAccount) {
        console.log(`ℹ️ Found connected account in DB: ${googleAccount.email}. Migrating to global storage...`);
        const expiresAt = googleAccount.tokenExpiresAt ? new Date(googleAccount.tokenExpiresAt).getTime() : 0;
        tokens = {
          access_token: googleAccount.accessToken || '',
          refresh_token: googleAccount.refreshToken || '',
          expires_at: expiresAt,
          token_type: 'Bearer',
          scope: ''
        };
        await storage.set(STORAGE_KEYS.GOOGLE_TOKENS, tokens);
      }
    } catch (e) {
      console.error('Error checking DB for tokens:', e);
    }
  }

  if (!tokens) {
    console.warn('⚠️ No Google tokens found in storage or database');
    return null;
  }

  // Check if token is expired (with 5-minute buffer)
  if (Date.now() >= tokens.expires_at - 300000) {
    console.log('🔄 Token expired or expiring soon, attempting refresh...');
    
    if (!tokens.refresh_token) {
      // No refresh token, need to re-authenticate
      console.error('❌ No refresh token available - need to re-authenticate');
      await storage.remove(STORAGE_KEYS.GOOGLE_TOKENS);
      return null;
    }
    
    try {
      const newTokens = await refreshAccessToken(tokens.refresh_token);
      return newTokens.access_token;
    } catch (error) {
      console.error('❌ Failed to refresh token:', error);
      // Don't remove if it's just a network error
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('invalid_grant') || message.includes('revoked')) {
        await storage.remove(STORAGE_KEYS.GOOGLE_TOKENS);
      }
      return null;
    }
  }

  return tokens.access_token;
}

/**
 * Get Google user info
 */
export async function getUserInfo(): Promise<GoogleUserInfo | null> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching user info:', error);
    return null;
  }
}

/**
 * Fetch Gmail messages
 */
export async function fetchGmailMessages(accessToken: string, maxResults: number = 200): Promise<GmailMessage[]> {
  console.log('📧 Fetching Gmail messages...');

  try {
    // First, get message list - fetch more to ensure we get a good sample of recent ones
    // We increase maxResults slightly to account for skipped messages if any
    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=label:INBOX OR label:SENT`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!listResponse.ok) {
      const errorData = await listResponse.json().catch(() => ({ error: 'Unknown error' }));
      console.error('❌ Failed to fetch message list:', listResponse.status, errorData);
      throw new Error(`Failed to fetch message list: ${errorData.error?.message || listResponse.statusText}`);
    }

    const listData = await listResponse.json();
    console.log('📧 Gmail API returned', listData.messages?.length || 0, 'messages matching query');
    
    if (!listData.messages || listData.messages.length === 0) {
      console.log('📧 No messages found in Gmail');
      return [];
    }

    // Fetch details for each message in batches to avoid rate limits (429 errors)
    const validMessages: GmailMessage[] = [];
    const messageIds = listData.messages.slice(0, maxResults);
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
      const batch = messageIds.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (msg: { id: string }) => {
        try {
          const msgResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date&metadataHeaders=To&metadataHeaders=Delivered-To`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (!msgResponse.ok) {
            console.warn(`⚠️ Failed to fetch message ${msg.id}:`, msgResponse.status);
            return null;
          }

          const msgData = await msgResponse.json();
          
          const headers = msgData.payload?.headers || [];
          const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

          // Prioritize internalDate (timestamp in ms) over Date header for accuracy
          let messageDate = '';
          if (msgData.internalDate) {
            messageDate = new Date(parseInt(msgData.internalDate)).toISOString();
          } else {
            const dateHeader = getHeader('Date');
            messageDate = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();
          }

          const message = {
            id: msgData.id,
            threadId: msgData.threadId,
            snippet: msgData.snippet || '',
            subject: getHeader('Subject') || '(No Subject)',
            from: getHeader('From') || 'unknown@unknown.com',
            to: getHeader('To') || getHeader('Delivered-To') || '',
            date: messageDate, // Use the resolved ISO date
            labelIds: msgData.labelIds || [],
            isUnread: msgData.labelIds?.includes('UNREAD') || false,
            isImportant: msgData.labelIds?.includes('IMPORTANT') || false,
          };
          
          return message;
        } catch (error) {
          console.error(`❌ Error fetching message ${msg.id}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      validMessages.push(...(batchResults.filter(Boolean) as GmailMessage[]));
      
      // Small pause between batches if there are more to process
      if (i + BATCH_SIZE < messageIds.length) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }
    
    console.log('✅ Successfully fetched', validMessages.length, 'out of', Math.min(maxResults, listData.messages.length), 'messages');
    return validMessages;
  } catch (error) {
    console.error('Error fetching Gmail messages:', error);
    return [];
  }
}

/**
 * Fetch Google Calendar events
 */
export async function fetchCalendarEvents(accessToken: string, daysAhead: number = 30): Promise<InternalCalendarEvent[]> {
  try {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + daysAhead);

    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '100',
    });

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch calendar events');
    }

    const data = await response.json();
    const items = data.items || [];

    return items.map((event: any) => ({
      id: `google-${event.id}`,
      accountId: '', // Caller should set this
      title: event.summary || '(No Title)',
      description: event.description || '',
      startTime: event.start?.dateTime || event.start?.date || '',
      endTime: event.end?.dateTime || event.end?.date || '',
      location: event.location || '',
      attendees: event.attendees?.map((a: any) => a.email) || [],
      isAllDay: !!event.start?.date,
      eventLink: event.htmlLink || '',
      platform: 'google' as any,
    }));
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return [];
  }
}

/**
 * Sync Google account data (emails + calendar)
 */
export async function syncGoogleAccount(account: Account): Promise<{
  emails: Email[];
  events: InternalCalendarEvent[];
}> {
  if (!account.accessToken) {
    throw new Error('No access token available for Google account sync');
  }

  // Check if token needs refresh (with 5-minute buffer)
  let accessToken = account.accessToken;
  const expiresAt = account.tokenExpiresAt ? new Date(account.tokenExpiresAt).getTime() : 0;
  
  const isExpired = Date.now() >= expiresAt - 300000;
  const noToken = !accessToken;

  if (isExpired || noToken) {
    if (!account.refreshToken) {
      console.error(`❌ Cannot refresh ${account.email} - no refresh token available. Re-authentication required.`);
      throw new Error(`Google token ${noToken ? 'missing' : 'expired'} and no refresh token available. Please reconnect your account.`);
    }
    
    console.log(`🔄 ${noToken ? 'Fetching' : 'Refreshing'} Google token for ${account.email}...`);
    try {
      const tokenResponse = await refreshAccessToken(account.refreshToken);
      accessToken = tokenResponse.access_token;
      
      // Update account object with new tokens for the caller to save
      account.accessToken = accessToken;
      account.refreshToken = tokenResponse.refresh_token || account.refreshToken;
      account.tokenExpiresAt = new Date(tokenResponse.expires_at).toISOString();
      console.log(`✅ Google token ${noToken ? 'obtained' : 'refreshed'} for ${account.email}`);
    } catch (error) {
      console.error(`❌ Failed to refresh Google token for ${account.email}:`, error);
      throw error;
    }
  }

  // Fetch data in parallel
  const [gmailMessages, calendarEvents] = await Promise.all([
    fetchGmailMessages(accessToken, 100),
    fetchCalendarEvents(accessToken, 30),
  ]);

  // Map Gmail messages to Email model
  const emails: Email[] = gmailMessages.map(msg => ({
    id: msg.id,
    accountId: account.id,
    threadId: msg.threadId,
    subject: msg.subject,
    sender: msg.from,
    recipient: msg.to,
    preview: msg.snippet,
    timestamp: msg.date,
    isRead: !msg.isUnread,
    isImportant: msg.isImportant || false,
    labels: msg.labelIds || [],
    tags: [],
  }));

  // Map calendar events and ensure accountId is set
  const events = calendarEvents.map(event => ({
    ...event,
    accountId: account.id
  }));

  return { emails, events };
}

/**
 * Check if user is authenticated with Google
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getValidAccessToken();
  return token !== null;
}

/**
 * Logout - revoke tokens and clear storage
 */
export async function logout(): Promise<void> {
  const tokens = await storage.get(STORAGE_KEYS.GOOGLE_TOKENS) as GoogleTokens | null;
  
  if (tokens?.access_token) {
    try {
      // Revoke the token - use form encoding as required by Google
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `token=${tokens.access_token}`,
      });
    } catch (error) {
      // Ignore revocation errors - token may already be invalid
      console.warn('Token revocation failed (may already be invalid):', error);
    }
  }
  
  // Use storage.remove() not storage.delete()
  await storage.remove(STORAGE_KEYS.GOOGLE_TOKENS);
  await storage.remove('google_user');
}

export default {
  getAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getValidAccessToken,
  getUserInfo,
  fetchGmailMessages,
  fetchCalendarEvents,
  isAuthenticated,
  logout,
};
