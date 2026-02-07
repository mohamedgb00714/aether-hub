import { app, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { randomBytes } from 'crypto';

const KEY_FILE_NAME = '.encryption-key';

/**
 * Gets or generates a secure encryption key for electron-store.
 * On systems where safeStorage is available, it uses the OS keychain.
 * Fallback to process.env.AETHER_ENCRYPTION_KEY if provided.
 */
export function getEncryptionKey(): string {
  // 1. Priority: Environment Variable (useful for dev/ci)
  if (process.env.AETHER_ENCRYPTION_KEY) {
    return process.env.AETHER_ENCRYPTION_KEY;
  }

  // 2. SafeStorage (Production recommended)
  // safeStorage is only available when app is ready or in some contexts
  // We check if it's available and encryption is supported
  const userDataPath = app.getPath('userData');
  const keyFilePath = path.join(userDataPath, KEY_FILE_NAME);

  if (safeStorage.isEncryptionAvailable()) {
    try {
      if (fs.existsSync(keyFilePath)) {
        const encryptedKey = fs.readFileSync(keyFilePath);
        return safeStorage.decryptString(encryptedKey);
      } else {
        // Generate a new random key
        const newKey = randomBytes(32).toString('hex');
        const encryptedKey = safeStorage.encryptString(newKey);
        fs.writeFileSync(keyFilePath, encryptedKey);
        return newKey;
      }
    } catch (error) {
      console.error('Failed to use safeStorage for encryption key:', error);
    }
  }

  // 3. Fallback: Local secret (less secure but better than hardcoded one in source)
  // This might happen on some Linux setups without a secret service
  const fallbackKeyPath = path.join(userDataPath, '.fallback-key');
  if (fs.existsSync(fallbackKeyPath)) {
    return fs.readFileSync(fallbackKeyPath, 'utf8');
  } else {
    const fallbackKey = randomBytes(32).toString('hex');
    fs.writeFileSync(fallbackKeyPath, fallbackKey, 'utf8');
    return fallbackKey;
  }
}
