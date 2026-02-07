/**
 * Notification Service for aethermsaid hub
 * Handles sound notifications for new messages, emails, and activities across all accounts
 */

import storage from './electronStore';
import { db } from './database';
import type { Email } from '../types';

// Storage key for notification settings
export const NOTIFICATION_STORAGE_KEYS = {
  ENABLED: 'notification_enabled',
  SOUND_ENABLED: 'notification_sound_enabled',
  SOUND_VOLUME: 'notification_sound_volume',
  SOUND_TYPE: 'notification_sound_type',
  EMAIL_NOTIFICATIONS: 'notification_email_enabled',
  MESSAGE_NOTIFICATIONS: 'notification_message_enabled',
  GITHUB_NOTIFICATIONS: 'notification_github_enabled',
  SLACK_NOTIFICATIONS: 'notification_slack_enabled',
  WHATSAPP_NOTIFICATIONS: 'notification_whatsapp_enabled',
  LAST_EMAIL_IDS: 'notification_last_email_ids',
  LAST_NOTIFICATION_IDS: 'notification_last_notif_ids',
  LAST_GITHUB_IDS: 'notification_last_github_ids',
  DO_NOT_DISTURB: 'notification_dnd',
  DND_START: 'notification_dnd_start',
  DND_END: 'notification_dnd_end',
};

// Available notification sound types
export const NOTIFICATION_SOUNDS = {
  default: { name: 'Default', frequency: 880, duration: 150 },
  chime: { name: 'Chime', frequency: 1200, duration: 200 },
  bell: { name: 'Bell', frequency: 660, duration: 300 },
  pop: { name: 'Pop', frequency: 1400, duration: 80 },
  ding: { name: 'Ding', frequency: 1000, duration: 120 },
} as const;

export type SoundType = keyof typeof NOTIFICATION_SOUNDS;

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  soundVolume: number; // 0-100
  soundType: SoundType;
  emailNotifications: boolean;
  messageNotifications: boolean;
  githubNotifications: boolean;
  slackNotifications: boolean;
  whatsappNotifications: boolean;
  doNotDisturb: boolean;
  dndStart: string; // HH:MM format
  dndEnd: string;   // HH:MM format
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  soundEnabled: true,
  soundVolume: 70,
  soundType: 'default',
  emailNotifications: true,
  messageNotifications: true,
  githubNotifications: true,
  slackNotifications: true,
  whatsappNotifications: true,
  doNotDisturb: false,
  dndStart: '22:00',
  dndEnd: '08:00',
};

// Track seen item IDs to detect new items
let seenEmailIds: Set<string> = new Set();
let seenNotificationIds: Set<string> = new Set();
let seenGitHubIds: Set<string> = new Set();
let initialized = false;

// Audio context for generating notification sounds
let audioContext: AudioContext | null = null;

/**
 * Get or create audio context (lazy initialization)
 */
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Generate and play a notification tone using Web Audio API
 */
function playTone(frequency: number, duration: number, volume: number, type: 'sine' | 'triangle' | 'square' = 'sine'): void {
  try {
    const ctx = getAudioContext();
    
    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    // Set volume (0-1)
    const normalizedVolume = Math.max(0, Math.min(1, volume / 100));
    gainNode.gain.setValueAtTime(normalizedVolume * 0.3, ctx.currentTime);
    
    // Fade out for smoother sound
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);
  } catch (error) {
    console.error('❌ Failed to play tone:', error);
  }
}

/**
 * Play a multi-note chime for certain sound types
 */
function playMultiTone(notes: { frequency: number; delay: number }[], duration: number, volume: number): void {
  notes.forEach(note => {
    setTimeout(() => {
      playTone(note.frequency, duration, volume, 'sine');
    }, note.delay);
  });
}

/**
 * Initialize the notification service
 */
