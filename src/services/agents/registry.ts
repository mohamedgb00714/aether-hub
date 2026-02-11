/**
 * Agent Registry
 * Central registry for all AI agents
 */

import { BaseAgent } from './baseAgent';
import { AgentInfo, AgentCategory } from './types';

// Core Life Agents
import { FinancialPlannerAgent } from './core-life/financialPlanner';
import { LegalInfoAgent } from './core-life/legalInfo';
import { PlannerAgent } from './core-life/planner';
import { StudyAgent } from './core-life/study';

// Productivity Agents
import { EmailAssistantAgent } from './productivity/emailAssistant';
import { NotesKnowledgeAgent } from './productivity/notesKnowledge';
import { FreelancerAssistantAgent } from './productivity/freelancerAssistant';
import { CodingTechnicalAgent } from './productivity/codingTechnical';

// Lifestyle Agents
import { WellnessRoutineAgent } from './lifestyle/wellnessRoutine';
import { ShoppingDecisionAgent } from './lifestyle/shoppingDecision';
import { TravelPlannerAgent } from './lifestyle/travelPlanner';

/**
 * Agent Registry - Singleton that manages all available agents
 */
class AgentRegistryClass {
  private agents: Map<string, BaseAgent> = new Map();
  private initialized = false;

  /**
   * Initialize all agents (lazy initialization)
   */
  private initialize() {
    if (this.initialized) return;

    // Core Life Agents
    this.register(new FinancialPlannerAgent());
    this.register(new LegalInfoAgent());
    this.register(new PlannerAgent());
    this.register(new StudyAgent());

    // Productivity Agents
    this.register(new EmailAssistantAgent());
    this.register(new NotesKnowledgeAgent());
    this.register(new FreelancerAssistantAgent());
    this.register(new CodingTechnicalAgent());

    // Lifestyle Agents
    this.register(new WellnessRoutineAgent());
    this.register(new ShoppingDecisionAgent());
    this.register(new TravelPlannerAgent());

    this.initialized = true;
  }

  /**
   * Register an agent
   */
  private register(agent: BaseAgent) {
    this.agents.set(agent.info.id, agent);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): BaseAgent[] {
    this.initialize();
    return Array.from(this.agents.values());
  }

  /**
   * Get all agent info objects
   */
  getAllAgentInfo(): AgentInfo[] {
    this.initialize();
    return Array.from(this.agents.values()).map(agent => agent.info);
  }

  /**
   * Get agents by category
   */
  getAgentsByCategory(category: AgentCategory): BaseAgent[] {
    this.initialize();
    return Array.from(this.agents.values()).filter(
      agent => agent.info.category === category
    );
  }

  /**
   * Get agent info by category
   */
  getAgentInfoByCategory(category: AgentCategory): AgentInfo[] {
    this.initialize();
    return this.getAgentsByCategory(category).map(agent => agent.info);
  }

  /**
   * Get a specific agent by ID
   */
  getAgent(id: string): BaseAgent | undefined {
    this.initialize();
    return this.agents.get(id);
  }

  /**
   * Get agent info by ID
   */
  getAgentInfo(id: string): AgentInfo | undefined {
    this.initialize();
    const agent = this.agents.get(id);
    return agent?.info;
  }

  /**
   * Search agents by name or description
   */
  searchAgents(query: string): BaseAgent[] {
    this.initialize();
    const lowerQuery = query.toLowerCase();
    return Array.from(this.agents.values()).filter(agent =>
      agent.info.name.toLowerCase().includes(lowerQuery) ||
      agent.info.description.toLowerCase().includes(lowerQuery) ||
      agent.info.capabilities.some(cap => cap.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get agent count
   */
  getCount(): number {
    this.initialize();
    return this.agents.size;
  }

  /**
   * Get counts by category
   */
  getCategoryCounts(): Record<AgentCategory, number> {
    this.initialize();
    return {
      'core-life': this.getAgentsByCategory('core-life').length,
      'productivity': this.getAgentsByCategory('productivity').length,
      'lifestyle': this.getAgentsByCategory('lifestyle').length
    };
  }
}

// Export singleton instance
export const AgentRegistry = new AgentRegistryClass();

// Export convenience functions
export function getAllAgents() {
  return AgentRegistry.getAllAgents();
}

export function getAllAgentInfo() {
  return AgentRegistry.getAllAgentInfo();
}

export function getAgentsByCategory(category: AgentCategory) {
  return AgentRegistry.getAgentsByCategory(category);
}

export function getAgentInfoByCategory(category: AgentCategory) {
  return AgentRegistry.getAgentInfoByCategory(category);
}

export function getAgent(id: string) {
  return AgentRegistry.getAgent(id);
}

export function getAgentInfo(id: string) {
  return AgentRegistry.getAgentInfo(id);
}

export function searchAgents(query: string) {
  return AgentRegistry.searchAgents(query);
}
