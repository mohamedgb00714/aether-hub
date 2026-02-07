/**
 * YouTube Channel Monitor Page
 * 
 * Watch YouTube channels, get video transcripts, AI summaries,
 * and content value ratings based on user interests.
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  PlayCircleIcon,
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  FunnelIcon,
  SparklesIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cog6ToothIcon,
  XMarkIcon,
  StarIcon,
  DocumentTextIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import {
  YouTubeChannel,
  YouTubeVideo,
  UserInterest,
  addChannel,
  getAllChannels,
  toggleChannelActive,
  deleteChannel,
  syncAllChannels,
  getVideos,
  markVideoAsWatched,
  analyzeVideo,
  analyzeUnanalyzedVideos,
  getUserInterests,
  saveUserInterest,
  deleteUserInterest,
  formatRelativeTime,
  getValueScoreColor,
  getValueScoreBg,
  INTEREST_CATEGORIES,
} from '../services/youtubeService';

// Tab type
type TabType = 'feed' | 'channels' | 'interests';

// Filter options
interface FilterOptions {
  channelId: string | null;
  dateRange: 'all' | 'today' | 'week' | 'month';
  valueFilter: 'all' | 'high' | 'medium' | 'low';
  showWatched: boolean;
  showAnalyzed: boolean;
}

// Video Card Component
const VideoCard: React.FC<{
  video: YouTubeVideo;
  channelName?: string;
  onWatch: () => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}> = ({ video, channelName, onWatch, onAnalyze, isAnalyzing }) => {
  const [showDetails, setShowDetails] = useState(false);
  
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg hover:border-slate-200 transition-all ${video.isWatched ? 'opacity-70' : ''}`}>
      {/* Thumbnail */}
      <div className="relative aspect-video bg-slate-100">
        {video.thumbnailUrl ? (
          <img 
            src={video.thumbnailUrl} 
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PlayCircleIcon className="w-16 h-16 text-slate-300" />
          </div>
        )}
        
        {/* Value Score Badge */}
        {video.aiValueScore !== null && (
          <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold ${getValueScoreBg(video.aiValueScore)} ${getValueScoreColor(video.aiValueScore)}`}>
            {video.aiValueScore}% Match
          </div>
        )}
        
        {/* Watched Badge */}
        {video.isWatched && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900/70 text-white">
            Watched
          </div>
        )}
        
        {/* Play Button Overlay */}
        <a 
          href={video.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onWatch}
          className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors group"
        >
          <PlayCircleIcon className="w-16 h-16 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
        </a>
      </div>
      
      {/* Content */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 line-clamp-2 mb-1">{video.title}</h3>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{channelName || 'Unknown Channel'}</span>
              <span>•</span>
              <span>{formatRelativeTime(video.publishedAt)}</span>
            </div>
          </div>
        </div>
        
        {/* AI Topics */}
        {video.aiTopics && video.aiTopics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {video.aiTopics.slice(0, 4).map((topic, idx) => (
              <span 
                key={idx}
                className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full"
              >
                {topic}
              </span>
            ))}
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-4">
          {!video.isAnalyzed ? (
            <button
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isAnalyzing ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4" />
                  Analyze with AI
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              <DocumentTextIcon className="w-4 h-4" />
              {showDetails ? 'Hide Summary' : 'View Summary'}
              {showDetails ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
            </button>
          )}
          
          <a
            href={video.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onWatch}
            className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            title="Watch on YouTube"
          >
            <PlayCircleIcon className="w-5 h-5" />
          </a>
        </div>
        
        {/* Expanded Summary */}
        {showDetails && video.aiSummary && (
          <div className="mt-4 p-4 bg-slate-50 rounded-xl">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">AI Summary</h4>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{video.aiSummary}</p>
            
            {video.aiValueReason && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">Value Assessment</h4>
                <p className="text-sm text-slate-600">{video.aiValueReason}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Channel Card Component
const ChannelCard: React.FC<{
  channel: YouTubeChannel;
  onToggle: () => void;
  onDelete: () => void;
}> = ({ channel, onToggle, onDelete }) => {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-lg hover:border-slate-200 transition-all ${!channel.isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-4">
        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
          {channel.thumbnailUrl ? (
            <img src={channel.thumbnailUrl} alt={channel.channelName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-red-100">
              <PlayCircleIcon className="w-8 h-8 text-red-500" />
            </div>
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 truncate">{channel.channelName}</h3>
          {channel.subscriberCount && (
            <p className="text-sm text-slate-500">{channel.subscriberCount}</p>
          )}
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
            {channel.lastChecked && (
              <span>Last synced: {formatRelativeTime(channel.lastChecked)}</span>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className={`p-2 rounded-xl transition-colors ${channel.isActive ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
            title={channel.isActive ? 'Pause monitoring' : 'Resume monitoring'}
          >
            {channel.isActive ? <EyeIcon className="w-5 h-5" /> : <EyeSlashIcon className="w-5 h-5" />}
          </button>
          
          <a
            href={channel.channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            title="View on YouTube"
          >
            <LinkIcon className="w-5 h-5" />
          </a>
          
          <button
            onClick={onDelete}
            className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            title="Remove channel"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {channel.description && (
        <p className="mt-3 text-sm text-slate-500 line-clamp-2">{channel.description}</p>
      )}
    </div>
  );
};

// Interest Item Component
const InterestItem: React.FC<{
  interest: UserInterest;
  onDelete: () => void;
}> = ({ interest, onDelete }) => {
  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-indigo-600 uppercase">{interest.category}</span>
        </div>
        <p className="font-medium text-slate-900 truncate">{interest.topic}</p>
      </div>
      
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, idx) => (
          <StarIconSolid 
            key={idx}
            className={`w-4 h-4 ${idx < Math.ceil(interest.weight / 2) ? 'text-amber-400' : 'text-slate-200'}`}
          />
        ))}
      </div>
      
      <button
        onClick={onDelete}
        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

