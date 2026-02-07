import React, { useState, useEffect } from 'react';
import { db } from '../services/database';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  SparklesIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ChartBarIcon,
  ClockIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';

interface KnowledgeInsightFull {
  id: string;
  category: string;
  fact: string;
  confidence: number;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  'All',
  'Work',
  'Preferences',
  'Communication',
  'Schedule',
  'Projects',
  'Interests',
  'Contacts',
  'Goals',
  'Skills',
  'Habits',
  'Health',
  'Finance',
  'Travel',
  'Learning',
  'Other'
];

const CONFIDENCE_COLORS = {
  low: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  high: 'bg-green-100 text-green-700 border-green-200',
};

const getConfidenceLevel = (confidence: number): 'low' | 'medium' | 'high' => {
  if (confidence >= 70) return 'high';
  if (confidence >= 40) return 'medium';
  return 'low';
};

const KnowledgeInsights: React.FC = () => {
  const [insights, setInsights] = useState<KnowledgeInsightFull[]>([]);
  const [filteredInsights, setFilteredInsights] = useState<KnowledgeInsightFull[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'date' | 'confidence'>('date');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFact, setEditFact] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editConfidence, setEditConfidence] = useState(50);
  const [isLoading, setIsLoading] = useState(true);

  // Load insights from database
  const loadInsights = async () => {
    setIsLoading(true);
    try {
      const data = await db.knowledgeInsights.getAll() as unknown as KnowledgeInsightFull[];
      setInsights(data);
      setFilteredInsights(data);
    } catch (error) {
      console.error('Failed to load insights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  // Filter and search
  useEffect(() => {
    let filtered = [...insights];

    // Category filter
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(i => i.category === selectedCategory);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(i => 
        i.fact.toLowerCase().includes(query) || 
        i.category.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else {
        return b.confidence - a.confidence;
      }
    });

    setFilteredInsights(filtered);
  }, [insights, searchQuery, selectedCategory, sortBy]);

  // Delete insight
  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this insight?')) {
      await db.knowledgeInsights.delete(id);
      loadInsights();
    }
  };

  // Start editing
  const startEdit = (insight: KnowledgeInsightFull) => {
    setEditingId(insight.id);
    setEditFact(insight.fact);
    setEditCategory(insight.category);
    setEditConfidence(insight.confidence);
  };

  // Save edit
  const saveEdit = async () => {
    if (!editingId) return;
    
    await db.knowledgeInsights.update(editingId, {
      fact: editFact,
      category: editCategory,
      confidence: editConfidence,
    });
    
    setEditingId(null);
    loadInsights();
  };

  // Cancel edit
  const cancelEdit = () => {
    setEditingId(null);
    setEditFact('');
    setEditCategory('');
    setEditConfidence(50);
  };

  // Stats
  const stats = {
    total: insights.length,
    highConfidence: insights.filter(i => i.confidence >= 70).length,
    categories: new Set(insights.map(i => i.category)).size,
    avgConfidence: insights.length > 0 
      ? Math.round(insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length)
      : 0,
  };

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-700 px-10 py-6">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Knowledge Insights</h1>
            <p className="text-base text-slate-500 font-medium">Browse and manage AI-learned insights about you</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl shadow-lg shadow-purple-100">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-white" />
                <span className="text-white font-black text-sm">{stats.total} Insights</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total</span>
              <LightBulbIcon className="w-5 h-5 text-indigo-500" />
            </div>
            <p className="text-3xl font-black text-slate-900">{stats.total}</p>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">High Confidence</span>
              <ChartBarIcon className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-3xl font-black text-slate-900">{stats.highConfidence}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Categories</span>
              <FunnelIcon className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-3xl font-black text-slate-900">{stats.categories}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Avg Confidence</span>
              <SparklesIcon className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-3xl font-black text-slate-900">{stats.avgConfidence}%</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search insights..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50 font-medium"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <FunnelIcon className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="pl-12 pr-8 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50 font-bold appearance-none cursor-pointer"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="relative">
              <ClockIcon className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'confidence')}
                className="pl-12 pr-8 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50 font-bold appearance-none cursor-pointer"
              >
                <option value="date">Latest First</option>
                <option value="confidence">Highest Confidence</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Insights List */}
      {isLoading ? (
        <div className="text-center py-20">
          <div className="inline-block w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-400 font-bold">Loading insights...</p>
        </div>
      ) : filteredInsights.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-20 text-center shadow-sm">
          <LightBulbIcon className="w-16 h-16 text-slate-300 mx-auto mb-6" />
          <h3 className="text-xl font-black text-slate-400 mb-2">No Insights Found</h3>
          <p className="text-slate-400 font-medium">
            {searchQuery || selectedCategory !== 'All' 
              ? 'Try adjusting your filters' 
              : 'Chat with the Knowledge Base to build your profile'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInsights.map(insight => (
            <div
              key={insight.id}
              className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group"
            >
              {editingId === insight.id ? (
                // Edit Mode
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="px-4 py-2 border border-slate-300 rounded-xl font-bold bg-slate-50"
                    >
                      {CATEGORIES.filter(c => c !== 'All').map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-600">Confidence:</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={editConfidence}
                        onChange={(e) => setEditConfidence(parseInt(e.target.value))}
                        className="w-32"
                      />
                      <span className="text-sm font-black text-indigo-600 w-12">{editConfidence}%</span>
                    </div>
                  </div>
                  
                  <textarea
                    value={editFact}
                    onChange={(e) => setEditFact(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium resize-none"
                    rows={3}
                  />
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveEdit}
                      className="px-6 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      <CheckIcon className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-colors flex items-center gap-2"
                    >
                      <XMarkIcon className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-wider">
                        {insight.category}
                      </span>
                      <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider border ${
                        CONFIDENCE_COLORS[getConfidenceLevel(insight.confidence)]
                      }`}>
                        {insight.confidence}% Confidence
                      </span>
                      <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                        <ClockIcon className="w-4 h-4" />
                        {new Date(insight.created_at).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    
                    <p className="text-base text-slate-800 font-medium leading-relaxed">
                      {insight.fact}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(insight)}
                      className="p-2 hover:bg-indigo-50 rounded-xl text-indigo-600 transition-colors"
                      title="Edit insight"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(insight.id)}
                      className="p-2 hover:bg-red-50 rounded-xl text-red-600 transition-colors"
                      title="Delete insight"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KnowledgeInsights;
