/**
 * Actions Page
 * 
 * Displays AI-generated actions from watched items.
 * Actions are created when the watch monitor detects relevant content
 * based on watch goals.
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  BoltIcon,
  CheckCircleIcon,
  TrashIcon,
  ArrowPathIcon,
  PlayIcon,
  XMarkIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  EyeIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  PaperAirplaneIcon,
  CodeBracketIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { runWatchMonitor, getAllActions, updateActionStatus, deleteAction } from '../services/watchMonitor';

interface WatchAction {
  id: string;
  watched_item_id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  source_content: string;
  source_message_ids: string;
  created_at: string;
  completed_at: string | null;
  // Joined fields from watched_items
  item_name?: string;
  platform?: string;
  item_type?: string;
}

// Platform icon mapping
const PlatformIcon: React.FC<{ platform?: string; className?: string }> = ({ platform, className = 'w-5 h-5' }) => {
  switch (platform) {
    case 'email': return <EnvelopeIcon className={className} />;
    case 'discord': return <ChatBubbleLeftRightIcon className={className} />;
    case 'whatsapp': return <ChatBubbleLeftRightIcon className={className} />;
    case 'telegram': return <PaperAirplaneIcon className={className} />;
    case 'github': return <CodeBracketIcon className={className} />;
    case 'calendar': return <CalendarDaysIcon className={className} />;
    default: return <EyeIcon className={className} />;
  }
};

// Priority colors
const getPriorityStyle = (priority: string): string => {
  switch (priority) {
    case 'critical': return 'text-red-600 bg-red-50 border-red-200';
    case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'low': return 'text-green-600 bg-green-50 border-green-200';
    default: return 'text-slate-600 bg-slate-50 border-slate-200';
  }
};

// Status colors
const getStatusStyle = (status: string): string => {
  switch (status) {
    case 'pending': return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'in_progress': return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'completed': return 'text-green-600 bg-green-50 border-green-200';
    case 'dismissed': return 'text-slate-400 bg-slate-50 border-slate-200';
    default: return 'text-slate-600 bg-slate-50 border-slate-200';
  }
};

// Platform colors
const getPlatformStyle = (platform?: string): string => {
  switch (platform) {
    case 'email': return 'text-red-500 bg-red-50 border-red-100';
    case 'discord': return 'text-indigo-500 bg-indigo-50 border-indigo-100';
    case 'whatsapp': return 'text-green-500 bg-green-50 border-green-100';
    case 'telegram': return 'text-blue-500 bg-blue-50 border-blue-100';
    case 'github': return 'text-slate-700 bg-slate-100 border-slate-200';
    case 'calendar': return 'text-purple-500 bg-purple-50 border-purple-100';
    default: return 'text-slate-500 bg-slate-50 border-slate-200';
  }
};

// Action Card Component
const ActionCard: React.FC<{
  action: WatchAction;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}> = ({ action, onStatusChange, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const isCompleted = action.status === 'completed';
  const isDismissed = action.status === 'dismissed';
  
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 p-5 transition-all hover:shadow-lg hover:border-slate-200 ${
      isCompleted || isDismissed ? 'opacity-60' : ''
    }`}>
      <div className="flex items-start gap-4">
        {/* Platform Icon */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ${getPlatformStyle(action.platform)}`}>
          <PlatformIcon platform={action.platform} className="w-6 h-6" />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className={`font-bold text-slate-900 ${isCompleted ? 'line-through' : ''}`}>
              {action.title}
            </h3>
            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${getPriorityStyle(action.priority)}`}>
              {action.priority}
            </span>
            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${getStatusStyle(action.status)}`}>
              {action.status.replace('_', ' ')}
            </span>
          </div>
          
          {action.item_name && (
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <span className="capitalize">{action.platform}</span>
              <span>•</span>
              <span>{action.item_name}</span>
            </div>
          )}
          
          {action.description && (
            <p className="text-sm text-slate-600 mb-3">
              {action.description}
            </p>
          )}
          
          {/* Source Content (collapsible) */}
          {action.source_content && (
            <div className="mt-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
              >
                {expanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                {expanded ? 'Hide source messages' : 'Show source messages'}
              </button>
              {expanded && (
                <div className="mt-2 p-3 bg-slate-50 rounded-xl text-xs text-slate-500 whitespace-pre-wrap font-mono">
                  {action.source_content}
                </div>
              )}
            </div>
          )}
          
          <div className="flex items-center gap-1 mt-3 text-[10px] text-slate-400">
            <ClockIcon className="w-3 h-3" />
            <span>Created {new Date(action.created_at).toLocaleString()}</span>
            {action.completed_at && (
              <>
                <span>•</span>
                <span>Completed {new Date(action.completed_at).toLocaleString()}</span>
              </>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex flex-col gap-1 shrink-0">
          {action.status === 'pending' && (
            <button
              onClick={() => onStatusChange(action.id, 'in_progress')}
              className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
              title="Start working"
            >
              <PlayIcon className="w-4 h-4" />
            </button>
          )}
          {action.status === 'in_progress' && (
            <button
              onClick={() => onStatusChange(action.id, 'completed')}
              className="p-2 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors"
              title="Mark completed"
            >
              <CheckCircleIcon className="w-4 h-4" />
            </button>
          )}
          {(action.status === 'pending' || action.status === 'in_progress') && (
            <button
              onClick={() => onStatusChange(action.id, 'dismissed')}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              title="Dismiss"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(action.id)}
            className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const ActionsPage: React.FC = () => {
  const [actions, setActions] = useState<WatchAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ processed: number; actionsGenerated: number; messagesAnalyzed: number } | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'dismissed'>('all');

  const loadActions = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getAllActions();
      setActions(result || []);
    } catch (error) {
      console.error('Failed to load actions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  const handleStatusChange = async (id: string, status: string) => {
    await updateActionStatus(id, status);
    loadActions();
  };

  const handleDelete = async (id: string) => {
    await deleteAction(id);
    loadActions();
  };

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const result = await runWatchMonitor();
      setAnalysisResult(result);
      loadActions();
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Filter actions
  const filteredActions = actions.filter(action => {
    if (filter === 'all') return true;
    return action.status === filter;
  });

  // Stats
  const stats = {
    total: actions.length,
    pending: actions.filter(a => a.status === 'pending').length,
    inProgress: actions.filter(a => a.status === 'in_progress').length,
    completed: actions.filter(a => a.status === 'completed').length,
    dismissed: actions.filter(a => a.status === 'dismissed').length,
  };

  return (
    <div className="flex-1 overflow-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-100">
            <BoltIcon className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900">Actions</h1>
            <p className="text-sm text-slate-400 mt-1">
              AI-generated actions from your watched items
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all ${
              isAnalyzing 
                ? 'bg-purple-100 text-purple-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg hover:shadow-purple-200'
            }`}
          >
            {isAnalyzing ? (
              <>
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <SparklesIcon className="w-5 h-5" />
                Run AI Analysis
              </>
            )}
          </button>
          
          <button
            onClick={loadActions}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
          >
            <ArrowPathIcon className="w-5 h-5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Analysis Result */}
      {analysisResult && (
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-xl flex items-center gap-3">
          <SparklesIcon className="w-5 h-5 text-purple-600" />
          <span className="text-purple-800">
            <strong>AI Analysis Complete:</strong> Processed {analysisResult.processed} watched items, 
            analyzed {analysisResult.messagesAnalyzed} new messages, 
            generated {analysisResult.actionsGenerated} new actions
          </span>
          <button onClick={() => setAnalysisResult(null)} className="ml-auto text-purple-400 hover:text-purple-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="text-3xl font-black text-slate-900">{stats.total}</div>
          <div className="text-xs font-bold text-slate-400 uppercase mt-1">Total</div>
        </div>
        <div className="bg-white rounded-2xl border border-amber-100 p-5">
          <div className="text-3xl font-black text-amber-600">{stats.pending}</div>
          <div className="text-xs font-bold text-amber-400 uppercase mt-1">Pending</div>
        </div>
        <div className="bg-white rounded-2xl border border-blue-100 p-5">
          <div className="text-3xl font-black text-blue-600">{stats.inProgress}</div>
          <div className="text-xs font-bold text-blue-400 uppercase mt-1">In Progress</div>
        </div>
        <div className="bg-white rounded-2xl border border-green-100 p-5">
          <div className="text-3xl font-black text-green-600">{stats.completed}</div>
          <div className="text-xs font-bold text-green-400 uppercase mt-1">Completed</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="text-3xl font-black text-slate-400">{stats.dismissed}</div>
          <div className="text-xs font-bold text-slate-300 uppercase mt-1">Dismissed</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {(['all', 'pending', 'in_progress', 'completed', 'dismissed'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              filter === status
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Actions List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <ArrowPathIcon className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : filteredActions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
          <BoltIcon className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg font-medium">No actions yet</p>
          <p className="text-sm mt-1">
            {filter === 'all' 
              ? 'Run AI Analysis to generate actions from your watched items'
              : `No ${filter.replace('_', ' ')} actions`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredActions.map(action => (
            <ActionCard
              key={action.id}
              action={action}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ActionsPage;
