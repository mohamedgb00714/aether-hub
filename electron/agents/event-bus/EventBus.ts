import { EventEmitter } from 'node:events';
import type { AgentEvent, AgentEventType } from './EventTypes.js';

export class EventBus {
  private emitter = new EventEmitter();

  publish<T>(event: AgentEvent<T>): void {
    this.emitter.emit(event.type, event);
    this.emitter.emit('*', event);
  }

  subscribe<T>(eventType: AgentEventType | '*', handler: (event: AgentEvent<T>) => void): () => void {
    this.emitter.on(eventType, handler as (event: AgentEvent) => void);
    return () => this.emitter.removeListener(eventType, handler as (event: AgentEvent) => void);
  }
}