export async function initNotificationService(): Promise<void> {
  if (initialized) return;
  
  console.log('🔔 Initializing notification service...');
  
  try {
    // Load previously seen IDs from storage
    const lastEmailIds = await storage.get(NOTIFICATION_STORAGE_KEYS.LAST_EMAIL_IDS) as string[] | null;
    const lastNotifIds = await storage.get(NOTIFICATION_STORAGE_KEYS.LAST_NOTIFICATION_IDS) as string[] | null;
    const lastGitHubIds = await storage.get(NOTIFICATION_STORAGE_KEYS.LAST_GITHUB_IDS) as string[] | null;
    
    if (lastEmailIds && lastEmailIds.length > 0) {
      seenEmailIds = new Set(lastEmailIds);
      console.log(`🔔 Loaded ${seenEmailIds.size} seen email IDs from storage`);
    }
    if (lastNotifIds && lastNotifIds.length > 0) {
      seenNotificationIds = new Set(lastNotifIds);
    }
    if (lastGitHubIds && lastGitHubIds.length > 0) {
      seenGitHubIds = new Set(lastGitHubIds);
    }
    
    // Note: We don't pre-populate seen IDs on first run anymore
    // This ensures we get a notification for the first batch of emails
    // After processing, they get added to the seen set
    
    initialized = true;
    console.log('🔔 Notification service initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize notification service:', error);
    initialized = true; // Mark as initialized to prevent repeated failures
  }
}

/**
 * Save seen IDs to persistent storage
 */
async function saveSeenIds(): Promise<void> {
  try {
    await storage.set(NOTIFICATION_STORAGE_KEYS.LAST_EMAIL_IDS, Array.from(seenEmailIds).slice(-1000));
    await storage.set(NOTIFICATION_STORAGE_KEYS.LAST_NOTIFICATION_IDS, Array.from(seenNotificationIds).slice(-500));
    await storage.set(NOTIFICATION_STORAGE_KEYS.LAST_GITHUB_IDS, Array.from(seenGitHubIds).slice(-500));
  } catch (error) {
    console.error('❌ Failed to save seen IDs:', error);
  }
}

/**
 * Get notification settings
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const enabled = await storage.get(NOTIFICATION_STORAGE_KEYS.ENABLED);
    const soundEnabled = await storage.get(NOTIFICATION_STORAGE_KEYS.SOUND_ENABLED);
    const soundVolume = await storage.get(NOTIFICATION_STORAGE_KEYS.SOUND_VOLUME);
    const soundType = await storage.get(NOTIFICATION_STORAGE_KEYS.SOUND_TYPE);
    const emailNotifications = await storage.get(NOTIFICATION_STORAGE_KEYS.EMAIL_NOTIFICATIONS);
    const messageNotifications = await storage.get(NOTIFICATION_STORAGE_KEYS.MESSAGE_NOTIFICATIONS);
    const githubNotifications = await storage.get(NOTIFICATION_STORAGE_KEYS.GITHUB_NOTIFICATIONS);
    const slackNotifications = await storage.get(NOTIFICATION_STORAGE_KEYS.SLACK_NOTIFICATIONS);
    const whatsappNotifications = await storage.get(NOTIFICATION_STORAGE_KEYS.WHATSAPP_NOTIFICATIONS);
    const doNotDisturb = await storage.get(NOTIFICATION_STORAGE_KEYS.DO_NOT_DISTURB);
    const dndStart = await storage.get(NOTIFICATION_STORAGE_KEYS.DND_START);
    const dndEnd = await storage.get(NOTIFICATION_STORAGE_KEYS.DND_END);
    
    return {
      enabled: enabled !== undefined ? enabled as boolean : DEFAULT_NOTIFICATION_SETTINGS.enabled,
      soundEnabled: soundEnabled !== undefined ? soundEnabled as boolean : DEFAULT_NOTIFICATION_SETTINGS.soundEnabled,
      soundVolume: soundVolume !== undefined ? soundVolume as number : DEFAULT_NOTIFICATION_SETTINGS.soundVolume,
      soundType: (soundType as SoundType) || DEFAULT_NOTIFICATION_SETTINGS.soundType,
      emailNotifications: emailNotifications !== undefined ? emailNotifications as boolean : DEFAULT_NOTIFICATION_SETTINGS.emailNotifications,
      messageNotifications: messageNotifications !== undefined ? messageNotifications as boolean : DEFAULT_NOTIFICATION_SETTINGS.messageNotifications,
      githubNotifications: githubNotifications !== undefined ? githubNotifications as boolean : DEFAULT_NOTIFICATION_SETTINGS.githubNotifications,
      slackNotifications: slackNotifications !== undefined ? slackNotifications as boolean : DEFAULT_NOTIFICATION_SETTINGS.slackNotifications,
      whatsappNotifications: whatsappNotifications !== undefined ? whatsappNotifications as boolean : DEFAULT_NOTIFICATION_SETTINGS.whatsappNotifications,
      doNotDisturb: doNotDisturb !== undefined ? doNotDisturb as boolean : DEFAULT_NOTIFICATION_SETTINGS.doNotDisturb,
      dndStart: (dndStart as string) || DEFAULT_NOTIFICATION_SETTINGS.dndStart,
      dndEnd: (dndEnd as string) || DEFAULT_NOTIFICATION_SETTINGS.dndEnd,
    };
  } catch (error) {
    console.error('❌ Failed to get notification settings:', error);
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

/**
 * Save notification settings
 */
