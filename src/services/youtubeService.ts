/**
 * YouTube Service - Renderer Process
 * 
 * Handles YouTube channel management, video analysis, and AI-powered summaries.
 * Works through IPC to communicate with main process for Puppeteer operations.
 */

import { v4 as uuidv4 } from 'uuid';
import { callAI, getTemporalContext } from './geminiService';
import storage, { STORAGE_KEYS } from './electronStore';

// Types
export interface YouTubeChannel {
  id: string;
  channelId: string;
  channelName: string;
  channelUrl: string;
  rssUrl: string;
  thumbnailUrl: string | null;
  description: string | null;
  subscriberCount: string | null;
  isActive: boolean;
  lastChecked: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface YouTubeVideo {
  id: string;
  channelId: string;
  videoId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
  duration: string | null;
  viewCount: string | null;
  videoUrl: string;
  transcript: string | null;
  aiSummary: string | null;
  aiTopics: string[] | null;
  aiValueScore: number | null;
  aiValueReason: string | null;
  isWatched: boolean;
  isAnalyzed: boolean;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  channelName?: string;
}

export interface UserInterest {
  id: string;
  category: string;
  topic: string;
  weight: number;
  createdAt: string;
  updatedAt: string;
}

export interface VideoAnalysis {
  summary: string;
  topics: string[];
  valueScore: number;
  valueReason: string;
}

// Predefined interest categories
export const INTEREST_CATEGORIES = [
  'Technology',
  'Business',
  'Science',
  'Programming',
  'AI & Machine Learning',
  'Finance & Investing',
  'Marketing',
  'Design',
  'Productivity',
  'Health & Fitness',
  'Education',
  'News & Politics',
  'Entertainment',
  'Gaming',
  'Music',
  'Travel',
  'Cooking',
  'DIY & Crafts',
  'Other'
];

// Convert database row to typed channel
function dbToChannel(row: any): YouTubeChannel {
  return {
    id: row.id,
    channelId: row.channel_id,
    channelName: row.channel_name,
    channelUrl: row.channel_url,
    rssUrl: row.rss_url,
    thumbnailUrl: row.thumbnail_url,
    description: row.description,
    subscriberCount: row.subscriber_count,
    isActive: row.is_active === 1,
    lastChecked: row.last_checked,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Convert database row to typed video
function dbToVideo(row: any): YouTubeVideo {
  return {
    id: row.id,
    channelId: row.channel_id,
    videoId: row.video_id,
    title: row.title,
    description: row.description,
    thumbnailUrl: row.thumbnail_url,
    publishedAt: row.published_at,
    duration: row.duration,
    viewCount: row.view_count,
    videoUrl: row.video_url,
    transcript: row.transcript,
    aiSummary: row.ai_summary,
    aiTopics: row.ai_topics ? JSON.parse(row.ai_topics) : null,
    aiValueScore: row.ai_value_score,
    aiValueReason: row.ai_value_reason,
    isWatched: row.is_watched === 1,
    isAnalyzed: row.is_analyzed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    channelName: row.channel_name,
  };
}

// Convert database row to typed interest
function dbToInterest(row: any): UserInterest {
  return {
    id: row.id,
    category: row.category,
    topic: row.topic,
    weight: row.weight,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==================== Channel Operations ====================

/**
 * Add a new YouTube channel by URL
 */
export async function addChannel(url: string): Promise<{
  success: boolean;
  channel?: YouTubeChannel;
  error?: string;
}> {
  try {
    // Extract channel info using Puppeteer (via IPC)
    const result = await window.electronAPI.youtube.extractChannelId(url);
    
    if (!result.success || !result.channelId) {
      return { success: false, error: result.error || 'Could not extract channel information' };
    }
    
    // Check if channel already exists
    const existing = await window.electronAPI.db.youtube.channels.getByChannelId(result.channelId);
    if (existing) {
      return { success: false, error: 'This channel is already added' };
    }
    
    // Build RSS URL
    const rssUrl = await window.electronAPI.youtube.buildRssUrl(result.channelId);
    
    // Create channel in database
    const channel = {
      id: uuidv4(),
      channel_id: result.channelId,
      channel_name: result.channelName || result.channelId,
      channel_url: result.channelUrl || url,
      rss_url: rssUrl,
      thumbnail_url: result.thumbnailUrl || null,
      description: result.description || null,
      subscriber_count: result.subscriberCount || null,
    };
    
    const created = await window.electronAPI.db.youtube.channels.create(channel);
    
    if (!created) {
      return { success: false, error: 'Failed to save channel to database' };
    }
    
    // Fetch initial videos
    await syncChannelVideos(result.channelId);
    
    return {
      success: true,
      channel: dbToChannel({
        ...channel,
        is_active: 1,
        last_checked: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    };
    
  } catch (error: any) {
    console.error('Error adding channel:', error);
    return { success: false, error: error.message || 'Failed to add channel' };
  }
}

/**
 * Get all channels
 */
export async function getAllChannels(): Promise<YouTubeChannel[]> {
  const rows = await window.electronAPI.db.youtube.channels.getAll();
  return rows.map(dbToChannel);
}

/**
 * Get active channels only
 */
export async function getActiveChannels(): Promise<YouTubeChannel[]> {
  const rows = await window.electronAPI.db.youtube.channels.getActive();
  return rows.map(dbToChannel);
}

/**
 * Toggle channel active status
 */
export async function toggleChannelActive(id: string): Promise<boolean> {
  return await window.electronAPI.db.youtube.channels.toggleActive(id);
}

/**
 * Delete a channel
 */
export async function deleteChannel(id: string): Promise<boolean> {
  return await window.electronAPI.db.youtube.channels.delete(id);
}

/**
 * Sync videos for a specific channel
 */
export async function syncChannelVideos(channelId: string): Promise<{
  success: boolean;
  videosAdded: number;
  error?: string;
}> {
  try {
    const result = await window.electronAPI.youtube.fetchChannelFeed(channelId);
    
    if (!result.success || !result.videos) {
      return { success: false, videosAdded: 0, error: result.error };
    }
    
    // Videos are added via main process, count is returned
    return {
      success: true,
      videosAdded: result.videos.length,
    };
    
  } catch (error: any) {
    return { success: false, videosAdded: 0, error: error.message };
  }
}

/**
 * Sync all active channels
 */
export async function syncAllChannels(): Promise<{
  success: boolean;
  channelsUpdated: number;
  videosAdded: number;
  errors: string[];
}> {
  return await window.electronAPI.youtube.syncAllChannels();
}

// ==================== Video Operations ====================

/**
 * Get all videos with optional filters
 */
export async function getVideos(options: {
  channelId?: string;
  limit?: number;
  startDate?: string;
  endDate?: string;
  highValueOnly?: boolean;
  minScore?: number;
} = {}): Promise<YouTubeVideo[]> {
  let rows: any[];
  
  if (options.highValueOnly) {
    rows = await window.electronAPI.db.youtube.videos.getHighValue(
      options.minScore || 70,
      options.limit || 50
    );
  } else if (options.channelId) {
    rows = await window.electronAPI.db.youtube.videos.getByChannel(
      options.channelId,
      options.limit || 50
    );
  } else if (options.startDate && options.endDate) {
    rows = await window.electronAPI.db.youtube.videos.getByDateRange(
      options.startDate,
      options.endDate
    );
  } else {
    rows = await window.electronAPI.db.youtube.videos.getAll(options.limit || 100);
  }
  
  return rows.map(dbToVideo);
}

/**
 * Get unanalyzed videos
 */
export async function getUnanalyzedVideos(limit: number = 20): Promise<YouTubeVideo[]> {
  const rows = await window.electronAPI.db.youtube.videos.getUnanalyzed(limit);
  return rows.map(dbToVideo);
}

/**
 * Mark video as watched
 */
export async function markVideoAsWatched(id: string): Promise<boolean> {
  return await window.electronAPI.db.youtube.videos.markAsWatched(id);
}

/**
 * Get video transcript
 */
export async function getVideoTranscript(videoId: string): Promise<{
  success: boolean;
  transcript?: string;
  error?: string;
}> {
  return await window.electronAPI.youtube.getVideoTranscript(videoId);
}

// ==================== AI Analysis ====================

/**
 * Analyze a video with AI
 */
export async function analyzeVideo(video: YouTubeVideo): Promise<{
  success: boolean;
  analysis?: VideoAnalysis;
  error?: string;
}> {
  try {
    // Get transcript if not already available
    let transcript = video.transcript;
    if (!transcript) {
      const transcriptResult = await getVideoTranscript(video.videoId);
      if (transcriptResult.success && transcriptResult.transcript) {
        transcript = transcriptResult.transcript;
      }
    }
    
    // Get user interests for value scoring
    const interests = await getUserInterests();
    const interestTopics = interests.map(i => `${i.category}: ${i.topic} (weight: ${i.weight})`).join(', ');
    
    // Prepare content for analysis
    const contentToAnalyze = transcript 
      ? `Title: ${video.title}\n\nDescription: ${video.description || 'N/A'}\n\nTranscript:\n${transcript.substring(0, 15000)}`
      : `Title: ${video.title}\n\nDescription: ${video.description || 'N/A'}`;
    
    const prompt = `Analyze this YouTube video content and provide a structured analysis.

${contentToAnalyze}

User's Interests and Topics (for value scoring):
${interestTopics || 'No specific interests defined - use general relevance'}

Please provide:
1. A concise summary (2-3 paragraphs) of the main points and takeaways
2. A list of 3-7 main topics/themes covered
3. A value score (0-100) based on how relevant and valuable this content is to the user's interests
4. A brief explanation (1-2 sentences) of why you gave that value score

Respond in this exact JSON format:
{
  "summary": "Your summary here...",
  "topics": ["topic1", "topic2", "topic3"],
  "valueScore": 75,
  "valueReason": "Explanation of the score..."
}`;

    const temporalContext = getTemporalContext();
    const systemInstruction = `You are a helpful AI assistant that analyzes YouTube video content. Always respond with valid JSON.\n\n[Temporal Context]\n${temporalContext}`;
    
    // Use unified callAI function that respects all providers
    const response = await callAI(prompt, systemInstruction);
    
    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: 'Failed to parse AI response' };
    }
    
    const analysis = JSON.parse(jsonMatch[0]) as VideoAnalysis;
    
    // Save analysis to database
    await window.electronAPI.db.youtube.videos.updateAnalysis(video.id, {
      transcript: transcript || undefined,
      ai_summary: analysis.summary,
      ai_topics: JSON.stringify(analysis.topics),
      ai_value_score: analysis.valueScore,
      ai_value_reason: analysis.valueReason,
    });
    
    return { success: true, analysis };
    
  } catch (error: any) {
    console.error('Error analyzing video:', error);
    return { success: false, error: error.message || 'Failed to analyze video' };
  }
}

/**
 * Batch analyze unanalyzed videos
 */
export async function analyzeUnanalyzedVideos(limit: number = 5): Promise<{
  analyzed: number;
  errors: string[];
}> {
  const videos = await getUnanalyzedVideos(limit);
  let analyzed = 0;
  const errors: string[] = [];
  
  for (const video of videos) {
    const result = await analyzeVideo(video);
    if (result.success) {
      analyzed++;
    } else {
      errors.push(`${video.title}: ${result.error}`);
    }
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return { analyzed, errors };
}

// ==================== User Interests ====================

/**
 * Get all user interests
 */
export async function getUserInterests(): Promise<UserInterest[]> {
  const rows = await window.electronAPI.db.userInterests.getAll();
  return rows.map(dbToInterest);
}

/**
 * Add or update a user interest
 */
export async function saveUserInterest(interest: {
  category: string;
  topic: string;
  weight: number;
}): Promise<boolean> {
  return await window.electronAPI.db.userInterests.upsert({
    id: uuidv4(),
    category: interest.category,
    topic: interest.topic,
    weight: interest.weight,
  });
}

/**
 * Delete a user interest
 */
export async function deleteUserInterest(id: string): Promise<boolean> {
  return await window.electronAPI.db.userInterests.delete(id);
}

// ==================== Utility Functions ====================

/**
 * Format video duration
 */
export function formatDuration(duration: string | null): string {
  if (!duration) return 'Unknown';
  
  // ISO 8601 duration format: PT1H2M3S
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return then.toLocaleDateString();
}

/**
 * Get value score color class
 */
export function getValueScoreColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-slate-500';
}

/**
 * Get value score background class
 */
export function getValueScoreBg(score: number | null): string {
  if (score === null) return 'bg-slate-100';
  if (score >= 80) return 'bg-emerald-100';
  if (score >= 60) return 'bg-blue-100';
  if (score >= 40) return 'bg-amber-100';
  return 'bg-slate-100';
}
