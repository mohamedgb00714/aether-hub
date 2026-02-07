/**
 * YouTube Channel Management - Main Process
 * 
 * Handles channel ID extraction via Puppeteer, RSS feed fetching,
 * and video transcript extraction.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { parseStringPromise } from 'xml2js';
import { database } from './database.js';

let browser: Browser | null = null;

// Get Chrome executable path for different platforms
function getChromePath(): string | undefined {
  const platform = process.platform;
  
  if (platform === 'linux') {
    const paths = [
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  } else if (platform === 'darwin') {
    const paths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  } else if (platform === 'win32') {
    const paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  }
  
  return undefined;
}

// Initialize Puppeteer browser
async function initBrowser(): Promise<Browser> {
  if (browser) return browser;
  
  const chromePath = getChromePath();
  console.log('🌐 YouTube: Launching browser with Chrome at:', chromePath || 'bundled');
  
  browser = await puppeteer.launch({
    headless: true,
    executablePath: chromePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
    userDataDir: path.join(app.getPath('userData'), 'youtube-puppeteer'),
  });
  
  return browser;
}

// Close browser
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// Extract channel ID from various YouTube URL formats
export async function extractChannelId(url: string): Promise<{
  success: boolean;
  channelId?: string;
  channelName?: string;
  channelUrl?: string;
  thumbnailUrl?: string;
  description?: string;
  subscriberCount?: string;
  error?: string;
}> {
  console.log('🎬 YouTube: Extracting channel ID from:', url);
  
  try {
    // Try to extract channel ID from URL patterns first
    const channelIdMatch = url.match(/\/channel\/(UC[\w-]{22})/);
    if (channelIdMatch) {
      const channelId = channelIdMatch[1];
      // Still fetch page to get channel details
      return await fetchChannelDetails(channelId, url);
    }
    
    // For other URL formats (@handle, /c/name, /user/name), use Puppeteer
    const browserInstance = await initBrowser();
    const page = await browserInstance.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to the channel URL
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for the page to load
    await page.waitForSelector('meta[itemprop="channelId"], link[rel="canonical"]', { timeout: 10000 }).catch(() => {});
    
    // Try to extract channel ID from meta tags
    const channelId = await page.evaluate(() => {
      // Method 1: From meta tag
      const metaChannelId = document.querySelector('meta[itemprop="channelId"]');
      if (metaChannelId) return metaChannelId.getAttribute('content');
      
      // Method 2: From canonical link
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) {
        const href = canonical.getAttribute('href');
        const match = href?.match(/\/channel\/(UC[\w-]{22})/);
        if (match) return match[1];
      }
      
      // Method 3: From page data
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent || '';
        const match = content.match(/"channelId":"(UC[\w-]{22})"/);
        if (match) return match[1];
      }
      
      return null;
    });
    
    if (!channelId) {
      await page.close();
      return { success: false, error: 'Could not extract channel ID from the URL' };
    }
    
    // Extract channel details
    const channelDetails = await page.evaluate(() => {
      // Channel name
      const nameElement = document.querySelector('#channel-name, #text.ytd-channel-name, [id="channel-header"] yt-formatted-string');
      const channelName = nameElement?.textContent?.trim() || '';
      
      // Thumbnail
      const avatarElement = document.querySelector('#avatar img, yt-img-shadow img');
      const thumbnailUrl = avatarElement?.getAttribute('src') || '';
      
      // Description
      const descElement = document.querySelector('#description, [id="description-container"]');
      const description = descElement?.textContent?.trim() || '';
      
      // Subscriber count
      const subElement = document.querySelector('#subscriber-count, [id="subscriber-count"]');
      const subscriberCount = subElement?.textContent?.trim() || '';
      
      return { channelName, thumbnailUrl, description, subscriberCount };
    });
    
    const canonicalUrl = await page.evaluate(() => {
      const canonical = document.querySelector('link[rel="canonical"]');
      return canonical?.getAttribute('href') || '';
    });
    
    await page.close();
    
    return {
      success: true,
      channelId,
      channelName: channelDetails.channelName,
      channelUrl: canonicalUrl || `https://www.youtube.com/channel/${channelId}`,
      thumbnailUrl: channelDetails.thumbnailUrl,
      description: channelDetails.description,
      subscriberCount: channelDetails.subscriberCount,
    };
    
  } catch (error: any) {
    console.error('🔴 YouTube: Error extracting channel ID:', error);
    return { success: false, error: error.message || 'Failed to extract channel ID' };
  }
}

// Fetch channel details using channel ID
async function fetchChannelDetails(channelId: string, originalUrl?: string): Promise<{
  success: boolean;
  channelId?: string;
  channelName?: string;
  channelUrl?: string;
  thumbnailUrl?: string;
  description?: string;
  subscriberCount?: string;
  error?: string;
}> {
  try {
    const browserInstance = await initBrowser();
    const page = await browserInstance.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const channelUrl = `https://www.youtube.com/channel/${channelId}`;
    await page.goto(channelUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    await page.waitForSelector('#channel-name, #text.ytd-channel-name', { timeout: 10000 }).catch(() => {});
    
    const channelDetails = await page.evaluate(() => {
      const nameElement = document.querySelector('#channel-name yt-formatted-string, #text.ytd-channel-name');
      const channelName = nameElement?.textContent?.trim() || '';
      
      const avatarElement = document.querySelector('#avatar img, yt-img-shadow img');
      const thumbnailUrl = avatarElement?.getAttribute('src') || '';
      
      const descElement = document.querySelector('#description, [id="description-container"]');
      const description = descElement?.textContent?.trim() || '';
      
      const subElement = document.querySelector('#subscriber-count');
      const subscriberCount = subElement?.textContent?.trim() || '';
      
      return { channelName, thumbnailUrl, description, subscriberCount };
    });
    
    await page.close();
    
    return {
      success: true,
      channelId,
      channelName: channelDetails.channelName || channelId,
      channelUrl,
      thumbnailUrl: channelDetails.thumbnailUrl,
      description: channelDetails.description,
      subscriberCount: channelDetails.subscriberCount,
    };
  } catch (error: any) {
    return {
      success: true,
      channelId,
      channelName: channelId,
      channelUrl: `https://www.youtube.com/channel/${channelId}`,
      error: error.message,
    };
  }
}

// Build RSS feed URL from channel ID
export function buildRssUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

// Fetch and parse RSS feed for a channel
export async function fetchChannelFeed(channelId: string): Promise<{
  success: boolean;
  videos?: Array<{
    videoId: string;
    title: string;
    description: string;
    publishedAt: string;
    thumbnailUrl: string;
    videoUrl: string;
  }>;
  error?: string;
}> {
  try {
    const rssUrl = buildRssUrl(channelId);
    console.log('📺 YouTube: Fetching RSS feed:', rssUrl);
    
    const response = await fetch(rssUrl);
    if (!response.ok) {
      return { success: false, error: `Failed to fetch RSS feed: ${response.status}` };
    }
    
    const xmlText = await response.text();
    const parsed = await parseStringPromise(xmlText, { explicitArray: false });
    
    const entries = parsed.feed?.entry;
    if (!entries) {
      return { success: true, videos: [] };
    }
    
    const entriesArray = Array.isArray(entries) ? entries : [entries];
    
    const videos = entriesArray.map((entry: any) => {
      const videoId = entry['yt:videoId'] || '';
      const mediaGroup = entry['media:group'] || {};
      const mediaThumbnail = mediaGroup['media:thumbnail'];
      
      return {
        videoId,
        title: entry.title || '',
        description: mediaGroup['media:description'] || '',
        publishedAt: entry.published || '',
        thumbnailUrl: mediaThumbnail?.['$']?.url || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        videoUrl: entry.link?.['$']?.href || `https://www.youtube.com/watch?v=${videoId}`,
      };
    });
    
    return { success: true, videos };
    
  } catch (error: any) {
    console.error('🔴 YouTube: Error fetching RSS feed:', error);
    return { success: false, error: error.message || 'Failed to fetch RSS feed' };
  }
}

// Get video transcript using youtube-transcript or fallback to captions
export async function getVideoTranscript(videoId: string): Promise<{
  success: boolean;
  transcript?: string;
  error?: string;
}> {
  try {
    console.log('📝 YouTube: Fetching transcript for video:', videoId);
    
    // Use innertube API to get captions
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    const browserInstance = await initBrowser();
    const page = await browserInstance.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Intercept network requests to find caption URLs
    let captionUrl: string | null = null;
    
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      request.continue();
    });
    
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('timedtext') || url.includes('caption')) {
        captionUrl = url;
      }
    });
    
    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Try to extract caption data from page
    const transcriptData = await page.evaluate(() => {
      // Look for caption tracks in ytInitialPlayerResponse
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent || '';
        if (content.includes('ytInitialPlayerResponse')) {
          const match = content.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
          if (match) {
            try {
              const data = JSON.parse(match[1]);
              const captions = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
              if (captions && captions.length > 0) {
                // Prefer English, then auto-generated
                const english = captions.find((c: any) => c.languageCode === 'en');
                const autoGen = captions.find((c: any) => c.kind === 'asr');
                const track = english || autoGen || captions[0];
                return track?.baseUrl || null;
              }
            } catch (e) {
              console.error('Error parsing ytInitialPlayerResponse:', e);
            }
          }
        }
      }
      return null;
    });
    
    await page.close();
    
    if (!transcriptData && !captionUrl) {
      return { success: false, error: 'No captions available for this video' };
    }
    
    // Fetch the transcript
    const transcriptUrl = transcriptData || captionUrl;
    if (!transcriptUrl) {
      return { success: false, error: 'Could not find transcript URL' };
    }
    
    const transcriptResponse = await fetch(transcriptUrl);
    if (!transcriptResponse.ok) {
      return { success: false, error: 'Failed to fetch transcript' };
    }
    
    const transcriptXml = await transcriptResponse.text();
    const transcriptParsed = await parseStringPromise(transcriptXml, { explicitArray: false });
    
    // Extract text from transcript XML
    const textElements = transcriptParsed?.transcript?.text;
    if (!textElements) {
      return { success: false, error: 'Could not parse transcript' };
    }
    
    const textArray = Array.isArray(textElements) ? textElements : [textElements];
    const transcript = textArray
      .map((t: any) => {
        const text = typeof t === 'string' ? t : t._ || '';
        return text.replace(/&#(\d+);/g, (_: any, num: string) => String.fromCharCode(parseInt(num)))
                   .replace(/&amp;/g, '&')
                   .replace(/&lt;/g, '<')
                   .replace(/&gt;/g, '>')
                   .replace(/&quot;/g, '"')
                   .replace(/&#39;/g, "'");
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return { success: true, transcript };
    
  } catch (error: any) {
    console.error('🔴 YouTube: Error fetching transcript:', error);
    return { success: false, error: error.message || 'Failed to fetch transcript' };
  }
}

// Sync all active channels - fetch new videos
export async function syncAllChannels(): Promise<{
  success: boolean;
  channelsUpdated: number;
  videosAdded: number;
  errors: string[];
}> {
  const channels = database.youtubeChannels.getActive();
  let channelsUpdated = 0;
  let videosAdded = 0;
  const errors: string[] = [];
  
  console.log(`📺 YouTube: Syncing ${channels.length} active channels`);
  
  for (const channel of channels) {
    try {
      const feedResult = await fetchChannelFeed(channel.channel_id);
      
      if (!feedResult.success || !feedResult.videos) {
        errors.push(`${channel.channel_name}: ${feedResult.error || 'Unknown error'}`);
        continue;
      }
      
      // Add videos to database
      const videosToCreate = feedResult.videos.map(video => ({
        id: `yt_${video.videoId}`,
        channel_id: channel.channel_id,
        video_id: video.videoId,
        title: video.title,
        description: video.description,
        thumbnail_url: video.thumbnailUrl,
        published_at: video.publishedAt,
        video_url: video.videoUrl,
      }));
      
      const inserted = database.youtubeVideos.bulkCreate(videosToCreate);
      videosAdded += inserted;
      
      // Update last checked timestamp
      database.youtubeChannels.updateLastChecked(channel.id);
      channelsUpdated++;
      
    } catch (error: any) {
      errors.push(`${channel.channel_name}: ${error.message}`);
    }
  }
  
  console.log(`✅ YouTube: Sync complete - ${channelsUpdated} channels, ${videosAdded} new videos`);
  
  return {
    success: true,
    channelsUpdated,
    videosAdded,
    errors,
  };
}

// Cleanup on app quit
app.on('before-quit', async () => {
  await closeBrowser();
});