export async function saveNotificationSettings(settings: Partial<NotificationSettings>): Promise<void> {
  try {
    if (settings.enabled !== undefined) {
      await storage.set(NOTIFICATION_STORAGE_KEYS.ENABLED, settings.enabled);
    }
    if (settings.soundEnabled !== undefined) {
      await storage.set(NOTIFICATION_STORAGE_KEYS.SOUND_ENABLED, settings.soundEnabled);
    }
    if (settings.soundVolume !== undefined) {
      await storage.set(NOTIFICATION_STORAGE_KEYS.SOUND_VOLUME, settings.soundVolume);
    }
    if (settings.soundType !== undefined) {
      await storage.set(NOTIFICATION_STORAGE_KEYS.SOUND_TYPE, settings.soundType);
    }
    if (settings.emailNotifications !== undefined) {
      await storage.set(NOTIFICATION_STORAGE_KEYS.EMAIL_NOTIFICATIONS, settings.emailNotifications);
    }
    if (settings.messageNotifications !== undefined) {
      await storage.set(NOTIFICATION_STORAGE_KEYS.MESSAGE_NOTIFICATIONS, settings.messageNotifications);
    }
    if (settings.githubNotifications !== undefined) {
      await storage.set(NOTIFICATION_STORAGE_KEYS.GITHUB_NOTIFICATIONS, settings.githubNotifications);
    }
    if (settings.slackNotifications !== undefined) {
      await storage.set(NOTIFICATION_STORAGE_KEYS.SLACK_NOTIFICATIONS, settings.slackNotifications);
    }
    if (settings.whatsappNotifications !== undefined) {
      await storage.set(NOTIFICATION_STORAGE_KEYS.WHATSAPP_NOTIFICATIONS, settings.whatsappNotifications);
    }
    if (settings.doNotDisturb !== undefined) {
      await storage.set(NOTIFICATION_STORAGE_KEYS.DO_NOT_DISTURB, settings.doNotDisturb);
    }
    if (settings.dndStart !== undefined) {
      await storage.set(NOTIFICATION_STORAGE_KEYS.DND_START, settings.dndStart);
    }
    if (settings.dndEnd !== undefined) {
      await storage.set(NOTIFICATION_STORAGE_KEYS.DND_END, settings.dndEnd);
    }
    console.log('🔔 Notification settings saved');
  } catch (error) {
    console.error('❌ Failed to save notification settings:', error);
  }
}

/**
 * Check if currently in Do Not Disturb period
 */
function isDoNotDisturbActive(settings: NotificationSettings): boolean {
  if (!settings.doNotDisturb) return false;
  
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  const [startHour, startMin] = settings.dndStart.split(':').map(Number);
  const [endHour, endMin] = settings.dndEnd.split(':').map(Number);
  
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;
  
  // Handle overnight DND (e.g., 22:00 - 08:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }
  
  return currentTime >= startTime && currentTime < endTime;
}

/**
 * Play notification sound
 */
