export type AgentEventType =
  | 'agent:status'
  | 'agent:task_completed'
  | 'agent:task_failed'
  | 'watch:item_triggered'
  | 'watch:action_created';

export interface AgentEvent<T = any> {
  id: string;
  type: AgentEventType;
  data: T;
  createdAt: string;
}
