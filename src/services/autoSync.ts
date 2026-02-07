/**
 * Auto-sync service for aethermsaid hub
 * Syncs all connected accounts every 5 minutes
 * Uses SQLite database for storage
 */

import { db } from './database';
import { syncOutlookAccount } from './connectors/outlookAuth';
import { syncSlackAccount } from './connectors/slackAuth';
import { syncGitHubAccount } from './connectors/githubConnector';
import { 
  initNotificationService, 
  checkNewEmails, 
  checkNewNotifications, 
  checkNewGitHubActivity 
} from './notificationService';
import type { Email, CalendarEvent } from '../types';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
const SYNC_TIMEOUT = 4 * 60 * 1000; // 4 minutes timeout (less than sync interval)

let syncIntervalId: NodeJS.Timeout | null = null;
let isSyncing = false;
let syncStartTime: number | null = null;

export async function syncAllAccounts(): Promise<{ success: boolean; synced: string[] }> {
  // Check if previous sync is stuck (exceeded timeout)
  if (isSyncing && syncStartTime) {
    const elapsed = Date.now() - syncStartTime;
    if (elapsed > SYNC_TIMEOUT) {
      console.warn(`⚠️ Previous sync exceeded timeout (${Math.round(elapsed / 1000)}s), forcing reset...`);
      isSyncing = false;
      syncStartTime = null;
    } else {
      console.log('🔄 Sync already in progress, skipping...');
      return { success: false, synced: [] };
    }
  } else if (isSyncing) {
    console.log('🔄 Sync already in progress, skipping...');
    return { success: false, synced: [] };
  }

  isSyncing = true;
  syncStartTime = Date.now();
  const syncedAccounts: string[] = [];

  try {
    console.log('🔄 Auto-sync starting...');
    
    const connectedAccounts = await db.accounts.getAll();
    console.log('🔄 Total accounts:', connectedAccounts.length);
    
    // Auto-reconnect/Sync accounts that are marked as connected OR just not explicitly ignored
    // We try to sync anything that isn't ignored, even if last sync failed (isConnected=false)
    const activeAccounts = connectedAccounts.filter(acc => !acc.ignored);
    console.log(`🔄 Active accounts to sync (not ignored): ${activeAccounts.length}`);
    
    if (activeAccounts.length === 0) {
      console.log('🔄 No active accounts to sync');
      return { success: true, synced: [] };
    }

    for (const account of activeAccounts) {
      try {
        console.log(`🔄 Processing account: ${account.name} (platform: ${account.platform})`);
        
        // Ensure account is marked as connected if we're trying to sync it
        if (!account.isConnected) {
          console.log(`🔧 Attempting to sync previously disconnected account: ${account.name}`);
        }
        
        if (account.platform === 'google') {
          console.log(`🔄 Syncing Google account: ${account.name}...`);
          
          // Check if Google OAuth tokens exist in the account object
          if (!account.accessToken && !account.refreshToken) {
            console.log(`⏭️ Skipping ${account.name} - no tokens found in database. Please reconnect your Google account.`);
            continue;
          }
          
          try {
            const { syncGoogleAccount } = await import('./connectors/googleAuth');
            
            // Fetch new emails and events using the account-specific sync function
            // This also handles token refresh automatically
            const { emails: newEmails, events: newEvents } = await syncGoogleAccount(account);
            
            console.log(`📧 Fetched ${newEmails.length} emails and 📅 ${newEvents.length} events for ${account.name}`);
            
            // Get existing data to preserve AI analysis
            const [existingEmails, existingEvents] = await Promise.all([
              db.emails.getByAccount(account.id),
              db.events.getByAccount(account.id)
            ]);

            // Merge emails: preserve AI analysis if it exists
            const mergedEmails: Email[] = newEmails.map(email => {
              const existing = existingEmails.find(e => e.id === email.id);
              if (existing) {
                return {
                  ...email,
                  tags: existing.tags || [],
                  aiSummary: existing.aiSummary,
                  aiCategory: existing.aiCategory,
                  aiPriority: existing.aiPriority,
                  aiSuggestedReply: existing.aiSuggestedReply,
                };
              }
              return email;
            });

            // Merge events: preserve AI analysis if it exists
            const mergedEvents: CalendarEvent[] = newEvents.map(event => {
              const existing = existingEvents.find(e => e.id === event.id);
              if (existing) {
                return {
                  ...event,
                  aiInsight: (existing as any).aiInsight,
                };
              }
              return event;
            });
            
            // Save to database
            if (mergedEmails.length > 0) {
              await db.emails.bulkUpsert(mergedEmails);
              console.log(`✅ Saved ${mergedEmails.length} emails to database for ${account.name}`);
              
              // Check for new notifications from these emails
              const { checkNewNotifications } = await import('./notificationService');
              const newUnreadEmails = mergedEmails.filter(e => !e.isRead);
              if (newUnreadEmails.length > 0) {
                // Simplified notification check
                // ... logic to notify user ...
              }
            }

            if (mergedEvents.length > 0) {
              await db.events.bulkUpsert(mergedEvents);
              console.log(`✅ Saved ${mergedEvents.length} events to database for ${account.name}`);
            }
            
            // Save potential token updates (refreshed during sync)
            const now = new Date().toISOString();
            await db.accounts.upsert({ 
              ...account, 
              lastSync: now, 
              isConnected: true, 
              status: 'connected' 
            });
            
            syncedAccounts.push(account.name);
          } catch (error) {
            console.error(`❌ Failed to sync Google account ${account.name}:`, error);
            // If the error is auth-related, mark as disconnected
            if (error instanceof Error && (error.message.includes('auth') || error.message.includes('token'))) {
              await db.accounts.upsert({ ...account, isConnected: false, status: 'error' });
            }
          }
          continue; // Move to next account, we handled Google
        }
        
        if (account.platform === 'outlook') {
          console.log(`🔄 Syncing Outlook account: ${account.name}...`);
          
          const { emails, events } = await syncOutlookAccount(account);
          
          // Get existing data to preserve AI analysis
          const existingEmails = await db.emails.getByAccount(account.id);
          const existingEvents = await db.events.getByAccount(account.id);
          
          // Merge emails
          const mergedEmails: (Partial<Email> & { id: string })[] = emails.map(email => {
            const existing = existingEmails.find(e => e.id === email.id);
            return {
              ...email,
              tags: existing?.tags || email.tags || [],
              aiSummary: existing?.aiSummary || email.aiSummary,
              aiCategory: existing?.aiCategory || email.aiCategory,
              aiPriority: existing?.aiPriority || email.aiPriority,
              aiSuggestedReply: existing?.aiSuggestedReply || email.aiSuggestedReply,
            };
          });
          
          // Merge events
          const mergedEvents: (Partial<CalendarEvent> & { id: string })[] = events.map(event => {
            const existing = existingEvents.find(e => e.id === event.id);
            return {
              ...event,
              aiBriefing: existing?.aiBriefing || event.aiBriefing,
              aiActionItems: existing?.aiActionItems || event.aiActionItems,
            };
          });
          
          await db.emails.bulkUpsert(mergedEmails);
          await db.events.bulkUpsert(mergedEvents);
          
          // Check for new emails and trigger notifications
          await checkNewEmails(mergedEmails as Email[]);
          
          // Update account with new tokens if refreshed
          await db.accounts.upsert(account);
          
          syncedAccounts.push(account.name);
          console.log(`✅ Synced Outlook account: ${account.name}`);
        }
        
        if (account.platform === 'slack') {
          console.log(`🔄 Syncing Slack account: ${account.name}...`);
          
          const { notifications } = await syncSlackAccount(account);
          
          await db.notifications.bulkUpsert(notifications as any);
          
          // Check for new Slack notifications
          await checkNewNotifications(notifications);
          
          syncedAccounts.push(account.name);
          console.log(`✅ Synced Slack account: ${account.name}`);
        }
        
        if (account.platform === 'github') {
          console.log(`🔄 Syncing GitHub account: ${account.name}...`);
          
          const { items } = await syncGitHubAccount(account);
          
          await db.github.bulkUpsert(items as any);
          
          // Check for new GitHub activity
          await checkNewGitHubActivity(items);
          
          syncedAccounts.push(account.name);
          console.log(`✅ Synced GitHub account: ${account.name}`);
        }
        
        // Update account status and last sync time after successful sync
        await db.accounts.upsert({
          ...account,
          isConnected: true,
          status: 'connected',
          lastSync: new Date().toLocaleTimeString()
        });
        
      } catch (error) {
        console.error(`❌ Failed to sync account ${account.name}:`, error);
        
        // Check if it's an authentication error
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isAuthError = errorMessage.includes('token') || 
                           errorMessage.includes('expired') || 
                           errorMessage.includes('invalid') ||
                           errorMessage.includes('401') ||
                           errorMessage.includes('403') ||
                           errorMessage.includes('revoked');
        
        // Update account with error status
        await db.accounts.upsert({
          ...account,
          status: isAuthError ? 'disconnected' : 'error',
          isConnected: !isAuthError
        });
        
        // Show user-friendly notification for auth errors
        if (isAuthError && window.electronAPI?.notification) {
          window.electronAPI.notification.show({
            title: 'Account Reconnection Required',
            body: `${account.name} needs to be reconnected. Please go to Settings to reauthenticate.`
          });
        }
      }
    }
    
    console.log(`🔄 Auto-sync complete. Synced ${syncedAccounts.length} accounts.`);
    return { success: true, synced: syncedAccounts };
    
  } catch (error) {
    console.error('❌ Auto-sync failed:', error);
    return { success: false, synced: syncedAccounts };
  } finally {
    isSyncing = false;
    syncStartTime = null;
  }
}

