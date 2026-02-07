/**
 * Knowledge Extractor Service
 * Periodically analyzes user activities to extract insights and build knowledge context
 */

import { extractUserContext, analyzeWorkPatterns, detectCommunicationStyle, identifyFrequentContacts } from './geminiService';
import { v4 as uuidv4 } from 'uuid';

interface UserActivity {
  id: string;
  timestamp: string;
  actionType: string;
  platform: string;
  entityId?: string;
  contextJson?: any;
  participants?: string[];
  topics?: string[];
  createdAt: string;
}

class KnowledgeExtractor {
  private extractionInterval: NodeJS.Timeout | null = null;
  private isExtracting: boolean = false;
  private extractionFrequency: number = 60 * 60 * 1000; // 1 hour in milliseconds

  /**
   * Start background knowledge extraction
   */
  start(frequencyMinutes: number = 60): void {
    this.extractionFrequency = frequencyMinutes * 60 * 1000;
    
    // Run initial extraction after 5 minutes
    setTimeout(() => this.runExtraction(), 5 * 60 * 1000);
    
    // Schedule periodic extraction
    this.extractionInterval = setInterval(
      () => this.runExtraction(),
      this.extractionFrequency
    );
    
    console.log(`🧠 Knowledge extraction started (every ${frequencyMinutes} minutes)`);
  }

  /**
   * Stop background extraction
   */
  stop(): void {
    if (this.extractionInterval) {
      clearInterval(this.extractionInterval);
      this.extractionInterval = null;
      console.log('🧠 Knowledge extraction stopped');
    }
  }

