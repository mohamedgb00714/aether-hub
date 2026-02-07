/**
 * Microphone Settings Service
 * Manages settings for the floating microphone widget
 */

import { getStorageItem, setStorageItem, STORAGE_KEYS } from './electronStore';
import type { STTProvider, MicActionMode } from './speechToTextService';

// Position type for the floating mic widget
export interface MicPosition {
  edge: 'left' | 'right';
  y: number; // percentage from top (0-100)
}

// Hotkey configuration
export interface MicHotkeys {
  toggle: string;
  pushToTalk: string;
  modeSwitch: string;
}

// Complete mic settings interface
export interface MicSettings {
  provider: STTProvider;
  actionMode: MicActionMode;
  hotkeys: MicHotkeys;
  position: MicPosition;
  vadEnabled: boolean;
  vadSilenceMs: number;
  language: string;
  voiceFeedback: boolean;
  textResponseEnabled: boolean;
  ttsProvider: 'google' | 'elevenlabs';
  screenshotsEnabled: boolean;
}

// Default settings
export const DEFAULT_MIC_SETTINGS: MicSettings = {
  provider: 'webSpeech',
  actionMode: 'chat',
  hotkeys: {
    toggle: 'CommandOrControl+Shift+M',
    pushToTalk: 'CommandOrControl+Space',
    modeSwitch: 'CommandOrControl+Shift+D',
  },
  position: {
    edge: 'right',
    y: 50,
  },
  vadEnabled: true,
  vadSilenceMs: 1500,
  language: 'en-US',
  voiceFeedback: true,
  textResponseEnabled: true,
  ttsProvider: 'google',
  screenshotsEnabled: true,
};

// Available languages for STT
export const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'es-ES', name: 'Spanish (Spain)' },
  { code: 'es-MX', name: 'Spanish (Mexico)' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'ko-KR', name: 'Korean' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)' },
  { code: 'ar-SA', name: 'Arabic' },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'ru-RU', name: 'Russian' },
];

/**
 * Load all mic settings from storage
 */
export async function getMicSettings(): Promise<MicSettings> {
  const [
    provider,
    actionMode,
    hotkeyToggle,
    hotkeyPTT,
    hotkeyMode,
    position,
    vadEnabled,
    vadSilenceMs,
    language,
    screenshotsEnabled,
  ] = await Promise.all([
    getStorageItem<STTProvider>(STORAGE_KEYS.MIC_STT_PROVIDER),
    getStorageItem<MicActionMode>(STORAGE_KEYS.MIC_ACTION_MODE),
    getStorageItem<string>(STORAGE_KEYS.MIC_HOTKEY_TOGGLE),
    getStorageItem<string>(STORAGE_KEYS.MIC_HOTKEY_PUSH_TO_TALK),
    getStorageItem<string>(STORAGE_KEYS.MIC_HOTKEY_MODE_SWITCH),
    getStorageItem<MicPosition>(STORAGE_KEYS.MIC_POSITION),
    getStorageItem<boolean>(STORAGE_KEYS.MIC_VAD_ENABLED),
    getStorageItem<number>(STORAGE_KEYS.MIC_VAD_SILENCE_MS),
    getStorageItem<string>(STORAGE_KEYS.MIC_LANGUAGE),
    getStorageItem<boolean>(STORAGE_KEYS.MIC_SCREENSHOTS_ENABLED),
  ]);

  return {
    provider: provider ?? DEFAULT_MIC_SETTINGS.provider,
    actionMode: actionMode ?? DEFAULT_MIC_SETTINGS.actionMode,
    hotkeys: {
      toggle: hotkeyToggle ?? DEFAULT_MIC_SETTINGS.hotkeys.toggle,
      pushToTalk: hotkeyPTT ?? DEFAULT_MIC_SETTINGS.hotkeys.pushToTalk,
      modeSwitch: hotkeyMode ?? DEFAULT_MIC_SETTINGS.hotkeys.modeSwitch,
    },
    position: position ?? DEFAULT_MIC_SETTINGS.position,
    vadEnabled: vadEnabled ?? DEFAULT_MIC_SETTINGS.vadEnabled,
    vadSilenceMs: vadSilenceMs ?? DEFAULT_MIC_SETTINGS.vadSilenceMs,
    language: language ?? DEFAULT_MIC_SETTINGS.language,
    voiceFeedback: DEFAULT_MIC_SETTINGS.voiceFeedback,
    textResponseEnabled: DEFAULT_MIC_SETTINGS.textResponseEnabled,
    ttsProvider: DEFAULT_MIC_SETTINGS.ttsProvider,
    screenshotsEnabled: screenshotsEnabled ?? DEFAULT_MIC_SETTINGS.screenshotsEnabled,
  };
}

