export type AgentStatus = 'stopped' | 'starting' | 'running' | 'paused' | 'error';

export interface AgentPersonality {
  style: 'professional' | 'casual' | 'technical' | 'creative' | 'custom';
  tone: string;
  goals: string[];
  constraints: string[];
  customInstructions: string;
}

export interface AgentBrowserConfig {
  headless: boolean;
  persistent: boolean;
  viewport: { width: number; height: number };
  userAgent?: string;
  timezone?: string;
  locale?: string;
}

export interface AgentExecutionConfig {
  maxConcurrentTasks: number;
  defaultTimeout: number;
  retryAttempts: number;
  screenshotOnError: boolean;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  profileId: string;
  telegramBotToken?: string;
  telegramChatIds?: string[];
  telegramUsername?: string;
  telegramAutoAuthorize?: boolean;
  personality: AgentPersonality;
  browser: AgentBrowserConfig;
  execution: AgentExecutionConfig;
}

export interface AgentSummary {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  profileId: string;
  telegramUsername?: string;
  lastActive?: string | null;
}

export interface AgentTask {
  id: string;
  agentId: string;
  name: string;
  task: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface AgentTaskResult {
  taskId: string;
  status: 'completed' | 'failed';
  output?: string;
  error?: string;
}

export interface HubEvent<T = any> {
  id: string;
  type: string;
  data: T;
  createdAt: string;
}
