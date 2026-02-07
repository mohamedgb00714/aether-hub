/**
 * Speech-to-Text Service
 * Provides a unified interface for multiple STT providers:
 * - Web Speech API (browser built-in, instant)
 * - Whisper.cpp (local, offline via main process)
 * - Google Cloud Speech-to-Text (Cloud-based, high accuracy)
 *
 * Includes Voice Activity Detection (VAD) for auto-stop functionality
 */

import * as googleSpeech from './googleSpeechService';
import * as elevenLabs from './elevenLabsService';

// Types
export type STTProvider = 'webSpeech' | 'whisper' | 'google' | 'elevenlabs';
export type MicActionMode = 'dictation' | 'aiGenerate' | 'chat';

export interface STTResult {
  transcript: string;
  isFinal: boolean;
  confidence: number;
}

export interface STTServiceConfig {
  provider: STTProvider;
  language: string;
  continuous: boolean;
  interimResults: boolean;
  vadEnabled: boolean;
  vadSilenceMs: number;
}

export interface STTServiceCallbacks {
  onResult?: (result: STTResult) => void;
  onInterim?: (transcript: string) => void;
  onError?: (error: Error) => void;
  onVADSilence?: () => void;
  onVolume?: (volume: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

// Default configuration
export const DEFAULT_STT_CONFIG: STTServiceConfig = {
  provider: 'webSpeech',
  language: 'en-US',
  continuous: true,
  interimResults: true,
  vadEnabled: true,
  vadSilenceMs: 1500,
};

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: Event & { error: string }) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

/**
 * Voice Activity Detection using Web Audio API
 * Monitors audio levels to detect silence
 */
class VoiceActivityDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private silenceTimer: NodeJS.Timeout | null = null;
  private isActive = false;
  private silenceThresholdMs: number;
  private onSilenceCallback: (() => void) | null = null;
  private onVolumeCallback: ((volume: number) => void) | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  // Audio level threshold (0-255, values below this are considered silence)
  // Increased slightly from 15 to 20 to be more robust against background noise
  private readonly SILENCE_THRESHOLD = 20;

  constructor(silenceThresholdMs: number = 1500) {
    this.silenceThresholdMs = silenceThresholdMs;
  }

  async start(onSilence: () => void, onVolume?: (volume: number) => void): Promise<void> {
    if (this.isActive) return;

    try {
      this.onSilenceCallback = onSilence;
      this.onVolumeCallback = onVolume || null;
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);

      this.isActive = true;
      this.startMonitoring();
    } catch (error) {
      console.error('VAD: Failed to start:', error);
      throw error;
    }
  }

  private startMonitoring(): void {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    this.checkInterval = setInterval(() => {
      if (!this.analyser || !this.isActive) return;

      this.analyser.getByteFrequencyData(dataArray);

      // Calculate average volume level
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      
      // Call volume callback
      if (this.onVolumeCallback) {
        this.onVolumeCallback(average);
      }

      if (average < this.SILENCE_THRESHOLD) {
        // Silence detected - start or continue timer
        if (!this.silenceTimer) {
          this.silenceTimer = setTimeout(() => {
            if (this.isActive && this.onSilenceCallback) {
              this.onSilenceCallback();
            }
          }, this.silenceThresholdMs);
        }
      } else {
        // Sound detected - reset timer
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
      }
    }, 100); // Check every 100ms
  }

  stop(): void {
    this.isActive = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.onSilenceCallback = null;
  }

  setSilenceThreshold(ms: number): void {
    this.silenceThresholdMs = ms;
  }
}

/**
 * Web Speech API STT Implementation
 */
class WebSpeechSTT {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private callbacks: STTServiceCallbacks = {};
  private config: STTServiceConfig;
  private vad: VoiceActivityDetector | null = null;
  private finalTranscript = '';

  constructor(config: STTServiceConfig) {
    this.config = config;

    // Check browser support
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      throw new Error('Web Speech API is not supported in this browser');
    }

