/**
 * ElevenLabs Text-to-Speech Service
 * 
 * Provides voice synthesis using ElevenLabs API
 * Supports multiple voices and models with configurable settings
 */

import storage, { STORAGE_KEYS } from './electronStore';

// ElevenLabs Voice interface
export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  preview_url?: string;
  category?: string;
  description?: string;
  labels?: Record<string, string>;
}

// ElevenLabs Model interface
export interface ElevenLabsModel {
  model_id: string;
  name: string;
  description?: string;
  can_be_finetuned?: boolean;
  can_do_text_to_speech?: boolean;
  can_do_voice_conversion?: boolean;
  languages?: { language_id: string; name: string }[];
}

// Voice settings for generation
export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

// Default voice settings
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0,
  use_speaker_boost: true
};

// Storage keys for ElevenLabs
export const ELEVENLABS_STORAGE_KEYS = {
  API_KEY: 'elevenlabs_api_key',
  VOICE_ID: 'elevenlabs_voice_id',
  MODEL_ID: 'elevenlabs_model_id',
  VOICE_SETTINGS: 'elevenlabs_voice_settings',
  ENABLED: 'elevenlabs_enabled'
};

// Add to main STORAGE_KEYS export
export const ELEVENLABS_KEYS = ELEVENLABS_STORAGE_KEYS;

// Cache for voices and models
let cachedVoices: ElevenLabsVoice[] | null = null;
let cachedModels: ElevenLabsModel[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

/**
 * Get the ElevenLabs API key from storage
 */
export async function getApiKey(): Promise<string | null> {
  return await storage.get(ELEVENLABS_STORAGE_KEYS.API_KEY);
}

/**
 * Check if ElevenLabs is enabled
 */
export async function isElevenLabsEnabled(): Promise<boolean> {
  const enabled = await storage.get(ELEVENLABS_STORAGE_KEYS.ENABLED);
  return enabled === true;
}

/**
 * Get selected voice ID
 */
export async function getSelectedVoiceId(): Promise<string | null> {
  return await storage.get(ELEVENLABS_STORAGE_KEYS.VOICE_ID);
}

/**
 * Get selected model ID
 */
export async function getSelectedModelId(): Promise<string> {
  const modelId = await storage.get(ELEVENLABS_STORAGE_KEYS.MODEL_ID);
  return modelId || 'eleven_multilingual_v2'; // Default to multilingual v2
}

/**
 * Get voice settings
 */
export async function getVoiceSettings(): Promise<VoiceSettings> {
  const settings = await storage.get(ELEVENLABS_STORAGE_KEYS.VOICE_SETTINGS);
  return settings ? { ...DEFAULT_VOICE_SETTINGS, ...settings } : DEFAULT_VOICE_SETTINGS;
}

/**
 * Fetch available voices from ElevenLabs API
 */
export async function fetchVoices(): Promise<ElevenLabsVoice[]> {
  // Return cached if valid
  if (cachedVoices && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedVoices;
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error('ElevenLabs API key not configured');
    return getDefaultVoices();
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch ElevenLabs voices:', response.statusText);
      return getDefaultVoices();
    }

    const data = await response.json();
    cachedVoices = data.voices || [];
    cacheTimestamp = Date.now();
    
    return cachedVoices;
  } catch (error) {
    console.error('Error fetching ElevenLabs voices:', error);
    return getDefaultVoices();
  }
}

/**
 * Fetch available models from ElevenLabs API
 */
export async function fetchModels(): Promise<ElevenLabsModel[]> {
  // Return cached if valid
  if (cachedModels && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedModels;
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error('ElevenLabs API key not configured');
    return getDefaultModels();
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/models', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch ElevenLabs models:', response.statusText);
      return getDefaultModels();
    }

    const data = await response.json();
    cachedModels = data.filter((m: ElevenLabsModel) => m.can_do_text_to_speech) || [];
    cacheTimestamp = Date.now();
    
    return cachedModels;
  } catch (error) {
    console.error('Error fetching ElevenLabs models:', error);
    return getDefaultModels();
  }
}

/**
 * Default voices (fallback when API is unavailable)
 */
