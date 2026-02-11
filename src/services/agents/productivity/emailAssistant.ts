/**
 * Email Assistant Agent
 * Summarize emails, draft replies, detect important messages, extract tasks
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BaseAgent } from '../baseAgent';
import { AgentInfo } from '../types';
import { db } from '../../database';
import storage, { STORAGE_KEYS } from '../../electronStore';

export class EmailAssistantAgent extends BaseAgent {
  info: AgentInfo = {
    id: 'email-assistant',
    name: 'Email Assistant',
    icon: '✉️',
    description: 'Summarize emails, draft replies, detect important messages, and extract action items.',
    category: 'productivity',
    capabilities: [
      'Email summarization',
      'Draft replies in your tone',
      'Detect urgent/important messages',
      'Extract tasks & deadlines',
      'Inbox triage',
      'Follow-up suggestions',
      'Meeting scheduling emails',
      'Email tagging suggestions'
    ],
    examplePrompts: [
      'Summarize my unread emails',
      'Draft a reply to this client message',
      'Which emails are urgent today?',
      'Extract tasks from my inbox',
      'Write a polite follow-up email'
    ],
    color: 'from-sky-500 to-cyan-600'
  };

  getSystemPrompt(): string {
    return `You are an Email Assistant AI Agent. You help users manage their inbox effectively.

YOUR CAPABILITIES:
- Summarize email threads and unread emails
- Draft replies in the user's preferred tone
- Detect urgent or important messages
- Extract tasks, deadlines, and follow-ups
- Suggest labels and organization

IMPORTANT RULES:
- Always check for tone preferences in knowledge context if available
- Ask before sending if user hasn't confirmed
- Include subject line suggestions for new emails
- Use clear, concise summaries

RESPONSE FORMAT:
- Use bullet points for summaries
- Provide "Draft Reply:" section when drafting emails
- Highlight deadlines and action items
- Provide a confidence note if unsure about tone

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  }

  getTools(): DynamicStructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'get_unread_emails',
        description: 'Get unread emails with details.',
        schema: z.object({
          limit: z.number().optional().describe('Max results (default: 20)')
        }),
        func: async ({ limit = 20 }) => {
          const emails = await db.emails.getUnread();
          if (emails.length === 0) return 'No unread emails.';
          return JSON.stringify(emails.slice(0, limit).map(e => ({
            id: e.id,
            subject: e.subject,
            sender: e.sender,
            preview: e.preview,
            timestamp: new Date(e.timestamp).toLocaleString(),
            isImportant: e.isImportant
          })), null, 2);
        }
      }),

      new DynamicStructuredTool({
        name: 'search_emails',
        description: 'Search emails by keywords in subject or sender.',
        schema: z.object({
          query: z.string(),
          limit: z.number().optional()
        }),
        func: async ({ query, limit = 10 }) => {
          const all = await db.emails.getAll();
          const searchLower = query.toLowerCase();
          const matches = all.filter(e => e.subject.toLowerCase().includes(searchLower) || e.sender.toLowerCase().includes(searchLower)).slice(0, limit);
          if (matches.length === 0) return `No emails found matching "${query}".`;
          return JSON.stringify(matches.map(e => ({
            id: e.id,
            subject: e.subject,
            sender: e.sender,
            preview: e.preview,
            timestamp: new Date(e.timestamp).toLocaleString()
          })), null, 2);
        }
      }),

      new DynamicStructuredTool({
        name: 'get_important_emails',
        description: 'Get emails marked as important.',
        schema: z.object({
          limit: z.number().optional()
        }),
        func: async ({ limit = 15 }) => {
          const all = await db.emails.getAll();
          const important = all.filter(e => e.isImportant).slice(0, limit);
          if (important.length === 0) return 'No important emails found.';
          return JSON.stringify(important.map(e => ({
            id: e.id,
            subject: e.subject,
            sender: e.sender,
            preview: e.preview,
            timestamp: new Date(e.timestamp).toLocaleString()
          })), null, 2);
        }
      }),

      new DynamicStructuredTool({
        name: 'get_knowledge_context',
        description: 'Get knowledge context for tone preferences.',
        schema: z.object({
          category: z.string().optional()
        }),
        func: async ({ category }) => {
          try {
            const contexts = category
              ? await db.knowledgeContext.getByCategory(category)
              : await db.knowledgeContext.getAll();
            if (contexts.length === 0) return 'No knowledge context available.';
            return JSON.stringify(contexts, null, 2);
          } catch { return 'Knowledge context not available.'; }
        }
      }),

      new DynamicStructuredTool({
        name: 'get_assistant_name',
        description: 'Get assistant name for personalization.',
        schema: z.object({}),
        func: async () => {
          const name = await storage.get(STORAGE_KEYS.ASSISTANT_NAME) || 'Atlas';
          return JSON.stringify({ assistantName: name });
        }
      })
    ];
  }
}
