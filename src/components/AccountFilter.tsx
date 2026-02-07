import React, { useState } from 'react';
import { Account, Platform, Folder } from '../types';
import { 
  FunnelIcon,
  ChartBarIcon,
  ServerIcon,
  TagIcon,
  EnvelopeIcon,
  CodeBracketIcon,
  FolderIcon,
  PlusIcon,
  XMarkIcon,
  EyeSlashIcon
} from '@heroicons/react/24/solid';

interface AccountFilterProps {
  accounts: Account[];
  selectedAccountIds: string[];
  onFilterChange: (accountIds: string[]) => void;
  showAllOption?: boolean;
  compact?: boolean;
  folders?: Folder[];
  onFolderSelect?: (folderId: string | null) => void;
  selectedFolderId?: string | null;
  showFolders?: boolean;
  showIgnored?: boolean;
  onToggleIgnored?: () => void;
}

// Brand icons for each platform
export const BrandIcon = ({ platform, className = "w-4 h-4" }: { platform: Platform | string, className?: string }) => {
  switch (platform) {
    case 'google':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      );
    case 'google_analytics':
      return <ChartBarIcon className={`${className} text-orange-500`} />;
    case 'clarity':
      return <div className={`flex items-center justify-center ${className} bg-blue-600 rounded-sm text-[8px] font-bold text-white`}>C</div>;
    case 'resend':
      return <EnvelopeIcon className={`${className} text-slate-900`} />;
    case 'smtp':
      return <ServerIcon className={`${className} text-slate-500`} />;
    case 'outlook':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="#0078d4">
          <path d="M2 3l14-2.5V21l-14-2.5V3zm16 1.5l4 0.5v14l-4 0.5V4.5z"/>
        </svg>
      );
    case 'slack':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.528 2.528 0 0 1 2.522-2.52h2.52v2.52zm1.263 0a2.528 2.528 0 0 1-2.52-2.52h6.313a2.528 2.528 0 0 1 0 5.056H8.826a2.528 2.528 0 0 1-2.521-2.536z" fill="#36C5F0"/>
          <path d="M8.826 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.826 0a2.528 2.528 0 0 1 2.522 2.522v2.52h-2.522zm0 1.263a2.528 2.528 0 0 1 2.522 2.52v6.313a2.528 2.528 0 1 1-5.056 0V8.826a2.528 2.528 0 0 1 2.534-2.521z" fill="#2EB67D"/>
          <path d="M18.958 8.826a2.528 2.528 0 0 1 2.521-2.522A2.528 2.528 0 0 1 24 8.826a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.826zm-1.263 0a2.528 2.528 0 0 1-2.52 2.521H8.862a2.528 2.528 0 1 1 0-5.056h6.313a2.528 2.528 0 0 1 2.52 2.535z" fill="#ECB22E"/>
          <path d="M15.174 18.958a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.174 24a2.528 2.528 0 0 1-2.522-2.522v-2.52h2.522zm0-1.263a2.528 2.528 0 0 1-2.522-2.52V8.862a2.528 2.528 0 1 1 5.056 0v6.313a2.528 2.528 0 0 1-2.534 2.521z" fill="#E01E5A"/>
        </svg>
      );
    case 'github':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
        </svg>
      );
    default:
      return <TagIcon className={className} />;
  }
};

// Get brand color for platform
export const getAccountBrandColor = (platform: Platform | string) => {
  switch(platform) {
    case 'google': return 'bg-indigo-600';
    case 'outlook': return 'bg-blue-600';
    case 'google_analytics': return 'bg-orange-600';
    case 'github': return 'bg-slate-800';
    case 'slack': return 'bg-purple-600';

    case 'clarity': return 'bg-blue-600';
    default: return 'bg-slate-700';
  }
};

