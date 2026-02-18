import { EventBus } from './event-bus/EventBus.js';
import { AgentManager } from './core/AgentManager.js';
import { BrowserUseRunner } from './runners/BrowserUseRunner.js';
import { SqliteAgentRepository } from './storage/SqliteAgentRepository.js';
import { TelegramAuthCodeService } from './comms/TelegramAuthCodeService.js';

export function createAgentManager(authCodes?: TelegramAuthCodeService): AgentManager {
  const repository = new SqliteAgentRepository();
  const runner = new BrowserUseRunner();
  const eventBus = new EventBus();
  const service = authCodes || new TelegramAuthCodeService();
  return new AgentManager(repository, runner, eventBus, code => service.validate(code));
}

export function createTelegramAuthCodeService(): TelegramAuthCodeService {
  return new TelegramAuthCodeService();
}
