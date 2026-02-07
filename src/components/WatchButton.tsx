import * as React from 'react';
import { useState, useEffect } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import type { WatchPlatform, WatchItemType } from '../types';
import { addToWatchList, removeFromWatchListByItemId, isItemWatched } from '../services/watchService';

interface WatchButtonProps {
  platform: WatchPlatform;
  itemType: WatchItemType;
  itemId: string;
  itemName: string;
  itemMetadata?: Record<string, any>;
  variant?: 'icon' | 'button' | 'compact';
  className?: string;
  onWatchChange?: (isWatched: boolean) => void;
}

// Generate default action text based on item type
const getDefaultAction = (itemType: WatchItemType, itemName: string): string => {
  const actions: Record<WatchItemType, string> = {
    email_address: `Monitor emails from ${itemName} for important updates`,
    discord_server: `Watch ${itemName} server for relevant discussions`,
    discord_channel: `Monitor ${itemName} channel for new messages`,
    whatsapp_chat: `Track ${itemName} chat for action items`,
    telegram_chat: `Monitor ${itemName} for new messages`,
    telegram_channel: `Watch ${itemName} channel for updates`,
    github_repo: `Track ${itemName} repo for issues and PRs`,
    github_user: `Monitor ${itemName}'s GitHub activity`,
    calendar_event: `Track updates for ${itemName} event`,
  };
  return actions[itemType] || `Monitor ${itemName} for updates`;
};

/**
 * Reusable Watch Button Component
 * Adds to watch list immediately with pending status
 */
const WatchButton: React.FC<WatchButtonProps> = ({
  platform,
  itemType,
  itemId,
  itemName,
  itemMetadata,
  variant = 'button',
  className = '',
  onWatchChange,
}) => {
  const [isWatched, setIsWatched] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if item is watched on mount
  useEffect(() => {
    const checkWatched = async () => {
      const watched = await isItemWatched(platform, itemType, itemId);
      setIsWatched(watched);
    };
    checkWatched();
  }, [platform, itemType, itemId]);

  const handleClick = async () => {
    setLoading(true);
    try {
      if (isWatched) {
        // Remove from watch list
        await removeFromWatchListByItemId(platform, itemType, itemId);
        setIsWatched(false);
        onWatchChange?.(false);
      } else {
        // Add to watch list immediately with default action
        const defaultAction = getDefaultAction(itemType, itemName);
        await addToWatchList({
          platform,
          itemType,
          itemId,
          itemName,
          itemMetadata,
          action: defaultAction,
        });
        setIsWatched(true);
        onWatchChange?.(true);
      }
    } catch (error) {
      console.error('Failed to update watch list:', error);
    } finally {
      setLoading(false);
    }
  };

  // Icon only variant
  if (variant === 'icon') {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        className={`p-2 rounded-lg transition-colors ${
          isWatched 
            ? 'text-amber-500 hover:bg-amber-50' 
            : 'text-slate-400 hover:bg-slate-100 hover:text-amber-500'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        title={isWatched ? 'Remove from watch list' : 'Add to watch list'}
      >
        {isWatched ? (
          <EyeIcon className="w-4 h-4" />
        ) : (
          <EyeSlashIcon className="w-4 h-4" />
        )}
      </button>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
          isWatched 
            ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' 
            : 'text-slate-500 hover:bg-slate-100 hover:text-amber-600'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        title={isWatched ? 'Remove from watch list' : 'Add to watch list'}
      >
        {isWatched ? (
          <>
            <EyeIcon className="w-3 h-3" />
            Watching
          </>
        ) : (
          <>
            <EyeSlashIcon className="w-3 h-3" />
            Watch
          </>
        )}
      </button>
    );
  }

  // Full button variant
  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
        isWatched 
          ? 'text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200' 
          : 'text-slate-600 bg-slate-50 hover:bg-amber-50 hover:text-amber-600 border border-slate-200'
      } ${loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      title={isWatched ? 'Remove from watch list' : 'Add to watch list'}
    >
      {isWatched ? (
        <>
          <EyeIcon className="w-4 h-4" />
          Watching
        </>
      ) : (
        <>
          <EyeSlashIcon className="w-4 h-4" />
          Watch
        </>
      )}
    </button>
  );
};

export default WatchButton;
