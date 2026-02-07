/**
 * Intelligence Feed Service
 * Generates AI-powered intelligence feeds from user data
 */

import { db } from './database';
import { callAI } from './geminiService';
import storage, { STORAGE_KEYS } from './electronStore';
import { v4 as uuidv4 } from 'uuid';

export interface IntelligenceFeedParams {
  includeEmails: boolean;
  includeEvents: boolean;
  includeGitHub: boolean;
  includeWhatsApp: boolean;
  includeTelegram: boolean;
  includeDiscord: boolean;
  timeRange: 'today' | 'week' | 'month';
  priority: 'all' | 'high' | 'medium';
}

export interface IntelligenceFeed {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: number;
  insights?: string[];
  actionItems?: string[];
  sources?: string[];
  generatedAt: string;
}

const DEFAULT_PARAMS: IntelligenceFeedParams = {
  includeEmails: true,
  includeEvents: true,
  includeGitHub: true,
  includeWhatsApp: true,
  includeTelegram: true,
  includeDiscord: true,
  timeRange: 'today',
  priority: 'all',
};

/**
 * Get saved feed parameters
 */
export async function getFeedParams(): Promise<IntelligenceFeedParams> {
  const saved = await storage.get(STORAGE_KEYS.INTELLIGENCE_FEED_PARAMS) as IntelligenceFeedParams | null;
  return saved || DEFAULT_PARAMS;
}

/**
 * Save feed parameters
 */
export async function saveFeedParams(params: IntelligenceFeedParams): Promise<void> {
  await storage.set(STORAGE_KEYS.INTELLIGENCE_FEED_PARAMS, params);
}

/**
 * Get time range filter
 */
