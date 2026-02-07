import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  EyeIcon,
  TrashIcon,
  CheckCircleIcon,
  PlayIcon,
  PauseIcon,
  XMarkIcon,
  FunnelIcon,
  ArrowPathIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  CodeBracketIcon,
  CalendarDaysIcon,
  PencilIcon,
  ClockIcon,
  CheckIcon,
  BellAlertIcon,
  BoltIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import type { WatchedItem, WatchPlatform, ActionStatus } from '../types';
import {
  getAllWatchedItems,
  removeFromWatchList,
  updateActionStatus,
  updateWatchedItem,
  toggleWatchStatus,
  clearCompletedItems,
  clearDismissedItems,
  getActionStatusColor,
  getActionStatusLabel,
} from '../services/watchService';
import { runWatchMonitor } from '../services/watchMonitor';

// Platform icon mapping
const PlatformIcon: React.FC<{ platform: WatchPlatform; className?: string }> = ({ platform, className = 'w-5 h-5' }) => {
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

// Platform color mapping
const getPlatformStyle = (platform: WatchPlatform): string => {
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

// Status badge component
const StatusBadge: React.FC<{ status: ActionStatus }> = ({ status }) => {
  const colorClass = getActionStatusColor(status);
  const label = getActionStatusLabel(status);
  
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${colorClass}`}>
      {label}
    </span>
  );
};

// Watched item card component
const WatchedItemCard: React.FC<{
  item: WatchedItem;
  onUpdateStatus: (id: string, status: ActionStatus) => void;
  onToggleWatch: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (item: WatchedItem) => void;
}> = ({ item, onUpdateStatus, onToggleWatch, onDelete, onEdit }) => {
  const metadata = item.itemMetadata ? JSON.parse(item.itemMetadata) : {};
  const isPaused = item.watchStatus === 'paused';
  
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 p-5 transition-all hover:shadow-lg hover:border-slate-200 ${isPaused ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-4">
        {/* Platform Icon */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${getPlatformStyle(item.platform)}`}>
          <PlatformIcon platform={item.platform} className="w-6 h-6" />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-slate-900 truncate">{item.itemName}</h3>
            <StatusBadge status={item.actionStatus} />
            {isPaused && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border text-slate-400 bg-slate-50 border-slate-200">
                Paused
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
            <span className="capitalize">{item.platform}</span>
            <span>•</span>
            <span className="capitalize">{item.itemType.replace(/_/g, ' ')}</span>
            {metadata.serverName && (
              <>
                <span>•</span>
                <span>{metadata.serverName}</span>
              </>
            )}
          </div>
          
          {item.action && (
            <div className="bg-slate-50 rounded-xl px-3 py-2 mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Action: </span>
              <span className="text-sm text-slate-700">{item.action}</span>
            </div>
          )}
          
          {item.notes && (
            <p className="text-sm text-slate-500 line-clamp-2">{item.notes}</p>
          )}
          
          <div className="flex items-center gap-1 mt-3 text-[10px] text-slate-400">
            <ClockIcon className="w-3 h-3" />
            <span>Added {new Date(item.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex flex-col gap-1">
          {item.actionStatus === 'pending' && (
            <button
              onClick={() => onUpdateStatus(item.id, 'in_progress')}
              className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
              title="Start working on this"
            >
              <PlayIcon className="w-4 h-4" />
            </button>
          )}
          {item.actionStatus === 'in_progress' && (
            <button
              onClick={() => onUpdateStatus(item.id, 'completed')}
              className="p-2 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors"
              title="Mark as completed"
            >
              <CheckIcon className="w-4 h-4" />
            </button>
          )}
          {(item.actionStatus === 'pending' || item.actionStatus === 'in_progress') && (
            <button
              onClick={() => onUpdateStatus(item.id, 'dismissed')}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              title="Dismiss"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onToggleWatch(item.id)}
            className="p-2 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
            title={isPaused ? 'Resume watching' : 'Pause watching'}
          >
            {isPaused ? <PlayIcon className="w-4 h-4" /> : <PauseIcon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onEdit(item)}
            className="p-2 rounded-lg hover:bg-purple-50 text-slate-400 hover:text-purple-600 transition-colors"
            title="Edit"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
            title="Remove from watch list"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Edit modal component
const EditModal: React.FC<{
  item: WatchedItem | null;
  onClose: () => void;
  onSave: (id: string, updates: { action?: string; notes?: string }) => void;
}> = ({ item, onClose, onSave }) => {
  const [action, setAction] = useState(item?.action || '');
  const [notes, setNotes] = useState(item?.notes || '');

  useEffect(() => {
    if (item) {
      setAction(item.action || '');
      setNotes(item.notes || '');
    }
  }, [item]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900">Edit Watch Item</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl">
              <XMarkIcon className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getPlatformStyle(item.platform)}`}>
              <PlatformIcon platform={item.platform} className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-slate-900">{item.itemName}</p>
              <p className="text-xs text-slate-400 capitalize">{item.platform} • {item.itemType.replace(/_/g, ' ')}</p>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Action to be done
            </label>
            <input
              type="text"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="e.g., Follow up, Review, Reply..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes or context..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
            />
          </div>
        </div>
        
        <div className="p-6 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(item.id, { action, notes });
              onClose();
            }}
            className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// Filter types
type FilterPlatform = WatchPlatform | 'all';
type FilterStatus = ActionStatus | 'all';

const WatchPage: React.FC = () => {
  const [items, setItems] = useState<WatchedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState<FilterPlatform>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [editingItem, setEditingItem] = useState<WatchedItem | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{ processed: number; actionsGenerated: number; messagesAnalyzed: number } | null>(null);

  // Load watched items
  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const allItems = await getAllWatchedItems();
      setItems(allItems);
    } catch (error) {
      console.error('Failed to load watched items:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Handle AI analysis
  const handleRunAIAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const result = await runWatchMonitor();
      setAnalysisResult(result);
      await loadItems();
    } catch (error) {
      console.error('Failed to run AI analysis:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  // Handle status update
  const handleUpdateStatus = async (id: string, status: ActionStatus) => {
    await updateActionStatus(id, status);
    loadItems();
  };

  // Handle toggle watch
  const handleToggleWatch = async (id: string) => {
    await toggleWatchStatus(id);
    loadItems();
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (confirm('Remove this item from your watch list?')) {
      await removeFromWatchList(id);
      loadItems();
    }
  };

  // Handle edit save
  const handleEditSave = async (id: string, updates: { action?: string; notes?: string }) => {
    await updateWatchedItem(id, updates);
    loadItems();
  };

  // Handle clear completed
  const handleClearCompleted = async () => {
    const count = await clearCompletedItems();
    if (count > 0) {
      loadItems();
    }
  };

  // Handle clear dismissed
  const handleClearDismissed = async () => {
    const count = await clearDismissedItems();
    if (count > 0) {
      loadItems();
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    if (filterPlatform !== 'all' && item.platform !== filterPlatform) return false;
    if (filterStatus !== 'all' && item.actionStatus !== filterStatus) return false;
    return true;
  });

  // Calculate stats
  const stats = {
    total: items.length,
    pending: items.filter(i => i.actionStatus === 'pending').length,
    inProgress: items.filter(i => i.actionStatus === 'in_progress').length,
    completed: items.filter(i => i.actionStatus === 'completed').length,
    dismissed: items.filter(i => i.actionStatus === 'dismissed').length,
  };

  // Platforms for filter
  const platforms: { value: FilterPlatform; label: string }[] = [
    { value: 'all', label: 'All Platforms' },
    { value: 'email', label: 'Email' },
    { value: 'discord', label: 'Discord' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'telegram', label: 'Telegram' },
    { value: 'github', label: 'GitHub' },
    { value: 'calendar', label: 'Calendar' },
  ];

  // Statuses for filter
  const statuses: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'dismissed', label: 'Dismissed' },
  ];

  return (
    <div className="h-full overflow-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                <EyeIcon className="w-7 h-7 text-white" />
              </div>
              Watch List
            </h1>
            <p className="text-slate-500 mt-2 ml-[60px]">
              Track items across platforms and manage your actions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRunAIAnalysis}
              disabled={analyzing || items.length === 0}
              className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/20 ${
                analyzing ? 'opacity-70 cursor-wait' : ''
              } ${items.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Run AI to analyze watched items and generate actions"
            >
              {analyzing ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4" />
                  AI Analysis
                </>
              )}
            </button>
            <Link
              to="/actions"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-bold hover:from-purple-600 hover:to-pink-700 transition-all shadow-lg shadow-purple-500/20"
              title="View AI-generated actions"
            >
              <BoltIcon className="w-4 h-4" />
              View Actions
            </Link>
            <button
              onClick={loadItems}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              title="Refresh list"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* AI Analysis Result */}
        {analysisResult && (
          <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SparklesIcon className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-purple-700">
                <strong>AI Analysis Complete:</strong> Processed {analysisResult.processed} items, analyzed {analysisResult.messagesAnalyzed} new messages, generated {analysisResult.actionsGenerated} new actions
              </span>
            </div>
            <button
              onClick={() => setAnalysisResult(null)}
              className="p-1 hover:bg-purple-100 rounded-lg transition-colors"
              title="Dismiss"
            >
              <XMarkIcon className="w-4 h-4 text-purple-400" />
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-4 border border-slate-100">
            <div className="text-3xl font-black text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-400 font-bold uppercase">Total</div>
          </div>
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
            <div className="text-3xl font-black text-amber-600">{stats.pending}</div>
            <div className="text-xs text-amber-500 font-bold uppercase">Pending</div>
          </div>
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
            <div className="text-3xl font-black text-blue-600">{stats.inProgress}</div>
            <div className="text-xs text-blue-500 font-bold uppercase">In Progress</div>
          </div>
          <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
            <div className="text-3xl font-black text-green-600">{stats.completed}</div>
            <div className="text-xs text-green-500 font-bold uppercase">Completed</div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <div className="text-3xl font-black text-slate-400">{stats.dismissed}</div>
            <div className="text-xs text-slate-400 font-bold uppercase">Dismissed</div>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-slate-400">
              <FunnelIcon className="w-4 h-4" />
              <span className="text-sm font-bold">Filter:</span>
            </div>
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value as FilterPlatform)}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              {platforms.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              {statuses.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            {stats.completed > 0 && (
              <button
                onClick={handleClearCompleted}
                className="flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-xl font-bold transition-colors"
              >
                <CheckCircleIcon className="w-4 h-4" />
                Clear Completed ({stats.completed})
              </button>
            )}
            {stats.dismissed > 0 && (
              <button
                onClick={handleClearDismissed}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:bg-slate-100 rounded-xl font-bold transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
                Clear Dismissed ({stats.dismissed})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-4">
            <BellAlertIcon className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-400 mb-2">
            {items.length === 0 ? 'No items being watched' : 'No matching items'}
          </h3>
          <p className="text-sm text-slate-400 max-w-md">
            {items.length === 0
              ? 'Click the "Watch" button on emails, Discord channels, WhatsApp chats, and more to add them to your watch list.'
              : 'Try adjusting your filters to see more items.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredItems.map((item) => (
            <WatchedItemCard
              key={item.id}
              item={item}
              onUpdateStatus={handleUpdateStatus}
              onToggleWatch={handleToggleWatch}
              onDelete={handleDelete}
              onEdit={setEditingItem}
            />
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <EditModal
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={handleEditSave}
      />
    </div>
  );
};

export default WatchPage;
