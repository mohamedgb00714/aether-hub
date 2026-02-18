import { v4 as uuidv4 } from 'uuid';
import { database } from '../../database.js';

export interface AgentMemoryInput {
  agent_id: string;
  type: string;
  content: string;
  metadata?: string | null;
  website_domain?: string | null;
  importance?: number;
}

export class AgentMemoryService {
  async addMemory(input: AgentMemoryInput): Promise<string> {
    const db = database['db'];
    if (!db) throw new Error('Database not initialized');

    const id = uuidv4();
    db.prepare(`
      INSERT INTO agent_memories (
        id, agent_id, type, content, metadata, website_domain, importance, use_count, last_accessed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.agent_id,
      input.type,
      input.content,
      input.metadata || null,
      input.website_domain || null,
      input.importance ?? 5,
      0,
      new Date().toISOString()
    );

    return id;
  }

  async getMemories(agentId: string): Promise<any[]> {
    const db = database['db'];
    if (!db) throw new Error('Database not initialized');

    return db.prepare('SELECT * FROM agent_memories WHERE agent_id = ? ORDER BY created_at DESC').all(agentId);
  }

  async updateMemory(id: string, updates: Partial<AgentMemoryInput>): Promise<void> {
    const db = database['db'];
    if (!db) throw new Error('Database not initialized');

    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });

    if (!fields.length) return;
    values.push(id);
    db.prepare(`UPDATE agent_memories SET ${fields.join(', ')}, last_accessed = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
  }

  async deleteMemory(id: string): Promise<void> {
    const db = database['db'];
    if (!db) throw new Error('Database not initialized');
    db.prepare('DELETE FROM agent_memories WHERE id = ?').run(id);
  }
}