export async function playNotificationSound(soundType?: SoundType): Promise<void> {
  try {
    const settings = await getNotificationSettings();
    
    if (!settings.enabled || !settings.soundEnabled) {
      console.log('🔔 Sound notifications disabled');
      return;
    }
    
    if (isDoNotDisturbActive(settings)) {
      console.log('🔔 Do Not Disturb active, skipping sound');
      return;
    }
    
    const type = soundType || settings.soundType;
    const soundInfo = NOTIFICATION_SOUNDS[type] || NOTIFICATION_SOUNDS.default;
    
    // Play different patterns based on sound type
    switch (type) {
      case 'chime':
        // Two-note chime (ascending)
        playMultiTone([
          { frequency: 880, delay: 0 },
          { frequency: 1100, delay: 150 },
        ], 200, settings.soundVolume);
        break;
      
      case 'bell':
        // Bell-like sound with harmonics
        playTone(660, 300, settings.soundVolume, 'triangle');
        setTimeout(() => playTone(1320, 200, settings.soundVolume * 0.5, 'sine'), 50);
        break;
      
      case 'pop':
        // Quick pop sound
        playTone(1400, 80, settings.soundVolume, 'sine');
        break;
      
      case 'ding':
        // Single ding
        playTone(1000, 120, settings.soundVolume, 'sine');
        break;
      
      default:
        // Default notification sound (two-tone)
        playMultiTone([
          { frequency: 880, delay: 0 },
          { frequency: 1320, delay: 100 },
        ], 150, settings.soundVolume);
        break;
    }
    
    console.log(`🔔 Playing notification sound: ${soundInfo.name}`);
  } catch (error) {
    console.error('❌ Failed to play notification sound:', error);
  }
}

/**
 * Show desktop notification with optional sound
 */
export async function showNotification(
  title: string, 
  body: string, 
  options?: { 
    playSound?: boolean;
    soundType?: SoundType;
    platform?: string;
  }
): Promise<void> {
  try {
    console.log(`🔔 showNotification called: "${title}" (body: ${body.substring(0, 50)}...)`);
    
    const settings = await getNotificationSettings();
    console.log('🔔 Current notification settings.enabled:', settings.enabled);
    
    if (!settings.enabled) {
      console.log('🔔 Notifications are globally disabled in settings');
      return;
    }
    
    if (isDoNotDisturbActive(settings)) {
      console.log('🔔 Do Not Disturb is currently active, skipping notification');
      return;
    }
    
    // Check platform-specific settings
    if (options?.platform) {
      const platform = options.platform.toLowerCase();
      console.log(`🔔 Checking platform settings for: ${platform}`);
      if (platform === 'email' && !settings.emailNotifications) {
        console.log('🔔 Email notifications disabled in settings');
        return;
      }
      if (platform === 'slack' && !settings.slackNotifications) {
        console.log('🔔 Slack notifications disabled in settings');
        return;
      }
      if (platform === 'github' && !settings.githubNotifications) {
        console.log('🔔 GitHub notifications disabled in settings');
        return;
      }
      if (platform === 'whatsapp' && !settings.whatsappNotifications) {
        console.log('🔔 WhatsApp notifications disabled in settings');
        return;
      }
      if (['message', 'messaging'].includes(platform) && !settings.messageNotifications) {
        console.log('🔔 Message notifications disabled in settings');
        return;
      }
    }
    
    // Show desktop notification via Electron
    console.log('🔔 Requesting native Electron notification...');
    if (window.electronAPI?.notification) {
      const result = await window.electronAPI.notification.show({ title, body });
      console.log(`🔔 Electron notification result from main process: ${result}`);
    } else {
      console.log('⚠️ electronAPI.notification not available in window.electronAPI');
      // Fallback to browser notification
      console.log('🔔 Attempting fallback to browser Notification API');
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        console.log(`🔔 Browser notification permission request: ${permission}`);
        if (permission === 'granted') {
          new Notification(title, { body });
        }
      }
    }
    
    // Play sound if enabled
    if (options?.playSound !== false && settings.soundEnabled) {
      console.log('🔔 Playing notification sound...');
      await playNotificationSound(options?.soundType);
    }
    
    console.log(`🔔 Notification complete: ${title}`);
  } catch (error) {
    console.error('❌ Failed to show notification:', error);
  }
}

