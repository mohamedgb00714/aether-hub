import { useEffect } from 'react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  callback: () => void;
  description?: string;
}

/**
 * Hook for registering keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const {
          key,
          ctrl = false,
          shift = false,
          alt = false,
          meta = false,
          callback,
        } = shortcut;

        const ctrlMatch = ctrl === (event.ctrlKey || event.metaKey);
        const shiftMatch = shift === event.shiftKey;
        const altMatch = alt === event.altKey;
        const metaMatch = meta === event.metaKey;
        const keyMatch = event.key.toLowerCase() === key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && metaMatch && keyMatch) {
          event.preventDefault();
          callback();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

export function getModifierSymbol(): string {
  const isMac = navigator.platform.toLowerCase().includes('mac');
  return isMac ? '⌘' : 'Ctrl';
}
