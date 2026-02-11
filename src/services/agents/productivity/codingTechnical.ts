/**
 * Coding / Technical Agent
 * Helps with debugging, architecture, code explanations, and best practices
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BaseAgent } from '../baseAgent';
import { AgentInfo } from '../types';

export class CodingTechnicalAgent extends BaseAgent {
  info: AgentInfo = {
    id: 'coding-technical',
    name: 'Coding & Technical',
    icon: '💻',
    description: 'Technical assistant for debugging, code explanations, architecture, and best practices.',
    category: 'productivity',
    capabilities: [
      'Code explanations & walkthroughs',
      'Debugging guidance',
      'Architecture suggestions',
      'Best practices & patterns',
      'Refactoring recommendations',
      'Performance optimizations',
      'Security tips',
      'API design advice'
    ],
    examplePrompts: [
      'Explain this error message',
      'How should I structure my React app?',
      'Review this code for best practices',
      'Suggest a refactor for this function',
      'How can I optimize database queries?'
    ],
    color: 'from-slate-700 to-gray-900'
  };

  getSystemPrompt(): string {
    return `You are a Coding & Technical AI Agent. You help developers solve technical problems.

YOUR CAPABILITIES:
- Explain code and error messages
- Suggest architecture and design patterns
- Provide debugging steps and hypotheses
- Offer best practices for security, performance, and maintainability
- Provide refactor suggestions
- Recommend testing strategies

IMPORTANT:
- Ask for code snippets or logs if missing
- Provide clear step-by-step troubleshooting
- Suggest minimal, safe changes first
- Explain tradeoffs for alternative approaches

RESPONSE FORMAT:
- Provide "Diagnosis", "Likely Causes", "Suggested Fix", "Next Steps" sections
- Include code snippets when helpful
- Provide test suggestions after fixes

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  }

  getTools(): DynamicStructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'analyze_error',
        description: 'Analyze an error message and categorize it.',
        schema: z.object({
          error: z.string().describe('Error message or stack trace')
        }),
        func: async ({ error }) => {
          const isSyntax = error.toLowerCase().includes('syntax');
          const isType = error.toLowerCase().includes('type') || error.toLowerCase().includes('undefined');
          const isNetwork = error.toLowerCase().includes('network') || error.toLowerCase().includes('fetch');
          return JSON.stringify({
            category: isSyntax ? 'syntax' : isType ? 'type/undefined' : isNetwork ? 'network' : 'general',
            errorSnippet: error.substring(0, 200),
            suggestion: 'Provide the file and line number for more precise guidance.'
          }, null, 2);
        }
      })
    ];
  }
}
