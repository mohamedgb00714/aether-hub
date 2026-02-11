/**
 * AI Agents Module
 * Export all agents, types, and utilities
 */

// Types
export * from './types';

// Base Agent
export { BaseAgent, getSharedChat, resetSharedChat } from './baseAgent';

// Registry
export * from './registry';

// Individual Agents (for direct import if needed)
export { FinancialPlannerAgent } from './core-life/financialPlanner';
export { LegalInfoAgent } from './core-life/legalInfo';
export { PlannerAgent } from './core-life/planner';
export { StudyAgent } from './core-life/study';

export { EmailAssistantAgent } from './productivity/emailAssistant';
export { NotesKnowledgeAgent } from './productivity/notesKnowledge';
export { FreelancerAssistantAgent } from './productivity/freelancerAssistant';
export { CodingTechnicalAgent } from './productivity/codingTechnical';

export { WellnessRoutineAgent } from './lifestyle/wellnessRoutine';
export { ShoppingDecisionAgent } from './lifestyle/shoppingDecision';
export { TravelPlannerAgent } from './lifestyle/travelPlanner';