/**
 * Check for new emails and trigger notifications
 */
export async function checkNewEmails(emails: Email[]): Promise<number> {
  if (!initialized) await initNotificationService();
  
  console.log(`🔔 Checking ${emails.length} emails for new items (${seenEmailIds.size} already seen)`);
  
  const settings = await getNotificationSettings();
  if (!settings.enabled) {
    console.log('🔔 Notifications disabled in settings');
    return 0;
  }
  if (!settings.emailNotifications) {
    console.log('🔔 Email notifications disabled in settings');
    return 0;
  }
  
  // Filter out emails we've already seen
  const newEmails = emails.filter(email => !seenEmailIds.has(email.id));
  
  console.log(`🔔 Found ${newEmails.length} new email(s) out of ${emails.length} total`);
  
  if (newEmails.length > 0) {
    // Add to seen set BEFORE showing notification to prevent duplicates
    newEmails.forEach(email => seenEmailIds.add(email.id));
    await saveSeenIds();
    
    // Show notification for new emails
    if (newEmails.length === 1) {
      const email = newEmails[0];
      console.log(`🔔 Showing notification for email from: ${email.sender}`);
      await showNotification(
        '📧 New Email',
        `From: ${email.sender}\n${email.subject}`,
        { playSound: true, platform: 'email' }
      );
    } else {
      console.log(`🔔 Showing notification for ${newEmails.length} emails`);
      await showNotification(
        '📧 New Emails',
        `You have ${newEmails.length} new emails`,
        { playSound: true, platform: 'email' }
      );
    }
  }
  
  return newEmails.length;
}

/**
 * Check for new notifications (Slack, etc.) and trigger alerts
 */
export async function checkNewNotifications(notifications: any[]): Promise<number> {
  if (!initialized) await initNotificationService();
  
  const settings = await getNotificationSettings();
  if (!settings.enabled || !settings.slackNotifications) return 0;
  
  const newNotifs = notifications.filter(n => !seenNotificationIds.has(n.id));
  
  if (newNotifs.length > 0) {
    console.log(`🔔 Found ${newNotifs.length} new notification(s)`);
    
    newNotifs.forEach(n => seenNotificationIds.add(n.id));
    await saveSeenIds();
    
    if (newNotifs.length === 1) {
      const notif = newNotifs[0];
      await showNotification(
        notif.title || 'New Message',
        notif.body || notif.message || 'You have a new message',
        { playSound: true, platform: 'message' }
      );
    } else {
      await showNotification(
        'New Messages',
        `You have ${newNotifs.length} new messages`,
        { playSound: true, platform: 'message' }
      );
    }
  }
  
  return newNotifs.length;
}

/**
 * Check for new GitHub activity and trigger notifications
 */
export async function checkNewGitHubActivity(items: any[]): Promise<number> {
  if (!initialized) await initNotificationService();
  
  const settings = await getNotificationSettings();
  if (!settings.enabled || !settings.githubNotifications) return 0;
  
  const newItems = items.filter(item => !seenGitHubIds.has(item.id));
  
  if (newItems.length > 0) {
    console.log(`🔔 Found ${newItems.length} new GitHub notification(s)`);
    
    newItems.forEach(item => seenGitHubIds.add(item.id));
    await saveSeenIds();
    
    if (newItems.length === 1) {
      const item = newItems[0];
      await showNotification(
        'GitHub Activity',
        item.title || item.subject?.title || 'New GitHub notification',
        { playSound: true, platform: 'github' }
      );
    } else {
      await showNotification(
        'GitHub Activity',
        `You have ${newItems.length} new GitHub notifications`,
        { playSound: true, platform: 'github' }
      );
    }
  }
  
  return newItems.length;
}

/**
 * Handle WhatsApp message notification
 */
export async function handleWhatsAppMessage(message: any): Promise<void> {
  if (!initialized) await initNotificationService();
  
  const settings = await getNotificationSettings();
  if (!settings.enabled || !settings.whatsappNotifications) return;
  
  // Don't notify for own messages
  if (message.isFromMe) return;
  
  await showNotification(
    message.chatName || 'WhatsApp Message',
    `${message.fromName || 'Someone'}: ${message.body?.substring(0, 100) || 'New message'}`,
    { playSound: true, platform: 'whatsapp' }
  );
}

