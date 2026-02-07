import React, { useEffect } from 'react';
import FloatingMicWidget from '../components/FloatingMicWidget';

const MicOverlayPage: React.FC = () => {
  const [position, setPosition] = React.useState<{edge: 'left' | 'right'}>({edge: 'right'});

  useEffect(() => {
    // Microphone overlay specific styles
    document.body.style.backgroundColor = 'transparent';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'visible';
    
    // Check if electronAPI is available
    if (!window.electronAPI) {
      console.warn('⚠️ electronAPI not available yet');
      return;
    }
    
    // Load position to align container
    window.electronAPI.store.get('mic_position').then(pos => {
      if (pos) setPosition(pos);
    });

    // Listen for settings changes
    let unsubscribe: (() => void) | undefined;
    if (window.electronAPI?.overlay?.onSettingsChanged) {
      unsubscribe = window.electronAPI.overlay.onSettingsChanged(() => {
        window.electronAPI.store.get('mic_position').then(pos => {
          if (pos) setPosition(pos);
        });
      });
    }

    console.log('🎤 Mic Overlay Page Loaded');
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <div className="w-fit h-fit bg-transparent flex items-center relative">
      <FloatingMicWidget isOverlay={true} />
    </div>
  );
};

export default MicOverlayPage;