    this.recognition = new SpeechRecognitionAPI();
    this.setupRecognition();
  }

  private setupRecognition(): void {
    if (!this.recognition) return;

    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.lang = this.config.language;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.finalTranscript = '';
      this.callbacks.onStart?.();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.callbacks.onEnd?.();
    };

    this.recognition.onerror = (event) => {
      let errorMessage: string;
      let isRetryable = false;

      // Normalize error to lowercase for consistent matching
      const errorType = String(event.error).toLowerCase();

      switch (errorType) {
        case 'network':
          errorMessage = 'Web Speech API (Google) is currently unavailable or blocked in Electron. For reliable voice input, please switch to Whisper (Local) in Settings.';
          isRetryable = true;
          break;
        case 'no-speech':
          errorMessage = 'No speech detected - please speak clearly into your microphone';
          isRetryable = true;
          break;
        case 'audio-capture':
          errorMessage = 'Microphone not available - check that your microphone is connected and not in use by another app';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone permission denied - please allow microphone access in your browser/system settings';
          break;
        case 'aborted':
          errorMessage = 'Speech recognition was cancelled';
          break;
        case 'service-not-allowed':
          errorMessage = 'Speech recognition service not available - this may be a browser restriction';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
          isRetryable = true;
      }

      const error = new Error(errorMessage);
      (error as Error & { isRetryable: boolean }).isRetryable = isRetryable;
      (error as Error & { errorType: string }).errorType = errorType;
      this.callbacks.onError?.(error);
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          this.finalTranscript += transcript;
          this.callbacks.onResult?.({
            transcript: this.finalTranscript,
            isFinal: true,
            confidence: result[0].confidence,
          });
        } else {
          interimTranscript += transcript;
          this.callbacks.onInterim?.(this.finalTranscript + interimTranscript);
        }
      }
    };
  }

  setCallbacks(callbacks: STTServiceCallbacks): void {
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    if (this.isListening) return;

    // Start VAD if enabled
    if (this.config.vadEnabled) {
      this.vad = new VoiceActivityDetector(this.config.vadSilenceMs);
      await this.vad.start(() => {
        this.callbacks.onVADSilence?.();
      }, (volume) => {
        this.callbacks.onVolume?.(volume);
      });
    }

    this.recognition?.start();
  }

  stop(): STTResult {
    this.recognition?.stop();
    this.vad?.stop();
    this.vad = null;

    return {
      transcript: this.finalTranscript,
      isFinal: true,
      confidence: 1,
    };
  }

  abort(): void {
    this.recognition?.abort();
    this.vad?.stop();
    this.vad = null;
    this.finalTranscript = '';
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  updateConfig(config: Partial<STTServiceConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.recognition) {
      this.recognition.lang = this.config.language;
      this.recognition.continuous = this.config.continuous;
      this.recognition.interimResults = this.config.interimResults;
    }
    if (this.vad) {
      this.vad.setSilenceThreshold(this.config.vadSilenceMs);
    }
  }
}

/**
 * Whisper.cpp STT Implementation
 * Records audio and sends to main process for transcription
 */
class WhisperSTT {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isListening = false;
  private callbacks: STTServiceCallbacks = {};
  private config: STTServiceConfig;
  private vad: VoiceActivityDetector | null = null;
  private mediaStream: MediaStream | null = null;

  constructor(config: STTServiceConfig) {
    this.config = config;
  }

