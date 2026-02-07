import React, { useState, useEffect } from 'react';
import { 
  generateIntelligenceFeed, 
  getFeedHistory, 
  getFeedParams, 
  saveFeedParams,
  type IntelligenceFeed,
  type IntelligenceFeedParams 
} from '../services/intelligenceFeed';
import {
  SparklesIcon,
  Cog6ToothIcon,
  ClockIcon,
  BoltIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import MarkdownRenderer from '../components/MarkdownRenderer';

const IntelligenceFeedPage: React.FC = () => {
  const [currentFeed, setCurrentFeed] = useState<IntelligenceFeed | null>(null);
  const [feedHistory, setFeedHistory] = useState<IntelligenceFeed[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [params, setParams] = useState<IntelligenceFeedParams>({
    includeEmails: true,
    includeEvents: true,
    includeGitHub: true,
    includeWhatsApp: true,
    includeTelegram: true,
    includeDiscord: true,
    timeRange: 'today',
    priority: 'all',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const savedParams = await getFeedParams();
    setParams(savedParams);
    
    const history = await getFeedHistory(10);
    setFeedHistory(history);
    
    if (history.length > 0) {
      setCurrentFeed(history[0]);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const feed = await generateIntelligenceFeed(params);
      setCurrentFeed(feed);
      
      // Refresh history
      const history = await getFeedHistory(10);
      setFeedHistory(history);
      
      setShowSettings(false);
    } catch (error) {
      console.error('Failed to generate feed:', error);
      alert('Failed to generate intelligence feed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveParams = async () => {
    await saveFeedParams(params);
    handleGenerate();
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'bg-rose-100 text-rose-700';
    if (priority >= 5) return 'bg-amber-100 text-amber-700';
    return 'bg-emerald-100 text-emerald-700';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 8) return 'High Priority';
    if (priority >= 5) return 'Medium Priority';
    return 'Low Priority';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-10 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <SparklesIcon className="w-7 h-7 text-white" />
            </div>
            Intelligence Feed
          </h1>
          <p className="text-slate-500 mt-2">AI-powered insights from all your connected data</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <Cog6ToothIcon className="w-5 h-5" />
            Settings
          </button>
          
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <BoltIcon className="w-5 h-5" />
                Generate Feed
              </>
            )}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Feed Generation Settings</h3>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Data Sources */}
            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Data Sources</h4>
              <div className="space-y-2">
                {[
                  { key: 'includeEmails', label: 'Emails', icon: '📧' },
                  { key: 'includeEvents', label: 'Calendar Events', icon: '📅' },
                  { key: 'includeGitHub', label: 'GitHub Activity', icon: '💻' },
                  { key: 'includeWhatsApp', label: 'WhatsApp Messages', icon: '💬' },
                  { key: 'includeTelegram', label: 'Telegram Messages', icon: '✈️' },
                  { key: 'includeDiscord', label: 'Discord Messages', icon: '🎮' },
                ].map(({ key, label, icon }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={params[key as keyof IntelligenceFeedParams] as boolean}
                      onChange={(e) => setParams({ ...params, [key]: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="flex-1 text-slate-700 group-hover:text-slate-900 font-medium">
                      {icon} {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Filters</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Time Range</label>
                  <select
                    value={params.timeRange}
                    onChange={(e) => setParams({ ...params, timeRange: e.target.value as any })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="today">Today</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Priority Filter</label>
                  <select
                    value={params.priority}
                    onChange={(e) => setParams({ ...params, priority: e.target.value as any })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="all">All Priorities</option>
                    <option value="high">High Priority Only</option>
                    <option value="medium">Medium & High</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveParams}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              Save & Generate
            </button>
          </div>
        </div>
      )}

      {/* Current Feed */}
      {currentFeed && (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
          {/* Feed Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getPriorityColor(currentFeed.priority)}`}>
                  {getPriorityLabel(currentFeed.priority)}
                </span>
                <span className="text-sm text-slate-500 flex items-center gap-1">
                  <ClockIcon className="w-4 h-4" />
                  {new Date(currentFeed.generatedAt).toLocaleString()}
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-900">{currentFeed.title}</h2>
            </div>
          </div>

          {/* Feed Content */}
          <div className="prose prose-slate max-w-none mb-6">
            <MarkdownRenderer content={currentFeed.content} />
          </div>

          {/* Insights */}
          {currentFeed.insights && currentFeed.insights.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                <ChartBarIcon className="w-5 h-5 text-indigo-600" />
                Key Insights
              </h3>
              <div className="space-y-2">
                {currentFeed.insights.map((insight, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-4 bg-indigo-50 rounded-xl">
                    <ExclamationTriangleIcon className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <p className="text-slate-700">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {currentFeed.actionItems && currentFeed.actionItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                Recommended Actions
              </h3>
              <div className="space-y-2">
                {currentFeed.actionItems.map((action, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-4 bg-emerald-50 rounded-xl">
                    <BoltIcon className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-slate-700">{action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          {currentFeed.sources && currentFeed.sources.length > 0 && (
            <div className="pt-6 border-t border-slate-200">
              <p className="text-sm text-slate-500">
                <span className="font-semibold">Data sources:</span> {currentFeed.sources.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Feed History */}
      {feedHistory.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Feed History</h3>
          <div className="space-y-3">
            {feedHistory.slice(0, 10).map((feed) => (
              <button
                key={feed.id}
                onClick={() => setCurrentFeed(feed)}
                className={`w-full text-left p-4 rounded-xl transition-all ${
                  currentFeed?.id === feed.id
                    ? 'bg-indigo-50 border-2 border-indigo-600'
                    : 'bg-slate-50 border border-slate-200 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900">{feed.title}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${getPriorityColor(feed.priority)}`}>
                    {getPriorityLabel(feed.priority)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-4 h-4" />
                    {new Date(feed.generatedAt).toLocaleDateString()}
                  </span>
                  <span className="uppercase text-xs font-bold">{feed.category}</span>
                  {feed.sources && <span>{feed.sources.length} sources</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!currentFeed && feedHistory.length === 0 && !loading && (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <SparklesIcon className="w-10 h-10 text-indigo-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Intelligence Feed Generated Yet</h3>
          <p className="text-slate-500 mb-6">Click "Generate Feed" to create your first AI-powered intelligence briefing</p>
          <button
            onClick={handleGenerate}
            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all inline-flex items-center gap-2"
          >
            <BoltIcon className="w-5 h-5" />
            Generate First Feed
          </button>
        </div>
      )}
    </div>
  );
};

export default IntelligenceFeedPage;
