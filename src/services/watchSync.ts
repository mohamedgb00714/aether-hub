/**
 * Watch Sync Service
 * 
 * Automatically fetches messages for all watched items on app startup
 * and periodically during runtime. This ensures that watched Discord channels,
 * WhatsApp chats, Telegram chats, etc. have their messages synced to the database
 * so the AI analysis can work on them.
 */

import { getActiveWatchedItems } from './watchService';
import type { WatchedItem } from '../types';

let isSyncing = false;
let syncIntervalId: ReturnType<typeof setInterval> | null = null;

const WATCH_SYNC_INTERVAL = 3 * 60 * 1000; // 3 minutes

interface SyncResult {
  platform: string;
  itemId: string;
  itemName: string;
  messagesCount: number;
  success: boolean;
  error?: string;
}

/**
 * Sync messages for a single watched item
 */
async function syncWatchedItem(item: WatchedItem): Promise<SyncResult> {
  const api = (globalThis as any).electronAPI;
  if (!api) {
    return { 
      platform: item.platform, 
      itemId: item.itemId, 
      itemName: item.itemName,
      messagesCount: 0, 
      success: false, 
      error: 'electronAPI not available' 
    };
  }

  try {
    switch (item.platform) {
      case 'discord': {
        if (item.itemType === 'discord_channel') {
          // Fetch messages for this specific channel
          if (api.discordSelfBot?.fetchMessages) {
            const messages = await api.discordSelfBot.fetchMessages(item.itemId, 50);
            console.log(`🔄 WATCH-SYNC: Discord channel ${item.itemName}: ${messages?.length || 0} messages`);
            return {
              platform: 'discord',
              itemId: item.itemId,
              itemName: item.itemName,
              messagesCount: messages?.length || 0,
              success: true
            };
          }
        } else if (item.itemType === 'discord_server') {
          // For servers, we need to fetch messages from all channels
          // First get the server's channels
          if (api.discordSelfBot?.fetchMessages) {
            // Parse metadata to get channel IDs if available
            const metadata = item.itemMetadata ? JSON.parse(item.itemMetadata) : {};
            const channelIds: string[] = metadata.channelIds || [];
            
            let totalMessages = 0;
            
            // If we have channel IDs stored, sync those
            if (channelIds.length > 0) {
              for (const channelId of channelIds.slice(0, 10)) { // Limit to 10 channels
                try {
                  const messages = await api.discordSelfBot.fetchMessages(channelId, 25);
                  totalMessages += messages?.length || 0;
                } catch (e) {
                  // Channel might not be accessible
                }
              }
            }
            
            console.log(`🔄 WATCH-SYNC: Discord server ${item.itemName}: ${totalMessages} messages from ${channelIds.length} channels`);
            return {
              platform: 'discord',
              itemId: item.itemId,
              itemName: item.itemName,
              messagesCount: totalMessages,
              success: true
            };
          }
        }
        break;
      }

      case 'whatsapp': {
        if (api.whatsapp?.getChatMessages) {
          const messages = await api.whatsapp.getChatMessages(item.itemId, 50);
          console.log(`🔄 WATCH-SYNC: WhatsApp chat ${item.itemName}: ${messages?.length || 0} messages`);
          return {
            platform: 'whatsapp',
            itemId: item.itemId,
            itemName: item.itemName,
            messagesCount: messages?.length || 0,
            success: true
          };
        }
        break;
      }

      case 'telegram': {
        if (api.telegram?.getChatMessages) {
          const messages = await api.telegram.getChatMessages(item.itemId, 50);
          console.log(`🔄 WATCH-SYNC: Telegram chat ${item.itemName}: ${messages?.length || 0} messages`);
          return {
            platform: 'telegram',
            itemId: item.itemId,
            itemName: item.itemName,
            messagesCount: messages?.length || 0,
            success: true
          };
        }
        break;
      }

      case 'email': {
        // Emails are already synced via autoSync, no need to do anything special
        console.log(`🔄 WATCH-SYNC: Email ${item.itemName}: synced via autoSync`);
        return {
          platform: 'email',
          itemId: item.itemId,
          itemName: item.itemName,
          messagesCount: 0,
          success: true
        };
      }

      case 'github': {
        // GitHub items are already synced via autoSync
        console.log(`🔄 WATCH-SYNC: GitHub ${item.itemName}: synced via autoSync`);
        return {
          platform: 'github',
          itemId: item.itemId,
          itemName: item.itemName,
          messagesCount: 0,
          success: true
        };
      }

      default:
        console.log(`🔄 WATCH-SYNC: Unsupported platform ${item.platform} for ${item.itemName}`);
    }

    return {
      platform: item.platform,
      itemId: item.itemId,
      itemName: item.itemName,
      messagesCount: 0,
      success: true
    };
  } catch (error) {
    console.error(`❌ WATCH-SYNC: Failed to sync ${item.platform}/${item.itemName}:`, error);
    return {
      platform: item.platform,
      itemId: item.itemId,
      itemName: item.itemName,
      messagesCount: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Sync all active watched items
 */
export async function syncWatchedItems(): Promise<{
  success: boolean;
  totalItems: number;
  syncedItems: number;
  totalMessages: number;
  results: SyncResult[];
}> {
  if (isSyncing) {
    console.log('🔄 WATCH-SYNC: Already syncing, skipping...');
    return { success: false, totalItems: 0, syncedItems: 0, totalMessages: 0, results: [] };
  }

  isSyncing = true;
  const results: SyncResult[] = [];

  try {
    console.log('🔄 WATCH-SYNC: Starting sync of watched items...');
    
    const watchedItems = await getActiveWatchedItems();
    console.log(`🔄 WATCH-SYNC: Found ${watchedItems.length} active watched items`);

    if (watchedItems.length === 0) {
      return { success: true, totalItems: 0, syncedItems: 0, totalMessages: 0, results: [] };
    }

    // Wait for platforms to be ready
    const api = (globalThis as any).electronAPI;
    if (!api) {
      console.log('🔄 WATCH-SYNC: electronAPI not available, skipping');
      return { success: false, totalItems: watchedItems.length, syncedItems: 0, totalMessages: 0, results: [] };
    }

    // Check platform readiness
    const platformStatus = {
      discord: false,
      whatsapp: false,
      telegram: false
    };

    try {
      if (api.discordSelfBot?.isReady) {
        platformStatus.discord = await api.discordSelfBot.isReady();
      }
    } catch (e) { /* ignore */ }

    try {
      if (api.whatsapp?.isReady) {
        platformStatus.whatsapp = await api.whatsapp.isReady();
      }
    } catch (e) { /* ignore */ }

    try {
      if (api.telegram?.isConnected) {
        platformStatus.telegram = await api.telegram.isConnected();
      }
    } catch (e) { /* ignore */ }

    console.log('🔄 WATCH-SYNC: Platform status:', platformStatus);

    // Sync each watched item based on platform readiness
    for (const item of watchedItems) {
      // Skip if platform is not ready
      if (item.platform === 'discord' && !platformStatus.discord) {
        console.log(`🔄 WATCH-SYNC: Skipping Discord item ${item.itemName} - platform not ready`);
        continue;
      }
      if (item.platform === 'whatsapp' && !platformStatus.whatsapp) {
        console.log(`🔄 WATCH-SYNC: Skipping WhatsApp item ${item.itemName} - platform not ready`);
        continue;
      }
      if (item.platform === 'telegram' && !platformStatus.telegram) {
        console.log(`🔄 WATCH-SYNC: Skipping Telegram item ${item.itemName} - platform not ready`);
        continue;
      }

      const result = await syncWatchedItem(item);
      results.push(result);

      // Add a small delay between syncs to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const syncedItems = results.filter(r => r.success).length;
    const totalMessages = results.reduce((sum, r) => sum + r.messagesCount, 0);

    console.log(`🔄 WATCH-SYNC: Completed! Synced ${syncedItems}/${watchedItems.length} items, ${totalMessages} total messages`);

    return {
      success: true,
      totalItems: watchedItems.length,
      syncedItems,
      totalMessages,
      results
    };
  } catch (error) {
    console.error('❌ WATCH-SYNC: Failed:', error);
    return { success: false, totalItems: 0, syncedItems: 0, totalMessages: 0, results };
  } finally {
    isSyncing = false;
  }
}

/**
 * Start periodic watch sync
 */
export function startWatchSync(): void {
  if (syncIntervalId) {
    console.log('🔄 WATCH-SYNC: Already running');
    return;
  }

  console.log('🔄 WATCH-SYNC: Starting periodic sync (every 3 minutes)...');

  // Run initial sync after 15 seconds (give platforms time to connect)
  setTimeout(() => {
    syncWatchedItems().catch(err => {
      console.error('❌ WATCH-SYNC: Initial sync failed:', err);
    });
  }, 15000);

  // Set up interval
  syncIntervalId = setInterval(() => {
    syncWatchedItems().catch(err => {
      console.error('❌ WATCH-SYNC: Periodic sync failed:', err);
    });
  }, WATCH_SYNC_INTERVAL);
}

/**
 * Stop periodic watch sync
 */
export function stopWatchSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('🔄 WATCH-SYNC: Stopped');
  }
}

/**
 * Check if watch sync is running
 */
export function isWatchSyncRunning(): boolean {
  return syncIntervalId !== null;
}

export default {
  syncWatchedItems,
  startWatchSync,
  stopWatchSync,
  isWatchSyncRunning
};