// Add Interest Modal
const AddInterestModal: React.FC<{
  onClose: () => void;
  onSave: (interest: { category: string; topic: string; weight: number }) => void;
}> = ({ onClose, onSave }) => {
  const [category, setCategory] = useState(INTEREST_CATEGORIES[0]);
  const [topic, setTopic] = useState('');
  const [weight, setWeight] = useState(5);
  
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-black text-slate-900 mb-6">Add Interest</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              {INTEREST_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g., React, Python, Machine Learning..."
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Importance: {weight}/10
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={weight}
              onChange={e => setWeight(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (topic.trim()) {
                onSave({ category, topic: topic.trim(), weight });
              }
            }}
            disabled={!topic.trim()}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Add Interest
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Component
const YouTubePage: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [interests, setInterests] = useState<UserInterest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzingBatch, setIsAnalyzingBatch] = useState(false);
  const [analyzingVideoId, setAnalyzingVideoId] = useState<string | null>(null);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [showAddInterest, setShowAddInterest] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [newChannelUrl, setNewChannelUrl] = useState('');
  const [addChannelError, setAddChannelError] = useState<string | null>(null);
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [filters, setFilters] = useState<FilterOptions>({
    channelId: null,
    dateRange: 'all',
    valueFilter: 'all',
    showWatched: true,
    showAnalyzed: true,
  });
  
  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [channelsData, videosData, interestsData] = await Promise.all([
        getAllChannels(),
        getVideos({ limit: 100 }),
        getUserInterests(),
      ]);
      
      // Create channel map for video enrichment
      const channelMap = new Map(channelsData.map(c => [c.channelId, c.channelName]));
      
      // Enrich videos with channel names
      const enrichedVideos = videosData.map(v => ({
        ...v,
        channelName: channelMap.get(v.channelId) || 'Unknown Channel',
      }));
      
      setChannels(channelsData);
      setVideos(enrichedVideos);
      setInterests(interestsData);
    } catch (error) {
      console.error('Error loading YouTube data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Add channel handler
  const handleAddChannel = async () => {
    if (!newChannelUrl.trim()) return;
    
    setIsAddingChannel(true);
    setAddChannelError(null);
    
    try {
      const result = await addChannel(newChannelUrl);
      
      if (result.success) {
        setNewChannelUrl('');
        setShowAddChannel(false);
        await loadData();
      } else {
        setAddChannelError(result.error || 'Failed to add channel');
      }
    } catch (error: any) {
      setAddChannelError(error.message || 'Failed to add channel');
    } finally {
      setIsAddingChannel(false);
    }
  };
  
  // Sync all channels
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncAllChannels();
      await loadData();
    } catch (error) {
      console.error('Error syncing channels:', error);
    } finally {
      setIsSyncing(false);
    }
  };
  
  // Analyze video
  const handleAnalyzeVideo = async (video: YouTubeVideo) => {
    setAnalyzingVideoId(video.id);
    try {
      await analyzeVideo(video);
      await loadData();
    } catch (error) {
      console.error('Error analyzing video:', error);
    } finally {
      setAnalyzingVideoId(null);
    }
  };
  
  // Batch analyze
  const handleBatchAnalyze = async () => {
    setIsAnalyzingBatch(true);
    try {
      await analyzeUnanalyzedVideos(5);
      await loadData();
    } catch (error) {
      console.error('Error batch analyzing:', error);
    } finally {
      setIsAnalyzingBatch(false);
    }
  };
  
  // Toggle channel
  const handleToggleChannel = async (id: string) => {
    await toggleChannelActive(id);
    await loadData();
  };
  
  // Delete channel
  const handleDeleteChannel = async (id: string) => {
    if (confirm('Are you sure you want to remove this channel? All videos from this channel will also be removed.')) {
      await deleteChannel(id);
      await loadData();
    }
  };
  
  // Save interest
  const handleSaveInterest = async (interest: { category: string; topic: string; weight: number }) => {
    await saveUserInterest(interest);
    setShowAddInterest(false);
    await loadData();
  };
  
  // Delete interest
  const handleDeleteInterest = async (id: string) => {
    await deleteUserInterest(id);
    await loadData();
  };
  
  // Filter videos
  const filteredVideos = videos.filter(video => {
    // Channel filter
    if (filters.channelId && video.channelId !== filters.channelId) return false;
    
    // Date filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const videoDate = new Date(video.publishedAt);
      const daysDiff = (now.getTime() - videoDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (filters.dateRange === 'today' && daysDiff > 1) return false;
      if (filters.dateRange === 'week' && daysDiff > 7) return false;
      if (filters.dateRange === 'month' && daysDiff > 30) return false;
    }
    
    // Value filter
    if (filters.valueFilter !== 'all' && video.aiValueScore !== null) {
      if (filters.valueFilter === 'high' && video.aiValueScore < 70) return false;
      if (filters.valueFilter === 'medium' && (video.aiValueScore < 40 || video.aiValueScore >= 70)) return false;
      if (filters.valueFilter === 'low' && video.aiValueScore >= 40) return false;
    }
    
    // Watched filter
    if (!filters.showWatched && video.isWatched) return false;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = video.title.toLowerCase().includes(query);
      const matchesChannel = video.channelName?.toLowerCase().includes(query);
      const matchesTopics = video.aiTopics?.some(t => t.toLowerCase().includes(query));
      if (!matchesTitle && !matchesChannel && !matchesTopics) return false;
    }
    
    return true;
  });
  
  // Unanalyzed count
  const unanalyzedCount = videos.filter(v => !v.isAnalyzed).length;
  
  return (
    <div className="space-y-6 px-10 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">YouTube Monitor</h1>
          <p className="text-slate-500 mt-1">Watch channels, analyze content, and discover valuable videos</p>
        </div>
        
        <div className="flex items-center gap-3">
          {unanalyzedCount > 0 && (
            <button
              onClick={handleBatchAnalyze}
              disabled={isAnalyzingBatch}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 text-purple-700 rounded-xl font-bold hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAnalyzingBatch ? (
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
              ) : (
                <SparklesIcon className="w-5 h-5" />
              )}
              Analyze {Math.min(unanalyzedCount, 5)} Videos
            </button>
          )}
          
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 disabled:opacity-50 transition-colors"
          >
            <ArrowPathIcon className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync All'}
          </button>
          
          <button
            onClick={() => setShowAddChannel(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl font-bold hover:shadow-lg transition-all"
          >
            <PlusIcon className="w-5 h-5" />
            Add Channel
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-100">
        {[
          { id: 'feed', label: 'Video Feed', icon: PlayCircleIcon, count: filteredVideos.length },
          { id: 'channels', label: 'Channels', icon: EyeIcon, count: channels.length },
          { id: 'interests', label: 'My Interests', icon: StarIcon, count: interests.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-2 pb-4 border-b-2 font-bold transition-colors ${
              activeTab === tab.id
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              activeTab === tab.id ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>
      
      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <ArrowPathIcon className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Video Feed Tab */}
          {activeTab === 'feed' && (
            <div>
              {/* Filters */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 relative">
                  <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search videos, channels, or topics..."
                    className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
                
                <select
                  value={filters.channelId || ''}
                  onChange={e => setFilters(f => ({ ...f, channelId: e.target.value || null }))}
                  className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">All Channels</option>
                  {channels.map(channel => (
                    <option key={channel.id} value={channel.channelId}>{channel.channelName}</option>
                  ))}
                </select>
                
                <select
                  value={filters.dateRange}
                  onChange={e => setFilters(f => ({ ...f, dateRange: e.target.value as any }))}
                  className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
                
                <select
                  value={filters.valueFilter}
                  onChange={e => setFilters(f => ({ ...f, valueFilter: e.target.value as any }))}
                  className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="all">All Values</option>
                  <option value="high">High Value (70%+)</option>
                  <option value="medium">Medium Value (40-70%)</option>
                  <option value="low">Low Value (&lt;40%)</option>
                </select>
                
                <button
                  onClick={() => setFilters(f => ({ ...f, showWatched: !f.showWatched }))}
                  className={`px-4 py-3 rounded-xl font-medium transition-colors ${
                    filters.showWatched ? 'bg-slate-100 text-slate-700' : 'bg-indigo-100 text-indigo-700'
                  }`}
                >
                  {filters.showWatched ? 'Showing Watched' : 'Hiding Watched'}
                </button>
              </div>
              
              {/* Videos Grid */}
              {filteredVideos.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-3xl">
                  {channels.length === 0 ? (
                    <>
                      <PlayCircleIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-slate-900 mb-2">No channels added yet</h3>
                      <p className="text-slate-500 mb-6">Add YouTube channels to start monitoring new videos</p>
                      <button
                        onClick={() => setShowAddChannel(true)}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                      >
                        <PlusIcon className="w-5 h-5" />
                        Add Your First Channel
                      </button>
                    </>
                  ) : (
                    <>
                      <FunnelIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-slate-900 mb-2">No videos match your filters</h3>
                      <p className="text-slate-500">Try adjusting your filters or syncing for new videos</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredVideos.map(video => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      channelName={video.channelName}
                      onWatch={() => markVideoAsWatched(video.id)}
                      onAnalyze={() => handleAnalyzeVideo(video)}
                      isAnalyzing={analyzingVideoId === video.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Channels Tab */}
          {activeTab === 'channels' && (
            <div className="space-y-4">
              {channels.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-3xl">
                  <EyeIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-900 mb-2">No channels added yet</h3>
                  <p className="text-slate-500 mb-6">Add YouTube channels to monitor their new videos</p>
                  <button
                    onClick={() => setShowAddChannel(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                  >
                    <PlusIcon className="w-5 h-5" />
                    Add Channel
                  </button>
                </div>
              ) : (
                channels.map(channel => (
                  <ChannelCard
                    key={channel.id}
                    channel={channel}
                    onToggle={() => handleToggleChannel(channel.id)}
                    onDelete={() => handleDeleteChannel(channel.id)}
                  />
                ))
              )}
            </div>
          )}
          
          {/* Interests Tab */}
          {activeTab === 'interests' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Your Interests</h2>
                  <p className="text-sm text-slate-500">AI will score video relevance based on these interests</p>
                </div>
                <button
                  onClick={() => setShowAddInterest(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                >
                  <PlusIcon className="w-5 h-5" />
                  Add Interest
                </button>
              </div>
              
              {interests.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-3xl">
                  <StarIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-900 mb-2">No interests defined</h3>
                  <p className="text-slate-500 mb-6">Add your interests to get personalized video value scores</p>
                  <button
                    onClick={() => setShowAddInterest(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                  >
                    <PlusIcon className="w-5 h-5" />
                    Add Your First Interest
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {interests.map(interest => (
                    <InterestItem
                      key={interest.id}
                      interest={interest}
                      onDelete={() => handleDeleteInterest(interest.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
      
      {/* Add Channel Modal */}
      {showAddChannel && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setShowAddChannel(false)}>
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <PlayCircleIcon className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">Add YouTube Channel</h2>
                <p className="text-sm text-slate-500">Paste a channel URL to start monitoring</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Channel URL</label>
                <input
                  type="text"
                  value={newChannelUrl}
                  onChange={e => {
                    setNewChannelUrl(e.target.value);
                    setAddChannelError(null);
                  }}
                  placeholder="https://www.youtube.com/@channelname"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
                <p className="text-xs text-slate-400 mt-2">
                  Supports: youtube.com/@handle, /channel/ID, /c/name, /user/name
                </p>
              </div>
              
              {addChannelError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
                  <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
                  {addChannelError}
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowAddChannel(false)}
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddChannel}
                disabled={!newChannelUrl.trim() || isAddingChannel}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl font-bold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isAddingChannel ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <PlusIcon className="w-5 h-5" />
                    Add Channel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Interest Modal */}
      {showAddInterest && (
        <AddInterestModal
          onClose={() => setShowAddInterest(false)}
          onSave={handleSaveInterest}
        />
      )}
    </div>
  );
};

export default YouTubePage;
