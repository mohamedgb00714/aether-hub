import { randomBytes } from 'node:crypto';

interface AuthCodeEntry {
  agentId: string;
  expiresAt: number;
}

export class TelegramAuthCodeService {
  private codes = new Map<string, AuthCodeEntry>();

  generate(agentId: string, ttlMs: number = 5 * 60 * 1000): string {
    const code = `AETH-${randomBytes(3).toString('hex').toUpperCase()}`;
    this.codes.set(code, { agentId, expiresAt: Date.now() + ttlMs });
    return code;
  }

  validate(code: string): string | null {
    const entry = this.codes.get(code);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.codes.delete(code);
      return null;
    }
    this.codes.delete(code);
    return entry.agentId;
  }
}