  /**
   * Run knowledge extraction from recent activities
   */
  async runExtraction(): Promise<void> {
    if (this.isExtracting) {
      console.log('⏭️ Skipping extraction - already in progress');
      return;
    }

    this.isExtracting = true;
    console.log('🧠 Starting knowledge extraction...');

    try {
      // Get recent activities (last 7 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const activities: UserActivity[] = await window.electronAPI.db.userActivities.getByDateRange(
        startDate.toISOString(),
        endDate.toISOString()
      );

      if (activities.length === 0) {
        console.log('ℹ️ No activities to analyze');
        return;
      }

      console.log(`📊 Analyzing ${activities.length} activities...`);

      // Extract user context
      await this.extractContextFromActivities(activities);

      // Analyze work patterns
      await this.extractWorkPatterns(activities);

      // Identify frequent contacts
      await this.extractFrequentContacts(activities);

      // Detect communication style from sent messages
      await this.extractCommunicationStyle(activities);

      console.log('✅ Knowledge extraction completed');
    } catch (error) {
      console.error('❌ Knowledge extraction failed:', error);
    } finally {
      this.isExtracting = false;
    }
  }

  /**
   * Extract general user context
   */
  private async extractContextFromActivities(activities: UserActivity[]): Promise<void> {
    try {
      const context = await extractUserContext(activities);

      // Save work hours
      if (context.workHours) {
        await window.electronAPI.db.knowledgeContext.upsert({
          id: uuidv4(),
          category: 'work_hours',
          key: 'schedule',
          value: JSON.stringify(context.workHours),
          confidence: 75,
        });

        await window.electronAPI.db.knowledgeInsights.create({
          id: uuidv4(),
          category: 'Work Habits',
          fact: `Typically works ${context.workHours.start} to ${context.workHours.end}, active on ${context.workHours.days.join(', ')}`,
          confidence: 75,
        });
      }

      // Save response style
      if (context.responseStyle) {
        await window.electronAPI.db.knowledgeContext.upsert({
          id: uuidv4(),
          category: 'response_style',
          key: 'preferences',
          value: JSON.stringify(context.responseStyle),
          confidence: 70,
        });
      }

      // Save topics of interest
      if (context.topicsOfInterest && context.topicsOfInterest.length > 0) {
        await window.electronAPI.db.knowledgeContext.upsert({
          id: uuidv4(),
          category: 'topics_of_interest',
          key: 'main_topics',
          value: JSON.stringify(context.topicsOfInterest),
          confidence: 65,
        });

        await window.electronAPI.db.knowledgeInsights.create({
          id: uuidv4(),
          category: 'Interests',
          fact: `Primary topics: ${context.topicsOfInterest.slice(0, 5).join(', ')}`,
          confidence: 65,
        });
      }

      // Save meeting preferences
      if (context.meetingPreferences) {
        await window.electronAPI.db.knowledgeContext.upsert({
          id: uuidv4(),
          category: 'meeting_preferences',
          key: 'schedule',
          value: JSON.stringify(context.meetingPreferences),
          confidence: 70,
        });
      }
    } catch (error) {
      console.error('Error extracting user context:', error);
    }
  }

  /**
   * Extract work patterns
   */
  private async extractWorkPatterns(activities: UserActivity[]): Promise<void> {
    try {
      const patterns = await analyzeWorkPatterns(activities);

      await window.electronAPI.db.knowledgeContext.upsert({
        id: uuidv4(),
        category: 'work_patterns',
        key: 'activity_stats',
        value: JSON.stringify(patterns),
        confidence: 80,
      });

      if (patterns.peakHours.length > 0) {
        await window.electronAPI.db.knowledgeInsights.create({
          id: uuidv4(),
          category: 'Work Habits',
          fact: `Most active during ${patterns.peakHours.join(', ')}`,
          confidence: 80,
        });
      }

      if (patterns.activeDays.length > 0) {
        await window.electronAPI.db.knowledgeInsights.create({
          id: uuidv4(),
          category: 'Work Habits',
          fact: `Most active on ${patterns.activeDays.slice(0, 3).join(', ')}`,
          confidence: 80,
        });
      }
    } catch (error) {
      console.error('Error extracting work patterns:', error);
    }
  }

  /**
   * Extract frequent contacts
   */
  private async extractFrequentContacts(activities: UserActivity[]): Promise<void> {
    try {
      const contacts = await identifyFrequentContacts(activities);

      if (contacts.length > 0) {
        await window.electronAPI.db.knowledgeContext.upsert({
          id: uuidv4(),
          category: 'important_contacts',
          key: 'frequent',
          value: JSON.stringify(contacts.slice(0, 20)),
          confidence: 85,
        });

        // Add insights for top 3 contacts
        for (let i = 0; i < Math.min(3, contacts.length); i++) {
          const contact = contacts[i];
          await window.electronAPI.db.knowledgeInsights.create({
            id: uuidv4(),
            category: 'Contacts',
            fact: `Frequently interacts with ${contact.email} (${contact.interactionCount} times across ${contact.platforms.join(', ')})`,
            confidence: 85,
          });
        }
      }
    } catch (error) {
      console.error('Error extracting frequent contacts:', error);
    }
  }

  /**
   * Extract communication style
   */
  private async extractCommunicationStyle(activities: UserActivity[]): Promise<void> {
    try {
      // Get sent emails and messages
      const sentMessages = activities
        .filter(a => a.actionType === 'email_send' || a.actionType === 'message_send')
        .map(a => ({
          body: a.contextJson?.body || a.contextJson?.messagePreview || '',
          platform: a.platform,
        }))
        .filter(m => m.body.length > 10);

      if (sentMessages.length < 5) return; // Need at least 5 messages

      const style = await detectCommunicationStyle(sentMessages);

      await window.electronAPI.db.knowledgeContext.upsert({
        id: uuidv4(),
        category: 'communication_style',
        key: 'writing',
        value: JSON.stringify(style),
        confidence: 70,
      });

      await window.electronAPI.db.knowledgeInsights.create({
        id: uuidv4(),
        category: 'Communication',
        fact: `Communication style is ${style.tone} with ${style.formality} formality (avg ${style.avgLength} words)`,
        confidence: 70,
      });
    } catch (error) {
      console.error('Error extracting communication style:', error);
    }
  }

  /**
   * Manually trigger extraction
   */
  async extractNow(): Promise<void> {
    await this.runExtraction();
  }

  /**
   * Update extraction frequency
   */
  updateFrequency(minutes: number): void {
    this.stop();
    this.start(minutes);
  }
}

// Export singleton instance
export const knowledgeExtractor = new KnowledgeExtractor();