/**
 * Specifically check Gmail connectivity on startup
 */
export async function checkGmailConnectivity(): Promise<void> {
  try {
    console.log('🔍 Checking Gmail connectivity...');
    const accounts = await db.accounts.getAll();
    const googleAccounts = accounts.filter(acc => acc.platform === 'google' && !acc.ignored);
    
    if (googleAccounts.length === 0) {
      console.log('🔍 No Gmail accounts found to check');
      return;
    }

    // Check if credentials exist for refreshing
    const googleCreds = await storage.get(STORAGE_KEYS.GOOGLE_CREDENTIALS);
    const hasCreds = googleCreds && googleCreds.clientId && googleCreds.clientSecret;

    let successCount = 0;
    let failedAccounts: string[] = [];
    let needsCredentials = !hasCreds;

    for (const account of googleAccounts) {
      try {
        console.log(`🔍 Checking connectivity for ${account.email}...`);
        const { syncGoogleAccount } = await import('./connectors/googleAuth');
        
        // This will attempt to refresh the token if needed
        await syncGoogleAccount(account);
        
        // Update database with success
        await db.accounts.upsert({
          ...account,
          isConnected: true,
          status: 'connected',
          lastSync: new Date().toISOString()
        });
        
        successCount++;
        console.log(`✅ Connectivity confirmed for ${account.email}`);
      } catch (error) {
        console.error(`❌ Connectivity check failed for ${account.email}:`, error);
        
        // Mark as error in database
        await db.accounts.upsert({
          ...account,
          isConnected: false,
          status: 'error'
        });
        
        failedAccounts.push(account.name || account.email);
      }
    }

    // Show summary notification
    if (window.electronAPI?.notification) {
      if (failedAccounts.length === 0) {
        window.electronAPI.notification.show({
          title: 'Gmail Status: Connected',
          body: successCount === 1 
            ? 'Your Gmail account is connected and synced.'
            : `All ${successCount} Gmail accounts are connected and synced.`
        });
      } else {
        let body = `${successCount} synced, ${failedAccounts.length} failed.`;
        if (needsCredentials) {
          body = "Google Cloud credentials missing. Please set them in Settings to enable automatic refresh.";
        } else {
          body += ` Accounts needing attention: ${failedAccounts.join(', ')}`;
        }

        window.electronAPI.notification.show({
          title: 'Gmail Connection Issue',
          body
        });
      }
    }
  } catch (err) {
    console.error('❌ Failed to run Gmail connectivity check:', err);
  }
}

