import type { AgentConfig, AgentStatus } from '../types.js';
import type { AgentRepository } from './AgentRepository.js';
import { database } from '../../database.js';

interface DbAgentRow {
  id: string;
  name: string;
  description: string;
  profile_id: string;
  telegram_bot_token: string | null;
  telegram_chat_ids: string | null;
  telegram_username: string | null;
  telegram_auto_authorize: number | null;
  personality: string;
  browser_config: string;
  execution_config: string;
  status: AgentStatus;
  last_active: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export class SqliteAgentRepository implements AgentRepository {
  async create(config: AgentConfig): Promise<string> {
    const db = database['db'];
    if (!db) throw new Error('Database not initialized');

    db.prepare(`
      INSERT INTO browser_agents (
        id, name, description, profile_id, telegram_bot_token, telegram_chat_ids,
        telegram_username, telegram_auto_authorize, personality, browser_config,
        execution_config, status, last_active, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      config.id,
      config.name,
      config.description,
      config.profileId,
      config.telegramBotToken || null,
      JSON.stringify(config.telegramChatIds || []),
      config.telegramUsername || null,
      config.telegramAutoAuthorize === false ? 0 : 1,
      JSON.stringify(config.personality),
      JSON.stringify(config.browser),
      JSON.stringify(config.execution),
      'stopped',
      null,
      null
    );

    return config.id;
  }

  async update(id: string, updates: Partial<AgentConfig>, status?: AgentStatus): Promise<void> {
    const db = database['db'];
    if (!db) throw new Error('Database not initialized');

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.profileId !== undefined) {
      fields.push('profile_id = ?');
      values.push(updates.profileId);
    }
    if (updates.telegramBotToken !== undefined) {
      fields.push('telegram_bot_token = ?');
      values.push(updates.telegramBotToken);
    }
    if (updates.telegramChatIds !== undefined) {
      fields.push('telegram_chat_ids = ?');
      values.push(JSON.stringify(updates.telegramChatIds));
    }
    if (updates.telegramUsername !== undefined) {
      fields.push('telegram_username = ?');
      values.push(updates.telegramUsername);
    }
    if (updates.telegramAutoAuthorize !== undefined) {
      fields.push('telegram_auto_authorize = ?');
      values.push(updates.telegramAutoAuthorize ? 1 : 0);
    }
    if (updates.personality !== undefined) {
      fields.push('personality = ?');
      values.push(JSON.stringify(updates.personality));
    }
    if (updates.browser !== undefined) {
      fields.push('browser_config = ?');
      values.push(JSON.stringify(updates.browser));
    }
    if (updates.execution !== undefined) {
      fields.push('execution_config = ?');
      values.push(JSON.stringify(updates.execution));
    }
    if (status) {
      fields.push('status = ?');
      values.push(status);
    }

    if (fields.length === 0) return;

    values.push(id);
    db.prepare(`UPDATE browser_agents SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
  }

  async updateStatus(id: string, status: AgentStatus, errorMessage?: string | null): Promise<void> {
    const db = database['db'];
    if (!db) throw new Error('Database not initialized');

    db.prepare(`
      UPDATE browser_agents
      SET status = ?, last_active = CURRENT_TIMESTAMP, error_message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, errorMessage || null, id);
  }

  async getById(id: string): Promise<AgentConfig | null> {
    const db = database['db'];
    if (!db) throw new Error('Database not initialized');

    const row = db.prepare('SELECT * FROM browser_agents WHERE id = ?').get(id) as DbAgentRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  async getAll(): Promise<AgentConfig[]> {
    const db = database['db'];
    if (!db) throw new Error('Database not initialized');

    const rows = db.prepare('SELECT * FROM browser_agents ORDER BY created_at DESC').all() as DbAgentRow[];
    return rows.map(row => this.mapRow(row));
  }

  async delete(id: string): Promise<void> {
    const db = database['db'];
    if (!db) throw new Error('Database not initialized');
    db.prepare('DELETE FROM browser_agents WHERE id = ?').run(id);
  }

  private mapRow(row: DbAgentRow): AgentConfig {
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      profileId: row.profile_id,
      telegramBotToken: row.telegram_bot_token || undefined,
      telegramChatIds: row.telegram_chat_ids ? JSON.parse(row.telegram_chat_ids) : [],
      telegramUsername: row.telegram_username || undefined,
      telegramAutoAuthorize: row.telegram_auto_authorize !== 0,
      personality: JSON.parse(row.personality),
      browser: JSON.parse(row.browser_config),
      execution: JSON.parse(row.execution_config)
    };
  }
}