/**
 * Save all mic settings to storage
 */
export async function setMicSettings(settings: MicSettings): Promise<void> {
  await Promise.all([
    setStorageItem(STORAGE_KEYS.MIC_STT_PROVIDER, settings.provider),
    setStorageItem(STORAGE_KEYS.MIC_ACTION_MODE, settings.actionMode),
    setStorageItem(STORAGE_KEYS.MIC_HOTKEY_TOGGLE, settings.hotkeys.toggle),
    setStorageItem(STORAGE_KEYS.MIC_HOTKEY_PUSH_TO_TALK, settings.hotkeys.pushToTalk),
    setStorageItem(STORAGE_KEYS.MIC_HOTKEY_MODE_SWITCH, settings.hotkeys.modeSwitch),
    setStorageItem(STORAGE_KEYS.MIC_POSITION, settings.position),
    setStorageItem(STORAGE_KEYS.MIC_VAD_ENABLED, settings.vadEnabled),
    setStorageItem(STORAGE_KEYS.MIC_VAD_SILENCE_MS, settings.vadSilenceMs),
    setStorageItem(STORAGE_KEYS.MIC_LANGUAGE, settings.language),
    setStorageItem(STORAGE_KEYS.MIC_SCREENSHOTS_ENABLED, settings.screenshotsEnabled),
  ]);
}

/**
 * Update specific settings
 */
export async function updateMicSettings(updates: Partial<MicSettings>): Promise<MicSettings> {
  const current = await getMicSettings();
  const updated = {
    ...current,
    ...updates,
    hotkeys: {
      ...current.hotkeys,
      ...(updates.hotkeys || {}),
    },
    position: {
      ...current.position,
      ...(updates.position || {}),
    },
  };
  await setMicSettings(updated);
  return updated;
}

// Individual setting getters/setters for convenience

export async function getSTTProvider(): Promise<STTProvider> {
  return (await getStorageItem<STTProvider>(STORAGE_KEYS.MIC_STT_PROVIDER)) ?? DEFAULT_MIC_SETTINGS.provider;
}

export async function setSTTProvider(provider: STTProvider): Promise<void> {
  await setStorageItem(STORAGE_KEYS.MIC_STT_PROVIDER, provider);
}

export async function getActionMode(): Promise<MicActionMode> {
  return (await getStorageItem<MicActionMode>(STORAGE_KEYS.MIC_ACTION_MODE)) ?? DEFAULT_MIC_SETTINGS.actionMode;
}

export async function setActionMode(mode: MicActionMode): Promise<void> {
  await setStorageItem(STORAGE_KEYS.MIC_ACTION_MODE, mode);
}

export async function getMicPosition(): Promise<MicPosition> {
  return (await getStorageItem<MicPosition>(STORAGE_KEYS.MIC_POSITION)) ?? DEFAULT_MIC_SETTINGS.position;
}

export async function setMicPosition(position: MicPosition): Promise<void> {
  await setStorageItem(STORAGE_KEYS.MIC_POSITION, position);
}

export async function getVADEnabled(): Promise<boolean> {
  return (await getStorageItem<boolean>(STORAGE_KEYS.MIC_VAD_ENABLED)) ?? DEFAULT_MIC_SETTINGS.vadEnabled;
}

export async function setVADEnabled(enabled: boolean): Promise<void> {
  await setStorageItem(STORAGE_KEYS.MIC_VAD_ENABLED, enabled);
}

export async function getVADSilenceMs(): Promise<number> {
  return (await getStorageItem<number>(STORAGE_KEYS.MIC_VAD_SILENCE_MS)) ?? DEFAULT_MIC_SETTINGS.vadSilenceMs;
}

export async function setVADSilenceMs(ms: number): Promise<void> {
  await setStorageItem(STORAGE_KEYS.MIC_VAD_SILENCE_MS, ms);
}

export async function getMicLanguage(): Promise<string> {
  return (await getStorageItem<string>(STORAGE_KEYS.MIC_LANGUAGE)) ?? DEFAULT_MIC_SETTINGS.language;
}

export async function setMicLanguage(language: string): Promise<void> {
  await setStorageItem(STORAGE_KEYS.MIC_LANGUAGE, language);
}

export default {
  getMicSettings,
  setMicSettings,
  updateMicSettings,
  getSTTProvider,
  setSTTProvider,
  getActionMode,
  setActionMode,
  getMicPosition,
  setMicPosition,
  getVADEnabled,
  setVADEnabled,
  getVADSilenceMs,
  setVADSilenceMs,
  getMicLanguage,
  setMicLanguage,
  DEFAULT_MIC_SETTINGS,
  SUPPORTED_LANGUAGES,
};
