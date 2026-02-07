import React from 'react';
import {
  CodeBracketIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationCircleIcon,
  ChatBubbleLeftIcon,
  EyeIcon,
} from '@heroicons/react/24/solid';
import { GithubItem } from '../../services/database';

interface GitHubWidgetProps {
  items: GithubItem[];
  loading?: boolean;
  onViewItem?: (item: GithubItem) => void;
  onMarkAsRead?: (id: string) => void;
}

const GitHubWidget: React.FC<GitHubWidgetProps> = ({
  items,
  loading,
  onViewItem,
  onMarkAsRead,
}) => {
  const prs = items.filter((item) => item.type === 'pr').slice(0, 3);
  const issues = items.filter((item) => item.type === 'issue').slice(0, 3);
  const notifications = items.filter((item) => item.type === 'notification' && !item.isRead).slice(0, 3);

  const getStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'open':
        return 'bg-emerald-100 text-emerald-700';
      case 'closed':
        return 'bg-purple-100 text-purple-700';
      case 'merged':
        return 'bg-indigo-100 text-indigo-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-8 py-6 flex items-center gap-4 border-b border-slate-50">
          <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
            <CodeBracketIcon className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">GitHub Activity</h2>
        </div>
        <div className="p-6 space-y-4">
          {['gh-sk-1', 'gh-sk-2', 'gh-sk-3'].map((key) => (
            <div key={key} className="animate-pulse flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
              <div className="w-8 h-8 bg-slate-200 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-8 py-6 flex items-center gap-4 border-b border-slate-50">
          <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
            <CodeBracketIcon className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">GitHub Activity</h2>
        </div>
        <div className="p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CodeBracketIcon className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-sm text-slate-500 font-medium">No GitHub activity yet</p>
          <p className="text-xs text-slate-400 mt-1">Connect a GitHub account to see your PRs and issues</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-8 py-6 flex items-center justify-between border-b border-slate-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
            <CodeBracketIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">GitHub Activity</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {items.filter(i => !i.isRead).length} unread
            </p>
          </div>
        </div>
        <a
          href="https://github.com/notifications"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
        >
          View All <ArrowTopRightOnSquareIcon className="w-3 h-3" />
        </a>
      </div>

      <div className="divide-y divide-slate-50">
        {/* Pull Requests Section */}
        {prs.length > 0 && (
          <div className="p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-3">
              Pull Requests
            </p>
            <div className="space-y-2">
              {prs.map((pr) => (
                <button
                  key={pr.id}
                  type="button"
                  onClick={() => onViewItem?.(pr)}
                  className="w-full flex items-center gap-4 p-4 bg-slate-50/50 hover:bg-slate-100/80 rounded-xl cursor-pointer transition-all group text-left"
                >
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <CodeBracketIcon className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                      {pr.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {pr.repository} • {formatDate(pr.updatedAt)}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getStateColor(pr.state)}`}>
                    {pr.state}
                  </span>
                  {pr.commentsCount > 0 && (
                    <div className="flex items-center gap-1 text-slate-400">
                      <ChatBubbleLeftIcon className="w-3 h-3" />
                      <span className="text-xs">{pr.commentsCount}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Issues Section */}
        {issues.length > 0 && (
          <div className="p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-3">
              Issues
            </p>
            <div className="space-y-2">
              {issues.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => onViewItem?.(issue)}
                  className="w-full flex items-center gap-4 p-4 bg-slate-50/50 hover:bg-slate-100/80 rounded-xl cursor-pointer transition-all group text-left"
                >
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <ExclamationCircleIcon className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                      {issue.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {issue.repository} • {formatDate(issue.updatedAt)}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getStateColor(issue.state)}`}>
                    {issue.state}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notifications Section */}
        {notifications.length > 0 && (
          <div className="p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-3">
              Notifications
            </p>
            <div className="space-y-2">
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => {
                    onMarkAsRead?.(notif.id);
                    onViewItem?.(notif);
                  }}
                  className="w-full flex items-center gap-4 p-4 bg-indigo-50/50 hover:bg-indigo-100/50 rounded-xl cursor-pointer transition-all group border-l-4 border-indigo-400 text-left"
                >
                  <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <EyeIcon className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                      {notif.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {notif.repository} • {formatDate(notif.updatedAt)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GitHubWidget;
