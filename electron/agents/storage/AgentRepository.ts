import type { AgentConfig, AgentStatus } from '../types.js';

export interface AgentRepository {
  create(config: AgentConfig): Promise<string>;
  update(id: string, updates: Partial<AgentConfig>, status?: AgentStatus): Promise<void>;
  updateStatus(id: string, status: AgentStatus, errorMessage?: string | null): Promise<void>;
  getById(id: string): Promise<AgentConfig | null>;
  getAll(): Promise<AgentConfig[]>;
  delete(id: string): Promise<void>;
}
