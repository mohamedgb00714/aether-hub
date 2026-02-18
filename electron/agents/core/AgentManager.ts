import { v4 as uuidv4 } from 'uuid';
import type { AgentConfig, AgentStatus, AgentSummary, HubEvent } from '../types.js';
import type { AgentRepository } from '../storage/AgentRepository.js';
import type { BrowserRunner } from '../runners/BrowserRunner.js';
import { BrowserAgent } from './BrowserAgent.js';
import { EventBus } from '../event-bus/EventBus.js';

export class AgentManager {
  private agents = new Map<string, BrowserAgent>();
  private onStatusChanged: ((summary: AgentSummary) => void) | null = null;

  constructor(
    private repository: AgentRepository,
    private runner: BrowserRunner,
    private eventBus: EventBus,
    private validateTelegramCode?: (code: string) => string | null
  ) {
    this.eventBus.subscribe('*', event => this.handleEvent(event));
  }

  async initialize(): Promise<void> {
    const configs = await this.repository.getAll();
    configs.forEach(config => this.ensureAgent(config));
  }

  setStatusHandler(handler: (summary: AgentSummary) => void): void {
    this.onStatusChanged = handler;
  }

  async createAgent(input: Omit<AgentConfig, 'id'>): Promise<AgentSummary> {
    const config: AgentConfig = { ...input, id: uuidv4() };
    await this.repository.create(config);
    const agent = this.ensureAgent(config);
    return this.toSummary(agent, 'stopped');
  }

  async updateAgent(id: string, updates: Partial<AgentConfig>): Promise<void> {
    await this.repository.update(id, updates);
    const updated = await this.repository.getById(id);
    if (updated) this.ensureAgent(updated);
  }

  async deleteAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (agent) await agent.stop();
    this.agents.delete(id);
    await this.repository.delete(id);
  }

  async startAgent(id: string): Promise<void> {
    const agent = await this.getOrLoadAgent(id);
    await agent.start();
    await this.repository.updateStatus(id, 'running');
    this.emitStatus(agent, 'running');
  }

  async stopAgent(id: string): Promise<void> {
    const agent = await this.getOrLoadAgent(id);
    await agent.stop();
    await this.repository.updateStatus(id, 'stopped');
    this.emitStatus(agent, 'stopped');
  }

  async runTask(id: string, task: string): Promise<any> {
    const agent = await this.getOrLoadAgent(id);
    return agent.runTask(task);
  }

  async getAll(): Promise<AgentSummary[]> {
    const configs = await this.repository.getAll();
    return configs.map(config => {
      const agent = this.ensureAgent(config);
      return this.toSummary(agent, agent.getStatus());
    });
  }

  async getById(id: string): Promise<AgentConfig | null> {
    return this.repository.getById(id);
  }

  getAuthorizedChatIds(id: string): string[] {
    const agent = this.agents.get(id);
    return agent?.getAuthorizedChatIds() || [];
  }

  publishEvent(event: HubEvent): void {
    this.eventBus.publish(event);
  }

  private async getOrLoadAgent(id: string): Promise<BrowserAgent> {
    const existing = this.agents.get(id);
    if (existing) return existing;

    const config = await this.repository.getById(id);
    if (!config) throw new Error('Agent not found');

    return this.ensureAgent(config);
  }

  private ensureAgent(config: AgentConfig): BrowserAgent {
    const existing = this.agents.get(config.id);
    if (existing) {
      existing.updateConfig(config);
      return existing;
    }

    const agent = new BrowserAgent(
      config,
      this.runner,
      this.eventBus,
      async updates => this.repository.update(config.id, updates),
      this.validateTelegramCode
    );
    this.agents.set(config.id, agent);
    return agent;
  }

  private emitStatus(agent: BrowserAgent, status: AgentStatus): void {
    if (!this.onStatusChanged) return;
    this.onStatusChanged(this.toSummary(agent, status));
  }

  private toSummary(agent: BrowserAgent, status: AgentStatus): AgentSummary {
    const config = agent.getConfig();
    return {
      id: config.id,
      name: config.name,
      description: config.description,
      status,
      profileId: config.profileId,
      telegramUsername: config.telegramUsername,
      lastActive: null
    };
  }

  private async handleEvent(event: HubEvent): Promise<void> {
    if (event.type !== 'watch:item_triggered' && event.type !== 'watch:action_created') return;

    const configs = await this.repository.getAll();
    const agents = configs.map(config => this.ensureAgent(config));

    for (const agent of agents) {
      await agent.handleEvent(event);
    }
  }
}