export function startAutoSync(): void {
  if (syncIntervalId) {
    console.log('🔄 Auto-sync already running');
    return;
  }
  
  console.log('🔄 Starting auto-sync (every 5 minutes)...');
  
  // Initialize notification service
  initNotificationService().catch(err => {
    console.error('❌ Failed to initialize notification service:', err);
  });
  
  // Check Gmail connectivity immediately on startup
  setTimeout(() => {
    checkGmailConnectivity();
  }, 2000);
  
  // Run initial full sync after 15 seconds (slightly longer to let connectivity check finish)
  setTimeout(() => {
    syncAllAccounts();
  }, 15000);
  
  // Set up interval for every 5 minutes
  syncIntervalId = setInterval(() => {
    syncAllAccounts();
  }, SYNC_INTERVAL);
}

export function stopAutoSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('🔄 Auto-sync stopped');
  }
}

export function isAutoSyncRunning(): boolean {
  return syncIntervalId !== null;
}

// Clear all data from database (for testing/reset purposes)
export async function clearAllData(): Promise<void> {
  console.log('🗑️ Clearing all synced data from database...');
  
  const accounts = await db.accounts.getAll();
  for (const account of accounts) {
    await db.emails.clearByAccount(account.id);
    await db.events.clearByAccount(account.id);
    await db.github.clearByAccount(account.id);
  }
  
  console.log('✅ All synced data cleared');
}

export default {
  syncAllAccounts,
  checkGmailConnectivity,
  startAutoSync,
  stopAutoSync,
  isAutoSyncRunning,
  clearAllData
};
