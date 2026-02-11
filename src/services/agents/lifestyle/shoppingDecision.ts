/**
 * Shopping / Decision Agent
 * Compare options, create shopping lists, budget-aware purchases
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BaseAgent } from '../baseAgent';
import { AgentInfo } from '../types';
import storage from '../../electronStore';

const SHOPPING_STORAGE_KEY = 'agent_shopping_data';

export class ShoppingDecisionAgent extends BaseAgent {
  info: AgentInfo = {
    id: 'shopping-decision',
    name: 'Shopping & Decision',
    icon: '🛒',
    description: 'Compare product options, create smart shopping lists, and make budget-aware purchase decisions.',
    category: 'lifestyle',
    capabilities: [
      'Product comparison matrices',
      'Shopping list creation',
      'Budget-aware recommendations',
      'Value-for-money analysis',
      'Pros & cons evaluation',
      'Decision frameworks (cost/benefit)',
      'Purchase prioritization',
      'Deal evaluation'
    ],
    examplePrompts: [
      'Compare these laptop options for me',
      'Create a shopping list for a home office setup',
      'Should I buy this now or wait?',
      'Which option is the best value for money?',
      'Help me decide between these two phones'
    ],
    color: 'from-pink-500 to-rose-600'
  };

  getSystemPrompt(): string {
    return `You are a Shopping & Decision AI Agent. You help users make informed purchase decisions.

YOUR CAPABILITIES:
- Create comparison matrices for products/services
- Generate optimized shopping lists
- Evaluate value for money
- Provide decision frameworks (cost/benefit, priority matrix)
- Identify hidden costs and long-term value
- Suggest alternatives and budget options

DECISION FRAMEWORKS:
1. **Cost/Benefit Analysis**: Quantify pros and cons
2. **Priority Matrix**: Need vs Want, Urgent vs Future
3. **Opportunity Cost**: What else could this money do?
4. **Total Cost of Ownership**: Include maintenance, subscriptions
5. **Value Durability**: Cost per use/year

RESPONSE FORMAT:
- Use comparison tables for products
- Provide "Recommended Option" with reasoning
- Include "Budget Alternative" when relevant
- List "Hidden Costs" section
- End with "Decision Framework" summary

IMPORTANT:
- Always consider user's budget if mentioned
- Flag purchases that seem impulsive or unnecessary
- Suggest waiting periods for big purchases (24-72 hour rule)
- Encourage reviews and research

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  }

  getTools(): DynamicStructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'save_shopping_list',
        description: 'Save a shopping list with items and priorities.',
        schema: z.object({
          listName: z.string(),
          items: z.string().describe('JSON array of items: [{name, quantity, priority, estimatedCost, category}]')
        }),
        func: async ({ listName, items }) => {
          try {
            const existing = await storage.get(SHOPPING_STORAGE_KEY) as any || {};
            if (!existing.lists) existing.lists = {};
            existing.lists[listName] = {
              items: JSON.parse(items),
              createdAt: new Date().toISOString()
            };
            await storage.set(SHOPPING_STORAGE_KEY, existing);
            return `Saved shopping list: "${listName}" with ${JSON.parse(items).length} items.`;
          } catch (error: any) { return `Error: ${error.message}`; }
        }
      }),

      new DynamicStructuredTool({
        name: 'get_shopping_lists',
        description: 'Retrieve saved shopping lists.',
        schema: z.object({
          listName: z.string().optional()
        }),
        func: async ({ listName }) => {
          try {
            const data = await storage.get(SHOPPING_STORAGE_KEY) as any || {};
            if (!data.lists) return 'No shopping lists saved yet.';
            if (listName) {
              const list = data.lists[listName];
              if (!list) return `List "${listName}" not found.`;
              return JSON.stringify(list, null, 2);
            }
            return JSON.stringify(Object.keys(data.lists).map(name => ({
              name,
              itemCount: data.lists[name].items.length,
              createdAt: data.lists[name].createdAt
            })), null, 2);
          } catch { return 'No shopping data available.'; }
        }
      }),

      new DynamicStructuredTool({
        name: 'save_purchase_decision',
        description: 'Save a purchase decision with reasoning for future reference.',
        schema: z.object({
          item: z.string(),
          decision: z.enum(['buy', 'wait', 'skip']),
          reasoning: z.string()
        }),
        func: async ({ item, decision, reasoning }) => {
          try {
            const existing = await storage.get(SHOPPING_STORAGE_KEY) as any || {};
            if (!existing.decisions) existing.decisions = [];
            existing.decisions.push({
              item,
              decision,
              reasoning,
              date: new Date().toISOString()
            });
            await storage.set(SHOPPING_STORAGE_KEY, existing);
            return `Decision logged: ${decision} for "${item}".`;
          } catch (error: any) { return `Error: ${error.message}`; }
        }
      }),

      new DynamicStructuredTool({
        name: 'create_comparison_matrix',
        description: 'Create a structured comparison framework for products.',
        schema: z.object({
          products: z.string().describe('JSON array of products to compare'),
          criteria: z.string().optional().describe('JSON array of criteria (price, quality, features, reviews, warranty)')
        }),
        func: async ({ products, criteria }) => {
          const defaultCriteria = ['price', 'quality', 'features', 'reviews', 'warranty', 'value'];
          const criteriaList = criteria ? JSON.parse(criteria) : defaultCriteria;
          return JSON.stringify({
            products: JSON.parse(products),
            criteria: criteriaList,
            instructions: 'Rate each product on each criterion (1-10 scale)',
            weightingTip: 'Assign importance weights to criteria based on your priorities'
          }, null, 2);
        }
      })
    ];
  }
}
