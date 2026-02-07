/**
 * Floating Microphone Widget
 * A draggable mic button that enables voice input with STT
 * Supports two modes: Dictation (type text) and AI Generate (send to assistant)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  MicrophoneIcon, 
  StopIcon, 
  SparklesIcon, 
  DocumentTextIcon,
  GlobeAltIcon,
  CpuChipIcon,
  ArrowsRightLeftIcon,
  Cog6ToothIcon,
  CloudIcon,
  SpeakerWaveIcon,
  MusicalNoteIcon,
  ChatBubbleLeftRightIcon,
  ChatBubbleBottomCenterTextIcon,
  SpeakerXMarkIcon,
  XMarkIcon,
  BoltIcon,
  ArrowPathIcon,
  CameraIcon
} from '@heroicons/react/24/solid';
import { 
  PlusIcon, 
  CheckIcon, 
  TrashIcon, 
  ChevronRightIcon
} from '@heroicons/react/24/outline'; // Outline icons for UI
import { callAI } from '../services/geminiService';
import { getChatResponse } from '../services/langchainService';
import { useMicHotkeys } from '../hooks/useMicHotkeys';
import {
  createSTTService,
  isWebSpeechSupported,
  isWhisperInstalled,
  requestMicrophonePermission,
  type STTService,
  type STTResult,
  type STTServiceConfig,
} from '../services/speechToTextService';
import {
  getMicSettings,
  setMicPosition,
  setActionMode,
  setSTTProvider,
  setMicSettings,
  type MicSettings,
  type MicPosition,
} from '../services/micSettingsService';
import type { MicActionMode } from '../services/speechToTextService';

// Import AI service for generate mode
import * as elevenLabs from '../services/elevenLabsService';
import * as googleSpeech from '../services/googleSpeechService';

// Widget states
type MicState = 'idle' | 'listening' | 'processing' | 'error';

interface FloatingMicWidgetProps {
  isOverlay?: boolean;
}

const FloatingMicWidget: React.FC<FloatingMicWidgetProps> = ({ isOverlay = false }) => {
  // Settings state
  const [settings, setSettings] = useState<MicSettings | null>(null);
  const [position, setPosition] = useState<MicPosition>({ edge: 'right', y: 50 });
  const [actionMode, setCurrentActionMode] = useState<MicActionMode>('chat');

  // Widget state
  const [micState, setMicState] = useState<MicState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const lastProcessedTranscript = useRef<string>('');
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [canSwitchToWhisper, setCanSwitchToWhisper] = useState(false);
  const [lastAiResponse, setLastAiResponse] = useState<string | null>(null);
  const [showResponsePanel, setShowResponsePanel] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [manualText, setManualText] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartPosY = useRef(0);

  // STT service ref
  const sttServiceRef = useRef<STTService | null>(null);

  // Retry state
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadSettings = async () => {
    try {
      const loadedSettings = await getMicSettings();
      setSettings(loadedSettings);
      setPosition(loadedSettings.position);
      setCurrentActionMode(loadedSettings.actionMode);
    } catch (err) {
      console.error('Failed to load mic settings:', err);
    }
  };

  const checkWhisperAvailability = async () => {
    const installed = await isWhisperInstalled();
    setCanSwitchToWhisper(installed);
  };

  const handleSwitchToWhisper = async () => {
    if (!settings) return;
    
    try {
      await setSTTProvider('whisper');
      setSettings({ ...settings, provider: 'whisper' });
      setError(null);
      setMicState('idle');
      setRetryCount(0);
      
      // Show notification
      await window.electronAPI?.notification?.show({
        title: 'STT Provider Switched',
        body: 'Switched to Whisper (Offline) for speech recognition.',
      });
    } catch (err) {
      console.error('Failed to switch to Whisper:', err);
    }
  };

  const toggleProvider = async () => {
    if (!settings) return;
    
    let newProvider: STTProvider;
    if (settings.provider === 'webSpeech') {
      newProvider = 'whisper';
    } else if (settings.provider === 'whisper') {
      newProvider = 'google';
    } else if (settings.provider === 'google') {
      newProvider = 'elevenlabs';
    } else {
      newProvider = 'webSpeech';
    }
    
    // Skip whisper if not installed
    if (newProvider === 'whisper' && !canSwitchToWhisper) {
      newProvider = 'google';
    }

    try {
      await setSTTProvider(newProvider);
      setSettings({ ...settings, provider: newProvider });
      setError(null);
      
      const providerNames = {
        webSpeech: 'Online (Web)',
        whisper: 'Offline (Local)',
        google: 'Google Cloud (Cloud)',
        elevenlabs: 'ElevenLabs Scribe'
      };

      await window.electronAPI?.notification?.show({
        title: 'Provider Switched',
        body: `Using ${providerNames[newProvider]} for speech recognition.`,
      });
    } catch (err) {
      console.error('Failed to toggle provider:', err);
    }
  };

  const toggleVoiceFeedback = async () => {
    if (!settings) return;
    const newVoiceFeedback = !settings.voiceFeedback;
    
    try {
      const newSettings = { ...settings, voiceFeedback: newVoiceFeedback };
      await setMicSettings(newSettings);
      setSettings(newSettings);
      
      await window.electronAPI?.notification?.show({
        title: 'Voice Feedback',
        body: `Voice feedback is now ${newVoiceFeedback ? 'Enabled' : 'Disabled'}.`,
      });
    } catch (err) {
      console.error('Failed to toggle voice feedback:', err);
    }
  };

  const toggleTTSProvider = async () => {
    if (!settings) return;
    const newTTSProvider = settings.ttsProvider === 'google' ? 'elevenlabs' : 'google';
    
    try {
      const newSettings = { ...settings, ttsProvider: newTTSProvider };
      await setMicSettings(newSettings);
      setSettings(newSettings);
      
      await window.electronAPI?.notification?.show({
        title: 'TTS Provider',
        body: `Switched to ${newTTSProvider === 'google' ? 'Google' : 'ElevenLabs'} for voice feedback.`,
      });
    } catch (err) {
      console.error('Failed to toggle TTS provider:', err);
    }
  };

  const captureScreenshot = async () => {
    if (!settings?.screenshotsEnabled) {
      await window.electronAPI?.notification?.show({
        title: 'Screenshots Disabled',
        body: 'Enable screenshots in Settings to use this feature.',
      });
      return;
    }

    try {
      setIsCapturingScreenshot(true);
      const result = await window.electronAPI.screenshot.capture();
      
      // Extract dataUrl from the response object
      if (result?.success && result?.dataUrl) {
        setScreenshot(result.dataUrl);
        
        await window.electronAPI?.notification?.show({
          title: 'Screenshot Captured',
          body: 'Screenshot will be sent with your next message.',
        });
      } else {
        throw new Error(result?.error || 'Failed to capture screenshot');
      }
    } catch (err) {
      console.error('Failed to capture screenshot:', err);
      await window.electronAPI?.notification?.show({
        title: 'Screenshot Failed',
        body: 'Could not capture screenshot.',
      });
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  const toggleActionMode = async () => {
    if (!settings) return;
    
    let newMode: MicActionMode;
    if (actionMode === 'chat') {
      newMode = 'aiGenerate';
    } else if (actionMode === 'aiGenerate') {
      newMode = 'dictation';
    } else {
      newMode = 'chat';
    }
    
    try {
      await setActionMode(newMode);
      setCurrentActionMode(newMode);
      setSettings({ ...settings, actionMode: newMode });
      
      const modeNames = {
        chat: 'AI Chat',
        aiGenerate: 'AI Generate',
        dictation: 'Dictation'
      };

      await window.electronAPI?.notification?.show({
        title: 'Mode Switched',
        body: `Now using ${modeNames[newMode]} mode.`,
      });
    } catch (err) {
      console.error('Failed to toggle action mode:', err);
    }
  };

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    checkWhisperAvailability();
  }, []);

  // Listen for settings changes from main process (for overlay window)
  useEffect(() => {
    if (isOverlay && window.electronAPI?.overlay?.onSettingsChanged) {
      const unsubscribe = window.electronAPI.overlay.onSettingsChanged(() => {
        console.log('🔄 Mic settings changed externally, reloading...');
        loadSettings();
        checkWhisperAvailability();
      });
      return () => unsubscribe();
    }
  }, [isOverlay]);

  // Handle overlay window resizing automatically via ResizeObserver
  useEffect(() => {
    if (!isOverlay || !window.electronAPI?.overlay?.resize) return;

    const handleResize = (entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        // Use scrollWidth/Height to get the full content size even if clipped by window
        const width = Math.ceil(entry.target.scrollWidth);
        const height = Math.ceil(entry.target.scrollHeight);
        
        if (width > 0 && height > 0) {
          console.log(`📏 Resizing overlay: ${width}x${height} (Scroll size)`);
          window.electronAPI.overlay.resize(width, height);
        }
      }
    };

    const observer = new ResizeObserver(handleResize);

    if (containerRef.current) {
      observer.observe(containerRef.current);
      // Immediate trigger for initial size
      const width = Math.ceil(containerRef.current.scrollWidth);
      const height = Math.ceil(containerRef.current.scrollHeight);
      window.electronAPI.overlay.resize(width, height);
    }

    return () => observer.disconnect();
  }, [isOverlay, isExpanded, isDrawerOpen, actionMode]);

  // Handle voice response playback
  const playVoiceResponse = useCallback(async (text: string) => {
    if (!settings?.voiceFeedback) return;
    
    try {
      setIsPlayingVoice(true);
      let audioUrl = null;
      if (settings.ttsProvider === 'elevenlabs') {
        audioUrl = await elevenLabs.textToSpeech(text);
      } else {
        audioUrl = await googleSpeech.textToSpeech(text, settings.language || 'en-US');
      }

      if (audioUrl) {
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        audioRef.current.src = audioUrl;
        audioRef.current.onended = () => setIsPlayingVoice(false);
        audioRef.current.onerror = () => setIsPlayingVoice(false);
        await audioRef.current.play();
      } else {
        setIsPlayingVoice(false);
      }
    } catch (voiceErr) {
      console.error('Voice feedback failed:', voiceErr);
      setIsPlayingVoice(false);
    }
  }, [settings?.voiceFeedback, settings?.ttsProvider, settings?.language]);

  // Process final transcript based on mode
  const processTranscript = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setMicState('processing');

    try {
      if (actionMode === 'dictation') {
        // Dictation mode: paste the text
        await window.electronAPI?.system?.pasteText(text);

        // Show notification
        await window.electronAPI?.notification?.show({
          title: 'Dictation Complete',
          body: `Text copied: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
        });
        
        setMicState('idle');
        setTranscript('');
        setIsExpanded(false);
      } else {
        // AI modes: chat or generate
        if (actionMode === 'chat') {
          setChatMessages(prev => [...prev, { role: 'user', text: screenshot ? `${text} [📷 Screenshot attached]` : text }]);
          setIsDrawerOpen(true);
        }

        // Pass screenshot to AI if captured
        const response = await getChatResponse(text, [], undefined, screenshot);
        const responseText = typeof response === 'string'
          ? response
          : response?.text || 'No response generated';

        if (actionMode === 'chat') {
          setChatMessages(prev => [...prev, { role: 'assistant', text: responseText }]);
        }

        setLastAiResponse(responseText);
        setShowResponsePanel(true);

        // Handle AI Generate mode: Copy and Paste
        if (actionMode === 'aiGenerate') {
          await window.electronAPI?.system?.pasteText(responseText);
        }

        // Voice Feedback
        if (settings?.voiceFeedback) {
          await playVoiceResponse(responseText);
        }

        // Show notification
        const preview = responseText.substring(0, 120).replace(/\n/g, ' ');
        await window.electronAPI?.notification?.show({
          title: actionMode === 'chat' ? 'Assistant' : 'AI Response Ready',
          body: `${preview}${responseText.length > 120 ? '...' : ''}`,
        });
        
        setMicState('idle');
        // Keep transcript showing for the response panel
        setTranscript(text);
        
        // Clear screenshot after it's been used
        if (screenshot) {
          setScreenshot(null);
        }
      }
    } catch (err) {
      console.error('Failed to process transcript:', err);
      setError('Failed to process voice input');
      setMicState('idle');
    }
  }, [actionMode, settings?.voiceFeedback, playVoiceResponse, screenshot]);

  // Handle STT result
  const handleSTTResult = useCallback(async (result: STTResult) => {
    console.log('🎤 Received STT Result:', result);
    
    if (result.isFinal) {
      setTranscript(result.transcript);
      setInterimTranscript('');
      
      if (result.transcript.trim()) {
        // Deduplicate: Don't process the same final transcript twice in short succession
        if (lastProcessedTranscript.current === result.transcript) {
          setMicState('idle');
          return;
        }
        lastProcessedTranscript.current = result.transcript;
        
        // Clear last processed after 2 seconds
        setTimeout(() => {
          if (lastProcessedTranscript.current === result.transcript) {
            lastProcessedTranscript.current = '';
          }
        }, 2000);

        await processTranscript(result.transcript);
      } else {
        // Empty transcript - just go to idle
        console.log('🎤 Empty transcript received, resetting to idle');
        setMicState('idle');
        setTranscript('');
      }
    } else {
      // Interim results
      setTranscript(result.transcript);
    }
  }, [actionMode, processTranscript]);

  // Handle interim results
  const handleInterimResult = useCallback((text: string) => {
    setInterimTranscript(text);
  }, []);

  // Start listening
  const startListening = useCallback(async () => {
    // Check browser support
    if (settings?.provider === 'webSpeech' && !isWebSpeechSupported()) {
      setError('Web Speech API not supported in this browser');
      setMicState('error');
      return;
    }

    // Request microphone permission
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      setError('Microphone permission denied');
      setMicState('error');
      return;
    }

    try {
      setError(null);
      setTranscript('');
      setInterimTranscript('');
      setIsExpanded(true);
      await sttServiceRef.current?.start();
    } catch (err) {
      console.error('Failed to start listening:', err);
      setError('Failed to start microphone');
      setMicState('error');
    }
  }, [settings?.provider]);

  // Stop listening
  const stopListening = useCallback(async () => {
    if (!sttServiceRef.current) return;

    try {
      console.log('🎤 Stopping listening...');
      setMicState('processing'); // Immediately show processing state
      
      // Stop the service and get potential immediate result
      const result = await sttServiceRef.current.stop();
      console.log('🎤 Service stop() returned:', result);
      
      // If we got a result directly (like from WebSpeech or Whisper), handle it
      if (result && result.isFinal && result.transcript.trim()) {
        await handleSTTResult(result);
      } else if (result && result.isFinal) {
        // Result is final but empty, and we might be waiting for handleSTTResult
        // No-op for now as onEnd or handleSTTResult will handle it
      }
    } catch (err) {
      console.error('Failed to stop listening:', err);
      setMicState('idle');
    }
  }, [handleSTTResult]);

  // Handle STT error
  const handleSTTError = useCallback((err: Error & { isRetryable?: boolean; errorType?: string }) => {
    console.error('STT Error:', err);
    setError(err.message);
    setMicState('error');

    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const isRetryable = err.isRetryable ?? false;
    const isNetworkError = err.errorType === 'network' || err.message.toLowerCase().includes('network');

    // Allow auto-retry for retryable errors. 
    // We allow one auto-retry even for network errors in Electron as it often fails on first boot.
    const shouldRetry = isRetryable && retryCount < maxRetries && (!isNetworkError || retryCount < 1);

    if (shouldRetry) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s

      retryTimeoutRef.current = setTimeout(async () => {
        setRetryCount(prev => prev + 1);
        setError(null);
        setMicState('idle');

        // Attempt to restart listening
        try {
          await sttServiceRef.current?.start();
        } catch (retryErr) {
          console.error('Retry failed:', retryErr);
          setMicState('idle');
        }
      }, delay);
    } else {
      // For non-retryable errors or network errors, just show the error and reset
      retryTimeoutRef.current = setTimeout(() => {
        setError(null);
        setMicState('idle');
        setRetryCount(0);
      }, 5000);
    }
  }, [retryCount]);

  // Cleanup retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Handle VAD silence detection
  const handleVADSilence = useCallback(() => {
    // Auto-stop when silence detected
    // Only stop if we are currently listening
    if (micState === 'listening') {
      console.log('🎤 VAD: Silence detected while listening, stopping...');
      stopListening();
    }
  }, [micState, stopListening]);

  const closeOverlay = () => {
    if (isOverlay && window.electronAPI?.overlay?.hide) {
      window.electronAPI.overlay.hide();
    }
  };

  const handleSubmitManualText = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!manualText.trim()) return;
    
    const text = manualText;
    setManualText('');
    await processTranscript(text);
  }, [manualText, processTranscript]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (micState === 'listening') {
      stopListening();
    } else if (micState === 'idle') {
      startListening();
    }
  }, [micState, stopListening, startListening]);

  // Toggle action mode
  const toggleMode = useCallback(async () => {
    let newMode: MicActionMode;
    if (actionMode === 'chat') {
      newMode = 'aiGenerate';
    } else if (actionMode === 'aiGenerate') {
      newMode = 'dictation';
    } else {
      newMode = 'chat';
    }
    
    setCurrentActionMode(newMode);
    await setActionMode(newMode);
    
    // Show notification for mode change
    const modeNames = {
      chat: 'AI Chat (Conversational)',
      aiGenerate: 'AI Generate (Copy result)',
      dictation: 'Dictation (Paste text)'
    };
    
    await window.electronAPI?.notification?.show({
      title: 'Mode Switched',
      body: `Now using ${modeNames[newMode]} mode.`,
    });
  }, [actionMode]);

  // Initialize STT service when settings change
  useEffect(() => {
    if (!settings) return;

    const config: STTServiceConfig = {
      provider: settings.provider,
      language: settings.language,
      continuous: true,
      interimResults: true,
      vadEnabled: settings.vadEnabled,
      vadSilenceMs: settings.vadSilenceMs,
    };

    console.log(`🎤 Initializing STT Service with provider: ${settings.provider}`);
    const service = createSTTService(config);
    sttServiceRef.current = service;

    // Set up initial callbacks
    service.setCallbacks({
      onResult: handleSTTResult,
      onInterim: handleInterimResult,
      onError: handleSTTError,
      onVADSilence: handleVADSilence,
      onVolume: (v) => setVolume(v),
      onStart: () => setMicState('listening'),
      onEnd: () => {
        // Fallback: If we stopped but didn't get a result to trigger processTranscript
        setMicState(prev => (prev === 'listening' ? 'idle' : prev));
        setVolume(0);
      },
    });

    return () => {
      console.log('🎤 Cleaning up STT Service');
      service.abort();
    };
  }, [settings?.provider, settings?.language, settings?.vadEnabled, settings?.vadSilenceMs]);

  // Keep STT callbacks up to date with changing dependencies (micState, actionMode, etc)
  useEffect(() => {
    if (sttServiceRef.current) {
      sttServiceRef.current.setCallbacks({
        onResult: handleSTTResult,
        onInterim: handleInterimResult,
        onError: handleSTTError,
        onVADSilence: handleVADSilence,
        onVolume: (v) => setVolume(v),
        onStart: () => setMicState('listening'),
        onEnd: () => {
          // Only go to idle if we aren't already processing or in error
          setMicState(prev => (prev === 'listening' || prev === 'idle' ? 'idle' : prev));
          setVolume(0);
        },
      });
    }
  }, [handleSTTResult, handleInterimResult, handleSTTError, handleVADSilence]);

  // Hotkey handlers
  useMicHotkeys({
    onToggle: toggleListening,
    onPushToTalkStart: () => {
      if (micState === 'idle') {
        startListening();
      }
    },
    onPushToTalkEnd: () => {
      if (micState === 'listening') {
        stopListening();
      }
    },
    onModeSwitch: toggleMode,
    enabled: true,
  });

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartPosY.current = position.y;
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - dragStartY.current;
      const windowHeight = window.innerHeight;
      const newY = dragStartPosY.current + (deltaY / windowHeight) * 100;

      // Clamp between 5% and 95%
      const clampedY = Math.max(5, Math.min(95, newY));
      setPosition(prev => ({ ...prev, y: clampedY }));
    };

    const handleMouseUp = async () => {
      setIsDragging(false);
      // Save position
      await setMicPosition(position);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position]);

  // Toggle edge on double click
  const handleDoubleClick = async () => {
    const newEdge = position.edge === 'left' ? 'right' : 'left';
    const newPosition = { ...position, edge: newEdge as 'left' | 'right' };
    setPosition(newPosition);
    await setMicPosition(newPosition);
  };

  // Get status color
  const getStatusColor = () => {
    switch (micState) {
      case 'listening':
        return 'bg-red-500';
      case 'processing':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-600';
      default:
        if (actionMode === 'chat') return 'bg-blue-500';
        return actionMode === 'aiGenerate' ? 'bg-indigo-500' : 'bg-green-500';
    }
  };

  // Get button gradient
  const getButtonGradient = () => {
    if (micState === 'listening') {
      return 'from-red-500 to-red-600';
    }
    if (micState === 'processing') {
      return 'from-yellow-500 to-orange-500';
    }
    if (micState === 'error') {
      return 'from-red-600 to-red-700';
    }
    if (actionMode === 'chat') return 'from-blue-500 to-blue-600';
    return actionMode === 'aiGenerate'
      ? 'from-indigo-500 to-purple-600'
      : 'from-green-500 to-teal-600';
  };

  if (!settings) {
    return null; // Don't render until settings are loaded
  }

  // Handle Overlay Mode (Bar Layout)
  if (isOverlay) {
    return (
      <div 
        ref={containerRef} 
        className="min-w-fit min-h-fit overflow-visible flex flex-col items-center justify-end"
      >
        {isExpanded ? (
          <div className="flex flex-col items-center justify-end w-[480px] h-fit overflow-visible">
            {/* Chat Messages Drawer */}
            {actionMode === 'chat' && isDrawerOpen && (
              <div 
                className="w-full h-[340px] mb-4 bg-slate-900/70 backdrop-blur-2xl rounded-[2.5rem] border border-white/20 shadow-2xl p-6 overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 duration-500"
                style={{ WebkitAppRegion: 'no-drag' } as any}
              >
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-xs font-black text-white uppercase tracking-widest">Atlas Conversation</span>
                  </div>
                  <button 
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-1.5 hover:bg-white/10 rounded-xl transition-all"
                  >
                    <XMarkIcon className="w-4 h-4 text-white/50" />
                  </button>
                </div>

                <div 
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar"
                >
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-30 text-center">
                      <ChatBubbleBottomCenterTextIcon className="w-12 h-12 text-white mb-2" />
                      <p className="text-sm font-bold text-white">No messages yet</p>
                      <p className="text-[10px] text-white">Speak or type to begin</p>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div 
                        key={i} 
                        className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} group`}
                      >
                        <div className={`
                          max-w-[85%] px-4 py-2.5 rounded-[1.25rem] text-sm relative transition-all duration-300
                          ${msg.role === 'user' 
                            ? 'bg-blue-600 text-white rounded-tr-none' 
                            : 'bg-white/10 text-white/90 rounded-tl-none border border-white/5'}
                        `}>
                          <div className="prose-sm max-w-none break-words">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({node, ...props}) => <p className="mb-0 last:mb-0" {...props} />,
                                a: ({node, ...props}) => <a className="text-blue-300 underline" target="_blank" {...props} />,
                                ul: ({node, ...props}) => <ul className="list-disc ml-4 my-1" {...props} />,
                                ol: ({node, ...props}) => <ol className="list-decimal ml-4 my-1" {...props} />,
                                code: ({node, ...props}) => <code className="bg-white/10 rounded px-1 py-0.5 text-[0.8em]" {...props} />,
                              }}
                            >
                              {msg.text}
                            </ReactMarkdown>
                          </div>
                          {msg.role === 'assistant' && (
                            <button
                              onClick={async () => {
                                await window.electronAPI?.clipboard?.writeText(msg.text);
                                await window.electronAPI?.notification?.show({ title: 'Copied', body: 'Response copied' });
                              }}
                              className="absolute -right-8 top-1 opacity-0 group-hover:opacity-100 p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                              title="Copy Response"
                            >
                              <PlusIcon className="w-3.5 h-3.5 text-white/50 rotate-45 group-active:scale-95 transition-transform" />
                            </button>
                          )}
                        </div>
                        <span className="text-[9px] font-bold text-white/20 mt-1 uppercase tracking-tighter">
                          {msg.role === 'user' ? 'You' : 'Atlas'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div 
              className="flex items-center gap-3 p-2 bg-slate-900/95 backdrop-blur-2xl rounded-2xl border border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.5)] w-full h-[64px] group relative overflow-hidden ring-1 ring-white/5"
              style={{ WebkitAppRegion: 'drag' } as any}
            >
              {/* Drag Handle */}
              <div className="flex flex-col gap-1 px-1 cursor-grab active:cursor-grabbing opacity-30 hover:opacity-100 transition-opacity">
                <div className="w-1 h-1 bg-white rounded-full" />
                <div className="w-1 h-1 bg-white rounded-full" />
                <div className="w-1 h-1 bg-white rounded-full" />
              </div>

              {/* Animated Background Pulse */}
              {(micState === 'listening' || micState === 'processing') && (
                <div className={`absolute inset-0 animate-pulse pointer-events-none ${
                  micState === 'listening' ? 'bg-red-500/10' : 'bg-blue-500/10'
                }`} />
              )}

              {/* Mic Toggle Button */}
              <button
                onClick={toggleListening}
                disabled={micState === 'processing'}
                className={`relative z-10 p-3 rounded-xl transition-all duration-300 shadow-lg group/mic flex items-center justify-center ${
                  micState === 'listening' 
                    ? 'bg-red-500 hover:bg-red-600 scale-105' 
                    : micState === 'processing'
                    ? 'bg-blue-600 cursor-wait'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
                style={{ WebkitAppRegion: 'no-drag' } as any}
              >
                {micState === 'listening' ? (
                  <StopIcon className="w-6 h-6 text-white" />
                ) : micState === 'processing' ? (
                  <ArrowPathIcon className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <MicrophoneIcon className="w-6 h-6 text-white" />
                )}
              </button>

              {/* In-Bar Input for Chat Mode */}
              {actionMode === 'chat' ? (
                <form 
                  onSubmit={handleSubmitManualText}
                  className="flex-1 flex items-center bg-white/5 border border-white/10 rounded-xl px-3 relative group/input"
                  style={{ WebkitAppRegion: 'no-drag' } as any}
                >
                  <input 
                    type="text"
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="Type message to Atlas..."
                    className="bg-transparent border-none text-white text-xs w-full py-2 placeholder:text-white/20 outline-none"
                  />
                  <button 
                    type="button"
                    onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                    className={`p-1 rounded-lg transition-colors ${isDrawerOpen ? 'bg-blue-500 text-white' : 'hover:bg-white/10 text-white/40'}`}
                  >
                    <ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-1.5 px-2 flex-1 h-full min-w-[80px]">
                  {[...Array(12)].map((_, i) => {
                    let barHeight = 4;
                    if (micState === 'listening') {
                      barHeight = Math.max(4, (volume / 100) * 32 * (0.6 + Math.random() * 0.4));
                    } else if (micState === 'processing') {
                      barHeight = 12;
                    }

                    return (
                      <div
                        key={i}
                        className={`w-1 rounded-full transition-all duration-200 ${
                          micState === 'listening' 
                            ? (i % 2 === 0 ? 'bg-blue-400' : 'bg-purple-400')
                            : micState === 'processing'
                            ? (i % 2 === 0 ? 'bg-indigo-400 animate-pulse' : 'bg-blue-400 animate-pulse')
                            : 'bg-white/10'
                        }`}
                        style={{ 
                          height: `${barHeight}px`,
                          animationDelay: micState === 'processing' ? `${i * 0.1}s` : undefined,
                          opacity: micState === 'listening' ? 0.7 + (Math.random() * 0.3) : micState === 'processing' ? 0.6 : 0.2
                        }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Action Mode Toggle */}
              <button
                onClick={toggleActionMode}
                className={`relative z-10 px-3 py-2 rounded-xl transition-all duration-200 border flex items-center gap-2 group/mode ${
                  actionMode === 'chat'
                    ? 'bg-blue-500/25 border-blue-500/40 text-blue-300 hover:bg-blue-500/40'
                    : actionMode === 'aiGenerate' 
                    ? 'bg-indigo-500/25 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/40' 
                    : 'bg-emerald-500/25 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/40'
                }`}
                style={{ WebkitAppRegion: 'no-drag' } as any}
              >
                {actionMode === 'chat' ? (
                  <ChatBubbleLeftRightIcon className="w-5 h-5 text-blue-400" />
                ) : actionMode === 'aiGenerate' ? (
                  <SparklesIcon className="w-5 h-5" />
                ) : (
                  <DocumentTextIcon className="w-5 h-5" />
                )}
              </button>

              {/* Screenshot Button - Only in Chat/AI Generate modes */}
              {(actionMode === 'chat' || actionMode === 'aiGenerate') && (
                <button
                  onClick={captureScreenshot}
                  disabled={isCapturingScreenshot}
                  className={`relative z-10 p-2.5 rounded-xl transition-all duration-200 border flex items-center justify-center ${
                    screenshot
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 border-purple-400/50 text-white'
                      : isCapturingScreenshot
                      ? 'bg-white/5 border-white/10 text-white/30 cursor-wait'
                      : 'bg-purple-500/25 border-purple-500/40 text-purple-300 hover:bg-purple-500/40'
                  }`}
                  style={{ WebkitAppRegion: 'no-drag' } as any}
                  title={screenshot ? 'Screenshot ready' : 'Capture screenshot'}
                >
                  <CameraIcon className="w-5 h-5" />
                  {screenshot && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                  )}
                </button>
              )}

              {/* Settings & Expand Buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    window.electronAPI.overlay.toMainWindow({ type: 'navigate', path: '/settings?tab=voice' });
                  }}
                  className="p-2.5 text-white/30 hover:text-white/70 hover:bg-white/10 rounded-xl transition-all"
                  style={{ WebkitAppRegion: 'no-drag' } as any}
                >
                  <Cog6ToothIcon className="w-5 h-5" />
                </button>

                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-2.5 text-white/30 hover:text-white/70 hover:bg-white/10 rounded-xl transition-all"
                  style={{ WebkitAppRegion: 'no-drag' } as any}
                >
                  <ArrowsRightLeftIcon className="rotate-90 w-5 h-5" />
                </button>

                <button
                  onClick={closeOverlay}
                  className="p-2.5 text-white/30 hover:text-red-400 hover:bg-white/10 rounded-xl transition-all"
                  style={{ WebkitAppRegion: 'no-drag' } as any}
                  title="Hide Overlay"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div 
            className="flex items-center gap-1.5 p-1 bg-slate-900/90 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl w-[160px] h-[48px] transition-all group/collapsed overflow-hidden"
            style={{ WebkitAppRegion: 'drag' } as any}
          >
            {/* Tiny Drag Handle / Indicator */}
            <div className={`w-1 h-3 ml-2 rounded-full transition-colors ${
              micState === 'listening' ? 'bg-red-500 animate-pulse' : 'bg-white/20'
            }`} />

            {/* Mini Mic Toggle */}
            <button
              onClick={toggleListening}
              className={`p-2 rounded-full transition-all flex items-center justify-center relative ${
                micState === 'listening' 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-green-500 hover:bg-green-600'
              }`}
              style={{ WebkitAppRegion: 'no-drag' } as any}
              title={micState === 'listening' ? 'Stop Listening' : 'Start Listening'}
            >
              {micState === 'listening' ? (
                <StopIcon className="w-4 h-4 text-white" />
              ) : (
                <MicrophoneIcon className="w-4 h-4 text-white" />
              )}
              {micState === 'listening' && (
                <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-25" />
              )}
            </button>

            {/* Mini Mode Toggle */}
            <button
              onClick={toggleActionMode}
              className={`p-2 rounded-xl transition-all border flex items-center justify-center ${
                actionMode === 'chat'
                  ? 'bg-blue-500/25 border-blue-500/40 text-blue-300'
                  : actionMode === 'aiGenerate' 
                  ? 'bg-indigo-500/25 border-indigo-500/40 text-indigo-300' 
                  : 'bg-emerald-500/25 border-emerald-500/40 text-emerald-300'
              }`}
              style={{ WebkitAppRegion: 'no-drag' } as any}
              title={actionMode === 'chat' ? 'AI Chat Mode' : actionMode === 'aiGenerate' ? 'AI Generate Mode' : 'Dictation Mode'}
            >
              {actionMode === 'chat' ? (
                <ChatBubbleLeftRightIcon className="w-4 h-4" />
              ) : actionMode === 'aiGenerate' ? (
                <SparklesIcon className="w-4 h-4" />
              ) : (
                <DocumentTextIcon className="w-4 h-4" />
              )}
            </button>

            {/* Expand Button */}
            <button
              onClick={() => setIsExpanded(true)}
              className="p-2 text-white/30 hover:text-white/70 transition-all ml-auto pr-2"
              style={{ WebkitAppRegion: 'no-drag' } as any}
              title="Expand Voice Bar"
            >
              <ArrowsRightLeftIcon className="w-4 h-4 rotate-90" />
            </button>

            {/* Close Button */}
            <button
              onClick={closeOverlay}
              className="p-2 text-white/30 hover:text-red-400 transition-all ml-1"
              style={{ WebkitAppRegion: 'no-drag' } as any}
              title="Hide Overlay"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`${isOverlay ? 'relative' : 'fixed z-50'} transition-all duration-200 ${
        !isOverlay && (position.edge === 'left' ? 'left-0' : 'right-0')
      }`}
      style={!isOverlay ? { top: `${position.y}%`, transform: 'translateY(-50%)' } : {}}
    >
      {/* AI Response Panel */}
      {showResponsePanel && lastAiResponse && (
        <div 
          className={`absolute bottom-full mb-4 ${
            position.edge === 'left' ? 'left-0' : 'right-0'
          } w-80 bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl p-4 overflow-hidden animate-in slide-in-from-bottom-4 duration-300`}
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
             <div className="flex items-center gap-2">
                <SparklesIcon className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Assistant Intelligence</span>
             </div>
             <button 
               onClick={() => {
                 setShowResponsePanel(false);
                 if (micState === 'idle') setTranscript('');
               }}
               className="p-1 hover:bg-white/10 rounded-lg transition-colors"
             >
                <XMarkIcon className="w-4 h-4 text-white/50" />
             </button>
          </div>
          
          <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
             {transcript && (
               <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <div className="text-[10px] uppercase font-bold text-white/30 mb-1">Transcription</div>
                  <p className="text-sm text-white/80 leading-relaxed italic">"{transcript}"</p>
               </div>
             )}
             
             <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20 shadow-inner">
                <div className="flex items-center justify-between mb-1">
                   <div className="text-[10px] uppercase font-bold text-blue-400">Response</div>
                   {isPlayingVoice && (
                      <div className="flex gap-0.5 items-end h-3">
                         <div className="w-0.5 bg-blue-400 animate-pulse h-full" />
                         <div className="w-0.5 bg-blue-400 animate-pulse h-2/3" style={{ animationDelay: '0.1s' }} />
                         <div className="w-0.5 bg-blue-400 animate-pulse h-4/5" style={{ animationDelay: '0.2s' }} />
                      </div>
                   )}
                </div>
                <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{lastAiResponse}</p>
             </div>
          </div>

          <div className="mt-4 flex gap-2">
             <button 
               onClick={async () => {
                  await window.electronAPI?.clipboard?.writeText(lastAiResponse);
                  await window.electronAPI?.notification?.show({ title: 'Copied', body: 'Response copied to clipboard' });
               }}
               className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold rounded-xl transition-all border border-white/5"
             >
                Copy Response
             </button>
             <button 
                onClick={() => playVoiceResponse(lastAiResponse)}
                className={`p-2 rounded-xl transition-all shadow-lg ${
                  isPlayingVoice ? 'bg-amber-500 shadow-amber-500/20' : 'bg-blue-500 shadow-blue-500/20 hover:bg-blue-600'
                } text-white`}
             >
                {isPlayingVoice ? <SpeakerWaveIcon className="w-4 h-4 animate-pulse" /> : <SpeakerWaveIcon className="w-4 h-4" />}
             </button>
          </div>
        </div>
      )}

      {/* Expanded panel */}
      {isExpanded && (
        <div
          className={`absolute ${
            isOverlay 
              ? (position.edge === 'left' ? 'left-14' : 'right-14') 
              : (position.edge === 'left' ? 'left-14' : 'right-14')
          } top-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl p-3 w-64 border border-gray-200`}
        >
          {/* Mode indicator */}
          <div className="flex items-center gap-2 mb-2">
            {actionMode === 'chat' ? (
              <>
                <ChatBubbleLeftRightIcon className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium text-blue-600">AI Chat</span>
              </>
            ) : actionMode === 'aiGenerate' ? (
              <>
                <SparklesIcon className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-medium text-indigo-600">AI Generate</span>
              </>
            ) : (
              <>
                <DocumentTextIcon className="w-4 h-4 text-green-500" />
                <span className="text-xs font-medium text-green-600">Dictation</span>
              </>
            )}
            <span className="text-xs text-gray-400 ml-auto">
              {micState === 'listening' ? 'Listening...' : micState === 'processing' ? 'Processing...' : ''}
            </span>
          </div>

          {/* Transcript preview */}
          <div className="text-sm text-gray-700 min-h-[40px] max-h-[100px] overflow-y-auto">
            {interimTranscript || transcript || (
              <span className="text-gray-400 italic">
                {micState === 'listening' ? 'Start speaking...' : 'Click mic or press Ctrl+Shift+M'}
              </span>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-2 text-xs bg-red-50 rounded p-2">
              <p className="text-red-600 font-medium">{error}</p>
              {error.toLowerCase().includes('internet') || error.toLowerCase().includes('network') ? (
                <div className="mt-1 space-y-2">
                  <p className="text-gray-600">
                    Web Speech API failed. You can check your connection or switch to Whisper (offline).
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setMicState('idle');
                        setRetryCount(0);
                        startListening();
                      }}
                      className="flex-1 px-2 py-1.5 bg-blue-500 text-white text-[10px] font-bold rounded uppercase hover:bg-blue-600 transition-colors"
                    >
                      Retry
                    </button>
                    {canSwitchToWhisper ? (
                      <button
                        type="button"
                        onClick={handleSwitchToWhisper}
                        className="flex-1 px-2 py-1.5 bg-purple-600 text-white text-[10px] font-bold rounded uppercase hover:bg-purple-700 transition-colors"
                      >
                        Switch to Whisper
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          window.location.hash = '/settings';
                          setIsExpanded(false);
                        }}
                        className="flex-1 px-2 py-1.5 bg-slate-600 text-white text-[10px] font-bold rounded uppercase hover:bg-slate-700 transition-colors"
                      >
                        Setup Whisper
                      </button>
                    )}
                  </div>
                </div>
              ) : error.toLowerCase().includes('permission') ? (
                <p className="text-gray-600 mt-1">
                  Click the microphone icon in your browser's address bar to allow access.
                </p>
              ) : retryCount > 0 && retryCount < maxRetries ? (
                <p className="text-gray-500 mt-1">
                  Retrying... ({retryCount}/{maxRetries})
                </p>
              ) : null}
            </div>
          )}

          {/* Waveform visualization placeholder */}
          {micState === 'listening' && (
            <div className="mt-2 flex items-center justify-center gap-1 h-6">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-blue-500 rounded-full animate-pulse"
                  style={{
                    height: `${Math.random() * 16 + 8}px`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Quick Controls */}
          <div className={`mt-3 pt-3 border-t border-slate-100 grid gap-2 ${
            (actionMode === 'chat' || actionMode === 'aiGenerate') ? 'grid-cols-3' : 'grid-cols-2'
          }`}>
            <button
              onClick={toggleProvider}
              className={`flex items-center justify-center gap-2 p-2 rounded-lg transition-all border ${
                settings?.provider === 'whisper' 
                  ? 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100' 
                  : settings?.provider === 'google'
                  ? 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100'
                  : settings?.provider === 'elevenlabs'
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100'
                  : 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100'
              }`}
            >
              {settings?.provider === 'whisper' ? (
                <>
                  <CpuChipIcon className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-tight">Local</span>
                </>
              ) : settings?.provider === 'google' ? (
                <>
                  <CloudIcon className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-tight">Cloud</span>
                </>
              ) : settings?.provider === 'elevenlabs' ? (
                <>
                  <BoltIcon className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-tight">Premium</span>
                </>
              ) : (
                <>
                  <GlobeAltIcon className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-tight">Web</span>
                </>
              )}
            </button>

            <button
              onClick={toggleVoiceFeedback}
              onContextMenu={(e) => {
                 e.preventDefault();
                 toggleTTSProvider();
              }}
              className={`flex items-center justify-center gap-2 p-2 rounded-lg transition-all border ${
                settings?.voiceFeedback 
                  ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' 
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {settings?.voiceFeedback ? (
                <>
                  {settings.ttsProvider === 'elevenlabs' ? (
                    <MusicalNoteIcon className="w-3.5 h-3.5" />
                  ) : (
                    <SpeakerWaveIcon className="w-3.5 h-3.5" />
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-tight">VOICE ON</span>
                </>
              ) : (
                <>
                  <SpeakerWaveIcon className="w-3.5 h-3.5 opacity-40" />
                  <span className="text-[10px] font-bold uppercase tracking-tight opacity-40">VOICE OFF</span>
                </>
              )}
            </button>

            {/* Screenshot button - only show in chat or aiGenerate modes */}
            {(actionMode === 'chat' || actionMode === 'aiGenerate') && (
              <button
                onClick={captureScreenshot}
                disabled={isCapturingScreenshot}
                className={`flex items-center justify-center gap-2 p-2 rounded-lg transition-all border ${
                  screenshot
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white border-purple-300'
                    : isCapturingScreenshot
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-wait'
                    : 'bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-blue-100'
                }`}
              >
                <CameraIcon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-tight">
                  {screenshot ? 'READY' : isCapturingScreenshot ? '...' : 'SCREEN'}
                </span>
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between px-1">
            <span className="text-[9px] text-slate-400 font-medium">aethermsaid hub Voice Command</span>
            <button
              onClick={toggleActionMode}
              className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
            >
              {actionMode === 'chat' ? (
                <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
              ) : actionMode === 'aiGenerate' ? (
                <SparklesIcon className="w-3.5 h-3.5" />
              ) : (
                <DocumentTextIcon className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={() => {
                if (window.electronAPI?.overlay) {
                   window.electronAPI.overlay.toMainWindow({ type: 'navigate', path: '/settings?tab=voice' });
                } else {
                   window.location.hash = '/settings?tab=voice';
                }
                setIsExpanded(false);
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
            >
              <Cog6ToothIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main mic button */}
      <button
        onClick={toggleListening}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={micState === 'processing'}
        className={`
          relative p-3 rounded-full shadow-lg transition-all duration-200
          bg-gradient-to-r ${getButtonGradient()}
          hover:shadow-xl hover:scale-105
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isDragging ? 'cursor-grabbing scale-110' : 'cursor-grab'}
          ${position.edge === 'left' ? 'rounded-l-none' : 'rounded-r-none'}
        `}
        title={`${actionMode === 'chat' ? 'AI Chat' : actionMode === 'aiGenerate' ? 'AI Generate' : 'Dictation'} Mode - ${
          micState === 'listening' ? 'Click to stop' : 'Click to start'
        }`}
      >
        {/* Icon */}
        {micState === 'listening' ? (
          <StopIcon className="w-5 h-5 text-white" />
        ) : (
          <MicrophoneIcon className="w-5 h-5 text-white" />
        )}

        {/* Mode indicator dot */}
        <div
          className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${getStatusColor()}`}
        />

        {/* Pulse animation when listening */}
        {micState === 'listening' && (
          <span className="absolute inset-0 rounded-full bg-red-500 opacity-75 animate-ping" />
        )}

        {/* Processing spinner */}
        {micState === 'processing' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-full rounded-full border-2 border-white border-t-transparent animate-spin" />
          </div>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && !isExpanded && !isDragging && (
        <div
          className={`absolute ${
            position.edge === 'left' ? 'left-14' : 'right-14'
          } top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-lg`}
        >
          <div className="font-medium">
            {actionMode === 'chat' ? 'AI Chat' : actionMode === 'aiGenerate' ? 'AI Generate' : 'Dictation'}
          </div>
          <div className="text-gray-400 text-[10px] mt-0.5">
            Ctrl+Shift+M to toggle | Ctrl+Shift+D to switch mode
          </div>
        </div>
      )}
    </div>
  );
};

export default FloatingMicWidget;
