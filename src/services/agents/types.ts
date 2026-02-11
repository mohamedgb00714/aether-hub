/**
 * AI Agents Type Definitions
 * Shared types for the entire agents system
 */

export type AgentCategory = 'core-life' | 'productivity' | 'lifestyle';

export type AgentStatus = 'idle' | 'thinking' | 'using-tools' | 'responding' | 'error';

export interface AgentInfo {
  id: string;
  name: string;
  icon: string; // emoji
  description: string;
  category: AgentCategory;
  capabilities: string[];
  examplePrompts: string[];
  color: string; // tailwind gradient classes
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolsUsed?: string[];
  reasoning?: string[];
  agentId?: string;
}

export interface AgentConversation {
  id: string;
  agentId: string;
  title: string;
  messages: AgentMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentResponse {
  text: string;
  toolsUsed?: string[];
  reasoning?: string[];
  structuredData?: any;
}

export interface AgentTool {
  name: string;
  description: string;
  schema: any;
  func: (...args: any[]) => Promise<string>;
}
