/**
 * Watch Monitor Service
 * 
 * AI-powered monitoring of watched items to automatically generate actions/todos
 * based on NEW content from Discord, WhatsApp, Telegram, emails, etc.
 * 
 * Key features:
 * - Only analyzes new messages (tracks analyzed message IDs)
 * - Uses watch goal (action text) to guide AI analysis
 * - Creates separate action items in watch_actions table
 */

import { callAI } from './geminiService';
import { getActiveWatchedItems } from './watchService';
import type { WatchedItem, WatchPlatform } from '../types';
import { db } from './database';

interface ContentMessage {
  id: string;
  text: string;
  author?: string;
  timestamp: string;
}

interface ContentFetchResult {
  platform: WatchPlatform;
  itemId: string;
  content: ContentMessage[];
}

interface GeneratedAction {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Get analyzed message IDs for a watched item
 */
async function getAnalyzedMessageIds(watchedItemId: string): Promise<Set<string>> {
  const api = (globalThis as any).electronAPI;
  if (!api?.db?.analyzedMessages) return new Set();
  
  try {
    const ids = await api.db.analyzedMessages.getAnalyzedIds(watchedItemId);
    return new Set(ids || []);
  } catch (error) {
    console.error('Failed to get analyzed message IDs:', error);
    return new Set();
  }
}

/**
 * Mark messages as analyzed
 */
async function markMessagesAsAnalyzed(watchedItemId: string, messageIds: string[], platform: string): Promise<void> {
  const api = (globalThis as any).electronAPI;
  if (!api?.db?.analyzedMessages) return;
  
  try {
    await api.db.analyzedMessages.markAsAnalyzed(watchedItemId, messageIds, platform);
  } catch (error) {
    console.error('Failed to mark messages as analyzed:', error);
  }
}

/**
 * Create a new action in the database
 */
async function createWatchAction(
  watchedItemId: string, 
  action: GeneratedAction, 
  sourceContent: string,
  messageIds: string[]
): Promise<boolean> {
  const api = (globalThis as any).electronAPI;
  if (!api?.db?.watchActions) return false;
  
  try {
    const id = `action_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await api.db.watchActions.create({
      id,
      watched_item_id: watchedItemId,
      title: action.title,
      description: action.description,
      priority: action.priority,
      source_content: sourceContent,
      source_message_ids: JSON.stringify(messageIds),
    });
    return true;
  } catch (error) {
    console.error('Failed to create watch action:', error);
    return false;
  }
}

/**
 * Fetch recent content for a watched item based on platform
 */
async function fetchRecentContent(item: WatchedItem): Promise<ContentFetchResult | null> {
  const api = (globalThis as any).electronAPI;
  if (!api) return null;

  try {
    switch (item.platform) {
      case 'discord': {
        if (item.itemType === 'discord_channel') {
          const messages = await api.db.discord.getMessages(item.itemId, 50);
          if (!messages || !Array.isArray(messages)) return null;
          return {
            platform: 'discord',
            itemId: item.itemId,
            content: messages.map((m: any) => ({
              id: m.id,
              text: m.content,
              author: m.author_username,
              timestamp: m.timestamp,
            })),
          };
        } else if (item.itemType === 'discord_server') {
          const metadata = item.itemMetadata ? JSON.parse(item.itemMetadata) : {};
          const accountId = metadata.accountId || 'discord-selfbot-*';
          const messages = await api.db.discord.getRecentMessages(accountId, 100);
          if (!messages || !Array.isArray(messages)) return null;
          
          const guildMessages = messages.filter((m: any) => m.guild_id === item.itemId);
          return {
            platform: 'discord',
            itemId: item.itemId,
            content: guildMessages.slice(0, 50).map((m: any) => ({
              id: m.id,
              text: m.content,
              author: m.author_username,
              timestamp: m.timestamp,
            })),
          };
        }
        break;
      }

      case 'whatsapp': {
        const messages = await db.whatsapp.getMessages(item.itemId, 50);
        if (!messages || !Array.isArray(messages)) return null;
        return {
          platform: 'whatsapp',
          itemId: item.itemId,
          content: messages
            .filter((m: any) => m.id && m.body) // Filter out invalid messages
            .map((m: any) => {
              let timestamp: string;
              try {
                // Handle various timestamp formats
                if (typeof m.timestamp === 'string' && m.timestamp.includes('T')) {
                  timestamp = m.timestamp; // Already ISO string
                } else if (typeof m.timestamp === 'number' && m.timestamp > 0) {
                  // Check if timestamp is in seconds or milliseconds
                  const ts = m.timestamp > 1e12 ? m.timestamp : m.timestamp * 1000;
                  timestamp = new Date(ts).toISOString();
                } else {
                  timestamp = new Date().toISOString(); // Fallback to now
                }
              } catch {
                timestamp = new Date().toISOString();
              }
              return {
                id: m.id,
                text: m.body,
                author: m.sender_name || m.from_name || 'Unknown',
                timestamp,
              };
            }),
        };
      }

      case 'telegram': {
        const messages = await db.telegram.getMessages(item.itemId, 50);
        if (!messages || !Array.isArray(messages)) return null;
        return {
          platform: 'telegram',
          itemId: item.itemId,
          content: messages
            .filter((m: any) => m.id && m.body) // Filter out invalid messages
            .map((m: any) => {
              let timestamp: string;
              try {
                // Handle various timestamp formats
                if (typeof m.timestamp === 'string' && m.timestamp.includes('T')) {
                  timestamp = m.timestamp; // Already ISO string
                } else if (typeof m.timestamp === 'number' && m.timestamp > 0) {
                  // Check if timestamp is in seconds or milliseconds
                  const ts = m.timestamp > 1e12 ? m.timestamp : m.timestamp * 1000;
                  timestamp = new Date(ts).toISOString();
                } else {
                  timestamp = new Date().toISOString(); // Fallback to now
                }
              } catch {
                timestamp = new Date().toISOString();
              }
              return {
                id: m.id,
                text: m.body,
                author: m.sender_name || m.from_name || 'Unknown',
                timestamp,
              };
            }),
        };
      }

      case 'email': {
        const emails = await db.emails.getAll();
        if (!emails || !Array.isArray(emails)) return null;
        const filtered = emails
          .filter((e: any) => e.sender?.includes(item.itemId))
          .slice(0, 20);
        return {
          platform: 'email',
          itemId: item.itemId,
          content: filtered.map((e: any) => ({
            id: e.id,
            text: `Subject: ${e.subject}\n\n${e.preview || ''}`,
            author: e.sender,
            timestamp: e.timestamp,
          })),
        };
      }

      case 'github': {
        const items = await db.github.getAll();
        if (!items || !Array.isArray(items)) return null;
        const filtered = items
          .filter((i: any) => i.repository?.includes(item.itemId) || i.url?.includes(item.itemId))
          .slice(0, 20);
        return {
          platform: 'github',
          itemId: item.itemId,
          content: filtered.map((i: any) => ({
            id: i.id.toString(),
            text: `${i.type}: ${i.title}\n${i.body || ''}`,
            author: i.author,
            timestamp: i.createdAt,
          })),
        };
      }
    }
  } catch (error) {
    console.error(`Failed to fetch content for ${item.platform}/${item.itemId}:`, error);
  }

  return null;
}

/**
 * Generate AI-powered action from NEW content based on watch goal
 */
async function generateActionFromContent(
  item: WatchedItem,
  newMessages: ContentMessage[]
): Promise<GeneratedAction | null> {
  if (!newMessages.length) return null;

  // Get the watch goal (action text) - this is what the user wants to monitor for
  const watchGoal = item.action || 'Monitor for important updates, opportunities, or items requiring attention';

  const contentSummary = newMessages
    .slice(0, 15)
    .map(c => `[${c.author || 'Unknown'} at ${c.timestamp}]: ${c.text.slice(0, 300)}`)
    .join('\n\n');

  const prompt = `You are an AI assistant analyzing NEW messages for a watched item.

WATCH GOAL (what the user is looking for):
"${watchGoal}"

WATCHED ITEM:
- Name: ${item.itemName}
- Platform: ${item.platform}
- Type: ${item.itemType}

NEW MESSAGES TO ANALYZE (${newMessages.length} messages):
${contentSummary}

TASK:
Based on the WATCH GOAL, analyze these NEW messages and determine if any require action.
Focus ONLY on content that matches what the user is looking for in their watch goal.

If there are actionable items matching the watch goal, create a clear action item.
If nothing matches the watch goal, respond with NO_ACTION.

Response format (JSON only, no markdown):
{
  "hasAction": true/false,
  "title": "Brief action title (max 10 words)",
  "description": "Detailed description of what needs to be done and why",
  "priority": "low|medium|high|critical"
}`;

  try {
    const response = await callAI(prompt);
    if (!response) return null;

    // Parse JSON response
    const jsonMatch = /\{[\s\S]*\}/.exec(response);
    if (!jsonMatch) return null;

    const result = JSON.parse(jsonMatch[0]);
    if (!result.hasAction) return null;

    return {
      title: result.title || 'Action Required',
      description: result.description || '',
      priority: result.priority || 'medium',
    };
  } catch (error) {
    console.error('Failed to generate action:', error);
    return null;
  }
}

/**
 * Process a single watched item - only analyze NEW messages
 */
async function processWatchedItem(item: WatchedItem): Promise<{ analyzed: number; actionCreated: boolean }> {
  try {
    // Fetch all recent content
    const content = await fetchRecentContent(item);
    if (!content?.content?.length) {
      return { analyzed: 0, actionCreated: false };
    }

    // Get already analyzed message IDs
    const analyzedIds = await getAnalyzedMessageIds(item.id);
    
    // Filter to only NEW messages (not previously analyzed)
    const newMessages = content.content.filter(msg => !analyzedIds.has(msg.id));
    
    if (newMessages.length === 0) {
      console.log(`[WatchMonitor] No new messages for ${item.itemName}`);
      return { analyzed: 0, actionCreated: false };
    }

    console.log(`[WatchMonitor] Found ${newMessages.length} new messages for ${item.itemName}`);

    // Generate action from NEW content using watch goal
    const generatedAction = await generateActionFromContent(item, newMessages);
    
    // Mark all new messages as analyzed (even if no action generated)
    const newMessageIds = newMessages.map(m => m.id);
    await markMessagesAsAnalyzed(item.id, newMessageIds, item.platform);

    if (generatedAction) {
      // Create action in the database
      const sourceContent = newMessages.slice(0, 5).map(m => `${m.author}: ${m.text}`).join('\n');
      await createWatchAction(item.id, generatedAction, sourceContent, newMessageIds);
      
      console.log(`[WatchMonitor] Generated action for ${item.itemName}: ${generatedAction.title}`);
      return { analyzed: newMessages.length, actionCreated: true };
    }

    return { analyzed: newMessages.length, actionCreated: false };
  } catch (error) {
    console.error(`[WatchMonitor] Error processing ${item.itemName}:`, error);
    return { analyzed: 0, actionCreated: false };
  }
}

/**
 * Run the watch monitor to process all active watched items
 */
export async function runWatchMonitor(): Promise<{ processed: number; actionsGenerated: number; messagesAnalyzed: number }> {
  console.log('[WatchMonitor] Starting watch monitor run...');
  
  const items = await getActiveWatchedItems();
  let processed = 0;
  let actionsGenerated = 0;
  let messagesAnalyzed = 0;

  for (const item of items) {
    processed++;
    const result = await processWatchedItem(item);
    messagesAnalyzed += result.analyzed;
    if (result.actionCreated) {
      actionsGenerated++;
    }
    
    // Small delay between items to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`[WatchMonitor] Completed: ${processed} items processed, ${messagesAnalyzed} messages analyzed, ${actionsGenerated} actions generated`);
  return { processed, actionsGenerated, messagesAnalyzed };
}

/**
 * Get all pending actions from the database
 */
export async function getAllActions(): Promise<any[]> {
  const api = (globalThis as any).electronAPI;
  if (!api?.db?.watchActions) return [];
  
  try {
    return await api.db.watchActions.getAll();
  } catch (error) {
    console.error('Failed to get actions:', error);
    return [];
  }
}

/**
 * Update action status
 */
export async function updateActionStatus(id: string, status: string): Promise<boolean> {
  const api = (globalThis as any).electronAPI;
  if (!api?.db?.watchActions) return false;
  
  try {
    return await api.db.watchActions.updateStatus(id, status);
  } catch (error) {
    console.error('Failed to update action status:', error);
    return false;
  }
}

/**
 * Delete an action
 */
export async function deleteAction(id: string): Promise<boolean> {
  const api = (globalThis as any).electronAPI;
  if (!api?.db?.watchActions) return false;
  
  try {
    return await api.db.watchActions.delete(id);
  } catch (error) {
    console.error('Failed to delete action:', error);
    return false;
  }
}

// Watch Monitor Singleton
let monitorInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

/**
 * Start the watch monitor (runs every N minutes)
 */
export function startWatchMonitor(intervalMinutes: number = 15): void {
  if (monitorInterval) {
    console.log('[WatchMonitor] Already running');
    return;
  }

  console.log(`[WatchMonitor] Starting with ${intervalMinutes} minute interval`);
  
  // Run immediately
  runWatchMonitor();
  
  // Then run on interval
  monitorInterval = setInterval(() => {
    if (!isRunning) {
      isRunning = true;
      runWatchMonitor().finally(() => {
        isRunning = false;
      });
    }
  }, intervalMinutes * 60 * 1000);
}

/**
 * Stop the watch monitor
 */
export function stopWatchMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('[WatchMonitor] Stopped');
  }
}

/**
 * Check if monitor is running
 */
export function isWatchMonitorRunning(): boolean {
  return monitorInterval !== null;
}

export default {
  runWatchMonitor,
  startWatchMonitor,
  stopWatchMonitor,
  isWatchMonitorRunning,
  getAllActions,
  updateActionStatus,
  deleteAction,
};
