import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BoltIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon,
  ArrowRightIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import type { WatchAction } from '../../types';
import { getAllActions, updateActionStatus } from '../../services/watchMonitor';

interface ActionStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  dismissed: number;
}

const ActionsWidget: React.FC = () => {
  const [actions, setActions] = useState<WatchAction[]>([]);
  const [stats, setStats] = useState<ActionStats>({ total: 0, pending: 0, inProgress: 0, completed: 0, dismissed: 0 });
  const [loading, setLoading] = useState(true);

  const loadActions = async () => {
    try {
      const allActions = await getAllActions();
      setActions(allActions.slice(0, 5)); // Show only top 5 actions
      
      // Calculate stats
      const newStats = {
        total: allActions.length,
        pending: allActions.filter(a => a.status === 'pending').length,
        inProgress: allActions.filter(a => a.status === 'in_progress').length,
        completed: allActions.filter(a => a.status === 'completed').length,
        dismissed: allActions.filter(a => a.status === 'dismissed').length,
      };
      setStats(newStats);
    } catch (error) {
      console.error('Failed to load actions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActions();
  }, []);

  const handleQuickComplete = async (actionId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await updateActionStatus(String(actionId), 'completed');
      await loadActions();
    } catch (error) {
      console.error('Failed to complete action:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-amber-600 bg-amber-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <ClockIcon className="w-3.5 h-3.5 text-amber-500" />;
      case 'in_progress': return <PlayIcon className="w-3.5 h-3.5 text-blue-500" />;
      case 'completed': return <CheckCircleIcon className="w-3.5 h-3.5 text-green-500" />;
      case 'dismissed': return <XCircleIcon className="w-3.5 h-3.5 text-slate-400" />;
      default: return <ClockIcon className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getPlatformEmoji = (platform: string) => {
    switch (platform) {
      case 'email': return '📧';
      case 'discord': return '💬';
      case 'whatsapp': return '💚';
      case 'telegram': return '✈️';
      case 'github': return '🐙';
      case 'calendar': return '📅';
      default: return '📌';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <BoltIcon className="w-5 h-5 text-purple-600" />
          </div>
          <h3 className="font-bold text-lg text-slate-800">AI Actions</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-12 bg-slate-100 rounded-xl"></div>
          <div className="h-12 bg-slate-100 rounded-xl"></div>
          <div className="h-12 bg-slate-100 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
            <BoltIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-800">AI Actions</h3>
            <p className="text-xs text-slate-400">{stats.pending} pending</p>
          </div>
        </div>
        <Link
          to="/actions"
          className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 font-medium"
        >
          View All
          <ArrowRightIcon className="w-4 h-4" />
        </Link>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-amber-50 rounded-xl p-2 text-center">
          <div className="text-lg font-bold text-amber-600">{stats.pending}</div>
          <div className="text-[10px] uppercase tracking-wider text-amber-500 font-bold">Pending</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-2 text-center">
          <div className="text-lg font-bold text-blue-600">{stats.inProgress}</div>
          <div className="text-[10px] uppercase tracking-wider text-blue-500 font-bold">In Progress</div>
        </div>
        <div className="bg-green-50 rounded-xl p-2 text-center">
          <div className="text-lg font-bold text-green-600">{stats.completed}</div>
          <div className="text-[10px] uppercase tracking-wider text-green-500 font-bold">Done</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-2 text-center">
          <div className="text-lg font-bold text-slate-600">{stats.total}</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total</div>
        </div>
      </div>

      {/* Actions List */}
      {actions.length === 0 ? (
        <div className="text-center py-8">
          <SparklesIcon className="w-10 h-10 text-purple-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No actions yet</p>
          <p className="text-xs text-slate-300 mt-1">Add items to watch and run AI analysis</p>
        </div>
      ) : (
        <div className="space-y-2">
          {actions.map((action) => (
            <Link
              key={action.id}
              to="/actions"
              className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors group"
            >
              <span className="text-lg">{getPlatformEmoji(action.platform)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {getStatusIcon(action.status)}
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${getPriorityColor(action.priority)}`}>
                    {action.priority}
                  </span>
                  {(action as any).item_name && (
                    <span className="text-[10px] text-slate-400 truncate max-w-[100px]">
                      • {(action as any).item_name}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700 font-medium truncate">
                  {(action as any).title || action.action || (action as any).description || 'New Action'}
                </p>
              </div>
              {action.status === 'pending' && (
                <button
                  onClick={(e) => handleQuickComplete(action.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 bg-green-100 hover:bg-green-200 rounded-lg transition-all"
                  title="Mark as complete"
                >
                  <CheckCircleIcon className="w-4 h-4 text-green-600" />
                </button>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Footer */}
      {actions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Showing {Math.min(5, actions.length)} of {stats.total} actions
          </span>
          <Link
            to="/watch"
            className="text-xs text-purple-600 hover:text-purple-700 font-medium"
          >
            Manage Watch List →
          </Link>
        </div>
      )}
    </div>
  );
};

export default ActionsWidget;
