/**
 * useMicHotkeys Hook
 * Manages global hotkeys for the floating microphone widget
 * Listens to both Electron global shortcuts and local keyboard events
 */

import { useEffect, useRef, useCallback } from 'react';

export interface UseMicHotkeysProps {
  onToggle: () => void;
  onPushToTalkStart: () => void;
  onPushToTalkEnd: () => void;
  onModeSwitch: () => void;
  enabled?: boolean;
}

export function useMicHotkeys({
  onToggle,
  onPushToTalkStart,
  onPushToTalkEnd,
  onModeSwitch,
  enabled = true,
}: UseMicHotkeysProps): void {
  // Track if push-to-talk is currently active
  const isPTTActive = useRef(false);

  // Memoize callbacks to prevent unnecessary re-subscriptions
  const handleToggle = useCallback(() => {
    if (enabled) onToggle();
  }, [onToggle, enabled]);

  const handleModeSwitch = useCallback(() => {
    if (enabled) onModeSwitch();
  }, [onModeSwitch, enabled]);

  const handlePTTStart = useCallback(() => {
    if (enabled && !isPTTActive.current) {
      isPTTActive.current = true;
      onPushToTalkStart();
    }
  }, [onPushToTalkStart, enabled]);

  const handlePTTEnd = useCallback(() => {
    if (enabled && isPTTActive.current) {
      isPTTActive.current = false;
      onPushToTalkEnd();
    }
  }, [onPushToTalkEnd, enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Subscribe to Electron global shortcuts via IPC
    const unsubscribers: (() => void)[] = [];

    // Toggle mic (Ctrl+Shift+M)
    const unsubToggle = window.electronAPI?.mic?.onToggle(handleToggle);
    if (unsubToggle) unsubscribers.push(unsubToggle);

    // Mode switch (Ctrl+Shift+D)
    const unsubModeSwitch = window.electronAPI?.mic?.onModeSwitch(handleModeSwitch);
    if (unsubModeSwitch) unsubscribers.push(unsubModeSwitch);

    // Push-to-talk start (Ctrl+Space) - from global shortcut
    const unsubPTTStart = window.electronAPI?.mic?.onPushToTalkStart(handlePTTStart);
    if (unsubPTTStart) unsubscribers.push(unsubPTTStart);

    // Local keyboard events for push-to-talk keyup
    // (Electron globalShortcut doesn't support keyup, so we handle it locally)
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+Space (push-to-talk)
      if (event.ctrlKey && event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        handlePTTStart();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // End push-to-talk when Space is released (regardless of Ctrl state)
      if (event.code === 'Space' && isPTTActive.current) {
        event.preventDefault();
        handlePTTEnd();
      }
    };

    // Handle window blur to ensure PTT ends if user switches windows
    const handleBlur = () => {
      if (isPTTActive.current) {
        handlePTTEnd();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      // Cleanup all subscriptions
      unsubscribers.forEach(unsub => unsub());
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);

      // Ensure PTT is ended on cleanup
      if (isPTTActive.current) {
        isPTTActive.current = false;
      }
    };
  }, [enabled, handleToggle, handleModeSwitch, handlePTTStart, handlePTTEnd]);
}

export default useMicHotkeys;