const AccountFilter: React.FC<AccountFilterProps> = ({
  accounts,
  selectedAccountIds,
  onFilterChange,
  showAllOption = true,
  compact = false,
  folders = [],
  onFolderSelect,
  selectedFolderId = null,
  showFolders = false,
  showIgnored = false,
  onToggleIgnored
}) => {
  const allSelected = selectedAccountIds.length === accounts.length || selectedAccountIds.length === 0;
  const visibleAccounts = showIgnored ? accounts : accounts.filter(a => !a.ignored);

  const toggleAccount = (accountId: string) => {
    if (selectedAccountIds.includes(accountId)) {
      onFilterChange(selectedAccountIds.filter(id => id !== accountId));
    } else {
      onFilterChange([...selectedAccountIds, accountId]);
    }
  };

  const selectAll = () => {
    onFilterChange(visibleAccounts.map(a => a.id));
  };

  const selectNone = () => {
    onFilterChange([]);
  };

  const selectFolder = (folderId: string) => {
    if (onFolderSelect) {
      onFolderSelect(folderId === selectedFolderId ? null : folderId);
    }
    // Also update selected accounts to those in the folder
    const folder = folders.find(f => f.id === folderId);
    if (folder?.accountIds) {
      onFilterChange(folder.accountIds);
    }
  };

  if (visibleAccounts.length === 0 && folders.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${compact ? '' : 'bg-white p-4 rounded-2xl border border-slate-100 shadow-sm'}`}>
      {/* Folder Filter Row */}
      {showFolders && folders.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 mr-2">
            <FolderIcon className="w-4 h-4 text-slate-300" />
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
              Groups
            </span>
          </div>
          
          <button
            onClick={() => onFolderSelect && onFolderSelect(null)}
            className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-2 uppercase tracking-wider hover:scale-105 active:scale-95 ${
              !selectedFolderId
                ? 'bg-slate-800 text-white shadow-lg'
                : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100'
            }`}
          >
            All Groups
          </button>
          
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => selectFolder(folder.id)}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-2 uppercase tracking-wider hover:scale-105 active:scale-95 ${
                selectedFolderId === folder.id
                  ? `text-white shadow-md`
                  : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100'
              }`}
              style={{ 
                backgroundColor: selectedFolderId === folder.id ? (folder.color || '#6366f1') : undefined 
              }}
            >
              <FolderIcon className="w-3.5 h-3.5" />
              {folder.name}
              {folder.accountIds && (
                <span className="text-[9px] opacity-70">({folder.accountIds.length})</span>
              )}
            </button>
          ))}
        </div>
      )}
      
      {/* Account Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 mr-2">
          <FunnelIcon className="w-4 h-4 text-slate-300" />
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
            {compact ? 'Filter' : 'Filter by Account'}
          </span>
        </div>
        
        {showAllOption && (
          <button
            onClick={allSelected ? selectNone : selectAll}
            className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-2 uppercase tracking-wider hover:scale-105 active:scale-95 ${
              allSelected
                ? 'bg-slate-800 text-white shadow-lg'
                : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100'
            }`}
          >
            All
          </button>
        )}
        
        {visibleAccounts.map(acc => {
          const isSelected = allSelected || selectedAccountIds.includes(acc.id);
          const displayText = acc.email || acc.name;
          return (
            <button
              key={acc.id}
              onClick={() => {
                if (allSelected) {
                  onFilterChange([acc.id]);
                } else {
                  toggleAccount(acc.id);
                }
              }}
              title={`${acc.name}${acc.email ? ` (${acc.email})` : ''}`}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-2 uppercase tracking-wider hover:scale-105 active:scale-95 ${
                isSelected && !allSelected
                  ? `${getAccountBrandColor(acc.platform)} text-white shadow-md`
                  : allSelected
                  ? `${getAccountBrandColor(acc.platform)} text-white shadow-md opacity-80`
                  : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100'
              }`}
            >
              <BrandIcon 
                platform={acc.platform} 
                className={`w-3.5 h-3.5 ${isSelected ? 'brightness-200' : ''}`} 
              />
              <span className="max-w-[120px] truncate">{displayText}</span>
              {acc.ignored && <EyeSlashIcon className="w-3 h-3 opacity-50" />}
            </button>
          );
        })}
        
        {/* Show/hide ignored toggle */}
        {onToggleIgnored && accounts.some(a => a.ignored) && (
          <button
            onClick={onToggleIgnored}
            className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 ${
              showIgnored
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
            }`}
          >
            <EyeSlashIcon className="w-3 h-3" />
            {showIgnored ? 'Showing Hidden' : 'Show Hidden'}
          </button>
        )}
        
        {selectedAccountIds.length > 0 && selectedAccountIds.length < visibleAccounts.length && (
          <span className="text-[10px] text-slate-400 ml-2">
            {selectedAccountIds.length} of {visibleAccounts.length} selected
          </span>
        )}
      </div>
    </div>
  );
};

export default AccountFilter;
