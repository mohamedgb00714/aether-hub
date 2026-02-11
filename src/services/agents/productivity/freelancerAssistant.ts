/**
 * Freelancer Assistant Agent
 * Proposal writing, client replies, pricing, contract templates, time estimation
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BaseAgent } from '../baseAgent';
import { AgentInfo } from '../types';
import storage from '../../electronStore';

const FREELANCER_STORAGE_KEY = 'agent_freelancer_data';

export class FreelancerAssistantAgent extends BaseAgent {
  info: AgentInfo = {
    id: 'freelancer-assistant',
    name: 'Freelancer Assistant',
    icon: '💼',
    description: 'Write proposals, craft client replies, suggest pricing, provide contract templates, and estimate timelines.',
    category: 'productivity',
    capabilities: [
      'Proposal writing',
      'Client communication templates',
      'Pricing guidance',
      'Contract clause templates',
      'Time estimation',
      'Scope definition',
      'Project milestone planning',
      'Invoice wording'
    ],
    examplePrompts: [
      'Write a proposal for a website redesign project',
      'Draft a reply to a client asking for a discount',
      'Suggest pricing for a 3-week mobile app project',
      'Create a freelance contract template',
      'Estimate timeline for this scope'
    ],
    color: 'from-amber-600 to-yellow-600'
  };

  getSystemPrompt(): string {
    return `You are a Freelancer Assistant AI Agent. You help freelancers win clients and deliver clearly.

YOUR CAPABILITIES:
- Write proposals tailored to client needs
- Draft client responses (professional, friendly, assertive)
- Suggest pricing approaches (fixed, hourly, retainer)
- Provide contract and scope templates (non-legal advice)
- Estimate timelines with milestones
- Define deliverables and acceptance criteria

IMPORTANT:
- Always request missing project details before finalizing pricing
- For contracts, clarify this is a template, not legal advice
- Encourage clear boundaries and scope definition
- Provide options with pros/cons (fixed vs hourly)
- Use bullet points and tables for clarity

RESPONSE FORMAT:
- Provide "Proposal Draft", "Pricing Options", "Timeline", "Scope" sections
- Include a "Questions for the Client" list
- Provide a short "Next Step" checklist

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  }

  getTools(): DynamicStructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'save_freelancer_profile',
        description: 'Save freelancer profile data (skills, rates, preferred industries).',
        schema: z.object({
          profile: z.string().describe('JSON string with freelancer profile data')
        }),
        func: async ({ profile }) => {
          try {
            const existing = await storage.get(FREELANCER_STORAGE_KEY) as any || {};
            existing.profile = JSON.parse(profile);
            existing.updatedAt = new Date().toISOString();
            await storage.set(FREELANCER_STORAGE_KEY, existing);
            return 'Freelancer profile saved.';
          } catch (err: any) { return `Error saving profile: ${err.message}`; }
        }
      }),

      new DynamicStructuredTool({
        name: 'get_freelancer_profile',
        description: 'Get saved freelancer profile data.',
        schema: z.object({}),
        func: async () => {
          try {
            const data = await storage.get(FREELANCER_STORAGE_KEY) as any || {};
            if (!data.profile) return 'No freelancer profile saved yet.';
            return JSON.stringify(data.profile, null, 2);
          } catch { return 'No profile data available.'; }
        }
      }),

      new DynamicStructuredTool({
        name: 'estimate_project_timeline',
        description: 'Estimate project timeline based on scope and complexity.',
        schema: z.object({
          scope: z.string().describe('Project scope description'),
          complexity: z.enum(['low', 'medium', 'high']).optional(),
          hoursPerWeek: z.number().optional().describe('Available hours per week')
        }),
        func: async ({ scope, complexity = 'medium', hoursPerWeek = 20 }) => {
          const baseWeeks = complexity === 'low' ? 2 : complexity === 'high' ? 8 : 4;
          const estimate = Math.ceil((baseWeeks * 40) / hoursPerWeek);
          return JSON.stringify({
            scopeSummary: scope.substring(0, 120),
            complexity,
            hoursPerWeek,
            estimatedWeeks: estimate,
            suggestedMilestones: [
              'Discovery & planning',
              'Design / architecture',
              'Implementation',
              'Testing & revisions',
              'Delivery & handoff'
            ]
          }, null, 2);
        }
      })
    ];
  }
}
