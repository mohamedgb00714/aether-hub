import type { AgentConfig, AgentTaskResult } from '../types.js';

export interface BrowserRunner {
  run(task: string, config: AgentConfig): Promise<AgentTaskResult>;
  startPersistent?(config: AgentConfig): Promise<void>;
  stopPersistent?(agentId: string): Promise<void>;
}
