/**
 * Study / Learning Agent
 * Summaries, explanations, quiz generation, study plans
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BaseAgent } from '../baseAgent';
import { AgentInfo } from '../types';
import storage from '../../electronStore';

const STUDY_STORAGE_KEY = 'agent_study_data';

export class StudyAgent extends BaseAgent {
  info: AgentInfo = {
    id: 'study',
    name: 'Study & Learning',
    icon: '📚',
    description: 'Study assistant for summaries, explanations, quiz generation, flashcards, and structured study plans.',
    category: 'core-life',
    capabilities: [
      'Topic summaries & explanations',
      'Quiz & test generation',
      'Flashcard creation',
      'Study plan scheduling',
      'Concept simplification',
      'Note organization',
      'Spaced repetition reminders',
      'Learning path recommendations'
    ],
    examplePrompts: [
      'Explain quantum computing in simple terms',
      'Create a quiz on JavaScript closures',
      'Make a study plan for learning Python in 4 weeks',
      'Summarize this chapter on machine learning',
      'Generate flashcards for Spanish vocabulary',
      'Explain the Feynman technique for learning'
    ],
    color: 'from-amber-500 to-orange-600'
  };

  getSystemPrompt(): string {
    return `You are a Study & Learning AI Agent. You help users learn effectively and retain knowledge.

YOUR CAPABILITIES:
- Explain complex topics at any level (ELI5 to expert)
- Create quizzes (multiple choice, true/false, fill-in-blank, open-ended)
- Generate flashcards for any topic
- Design structured study plans with spaced repetition
- Summarize content into key points
- Create mind maps and concept hierarchies
- Use learning techniques: Feynman, active recall, elaboration

TEACHING METHODS:
1. **Feynman Technique**: Explain it simply, identify gaps, refine
2. **Active Recall**: Test yourself instead of re-reading
3. **Spaced Repetition**: Review at increasing intervals
4. **Elaboration**: Connect new concepts to existing knowledge
5. **Interleaving**: Mix different topics during study

RESPONSE FORMAT:
- For explanations: Start simple, build complexity, use analogies
- For quizzes: Number questions, provide answer key at end
- For study plans: Day-by-day with specific topics and time estimates
- For flashcards: Use "Q:" and "A:" format
- Include difficulty levels: 🟢 Beginner, 🟡 Intermediate, 🔴 Advanced
- End study plans with motivation tips

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  }

  getTools(): DynamicStructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'save_study_progress',
        description: 'Save study progress, notes, or flashcards for a topic.',
        schema: z.object({
          topic: z.string().describe('The study topic'),
          type: z.enum(['notes', 'flashcards', 'quiz_score', 'study_plan']),
          data: z.string().describe('JSON string of the study data')
        }),
        func: async ({ topic, type, data }) => {
          try {
            const existing = await storage.get(STUDY_STORAGE_KEY) as any || {};
            if (!existing.topics) existing.topics = {};
            if (!existing.topics[topic]) existing.topics[topic] = {};
            existing.topics[topic][type] = JSON.parse(data);
            existing.topics[topic].lastStudied = new Date().toISOString();
            await storage.set(STUDY_STORAGE_KEY, existing);
            return `Saved ${type} for topic "${topic}".`;
          } catch (error: any) { return `Error: ${error.message}`; }
        }
      }),

      new DynamicStructuredTool({
        name: 'get_study_progress',
        description: 'Get saved study progress and data for a topic or all topics.',
        schema: z.object({
          topic: z.string().optional().describe('Specific topic (omit for all)')
        }),
        func: async ({ topic }) => {
          try {
            const data = await storage.get(STUDY_STORAGE_KEY) as any || {};
            if (!data.topics) return 'No study data saved yet.';
            if (topic) {
              const topicData = data.topics[topic];
              if (!topicData) return `No data for topic "${topic}".`;
              return JSON.stringify(topicData, null, 2);
            }
            return JSON.stringify(Object.entries(data.topics).map(([name, topicData]: [string, any]) => ({
              topic: name,
              lastStudied: topicData.lastStudied,
              hasNotes: !!topicData.notes,
              hasFlashcards: !!topicData.flashcards,
              quizScores: topicData.quiz_score || null,
              hasStudyPlan: !!topicData.study_plan
            })), null, 2);
          } catch { return 'No study data available.'; }
        }
      }),

      new DynamicStructuredTool({
        name: 'generate_quiz_template',
        description: 'Generate a quiz structure template for a topic.',
        schema: z.object({
          topic: z.string().describe('Quiz topic'),
          questionCount: z.number().optional().describe('Number of questions (default: 10)'),
          difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
          types: z.string().optional().describe('Question types: mc (multiple choice), tf (true/false), fill (fill in blank), open')
        }),
        func: async ({ topic, questionCount = 10, difficulty = 'intermediate', types = 'mc,tf' }) => {
          return JSON.stringify({
            topic,
            difficulty,
            questionCount,
            types: types.split(','),
            instructions: `Generate ${questionCount} questions about "${topic}" at ${difficulty} level. Include answer key at the end.`
          });
        }
      }),

      new DynamicStructuredTool({
        name: 'get_current_time',
        description: 'Get current date and time.',
        schema: z.object({}),
        func: async () => JSON.stringify({ date: new Date().toLocaleDateString(), day: new Date().toLocaleDateString('en-US', { weekday: 'long' }) })
      })
    ];
  }
}