function getTimeFilter(range: 'today' | 'week' | 'month'): string {
  const now = new Date();
  let startTime: Date;

  switch (range) {
    case 'today':
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  return startTime.toISOString();
}

/**
 * Generate intelligence feed
 */
export async function generateIntelligenceFeed(params?: Partial<IntelligenceFeedParams>): Promise<IntelligenceFeed> {
  const savedParams = await getFeedParams();
  const finalParams = { ...savedParams, ...params };
  
  console.log('🧠 Generating intelligence feed with params:', finalParams);

  const timeFilter = getTimeFilter(finalParams.timeRange);
  const sources: string[] = [];
  let dataContext = '';

  // Gather emails
  if (finalParams.includeEmails) {
    try {
      const emails = await db.emails.getAll();
      const recentEmails = emails
        .filter(e => e.timestamp >= timeFilter)
        .filter(e => finalParams.priority === 'all' || 
                     (finalParams.priority === 'high' && e.aiPriority === 3) ||
                     (finalParams.priority === 'medium' && e.aiPriority === 2))
        .slice(0, 10);
      
      if (recentEmails.length > 0) {
        dataContext += `\n\n📧 EMAILS (${recentEmails.length}):\n`;
        recentEmails.forEach(email => {
          dataContext += `- ${email.subject} from ${email.sender}\n`;
          if (email.aiSummary) dataContext += `  Summary: ${email.aiSummary}\n`;
        });
        sources.push(`${recentEmails.length} emails`);
      }
    } catch (err) {
      console.warn('Failed to fetch emails for intelligence feed:', err);
    }
  }

  // Gather calendar events
  if (finalParams.includeEvents) {
    try {
      const events = await db.events.getAll();
      const recentEvents = events
        .filter(e => e.startTime >= timeFilter)
        .slice(0, 10);
      
      if (recentEvents.length > 0) {
        dataContext += `\n\n📅 CALENDAR EVENTS (${recentEvents.length}):\n`;
        recentEvents.forEach(event => {
          dataContext += `- ${event.title} at ${new Date(event.startTime).toLocaleString()}\n`;
          if (event.description) dataContext += `  ${event.description}\n`;
        });
        sources.push(`${recentEvents.length} events`);
      }
    } catch (err) {
      console.warn('Failed to fetch events for intelligence feed:', err);
    }
  }

  // Gather GitHub activity
  if (finalParams.includeGitHub) {
    try {
      const githubItems = await db.github.getAll();
      const recentGitHub = githubItems
        .filter(item => item.updatedAtGithub >= timeFilter)
        .slice(0, 10);
      
      if (recentGitHub.length > 0) {
        dataContext += `\n\n💻 GITHUB ACTIVITY (${recentGitHub.length}):\n`;
        recentGitHub.forEach(item => {
          dataContext += `- [${item.type.toUpperCase()}] ${item.title} in ${item.repository}\n`;
          dataContext += `  State: ${item.state}, Author: ${item.author}\n`;
        });
        sources.push(`${recentGitHub.length} GitHub items`);
      }
    } catch (err) {
      console.warn('Failed to fetch GitHub items for intelligence feed:', err);
    }
  }

  // Gather WhatsApp messages
  if (finalParams.includeWhatsApp) {
    try {
      const accounts = await db.accounts.getByPlatform('whatsapp');
      for (const account of accounts) {
        try {
          const whatsappChats = await db.whatsapp.getChats(account.id);
          const recentChats = (whatsappChats || []).filter(chat => chat.unreadCount > 0);
          
          if (recentChats.length > 0) {
            dataContext += `\n\n💬 WHATSAPP (${account.name}) (${recentChats.length} unread chats):\n`;
            recentChats.slice(0, 5).forEach(chat => {
              dataContext += `- ${chat.name}: ${chat.unreadCount} unread messages\n`;
              if (chat.lastMessage) dataContext += `  Last: ${chat.lastMessage}\n`;
            });
            sources.push(`${recentChats.length} WhatsApp chats (${account.name})`);
          }
        } catch (chatErr) {
          console.warn(`Failed to fetch WhatsApp chats for account ${account.id}:`, chatErr);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch WhatsApp accounts for intelligence feed:', err);
    }
  }

  // Gather Telegram messages
  if (finalParams.includeTelegram) {
    try {
      const accounts = await db.accounts.getByPlatform('telegram');
      for (const account of accounts) {
        try {
          const telegramChats = await db.telegram.getChats(account.id);
          const recentChats = (telegramChats || []).filter(chat => chat.unreadCount > 0);
          
          if (recentChats.length > 0) {
            dataContext += `\n\n✈️ TELEGRAM (${account.name}) (${recentChats.length} unread chats):\n`;
            recentChats.slice(0, 5).forEach(chat => {
              dataContext += `- ${chat.name}: ${chat.unreadCount} unread messages\n`;
              if (chat.lastMessage) dataContext += `  Last: ${chat.lastMessage}\n`;
            });
            sources.push(`${recentChats.length} Telegram chats (${account.name})`);
          }
        } catch (chatErr) {
          console.warn(`Failed to fetch Telegram chats for account ${account.id}:`, chatErr);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch Telegram accounts for intelligence feed:', err);
    }
  }

  // Gather Discord messages
  if (finalParams.includeDiscord) {
    try {
      const accounts = await db.accounts.getByPlatform('discord');
      for (const account of accounts) {
        try {
          const discordMessages = await db.discord.getRecentMessages(account.id, 20);
          const unreadMessages = (discordMessages || [])
            .filter(msg => msg.timestamp >= timeFilter && !msg.isRead)
            .slice(0, 10);
          
          if (unreadMessages.length > 0) {
            dataContext += `\n\n🎮 DISCORD (${account.name}) (${unreadMessages.length} unread):\n`;
            unreadMessages.forEach(msg => {
              dataContext += `- ${msg.authorName || 'Unknown'}: ${msg.content ? msg.content.substring(0, 100) : 'No content'}\n`;
            });
            sources.push(`${unreadMessages.length} Discord messages (${account.name})`);
          }
        } catch (msgErr) {
          console.warn(`Failed to fetch Discord messages for account ${account.id}:`, msgErr);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch Discord accounts for intelligence feed:', err);
    }
  }

  if (!dataContext.trim()) {
    dataContext = 'No recent activity found in the selected time range.';
  }

  // Generate AI intelligence feed
  const prompt = `You are an intelligent assistant analyzing a user's digital activity. Generate a comprehensive intelligence briefing based on the following data.

CONTEXT:
${dataContext}

Generate a JSON response with:
{
  "title": "Brief title for this intelligence feed",
  "summary": "Executive summary of key information (2-3 paragraphs)",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "actionItems": ["action 1", "action 2"],
  "priority": 0-10 (overall priority score)
}

Focus on:
- Important trends or patterns
- Urgent items requiring attention
- Opportunities or risks
- Strategic insights`;

  try {
    const response = await callAI(prompt);
    const aiResult = JSON.parse(response.replace(/```json\n?|```/g, '').trim());

    const feed: IntelligenceFeed = {
      id: uuidv4(),
      title: aiResult.title || 'Intelligence Feed',
      content: aiResult.summary || 'No summary generated',
      category: finalParams.timeRange,
      priority: aiResult.priority || 5,
      insights: aiResult.insights || [],
      actionItems: aiResult.actionItems || [],
      sources,
      generatedAt: new Date().toISOString(),
    };

    // Save to database
    await db.intelligenceFeeds.create({
      id: feed.id,
      title: feed.title,
      content: feed.content,
      category: feed.category,
      priority: feed.priority,
      insights: JSON.stringify(feed.insights),
      action_items: JSON.stringify(feed.actionItems),
      sources: JSON.stringify(feed.sources),
      generated_at: feed.generatedAt,
    });

    console.log('✅ Intelligence feed generated:', feed.title);
    return feed;

  } catch (error) {
    console.error('❌ Failed to generate intelligence feed:', error);
    throw error;
  }
}

/**
 * Get feed history
 */
export async function getFeedHistory(limit: number = 10): Promise<IntelligenceFeed[]> {
  const dbFeeds = await db.intelligenceFeeds.getRecent(limit);
  return dbFeeds.map(feed => ({
    id: feed.id,
    title: feed.title,
    content: feed.content,
    category: feed.category,
    priority: feed.priority,
    insights: feed.insights ? JSON.parse(feed.insights) : [],
    actionItems: feed.action_items ? JSON.parse(feed.action_items) : [],
    sources: feed.sources ? JSON.parse(feed.sources) : [],
    generatedAt: feed.generated_at,
  }));
}

/**
 * Delete old feeds (keep last 30 days)
 */
export async function cleanupOldFeeds(): Promise<number> {
  return await db.intelligenceFeeds.deleteOlderThan(30);
}
