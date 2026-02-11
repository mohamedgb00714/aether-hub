/**
 * Notes & Knowledge Agent
 * Summarize notes, organize ideas, create structured documents, tagging
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BaseAgent } from '../baseAgent';
import { AgentInfo } from '../types';
import { db } from '../../database';

export class NotesKnowledgeAgent extends BaseAgent {
  info: AgentInfo = {
    id: 'notes-knowledge',
    name: 'Notes & Knowledge',
    icon: '📝',
    description: 'Summarize notes, organize ideas, and build structured documents with tags and links.',
    category: 'productivity',
    capabilities: [
      'Note summarization',
      'Idea organization & clustering',
      'Structured document creation',
      'Tagging & linking',
      'Meeting notes cleanup',
      'Knowledge base building',
      'Action item extraction',
      'Topic synthesis'
    ],
    examplePrompts: [
      'Summarize my notes from this week',
      'Organize these ideas into themes',
      'Create a structured document from these bullet points',
      'Tag my notes with relevant topics',
      'Extract action items from my meeting notes'
    ],
    color: 'from-violet-500 to-fuchsia-600'
  };

  getSystemPrompt(): string {
    return `You are a Notes & Knowledge AI Agent. You help users turn raw notes into structured knowledge.

YOUR CAPABILITIES:
- Summarize and clean up raw notes
- Organize ideas into themes and categories
- Create structured documents (reports, outlines, briefs)
- Tag and link related notes
- Extract action items and decisions
- Build knowledge base entries

RESPONSE FORMAT:
- Use headings and bullet lists for structure
- Provide tags and suggested links
- Include "Action Items" section when relevant
- Provide a "Summary" at the top for long notes

IMPORTANT:
- Ask for context if notes are ambiguous
- Keep structure clean and easy to scan
- Suggest follow-up questions to complete incomplete notes

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  }

  getTools(): DynamicStructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'create_note',
        description: 'Create a new note with title, content, and optional category.',
        schema: z.object({
          title: z.string(),
          content: z.string(),
          category: z.string().optional(),
          style: z.enum(['default', 'blue', 'green', 'purple', 'red', 'dark']).optional(),
          isPinned: z.boolean().optional()
        }),
        func: async ({ title, content, category = 'General', style = 'default', isPinned = false }) => {
          try {
            const note = await db.notes.upsert({
              title,
              content,
              category,
              isPinned,
              style: { color: style, fontSize: 'base' }
            });
            return `Created note: "${title}" (ID: ${note.id}).`;
          } catch (err: any) { return `Error creating note: ${err.message}`; }
        }
      }),

      new DynamicStructuredTool({
        name: 'get_notes',
        description: 'Retrieve notes, optionally filtered by category.',
        schema: z.object({
          category: z.string().optional(),
          pinnedOnly: z.boolean().optional()
        }),
        func: async ({ category, pinnedOnly }) => {
          try {
            let notes = await db.notes.getAll();
            if (category) notes = notes.filter(n => n.category.toLowerCase() === category.toLowerCase());
            if (pinnedOnly) notes = notes.filter(n => n.isPinned);
            if (notes.length === 0) return 'No notes found.';
            return JSON.stringify(notes.map(n => ({
              id: n.id,
              title: n.title,
              content: n.content,
              category: n.category,
              isPinned: n.isPinned,
              updatedAt: n.updatedAt
            })), null, 2);
          } catch (err: any) { return `Error retrieving notes: ${err.message}`; }
        }
      }),

      new DynamicStructuredTool({
        name: 'update_note',
        description: 'Update a note by ID.',
        schema: z.object({
          id: z.number(),
          title: z.string().optional(),
          content: z.string().optional(),
          category: z.string().optional(),
          style: z.enum(['default', 'blue', 'green', 'purple', 'red', 'dark']).optional(),
          isPinned: z.boolean().optional()
        }),
        func: async ({ id, title, content, category, style, isPinned }) => {
          try {
            const allNotes = await db.notes.getAll();
            const existing = allNotes.find(n => n.id === id);
            if (!existing) return `Note with ID ${id} not found.`;
            await db.notes.upsert({
              ...existing,
              ...(title !== undefined && { title }),
              ...(content !== undefined && { content }),
              ...(category !== undefined && { category }),
              ...(style !== undefined && { style: { ...existing.style, color: style } }),
              ...(isPinned !== undefined && { isPinned })
            });
            return `Updated note ${id}.`;
          } catch (err: any) { return `Error updating note: ${err.message}`; }
        }
      }),

      new DynamicStructuredTool({
        name: 'delete_note',
        description: 'Delete a note by ID.',
        schema: z.object({ id: z.number() }),
        func: async ({ id }) => {
          try { await db.notes.delete(id); return `Deleted note ${id}.`; }
          catch (err: any) { return `Error deleting note: ${err.message}`; }
        }
      })
    ];
  }
}
