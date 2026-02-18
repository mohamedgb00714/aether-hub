import type { BrowserAgent } from '../core/BrowserAgent.js';

export interface AgentSkillContext {
  agent: BrowserAgent;
  taskId?: string;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  execute: (params: any, context: AgentSkillContext) => Promise<any>;
}

export class SkillRegistry {
  private readonly skills = new Map<string, AgentSkill>();

  register(skill: AgentSkill): void {
    this.skills.set(skill.id, skill);
  }

  get(id: string): AgentSkill | undefined {
    return this.skills.get(id);
  }

  list(): AgentSkill[] {
    return Array.from(this.skills.values());
  }
}
