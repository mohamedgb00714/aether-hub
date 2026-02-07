import React, { useState, useEffect } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
} from '@heroicons/react/24/solid';

interface SyncStatusFooterProps {
  lastSyncTime?: Date;
  nextSyncTime?: Date;
  isSyncing?: boolean;
  syncError?: string;
  onManualSync?: () => void;
  stats?: {
    emailsAnswered: number;
    meetingsAttended: number;
    averageResponseTime: string;
  };
}

const SyncStatusFooter: React.FC<SyncStatusFooterProps> = ({
  lastSyncTime,
  nextSyncTime,
  isSyncing,
  syncError,
  onManualSync,
  stats,
}) => {
  const [countdown, setCountdown] = useState<string>('');
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    if (!nextSyncTime) return;

    const updateCountdown = () => {
      const now = new Date();
      const diff = nextSyncTime.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown('Syncing soon...');
        return;
      }

      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (minutes > 0) {
        setCountdown(`${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [nextSyncTime]);

  const formatLastSync = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  };

  // Render sync status indicator
  const renderSyncStatus = () => {
    if (isSyncing) {
      return (
        <div className="flex items-center gap-2">
          <ArrowPathIcon className="w-4 h-4 text-indigo-600 animate-spin" />
          <span className="text-xs font-bold text-indigo-600">Syncing...</span>
        </div>
      );
    }
    if (syncError) {
      return (
        <div className="flex items-center gap-2">
          <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-amber-600">Sync Error</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
        <span className="text-xs font-bold text-emerald-600">Synced</span>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Sync Status */}
        <div className="flex items-center gap-6">
          {/* Status Indicator */}
          <div className="flex items-center gap-3">
            {renderSyncStatus()}
          </div>

          {/* Last Sync Time */}
          {lastSyncTime && !isSyncing && (
            <div className="flex items-center gap-2 text-slate-400">
              <ClockIcon className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium">
                Last sync: {formatLastSync(lastSyncTime)}
              </span>
            </div>
          )}

          {/* Next Sync Countdown */}
          {nextSyncTime && !isSyncing && countdown && (
            <div className="flex items-center gap-2 text-slate-400">
              <span className="text-[11px] font-medium">Next sync in: {countdown}</span>
            </div>
          )}

          {/* Sync Error Message */}
          {syncError && (
            <span className="text-[11px] text-amber-600 font-medium">{syncError}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Productivity Stats Toggle */}
          <button
            onClick={() => setShowStats(!showStats)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              showStats
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ChartBarIcon className="w-4 h-4" />
            Stats
          </button>

          {/* Manual Sync Button */}
          {onManualSync && (
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync Now
            </button>
          )}
        </div>
      </div>

      {/* Productivity Stats Panel */}
      {showStats && stats && (
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-2xl font-black text-slate-900">{stats.emailsAnswered}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Emails Answered
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-slate-900">{stats.meetingsAttended}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Meetings Attended
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-slate-900">{stats.averageResponseTime}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Avg Response Time
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncStatusFooter;
