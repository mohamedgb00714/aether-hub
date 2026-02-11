/**
 * Financial Planner Agent
 * Budget planning, expense analysis, savings strategies, subscription detection
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BaseAgent } from '../baseAgent';
import { AgentInfo } from '../types';
import { db } from '../../database';
import storage from '../../electronStore';

const FINANCE_STORAGE_KEY = 'agent_finance_data';

interface FinanceData {
  income?: number;
  currency?: string;
  budgets?: { category: string; limit: number; spent: number }[];
  expenses?: { description: string; amount: number; category: string; date: string; recurring?: boolean }[];
  savings_goals?: { name: string; target: number; current: number; deadline?: string }[];
  debts?: { name: string; balance: number; rate: number; minPayment: number }[];
  subscriptions?: { name: string; amount: number; frequency: string; nextDate?: string }[];
}

export class FinancialPlannerAgent extends BaseAgent {
  info: AgentInfo = {
    id: 'financial-planner',
    name: 'Financial Planner',
    icon: '💰',
    description: 'Budget planning, expense analysis, savings strategies, subscription tracking, and debt repayment planning.',
    category: 'core-life',
    capabilities: [
      'Budget creation & tracking',
      'Expense analysis & categorization',
      'Savings strategies & goals',
      'Subscription detection & management',
      'Debt repayment planning',
      'Investment education basics',
      'Bill reminders setup',
      'Income vs expense reports'
    ],
    examplePrompts: [
      'Create a monthly budget from my income of $5000',
      'How can I save 20% of my income?',
      'Analyze my spending habits',
      'Track my subscription costs',
      'Plan to pay off my $10k credit card debt',
      'What\'s the 50/30/20 rule for budgeting?'
    ],
    color: 'from-emerald-500 to-teal-600'
  };

  getSystemPrompt(): string {
    return `You are a Personal Financial Planner AI Agent. You help users manage their money wisely.

YOUR CAPABILITIES:
- Create monthly/weekly budgets using the 50/30/20 or zero-based method
- Analyze spending patterns and identify areas to cut costs
- Set up savings goals with timelines and milestones
- Detect and track recurring subscriptions
- Create debt repayment plans (avalanche vs snowball method)
- Provide basic investment education (NOT financial advice)
- Generate expense reports and visualizations

TOOLS AVAILABLE:
You have tools to save/load the user's financial data (income, expenses, budgets, goals, debts, subscriptions) locally.

IMPORTANT RULES:
- You are NOT a licensed financial advisor - always include this disclaimer for investment topics
- All data stays local on the user's device - emphasize privacy
- Use clear tables and formatting for financial data
- Always suggest actionable next steps
- Be encouraging but realistic about financial goals
- When creating budgets, ask about income first if not provided
- Format currency amounts clearly

RESPONSE STYLE:
- Use markdown tables for budgets and expense breakdowns
- Include percentage breakdowns where relevant
- Provide specific, actionable recommendations
- Use bullet points for tips and strategies

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  }

  getTools(): DynamicStructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'save_financial_data',
        description: 'Save financial data (income, expenses, budgets, goals, debts, subscriptions) to local storage.',
        schema: z.object({
          dataType: z.enum(['income', 'expense', 'budget', 'savings_goal', 'debt', 'subscription']),
          data: z.string().describe('JSON string of the financial data to save')
        }),
        func: async ({ dataType, data }) => {
          try {
            const existing = await storage.get(FINANCE_STORAGE_KEY) as FinanceData || {};
            const parsed = JSON.parse(data);
            
            switch (dataType) {
              case 'income':
                existing.income = parsed.amount;
                existing.currency = parsed.currency || 'USD';
                break;
              case 'expense':
                if (!existing.expenses) existing.expenses = [];
                existing.expenses.push({ ...parsed, date: parsed.date || new Date().toISOString().split('T')[0] });
                break;
              case 'budget':
                if (!existing.budgets) existing.budgets = [];
                const existingBudget = existing.budgets.findIndex(b => b.category === parsed.category);
                if (existingBudget >= 0) existing.budgets[existingBudget] = parsed;
                else existing.budgets.push(parsed);
                break;
              case 'savings_goal':
                if (!existing.savings_goals) existing.savings_goals = [];
                existing.savings_goals.push(parsed);
                break;
              case 'debt':
                if (!existing.debts) existing.debts = [];
                existing.debts.push(parsed);
                break;
              case 'subscription':
                if (!existing.subscriptions) existing.subscriptions = [];
                existing.subscriptions.push(parsed);
                break;
            }
            
            await storage.set(FINANCE_STORAGE_KEY, existing);
            return `Successfully saved ${dataType} data.`;
          } catch (error: any) {
            return `Error saving data: ${error.message}`;
          }
        }
      }),
      
      new DynamicStructuredTool({
        name: 'get_financial_data',
        description: 'Retrieve all saved financial data including income, expenses, budgets, goals, debts, and subscriptions.',
        schema: z.object({
          dataType: z.enum(['all', 'income', 'expenses', 'budgets', 'savings_goals', 'debts', 'subscriptions']).optional()
        }),
        func: async ({ dataType = 'all' }) => {
          try {
            const data = await storage.get(FINANCE_STORAGE_KEY) as FinanceData || {};
            
            if (dataType === 'all') return JSON.stringify(data, null, 2);
            
            const key = dataType === 'income' ? 'income' : dataType;
            const value = (data as any)[key];
            
            if (!value || (Array.isArray(value) && value.length === 0)) {
              return `No ${dataType} data saved yet.`;
            }
            
            return JSON.stringify(value, null, 2);
          } catch (error: any) {
            return `Error retrieving data: ${error.message}`;
          }
        }
      }),

      new DynamicStructuredTool({
        name: 'calculate_budget',
        description: 'Calculate a budget breakdown using a specified method (50/30/20 or zero-based) from income.',
        schema: z.object({
          income: z.number().describe('Monthly income amount'),
          method: z.enum(['50-30-20', 'zero-based']).optional().describe('Budget method (default: 50-30-20)')
        }),
        func: async ({ income, method = '50-30-20' }) => {
          if (method === '50-30-20') {
            return JSON.stringify({
              method: '50/30/20 Rule',
              income,
              breakdown: {
                needs: { percentage: 50, amount: income * 0.5, categories: ['Housing', 'Utilities', 'Food', 'Transport', 'Insurance', 'Minimum debt payments'] },
                wants: { percentage: 30, amount: income * 0.3, categories: ['Entertainment', 'Dining out', 'Hobbies', 'Subscriptions', 'Shopping'] },
                savings: { percentage: 20, amount: income * 0.2, categories: ['Emergency fund', 'Investments', 'Extra debt payments', 'Retirement'] }
              }
            }, null, 2);
          }
          return JSON.stringify({
            method: 'Zero-Based Budget',
            income,
            note: 'Every dollar is assigned a purpose. Total allocations must equal income.',
            suggestedCategories: [
              { category: 'Housing', suggestedPercent: 25 },
              { category: 'Food & Groceries', suggestedPercent: 12 },
              { category: 'Transportation', suggestedPercent: 10 },
              { category: 'Utilities', suggestedPercent: 8 },
              { category: 'Insurance', suggestedPercent: 8 },
              { category: 'Savings', suggestedPercent: 15 },
              { category: 'Debt Payments', suggestedPercent: 10 },
              { category: 'Personal', suggestedPercent: 5 },
              { category: 'Entertainment', suggestedPercent: 5 },
              { category: 'Misc', suggestedPercent: 2 }
            ]
          }, null, 2);
        }
      }),

      new DynamicStructuredTool({
        name: 'calculate_debt_payoff',
        description: 'Calculate debt payoff timeline using avalanche or snowball method.',
        schema: z.object({
          debts: z.string().describe('JSON array of debts with name, balance, rate (APR%), minPayment'),
          extraPayment: z.number().optional().describe('Extra monthly payment to add (default: 0)'),
          method: z.enum(['avalanche', 'snowball']).optional().describe('Payoff method')
        }),
        func: async ({ debts: debtsStr, extraPayment = 0, method = 'avalanche' }) => {
          const debts = JSON.parse(debtsStr);
          const sorted = [...debts].sort((a, b) => 
            method === 'avalanche' ? b.rate - a.rate : a.balance - b.balance
          );
          
          let totalInterest = 0;
          let months = 0;
          const timeline = sorted.map(d => {
            const monthlyRate = d.rate / 100 / 12;
            const payment = d.minPayment + (sorted.indexOf(d) === 0 ? extraPayment : 0);
            let balance = d.balance;
            let m = 0;
            let interest = 0;
            
            while (balance > 0 && m < 360) {
              const monthInterest = balance * monthlyRate;
              interest += monthInterest;
              balance = balance + monthInterest - payment;
              m++;
            }
            
            totalInterest += interest;
            months = Math.max(months, m);
            
            return { name: d.name, balance: d.balance, rate: d.rate, monthsToPayoff: m, totalInterest: Math.round(interest) };
          });
          
          return JSON.stringify({
            method: method === 'avalanche' ? 'Avalanche (highest interest first)' : 'Snowball (lowest balance first)',
            extraMonthlyPayment: extraPayment,
            totalMonthsToDebtFree: months,
            totalInterestPaid: Math.round(totalInterest),
            timeline
          }, null, 2);
        }
      }),

      new DynamicStructuredTool({
        name: 'get_current_time',
        description: 'Get current date and time for context.',
        schema: z.object({}),
        func: async () => JSON.stringify({ date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString(), day: new Date().toLocaleDateString('en-US', { weekday: 'long' }) })
      }),

      new DynamicStructuredTool({
        name: 'scan_emails_for_subscriptions',
        description: 'Scan stored emails for potential subscription notifications and recurring payments.',
        schema: z.object({}),
        func: async () => {
          try {
            const emails = await db.emails.getAll();
            const subscriptionKeywords = ['subscription', 'renewal', 'billing', 'invoice', 'payment', 'recurring', 'membership', 'premium', 'plan', 'auto-renew'];
            const matches = emails.filter(e => 
              subscriptionKeywords.some(k => 
                e.subject.toLowerCase().includes(k) || e.preview.toLowerCase().includes(k)
              )
            ).slice(0, 20);
            
            if (matches.length === 0) return 'No subscription-related emails found.';
            
            return JSON.stringify(matches.map(e => ({
              subject: e.subject,
              sender: e.sender,
              date: new Date(e.timestamp).toLocaleDateString(),
              preview: e.preview.substring(0, 100)
            })), null, 2);
          } catch {
            return 'Unable to scan emails. No email accounts connected.';
          }
        }
      })
    ];
  }
}