/**
 * Handle Discord message notification
 */
export async function handleDiscordMessage(message: any): Promise<void> {
  if (!initialized) await initNotificationService();
  
  const settings = await getNotificationSettings();
  if (!settings.enabled || !settings.messageNotifications) return;
  
  // Don't notify for own messages
  if (message.isFromMe) return;
  
  // Create a descriptive title
  const title = message.guildName ? `Discord (${message.guildName})` : 'Discord DM';
  const sender = message.author || 'Someone';
  const prefix = message.isDM ? sender : `${sender} in #${message.channelName}`;
  
  await showNotification(
    title,
    `${prefix}: ${message.content?.substring(0, 100) || 'New message'}`,
    { playSound: true, platform: 'messaging' }
  );
}

/**
 * Handle Telegram message notification
 */
export async function handleTelegramMessage(message: any): Promise<void> {
  if (!initialized) await initNotificationService();
  
  const settings = await getNotificationSettings();
  if (!settings.enabled || !settings.messageNotifications) return;
  
  // Don't notify for own messages
  if (message.isFromMe) return;
  
  await showNotification(
    message.chatName || 'Telegram Message',
    `${message.senderName || 'Someone'}: ${message.text?.substring(0, 100) || 'New message'}`,
    { playSound: true, platform: 'messaging' }
  );
}

/**
 * Test notification sound
 */
export async function testNotificationSound(soundType?: SoundType): Promise<void> {
  console.log('🔔 Testing notification sound...');
  // For testing, bypass the settings check
  const type = soundType || 'default';
  const settings = await getNotificationSettings();
  
  switch (type) {
    case 'chime':
      playMultiTone([
        { frequency: 880, delay: 0 },
        { frequency: 1100, delay: 150 },
      ], 200, settings.soundVolume);
      break;
    case 'bell':
      playTone(660, 300, settings.soundVolume, 'triangle');
      setTimeout(() => playTone(1320, 200, settings.soundVolume * 0.5, 'sine'), 50);
      break;
    case 'pop':
      playTone(1400, 80, settings.soundVolume, 'sine');
      break;
    case 'ding':
      playTone(1000, 120, settings.soundVolume, 'sine');
      break;
    default:
      playMultiTone([
        { frequency: 880, delay: 0 },
        { frequency: 1320, delay: 100 },
      ], 150, settings.soundVolume);
      break;
  }
  console.log(`🔔 Test sound played: ${type}`);
}

/**
 * Send a test notification (bypasses all checks)
 */
export async function sendTestNotification(): Promise<void> {
  console.log('🔔 Sending test notification...');
  
  // Show desktop notification via Electron
  if (window.electronAPI?.notification) {
    const result = await window.electronAPI.notification.show({ 
      title: '🔔 Test Notification', 
      body: 'aethermsaid hub notifications are working!' 
    });
    console.log(`🔔 Test notification result: ${result}`);
  }
  
  // Play sound
  const settings = await getNotificationSettings();
  playMultiTone([
    { frequency: 880, delay: 0 },
    { frequency: 1320, delay: 100 },
  ], 150, settings.soundVolume);
  
  console.log('🔔 Test notification complete');
}

/**
 * Reset seen IDs (useful for testing)
 */
export async function resetSeenIds(): Promise<void> {
  seenEmailIds.clear();
  seenNotificationIds.clear();
  seenGitHubIds.clear();
  await saveSeenIds();
  console.log('🔔 Seen IDs reset - next sync will trigger notifications for all items');
}

export default {
  initNotificationService,
  getNotificationSettings,
  saveNotificationSettings,
  playNotificationSound,
  showNotification,
  checkNewEmails,
  checkNewNotifications,
  checkNewGitHubActivity,
  handleWhatsAppMessage,
  testNotificationSound,
  sendTestNotification,
  resetSeenIds,
  NOTIFICATION_SOUNDS,
  DEFAULT_NOTIFICATION_SETTINGS,
};