function getDefaultVoices(): ElevenLabsVoice[] {
  return [
    { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', category: 'premade', description: 'Calm and professional' },
    { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', category: 'premade', description: 'Strong and confident' },
    { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', category: 'premade', description: 'Soft and warm' },
    { voice_id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', category: 'premade', description: 'Well-rounded and clear' },
    { voice_id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', category: 'premade', description: 'Emotional and expressive' },
    { voice_id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', category: 'premade', description: 'Deep and authoritative' },
    { voice_id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', category: 'premade', description: 'Crisp and articulate' },
    { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', category: 'premade', description: 'Deep and narrative' },
    { voice_id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', category: 'premade', description: 'Raspy and dynamic' },
    { voice_id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', category: 'premade', description: 'British accent, authoritative' },
    { voice_id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', category: 'premade', description: 'Swedish accent, seductive' },
    { voice_id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', category: 'premade', description: 'British accent, confident' },
    { voice_id: 'iP95p4xoKVk53GoZ742B', name: 'Chris', category: 'premade', description: 'American casual' },
    { voice_id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', category: 'premade', description: 'American narrator' },
    { voice_id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', category: 'premade', description: 'Transatlantic, intense' },
  ];
}

/**
 * Default models (fallback when API is unavailable)
 */
function getDefaultModels(): ElevenLabsModel[] {
  return [
    { 
      model_id: 'eleven_multilingual_v2', 
      name: 'Eleven Multilingual v2',
      description: 'Our most advanced model, supporting 29 languages with excellent quality',
      can_do_text_to_speech: true
    },
    { 
      model_id: 'eleven_turbo_v2_5', 
      name: 'Eleven Turbo v2.5',
      description: 'High quality, low latency model optimized for real-time use',
      can_do_text_to_speech: true
    },
    { 
      model_id: 'eleven_turbo_v2', 
      name: 'Eleven Turbo v2',
      description: 'Fast model with good quality, English focused',
      can_do_text_to_speech: true
    },
    { 
      model_id: 'eleven_monolingual_v1', 
      name: 'Eleven English v1',
      description: 'Original English-only model',
      can_do_text_to_speech: true
    },
    { 
      model_id: 'eleven_multilingual_v1', 
      name: 'Eleven Multilingual v1',
      description: 'First generation multilingual model',
      can_do_text_to_speech: true
    },
  ];
}

/**
 * Generate speech from text using ElevenLabs API
 * Returns audio data as ArrayBuffer or base64 string
 */
export async function textToSpeech(
  text: string, 
  options?: {
    voiceId?: string;
    modelId?: string;
    outputFormat?: 'mp3_44100_128' | 'mp3_22050_32' | 'pcm_16000' | 'pcm_22050' | 'pcm_24000' | 'pcm_44100' | 'ulaw_8000';
  }
): Promise<{ audioBuffer: ArrayBuffer; contentType: string } | null> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured. Please add it in Settings.');
  }

  const voiceId = options?.voiceId || await getSelectedVoiceId() || '21m00Tcm4TlvDq8ikWAM'; // Default to Rachel
  const modelId = options?.modelId || await getSelectedModelId();
  const outputFormat = options?.outputFormat || 'mp3_44100_128';
  const voiceSettings = await getVoiceSettings();

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: voiceSettings
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs TTS error:', errorText);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'audio/mpeg';

    return { audioBuffer, contentType };
  } catch (error) {
    console.error('Error generating speech:', error);
    throw error;
  }
}

/**
 * Convert ArrayBuffer to Base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert ArrayBuffer to Blob URL for audio playback
 */
export function arrayBufferToBlobUrl(buffer: ArrayBuffer, contentType: string = 'audio/mpeg'): string {
  const blob = new Blob([buffer], { type: contentType });
  return URL.createObjectURL(blob);
}

/**
 * Generate speech and return as base64 data URL
 */
export async function textToSpeechBase64(text: string): Promise<string | null> {
  const result = await textToSpeech(text);
  if (!result) return null;
  
  const base64 = arrayBufferToBase64(result.audioBuffer);
  return `data:${result.contentType};base64,${base64}`;
}

/**
 * Get user subscription info (quota, etc.)
 */
export async function getSubscriptionInfo(): Promise<{
  character_count: number;
  character_limit: number;
  can_extend_character_limit: boolean;
  allowed_to_extend_character_limit: boolean;
  next_character_count_reset_unix: number;
  voice_limit: number;
  professional_voice_limit: number;
  can_extend_voice_limit: boolean;
  can_use_instant_voice_cloning: boolean;
  can_use_professional_voice_cloning: boolean;
  currency: string;
  status: string;
  billing_period: { left_days: number; started_at_unix: number; ends_at_unix: number };
} | null> {
  const apiKey = await getApiKey();
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch subscription info');
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching subscription info:', error);
    return null;
  }
}

/**
 * Speech-to-Text (STT)
 * Converts audio to text using ElevenLabs Scribe API
 */
export async function speechToText(audioBlob: Blob, modelId: string = 'scribe_v1'): Promise<string | null> {
  const apiKey = await getApiKey();
  if (!apiKey) return null;

  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model_id', modelId);

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail?.message || 'Failed to transcribe audio');
    }

    const data = await response.json();
    return data.text || '';
  } catch (error) {
    console.error('ElevenLabs STT Error:', error);
    return null;
  }
}

/**
 * Test the API key by fetching user info
 */
export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    return response.ok;
  } catch {
    return false;
  }
}

// Clear cache function (useful when API key changes)
export function clearCache(): void {
  cachedVoices = null;
  cachedModels = null;
  cacheTimestamp = 0;
}

export default {
  getApiKey,
  isElevenLabsEnabled,
  getSelectedVoiceId,
  getSelectedModelId,
  getVoiceSettings,
  fetchVoices,
  fetchModels,
  textToSpeech,
  textToSpeechBase64,
  arrayBufferToBase64,
  arrayBufferToBlobUrl,
  getSubscriptionInfo,
  testApiKey,
  clearCache,
  STORAGE_KEYS: ELEVENLABS_STORAGE_KEYS,
  DEFAULT_VOICE_SETTINGS
};
