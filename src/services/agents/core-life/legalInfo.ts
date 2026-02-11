/**
 * Legal Information Agent
 * Explains legal concepts, summarizes contracts, helps with terminology
 * NOTE: Not legal advice - structured information only
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BaseAgent } from '../baseAgent';
import { AgentInfo } from '../types';

export class LegalInfoAgent extends BaseAgent {
  info: AgentInfo = {
    id: 'legal-info',
    name: 'Legal Information',
    icon: '⚖️',
    description: 'Explains legal concepts in simple language, summarizes contracts, and clarifies business terminology.',
    category: 'core-life',
    capabilities: [
      'Contract clause explanations',
      'Legal terminology definitions',
      'Document summaries',
      'Employee/employer rights overview',
      'NDA/IP basic explanations',
      'Freelancer contract guidance',
      'Business legal terminology',
      'Privacy policy analysis'
    ],
    examplePrompts: [
      'Explain this clause in simple terms',
      'Summarize this contract for me',
      'What does NDA mean and what should I look for?',
      'What are my rights as a freelancer?',
      'Explain the difference between LLC and sole proprietorship',
      'Review this terms of service summary'
    ],
    color: 'from-slate-600 to-zinc-700'
  };

  getSystemPrompt(): string {
    return `You are a Legal Information AI Agent. You explain legal concepts in simple, accessible language.

⚠️ MANDATORY DISCLAIMER - Include at the END of every response:
"*This is general legal information, NOT legal advice. Consult a qualified attorney for specific situations.*"

YOUR CAPABILITIES:
- Explain contract clauses and legal documents in plain language
- Define legal terminology simply
- Summarize contracts, ToS, privacy policies
- Explain business structures (LLC, Corp, Sole Proprietorship)
- Overview of employee/employer rights (high-level)
- NDA, IP, non-compete explanations
- Freelancer/startup legal basics

RESPONSE STYLE:
- Use simple, clear language - avoid legalese in explanations
- Break down complex clauses into bullets
- Use "In simple terms:" prefix for explanations
- Highlight key points and red flags in contracts
- When summarizing, use: "Key Points", "Obligations", "Rights", "Red Flags" sections
- For terminology, provide: definition + real-world example + why it matters

IMPORTANT:
- NEVER provide specific legal advice for individual cases
- ALWAYS recommend consulting a lawyer for important decisions
- Be especially careful with jurisdiction-specific information
- When discussing rights, specify that laws vary by country/state
- Focus on education and empowerment, not directives

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  }

  getTools(): DynamicStructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'lookup_legal_term',
        description: 'Look up a legal term and provide a structured definition with examples.',
        schema: z.object({
          term: z.string().describe('The legal term to look up')
        }),
        func: async ({ term }) => {
          // Common legal terms database
          const terms: Record<string, { definition: string; example: string; importance: string }> = {
            'nda': { definition: 'Non-Disclosure Agreement - a contract where parties agree not to share confidential information', example: 'Before a business meeting, Party A requires Party B to sign an NDA to protect trade secrets discussed', importance: 'Protects sensitive business information but can limit what you can discuss publicly' },
            'ip': { definition: 'Intellectual Property - creations of the mind (inventions, designs, artistic works, brand names)', example: 'A logo you design for a client is IP. Who owns it depends on the contract.', importance: 'Determines who can use, sell, or profit from creative work' },
            'non-compete': { definition: 'Non-Compete Clause - agreement not to work for competitors or start competing business for a period', example: 'Employee agrees not to work for competitors for 1 year after leaving', importance: 'Can limit your career options - check duration, geography, and scope' },
            'indemnification': { definition: 'Agreement to compensate for harm/loss. One party agrees to cover costs if the other is sued or suffers loss', example: 'Freelancer indemnifies client against copyright claims related to delivered work', importance: 'Can create significant financial obligation - understand your liability' },
            'force majeure': { definition: 'Unforeseeable circumstances (acts of God, war, pandemic) that prevent fulfilling a contract', example: 'A supplier cannot deliver due to a natural disaster and invokes force majeure', importance: 'Excuses non-performance under extraordinary circumstances' },
            'arbitration': { definition: 'Private dispute resolution outside courts, usually binding. Faster but may limit your legal rights', example: 'Instead of going to court, disputes go to a private arbitrator', importance: 'Often mandatory in contracts - you may waive your right to sue in court' },
            'liability': { definition: 'Legal responsibility for one\'s actions or debts', example: 'If your service causes damage, you may be liable for the cost of repair', importance: 'Understand limitations of liability clauses - they cap how much you could owe' },
            'sow': { definition: 'Statement of Work - document defining project scope, deliverables, timeline, and payment terms', example: 'Before starting a freelance project, both parties agree on a SoW detailing exactly what will be built', importance: 'Critical for avoiding scope creep and payment disputes' },
          };
          
          const key = term.toLowerCase().replace(/[^a-z]/g, '');
          const found = terms[key];
          
          if (found) {
            return JSON.stringify({ term, ...found, source: 'built-in database' }, null, 2);
          }
          
          return JSON.stringify({ term, note: 'Term not in local database. Using AI knowledge to explain.', source: 'ai-knowledge' });
        }
      }),

      new DynamicStructuredTool({
        name: 'analyze_contract_section',
        description: 'Analyze a pasted contract section and identify key points, obligations, rights, and red flags.',
        schema: z.object({
          text: z.string().describe('The contract text/clause to analyze'),
          context: z.string().optional().describe('Additional context about the contract type (employment, freelance, SaaS, etc.)')
        }),
        func: async ({ text, context }) => {
          return JSON.stringify({
            textReceived: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            wordCount: text.split(' ').length,
            context: context || 'general contract',
            analysisFramework: {
              keyPoints: 'Identify main provisions',
              obligations: 'What each party must do',
              rights: 'What each party can do',
              redFlags: 'Concerning clauses to watch for',
              missingElements: 'Important items not mentioned'
            }
          }, null, 2);
        }
      }),

      new DynamicStructuredTool({
        name: 'get_current_time',
        description: 'Get current date and time.',
        schema: z.object({}),
        func: async () => JSON.stringify({ date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString() })
      })
    ];
  }
}