  setCallbacks(callbacks: STTServiceCallbacks): void {
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    if (this.isListening) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstart = () => {
        this.isListening = true;
        this.callbacks.onStart?.();
      };

      this.mediaRecorder.onstop = async () => {
        this.isListening = false;
        // Audio processing happens in stop() method
      };

      // Start VAD if enabled
      if (this.config.vadEnabled) {
        this.vad = new VoiceActivityDetector(this.config.vadSilenceMs);
        await this.vad.start(() => {
          this.callbacks.onVADSilence?.();
        }, (volume) => {
          this.callbacks.onVolume?.(volume);
        });
      }

      this.mediaRecorder.start(100); // Collect data every 100ms
    } catch (error) {
      console.error('Whisper STT: Failed to start recording:', error);
      this.callbacks.onError?.(error as Error);
    }
  }

  async stop(): Promise<STTResult> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve({ transcript: '', isFinal: true, confidence: 0 });
        return;
      }

      this.mediaRecorder.onstop = async () => {
        this.isListening = false;
        this.vad?.stop();
        this.vad = null;

        // Stop media stream
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(track => track.stop());
          this.mediaStream = null;
        }

        // Convert to audio blob
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

        try {
          // Convert blob to ArrayBuffer and send to main process
          const arrayBuffer = await audioBlob.arrayBuffer();

          // Check if Whisper is available
          if (!window.electronAPI?.whisper) {
            this.callbacks.onError?.(new Error('Whisper API not available in Electron context. Make sure preload is built.'));
            resolve({ transcript: '', isFinal: true, confidence: 0 });
            return;
          }

          const whisperStatus = await window.electronAPI.whisper.checkInstalled();
          if (!whisperStatus?.installed) {
            let errorMessage = whisperStatus?.installInstructions
              || 'Whisper.cpp is not installed. Install whisper.cpp and download a model to use offline speech recognition.';
              
            // If instructions are missing but we know what's wrong
            if (!whisperStatus?.whisperPath && !whisperStatus?.installInstructions) {
              errorMessage = 'Whisper.cpp binary not found. Install it and make sure it is in your PATH.';
            } else if (!whisperStatus?.modelPath && !whisperStatus?.installInstructions) {
              errorMessage = 'No Whisper model found. Please download one in Settings.';
            } else if (!whisperStatus?.hasFfmpeg && !whisperStatus?.installInstructions) {
              errorMessage = 'FFmpeg not found. It is required for local transcription.';
            }
            
            this.callbacks.onError?.(new Error(errorMessage));
            resolve({ transcript: '', isFinal: true, confidence: 0 });
            return;
          }

          // Send to main process for transcription
          const result = await window.electronAPI?.whisper?.transcribe(arrayBuffer);

          this.callbacks.onEnd?.();
          this.callbacks.onResult?.({
            transcript: result?.transcript || '',
            isFinal: true,
            confidence: result?.confidence || 0.9,
          });

          resolve({
            transcript: result?.transcript || '',
            isFinal: true,
            confidence: result?.confidence || 0.9,
          });
        } catch (error) {
          console.error('Whisper STT: Transcription failed:', error);
          this.callbacks.onError?.(error as Error);
          this.callbacks.onEnd?.();
          resolve({ transcript: '', isFinal: true, confidence: 0 });
        }
      };

      this.mediaRecorder.stop();
    });
  }

  abort(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.vad?.stop();
    this.vad = null;
    this.audioChunks = [];

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  updateConfig(config: Partial<STTServiceConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.vad) {
      this.vad.setSilenceThreshold(this.config.vadSilenceMs);
    }
  }
}

/** * ElevenLabs STT Implementation
 */
class ElevenLabsSTT implements STTService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isListening = false;
  private callbacks: STTServiceCallbacks = {};
  private config: STTServiceConfig;
  private vad: VoiceActivityDetector | null = null;
  private mediaStream: MediaStream | null = null;

  constructor(config: STTServiceConfig) {
    this.config = config;
  }

  setCallbacks(callbacks: STTServiceCallbacks): void {
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    if (this.isListening) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstart = () => {
        this.isListening = true;
        this.callbacks.onStart?.();
      };

      this.mediaRecorder.onstop = () => {
        this.isListening = false;
      };

      // Start VAD if enabled
      if (this.config.vadEnabled) {
        this.vad = new VoiceActivityDetector(this.config.vadSilenceMs);
        await this.vad.start(() => {
          this.callbacks.onVADSilence?.();
        }, (volume) => {
          this.callbacks.onVolume?.(volume);
        });
      }

      this.mediaRecorder.start(100);
    } catch (error) {
      console.error('ElevenLabs STT: Failed to start recording:', error);
      this.callbacks.onError?.(error as Error);
    }
  }

  async stop(): Promise<STTResult> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve({ transcript: '', isFinal: true, confidence: 0 });
        return;
      }

      this.mediaRecorder.onstop = async () => {
        this.isListening = false;
        this.vad?.stop();
        this.vad = null;

        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(track => track.stop());
          this.mediaStream = null;
        }

        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

        try {
          this.callbacks.onInterim?.('Transcribing with ElevenLabs...');
          const transcript = await elevenLabs.speechToText(audioBlob);

          this.callbacks.onEnd?.();
          this.callbacks.onResult?.({
            transcript: transcript || '',
            isFinal: true,
            confidence: 0.9,
          });

          resolve({
            transcript: transcript || '',
            isFinal: true,
            confidence: 0.9,
          });
        } catch (error) {
          console.error('ElevenLabs STT: Transcription failed:', error);
          this.callbacks.onError?.(error as Error);
          this.callbacks.onEnd?.();
          resolve({ transcript: '', isFinal: true, confidence: 0 });
        }
      };

      this.mediaRecorder.stop();
    });
  }

  abort(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.vad?.stop();
    this.vad = null;
    this.audioChunks = [];

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  updateConfig(config: Partial<STTServiceConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.vad) {
      this.vad.setSilenceThreshold(this.config.vadSilenceMs);
    }
  }
}

