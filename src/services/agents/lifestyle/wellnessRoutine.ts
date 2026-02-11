/**
 * Wellness / Routine Agent
 * Habit building, work-life balance, fitness routines, burnout prevention
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BaseAgent } from '../baseAgent';
import { AgentInfo } from '../types';
import storage from '../../electronStore';

const WELLNESS_STORAGE_KEY = 'agent_wellness_data';

export class WellnessRoutineAgent extends BaseAgent {
  info: AgentInfo = {
    id: 'wellness-routine',
    name: 'Wellness & Routine',
    icon: '🏥',
    description: 'Build healthy habits, maintain work-life balance, suggest fitness routines, and prevent burnout.',
    category: 'lifestyle',
    capabilities: [
      'Habit tracking & building',
      'Work-life balance tips',
      'Simple fitness routines',
      'Burnout prevention',
      'Sleep schedule optimization',
      'Break reminders',
      'Hydration & nutrition tracking',
      'Stress management techniques'
    ],
    examplePrompts: [
      'Help me build a morning routine',
      'I feel burned out, what should I do?',
      'Create a simple 15-minute workout routine',
      'How can I improve my sleep schedule?',
      'Track my water intake today'
    ],
    color: 'from-green-500 to-emerald-600'
  };

  getSystemPrompt(): string {
    return `You are a Wellness & Routine AI Agent. You help users build healthy habits and maintain balance.

YOUR CAPABILITIES:
- Design morning/evening routines
- Track habits (exercise, water, sleep, breaks)
- Suggest simple fitness routines (no equipment needed)
- Provide burnout prevention strategies
- Optimize sleep schedules
- Recommend break schedules (Pomodoro, 52/17, etc.)
- Mindfulness and stress management techniques

IMPORTANT DISCLAIMER:
You provide general wellness information, NOT medical advice. For health concerns, users should consult healthcare professionals.

RESPONSE FORMAT:
- Provide actionable, specific suggestions
- Use bullet points and step-by-step routines
- Include timing and frequency recommendations
- Provide motivation and accountability tips
- Use emojis to make wellness advice friendly

WELLNESS PRINCIPLES:
- Start small and build gradually
- Consistency beats intensity
- Recovery is as important as activity
- Listen to your body
- Balance is personal and varies

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Current time: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  }

  getTools(): DynamicStructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'save_wellness_data',
        description: 'Save wellness tracking data (habits, routines, goals).',
        schema: z.object({
          dataType: z.enum(['habit', 'routine', 'workout', 'sleep_log', 'water_log']),
          data: z.string().describe('JSON string of wellness data')
        }),
        func: async ({ dataType, data }) => {
          try {
            const existing = await storage.get(WELLNESS_STORAGE_KEY) as any || {};
            const parsed = JSON.parse(data);
            
            switch (dataType) {
              case 'habit':
                if (!existing.habits) existing.habits = [];
                existing.habits.push({ ...parsed, createdAt: new Date().toISOString() });
                break;
              case 'routine':
                if (!existing.routines) existing.routines = {};
                existing.routines[parsed.name] = parsed;
                break;
              case 'workout':
                if (!existing.workouts) existing.workouts = [];
                existing.workouts.push({ ...parsed, date: new Date().toISOString().split('T')[0] });
                break;
              case 'sleep_log':
                if (!existing.sleep) existing.sleep = [];
                existing.sleep.push({ ...parsed, date: new Date().toISOString().split('T')[0] });
                break;
              case 'water_log':
                if (!existing.water) existing.water = [];
                existing.water.push({ ...parsed, date: new Date().toISOString().split('T')[0] });
                break;
            }
            
            await storage.set(WELLNESS_STORAGE_KEY, existing);
            return `Saved ${dataType} data.`;
          } catch (error: any) { return `Error saving: ${error.message}`; }
        }
      }),

      new DynamicStructuredTool({
        name: 'get_wellness_data',
        description: 'Retrieve wellness tracking data.',
        schema: z.object({
          dataType: z.enum(['all', 'habits', 'routines', 'workouts', 'sleep', 'water']).optional()
        }),
        func: async ({ dataType = 'all' }) => {
          try {
            const data = await storage.get(WELLNESS_STORAGE_KEY) as any || {};
            if (dataType === 'all') return JSON.stringify(data, null, 2);
            const value = data[dataType];
            if (!value || (Array.isArray(value) && value.length === 0)) {
              return `No ${dataType} data saved yet.`;
            }
            return JSON.stringify(value, null, 2);
          } catch { return 'No wellness data available.'; }
        }
      }),

      new DynamicStructuredTool({
        name: 'get_current_time',
        description: 'Get current time for scheduling.',
        schema: z.object({}),
        func: async () => JSON.stringify({
          time: new Date().toLocaleTimeString(),
          hour: new Date().getHours(),
          day: new Date().toLocaleDateString('en-US', { weekday: 'long' })
        })
      })
    ];
  }
}
