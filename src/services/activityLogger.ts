/**
 * Activity Logger Service
 * Tracks all user actions across platforms for knowledge extraction
 */

import { v4 as uuidv4 } from 'uuid';

export type ActionType = 
  | 'email_send' 
  | 'email_read' 
  | 'email_reply' 
  | 'email_star' 
  | 'email_archive'
  | 'message_send' 
  | 'message_read'
  | 'event_attend'
  | 'event_create'
  | 'github_action'
  | 'chat_message';

export interface ActivityContext {
  subject?: string;
  body?: string;
  sender?: string;
  recipient?: string;
  messagePreview?: string;
  eventTitle?: string;
  repositoryName?: string;
  [key: string]: any;
}

interface UserActivity {
  id: string;
  timestamp: string;
  actionType: ActionType;
  platform: string;
  entityId?: string;
  contextJson?: ActivityContext;
  participants?: string[];
  topics?: string[];
}

class ActivityLogger {
  private enabled: boolean = true;
  private batchQueue: Omit<UserActivity, 'createdAt'>[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 2000; // 2 seconds

  /**
   * Log a user activity
   */
  async logActivity(
    actionType: ActionType,
    platform: string,
    options: {
      entityId?: string;
      context?: ActivityContext;
      participants?: string[];
      topics?: string[];
    } = {}
  ): Promise<void> {
    if (!this.enabled) return;

    const activity: Omit<UserActivity, 'createdAt'> = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      actionType,
      platform,
      entityId: options.entityId,
      contextJson: options.context,
      participants: options.participants,
      topics: options.topics,
    };

    // Add to batch queue
    this.batchQueue.push(activity);

    // Schedule batch insert
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    this.batchTimeout = setTimeout(() => this.flushBatch(), this.BATCH_DELAY);
  }

  /**
   * Flush the batch queue to database
   */
  private async flushBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const activities = [...this.batchQueue];
    this.batchQueue = [];

    try {
      for (const activity of activities) {
        // Convert to database format
        const dbActivity = {
          id: activity.id,
          timestamp: activity.timestamp,
          action_type: activity.actionType,
          platform: activity.platform,
          entity_id: activity.entityId || null,
          context_json: activity.contextJson ? JSON.stringify(activity.contextJson) : null,
          participants: activity.participants ? JSON.stringify(activity.participants) : null,
          topics: activity.topics ? JSON.stringify(activity.topics) : null,
        };
        await window.electronAPI.db.userActivities.insert(dbActivity);
      }
      console.log(`✅ Logged ${activities.length} activities`);
    } catch (error) {
      console.error('❌ Failed to log activities:', error);
      // Re-add failed activities to queue
      this.batchQueue.unshift(...activities);
    }
  }

  /**
   * Log email action
   */
  async logEmail(
    action: 'send' | 'read' | 'reply' | 'star' | 'archive',
    platform: string,
    emailId: string,
    context: {
      subject?: string;
      sender?: string;
      recipient?: string;
      topics?: string[];
    }
  ): Promise<void> {
    await this.logActivity(`email_${action}` as ActionType, platform, {
      entityId: emailId,
      context: {
        subject: context.subject,
        sender: context.sender,
        recipient: context.recipient,
      },
      participants: [context.sender, context.recipient].filter(Boolean) as string[],
      topics: context.topics,
    });
  }

  /**
   * Log message action
   */
  async logMessage(
    action: 'send' | 'read',
    platform: string,
    messageId: string,
    context: {
      chatName?: string;
      messagePreview?: string;
      participants?: string[];
      topics?: string[];
    }
  ): Promise<void> {
    await this.logActivity(`message_${action}` as ActionType, platform, {
      entityId: messageId,
      context: {
        chatName: context.chatName,
        messagePreview: context.messagePreview,
      },
      participants: context.participants,
      topics: context.topics,
    });
  }

  /**
   * Log calendar event action
   */
  async logCalendar(
    action: 'attend' | 'create',
    platform: string,
    eventId: string,
    context: {
      title?: string;
      attendees?: string[];
      topics?: string[];
    }
  ): Promise<void> {
    await this.logActivity(`event_${action}` as ActionType, platform, {
      entityId: eventId,
      context: {
        eventTitle: context.title,
      },
      participants: context.attendees,
      topics: context.topics,
    });
  }

  /**
   * Log GitHub action
   */
  async logGitHub(
    platform: string,
    itemId: string,
    context: {
      type?: string;
      repository?: string;
      title?: string;
      topics?: string[];
    }
  ): Promise<void> {
    await this.logActivity('github_action', platform, {
      entityId: itemId,
      context: {
        type: context.type,
        repositoryName: context.repository,
        title: context.title,
      },
      topics: context.topics,
    });
  }

  /**
   * Log chat message
   */
  async logChat(
    messageId: string,
    context: {
      topics?: string[];
    }
  ): Promise<void> {
    await this.logActivity('chat_message', 'atlas', {
      entityId: messageId,
      context: {},
      topics: context.topics,
    });
  }

  /**
   * Enable/disable activity logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchQueue = [];
    }
  }

  /**
   * Get recent activities
   */
  async getRecentActivities(limit: number = 100): Promise<any[]> {
    return await window.electronAPI.db.userActivities.getAll(limit);
  }

  /**
   * Clean up old activities
   */
  async cleanupOldActivities(days: number = 90): Promise<void> {
    await window.electronAPI.db.userActivities.deleteOlderThan(days);
  }
}

// Export singleton instance
export const activityLogger = new ActivityLogger();