/** * Google Cloud Speech STT Implementation
 */
class GoogleSTT implements STTService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isListening = false;
  private callbacks: STTServiceCallbacks = {};
  private config: STTServiceConfig;
  private vad: VoiceActivityDetector | null = null;
  private mediaStream: MediaStream | null = null;

  constructor(config: STTServiceConfig) {
    this.config = config;
  }

  setCallbacks(callbacks: STTServiceCallbacks): void {
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    if (this.isListening) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstart = () => {
        this.isListening = true;
        this.callbacks.onStart?.();
      };

      this.mediaRecorder.onstop = () => {
        this.isListening = false;
      };

      // Start VAD if enabled
      if (this.config.vadEnabled) {
        this.vad = new VoiceActivityDetector(this.config.vadSilenceMs);
        await this.vad.start(() => {
          this.callbacks.onVADSilence?.();
        }, (volume) => {
          this.callbacks.onVolume?.(volume);
        });
      }

      this.mediaRecorder.start(100);
    } catch (error) {
      console.error('Google STT: Failed to start recording:', error);
      this.callbacks.onError?.(error as Error);
    }
  }

  async stop(): Promise<STTResult> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve({ transcript: '', isFinal: true, confidence: 0 });
        return;
      }

      this.mediaRecorder.onstop = async () => {
        this.isListening = false;
        this.vad?.stop();
        this.vad = null;

        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(track => track.stop());
          this.mediaStream = null;
        }

        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

        try {
          // Convert to Base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string || '').split(',')[1];
            
            if (!base64Audio) {
               resolve({ transcript: '', isFinal: true, confidence: 0 });
               return;
            }

            this.callbacks.onInterim?.('Transcribing with Google Cloud...');
            const transcript = await googleSpeech.speechToText(base64Audio, this.config.language);

            this.callbacks.onEnd?.();
            this.callbacks.onResult?.({
              transcript: transcript || '',
              isFinal: true,
              confidence: 0.9,
            });

            resolve({
              transcript: transcript || '',
              isFinal: true,
              confidence: 0.9,
            });
          };
        } catch (error) {
          console.error('Google STT: Transcription failed:', error);
          this.callbacks.onError?.(error as Error);
          this.callbacks.onEnd?.();
          resolve({ transcript: '', isFinal: true, confidence: 0 });
        }
      };

      this.mediaRecorder.stop();
    });
  }

  abort(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.vad?.stop();
    this.vad = null;
    this.audioChunks = [];

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  updateConfig(config: Partial<STTServiceConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.vad) {
      this.vad.setSilenceThreshold(this.config.vadSilenceMs);
    }
  }
}

/**
 * Unified STT Service
 * Factory function to create the appropriate STT service
 */
export interface STTService {
  start(): Promise<void>;
  stop(): Promise<STTResult> | STTResult;
  abort(): void;
  getIsListening(): boolean;
  setCallbacks(callbacks: STTServiceCallbacks): void;
  updateConfig(config: Partial<STTServiceConfig>): void;
}

export function createSTTService(config: STTServiceConfig = DEFAULT_STT_CONFIG): STTService {
  if (config.provider === 'whisper') {
    return new WhisperSTT(config);
  }
  if (config.provider === 'google') {
    return new GoogleSTT(config);
  }
  if (config.provider === 'elevenlabs') {
    return new ElevenLabsSTT(config);
  }
  return new WebSpeechSTT(config);
}

/**
 * Check if Web Speech API is supported
 */
export function isWebSpeechSupported(): boolean {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Check if Whisper.cpp is installed
 */
export async function isWhisperInstalled(): Promise<boolean> {
  try {
    const result = await window.electronAPI?.whisper?.checkInstalled();
    return result?.installed ?? false;
  } catch {
    return false;
  }
}

/**
 * Get Whisper installation status with details
 */
export async function getWhisperStatus(): Promise<{
  installed: boolean;
  whisperPath: string | null;
  modelPath: string | null;
  hasFfmpeg: boolean;
  modelsDir: string;
  installInstructions: string | null;
} | null> {
  try {
    return await window.electronAPI?.whisper?.checkInstalled() ?? null;
  } catch {
    return null;
  }
}

/**
 * Request microphone permission
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch {
    return false;
  }
}

export default {
  createSTTService,
  isWebSpeechSupported,
  isWhisperInstalled,
  getWhisperStatus,
  requestMicrophonePermission,
  DEFAULT_STT_CONFIG,
};
