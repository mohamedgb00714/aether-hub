/**
 * Microsoft Outlook OAuth Connector
 * 
 * Handles authentication and data syncing with Microsoft Graph API
 * Supports: Outlook.com, Office 365, Exchange Online
 */

import type { Account, Email, CalendarEvent } from '../../types';

// Microsoft App Configuration
const MICROSOFT_CLIENT_ID = ''; // TODO: Register app at https://portal.azure.com
const MICROSOFT_REDIRECT_URI = 'http://localhost:8089/oauth/callback';
const MICROSOFT_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Mail.ReadWrite',
  'https://graph.microsoft.com/Calendars.Read',
  'https://graph.microsoft.com/User.Read',
].join(' ');

export interface OutlookTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface OutlookProfile {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

export interface OutlookMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  receivedDateTime: string;
  isRead: boolean;
  importance: string;
  categories: string[];
  conversationId: string;
}

export interface OutlookEvent {
  id: string;
  subject: string;
  bodyPreview: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location: {
    displayName: string;
  };
  attendees: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  isAllDay: boolean;
  webLink: string;
}

/**
 * Start Outlook OAuth flow
 * Opens browser to Microsoft login page
 */
export async function startOutlookAuth(): Promise<string> {
  if (!MICROSOFT_CLIENT_ID) {
    throw new Error('Microsoft Client ID not configured. Please set MICROSOFT_CLIENT_ID in outlookAuth.ts');
  }

  const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  authUrl.searchParams.append('client_id', MICROSOFT_CLIENT_ID);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('redirect_uri', MICROSOFT_REDIRECT_URI);
  authUrl.searchParams.append('scope', MICROSOFT_SCOPES);
  authUrl.searchParams.append('response_mode', 'query');
  authUrl.searchParams.append('state', crypto.randomUUID());
  authUrl.searchParams.append('prompt', 'select_account');

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
export async function exchangeOutlookCode(code: string): Promise<OutlookTokenResponse> {
  if (!MICROSOFT_CLIENT_ID) {
    throw new Error('Microsoft Client ID not configured');
  }

  // Note: In production, this should use a client secret which must be handled server-side
  // For now, using public client flow (no secret) which has limitations
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      code: code,
      redirect_uri: MICROSOFT_REDIRECT_URI,
      grant_type: 'authorization_code',
      scope: MICROSOFT_SCOPES,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
  }

  return response.json();
}

/**
 * Refresh Outlook access token
 */
export async function refreshOutlookToken(refreshToken: string): Promise<OutlookTokenResponse> {
  if (!MICROSOFT_CLIENT_ID) {
    throw new Error('Microsoft Client ID not configured');
  }

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: MICROSOFT_SCOPES,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
  }

  return response.json();
}

/**
 * Get Outlook user profile
 */
export async function getOutlookProfile(accessToken: string): Promise<OutlookProfile> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Outlook profile');
  }

  return response.json();
}

/**
 * Fetch Outlook emails (last 200 messages)
 */
export async function fetchOutlookEmails(accessToken: string, accountId: string): Promise<Email[]> {
  const response = await fetch(
    'https://graph.microsoft.com/v1.0/me/messages?$top=200&$orderby=receivedDateTime desc',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch Outlook emails');
  }

  const data = await response.json();
  const messages: OutlookMessage[] = data.value;

  return messages.map(msg => ({
    id: `outlook-${msg.id}`,
    accountId: accountId,
    threadId: msg.conversationId,
    subject: msg.subject || '(No Subject)',
    sender: msg.from?.emailAddress?.address || 'Unknown',
    recipient: msg.toRecipients?.[0]?.emailAddress?.address,
    preview: msg.bodyPreview || '',
    timestamp: msg.receivedDateTime,
    isRead: msg.isRead,
    isImportant: msg.importance === 'high',
    labels: msg.categories || [],
    tags: [],
    platform: 'outlook' as any,
  }));
}

/**
 * Fetch Outlook calendar events (next 30 days)
 */
export async function fetchOutlookEvents(accessToken: string, accountId: string): Promise<CalendarEvent[]> {
  const now = new Date();
  const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendar/calendarView?startDateTime=${now.toISOString()}&endDateTime=${endDate.toISOString()}&$top=100`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch Outlook calendar events');
  }

  const data = await response.json();
  const events: OutlookEvent[] = data.value;

  return events.map(event => ({
    id: `outlook-${event.id}`,
    accountId: accountId,
    title: event.subject || '(No Title)',
    description: event.bodyPreview,
    startTime: event.start.dateTime,
    endTime: event.end.dateTime,
    location: event.location?.displayName,
    attendees: event.attendees?.map(a => a.emailAddress.address) || [],
    isAllDay: event.isAllDay,
    eventLink: event.webLink,
    platform: 'outlook' as any,
  }));
}

/**
 * Full Outlook account connection flow
 */
export async function connectOutlookAccount(): Promise<Account> {
  try {
    // Step 1: Start OAuth flow
    const code = await startOutlookAuth();

    // Step 2: Exchange code for tokens
    const tokenResponse = await exchangeOutlookCode(code);

    // Step 3: Get user profile
    const profile = await getOutlookProfile(tokenResponse.access_token);

    // Step 4: Calculate token expiry
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();

    // Step 5: Create account object
    const account: Account = {
      id: `outlook-${profile.id}`,
      name: profile.displayName,
      email: profile.mail || profile.userPrincipalName,
      platform: 'outlook',
      category: 'email',
      isConnected: true,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      tokenExpiresAt: expiresAt,
    };

    return account;
  } catch (error) {
    console.error('Outlook connection failed:', error);
    throw error;
  }
}

/**
 * Sync Outlook account data (emails + calendar)
 */
export async function syncOutlookAccount(account: Account): Promise<{
  emails: Email[];
  events: CalendarEvent[];
}> {
  if (!account.accessToken) {
    throw new Error('No access token available');
  }

  // Check if token needs refresh
  let accessToken = account.accessToken;
  if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()) {
    if (!account.refreshToken) {
      throw new Error('Token expired and no refresh token available');
    }
    
    const tokenResponse = await refreshOutlookToken(account.refreshToken);
    accessToken = tokenResponse.access_token;
    
    // Update account with new tokens
    account.accessToken = accessToken;
    account.refreshToken = tokenResponse.refresh_token;
    account.tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();
  }

  // Fetch emails and events in parallel
  const [emails, events] = await Promise.all([
    fetchOutlookEmails(accessToken, account.id),
    fetchOutlookEvents(accessToken, account.id),
  ]);

  return { emails, events };
}

/**
 * Disconnect Outlook account
 * Note: Microsoft doesn't provide a revocation endpoint for public clients
 * Tokens will expire naturally
 */
export async function disconnectOutlookAccount(account: Account): Promise<void> {
  // Clear tokens from account
  account.accessToken = undefined;
  account.refreshToken = undefined;
  account.tokenExpiresAt = undefined;
  account.isConnected = false;
}
