/**
 * Planner / Scheduler Agent
 * Daily plans, schedule optimization, task prioritization, meeting preparation
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BaseAgent } from '../baseAgent';
import { AgentInfo } from '../types';
import { db } from '../../database';
import storage from '../../electronStore';

const PLANNER_STORAGE_KEY = 'agent_planner_data';

export class PlannerAgent extends BaseAgent {
  info: AgentInfo = {
    id: 'planner',
    name: 'Planner & Scheduler',
    icon: '📅',
    description: 'Organize your time, create daily plans, optimize schedules, prioritize tasks, and prepare for meetings.',
    category: 'core-life',
    capabilities: [
      'Daily plan generation',
      'Weekly schedule optimization',
      'Task prioritization (Eisenhower matrix)',
      'Meeting preparation & agendas',
      'Time blocking suggestions',
      'Calendar conflict detection',
      'Focus time recommendations',
      'Routine building'
    ],
    examplePrompts: [
      'Plan my day based on my calendar',
      'Prioritize these tasks for me',
      'Create a weekly schedule',
      'Prepare an agenda for my 2pm meeting',
      'Help me time-block my work day',
      'What should I focus on today?'
    ],
    color: 'from-blue-500 to-indigo-600'
  };

  getSystemPrompt(): string {
    return `You are a Personal Planner & Scheduler AI Agent. You help users organize time and maximize productivity.

YOUR CAPABILITIES:
- Generate optimized daily/weekly plans based on calendar events and tasks
- Prioritize tasks using Eisenhower Matrix (Urgent/Important)
- Create meeting agendas and preparation plans
- Suggest time-blocking schedules
- Detect calendar conflicts and suggest resolutions
- Recommend focus time and break periods
- Build morning/evening routines

TOOLS AVAILABLE:
You can access the user's calendar events and saved tasks to create data-driven plans.

PLANNING METHODS YOU USE:
1. **Eisenhower Matrix**: Urgent+Important / Important / Urgent / Neither
2. **Time Blocking**: Assign specific time slots for tasks
3. **Eat the Frog**: Tackle hardest task first
4. **Pomodoro Planning**: 25min work / 5min break cycles
5. **2-Minute Rule**: If it takes <2 min, do it now

RESPONSE FORMAT:
- Use clear time-based schedules with emojis for visual scanning
- Include buffer time between meetings (15-30 min)
- Mark priorities with 🔴 (urgent), 🟡 (important), 🟢 (nice-to-have)
- Group related tasks together
- Include breaks and wellness reminders
- End with "Today's Top 3 Priorities" summary

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Current time: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  }

  getTools(): DynamicStructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'get_todays_events',
        description: 'Get all calendar events for today.',
        schema: z.object({}),
        func: async () => {
          try {
            const today = new Date().toISOString().split('T')[0];
            const events = await db.events.getByDateRange(today, today);
            if (events.length === 0) return 'No calendar events today.';
            return JSON.stringify(events.map(e => ({
              title: e.title,
              start: new Date(e.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              end: new Date(e.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              location: e.location || 'No location',
              attendees: e.attendees,
              description: e.description
            })), null, 2);
          } catch { return 'Calendar data not available.'; }
        }
      }),

      new DynamicStructuredTool({
        name: 'get_upcoming_events',
        description: 'Get upcoming calendar events for the next N days.',
        schema: z.object({
          days: z.number().optional().describe('Number of days ahead (default: 7)')
        }),
        func: async ({ days = 7 }) => {
          try {
            const start = new Date().toISOString().split('T')[0];
            const end = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
            const events = await db.events.getByDateRange(start, end);
            if (events.length === 0) return `No events in the next ${days} days.`;
            return JSON.stringify(events.map(e => ({
              title: e.title,
              date: new Date(e.startTime).toLocaleDateString(),
              start: new Date(e.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              end: new Date(e.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              location: e.location,
              isAllDay: e.isAllDay
            })), null, 2);
          } catch { return 'Calendar data not available.'; }
        }
      }),

      new DynamicStructuredTool({
        name: 'save_tasks',
        description: 'Save a list of tasks with priorities for planning.',
        schema: z.object({
          tasks: z.string().describe('JSON array of tasks: [{title, priority: "high"|"medium"|"low", estimatedMinutes, category}]')
        }),
        func: async ({ tasks }) => {
          try {
            const existing = await storage.get(PLANNER_STORAGE_KEY) as any || {};
            existing.tasks = JSON.parse(tasks);
            existing.lastUpdated = new Date().toISOString();
            await storage.set(PLANNER_STORAGE_KEY, existing);
            return `Saved ${JSON.parse(tasks).length} tasks.`;
          } catch (error: any) { return `Error saving tasks: ${error.message}`; }
        }
      }),

      new DynamicStructuredTool({
        name: 'get_saved_tasks',
        description: 'Retrieve previously saved tasks.',
        schema: z.object({}),
        func: async () => {
          try {
            const data = await storage.get(PLANNER_STORAGE_KEY) as any || {};
            if (!data.tasks || data.tasks.length === 0) return 'No saved tasks.';
            return JSON.stringify(data.tasks, null, 2);
          } catch { return 'No tasks data available.'; }
        }
      }),

      new DynamicStructuredTool({
        name: 'get_unread_emails_summary',
        description: 'Get a count and summary of unread emails to factor into planning.',
        schema: z.object({}),
        func: async () => {
          try {
            const unread = await db.emails.getUnread();
            return JSON.stringify({
              unreadCount: unread.length,
              urgent: unread.filter(e => e.isImportant).length,
              topSenders: [...new Set(unread.slice(0, 10).map(e => e.sender))]
            });
          } catch { return 'Email data not available.'; }
        }
      }),

      new DynamicStructuredTool({
        name: 'get_current_time',
        description: 'Get current date and time.',
        schema: z.object({}),
        func: async () => JSON.stringify({
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString(),
          day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
          hour: new Date().getHours()
        })
      }),

      new DynamicStructuredTool({
        name: 'get_notifications_summary',
        description: 'Get summary of pending notifications for task planning.',
        schema: z.object({}),
        func: async () => {
          try {
            const notifications = await db.notifications.getUnread();
            return JSON.stringify({
              total: notifications.length,
              byPriority: {
                high: notifications.filter(n => n.priority === 'high').length,
                medium: notifications.filter(n => n.priority === 'medium').length,
                low: notifications.filter(n => n.priority === 'low').length
              }
            });
          } catch { return 'Notifications not available.'; }
        }
      })
    ];
  }
}
