import React, { useEffect, useState } from 'react';
import { 
  XMarkIcon, 
  MinusIcon, 
  Square2StackIcon,
  StopIcon 
} from '@heroicons/react/24/outline';

interface TitleBarProps {
  title?: string;
}

const TitleBar: React.FC<TitleBarProps> = ({ title = 'aethermsaid hub' }) => {
  const [platform, setPlatform] = useState<string>('');
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Get platform info
    if (window.electronAPI) {
      window.electronAPI.app.getPlatform().then(p => {
        console.log('Platform:', p);
        setPlatform(p);
      }).catch(err => console.error('Failed to get platform:', err));
      
      window.electronAPI.window.isMaximized().then(m => {
        console.log('Is maximized:', m);
        setIsMaximized(m);
      }).catch(err => console.error('Failed to check maximized:', err));
    } else {
      console.warn('electronAPI not available - running in browser mode');
    }
  }, []);

  const handleMinimize = () => {
    console.log('🟡 RENDERER: Minimize button clicked');
    console.log('🟡 RENDERER: electronAPI exists?', !!window.electronAPI);
    if (window.electronAPI) {
      console.log('🟡 RENDERER: Calling electronAPI.window.minimize()');
      window.electronAPI.window.minimize();
    } else {
      console.error('❌ RENDERER: electronAPI not available!');
    }
  };

  const handleMaximize = async () => {
    console.log('🟡 RENDERER: Maximize button clicked');
    console.log('🟡 RENDERER: electronAPI exists?', !!window.electronAPI);
    if (!window.electronAPI) {
      console.error('❌ RENDERER: electronAPI not available!');
      return;
    }
    
    console.log('🟡 RENDERER: Calling electronAPI.window.maximize()');
    window.electronAPI.window.maximize();
    
    // Update state after a short delay to reflect the change
    setTimeout(async () => {
      const maximized = await window.electronAPI.window.isMaximized();
      setIsMaximized(maximized || false);
    }, 100);
  };

  const handleClose = () => {
    console.log('🟡 RENDERER: Close button clicked');
    console.log('🟡 RENDERER: electronAPI exists?', !!window.electronAPI);
    if (window.electronAPI) {
      console.log('🟡 RENDERER: Calling electronAPI.window.close()');
      window.electronAPI.window.close();
    } else {
      console.error('❌ RENDERER: electronAPI not available!');
    }
  };

  // macOS style - traffic lights on left (handled by Electron natively)
  if (platform === 'darwin') {
    return (
      <div 
        className="h-8 bg-white border-b border-slate-100 flex items-center justify-center select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* macOS traffic lights are native, just provide draggable area */}
        <div className="text-xs font-semibold text-slate-600 tracking-tight">
          {title}
        </div>
      </div>
    );
  }

  // Windows/Linux style - controls on right
  return (
    <div 
      className="h-8 bg-white border-b border-slate-100 flex items-center justify-between select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left side - App branding */}
      <div className="flex items-center space-x-2 px-3">
        <div className="w-4 h-4 bg-indigo-600 rounded flex items-center justify-center text-white font-bold text-[10px]">
          N
        </div>
        <span className="text-xs font-semibold text-slate-700 tracking-tight">
          {title}
        </span>
      </div>

      {/* Right side - Window controls */}
      <div 
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Minimize */}
        <button
          onClick={handleMinimize}
          className="h-full px-4 hover:bg-slate-100 transition-colors duration-150 flex items-center justify-center group"
          aria-label="Minimize"
        >
          <MinusIcon className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-900" />
        </button>

        {/* Maximize/Restore */}
        <button
          onClick={handleMaximize}
          className="h-full px-4 hover:bg-slate-100 transition-colors duration-150 flex items-center justify-center group"
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <Square2StackIcon className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-900" />
          ) : (
            <StopIcon className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-900" />
          )}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="h-full px-4 hover:bg-red-500 transition-colors duration-150 flex items-center justify-center group"
          aria-label="Close"
        >
          <XMarkIcon className="w-3.5 h-3.5 text-slate-600 group-hover:text-white" />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
