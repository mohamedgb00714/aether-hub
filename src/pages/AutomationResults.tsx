import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ComputerDesktopIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  XCircleIcon,
  ClockIcon,
  SparklesIcon,
  ArrowPathIcon,
  FunnelIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  PlayCircleIcon,
  EyeIcon,
  XMarkIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ArrowTopRightOnSquareIcon,
  BoltIcon,
  SignalIcon,
} from '@heroicons/react/24/solid';
import MarkdownRenderer from '../components/MarkdownRenderer';

interface Automation {
  id: string;
  name: string;
  description: string | null;
  task: string;
  profile_id: string;
  headless: number;
  run_on_startup: number;
  cron_schedule: string | null;
  status: string;
  last_run: string | null;
  created_at: string;
}

interface AutomationHistory {
  id: string;
  automation_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  result: string | null;
  error_message: string | null;
  analysis: string | null;
}

type StatusFilter = 'all' | 'completed' | 'failed' | 'running' | 'error';

export default function AutomationResultsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [historyMap, setHistoryMap] = useState<Record<string, AutomationHistory[]>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedAutomation, setExpandedAutomation] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<AutomationHistory | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.automation.getAll();
      if (result.success && result.automations) {
        setAutomations(result.automations);
        const hMap: Record<string, AutomationHistory[]> = {};
        await Promise.all(
          result.automations.map(async (a: Automation) => {
            const histResult = await window.electronAPI.automation.getHistory(a.id);
            if (histResult.success && histResult.history) {
              hMap[a.id] = histResult.history;
            }
          })
        );
        setHistoryMap(hMap);
      }
    } catch (err) {
      console.error('Failed to load automation data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const allRuns = useMemo(() => {
    const runs: (AutomationHistory & { automationName: string; automationTask: string })[] = [];
    automations.forEach(a => {
      const history = historyMap[a.id] || [];
      history.forEach(h => runs.push({ ...h, automationName: a.name, automationTask: a.task }));
    });
    runs.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    return runs;
  }, [automations, historyMap]);

  const stats = useMemo(() => {
    const total = allRuns.length;
    const completed = allRuns.filter(r => r.status === 'completed').length;
    const failed = allRuns.filter(r => r.status === 'failed' || r.status === 'error').length;
    const running = allRuns.filter(r => r.status === 'running').length;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const avgDuration = allRuns
      .filter(r => r.completed_at && r.started_at)
      .reduce((acc, r) => {
        const dur = new Date(r.completed_at!).getTime() - new Date(r.started_at).getTime();
        return acc + dur;
      }, 0) / Math.max(allRuns.filter(r => r.completed_at).length, 1);
    return { total, completed, failed, running, successRate, avgDuration };
  }, [allRuns]);

  const filteredRuns = useMemo(() => {
    return allRuns.filter(run => {
      const matchesStatus = statusFilter === 'all' || run.status === statusFilter;
      const matchesSearch = !searchTerm ||
        run.automationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        run.automationTask.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [allRuns, statusFilter, searchTerm]);

  const filteredAutomations = useMemo(() => {
    return automations.filter(a => {
      const history = historyMap[a.id] || [];
      if (statusFilter !== 'all') {
        if (!history.some(h => h.status === statusFilter)) return false;
      }
      if (searchTerm) {
        return a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.task.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return true;
    });
  }, [automations, historyMap, statusFilter, searchTerm]);

  const handleAnalyzeResult = async (run: AutomationHistory & { automationTask: string }) => {
    if (!run.result) return;
    setAnalyzingId(run.id);
    try {
      const result = await window.electronAPI.automation.analyzeResult(run.result, run.automationTask);
      if (result.success && result.analysis) {
        setAnalysisResults(prev => ({ ...prev, [run.id]: result.analysis }));
      }
    } catch (err) {
      console.error('Analysis failed:', err);
    }
    setAnalyzingId(null);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed': return { icon: CheckCircleIcon, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', label: 'Completed' };
      case 'running': return { icon: ArrowPathIcon, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500 animate-pulse', label: 'Running' };
      case 'failed': return { icon: XCircleIcon, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: 'Failed' };
      case 'error': return { icon: ExclamationCircleIcon, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'Error' };
      default: return { icon: ClockIcon, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-100', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', label: status };
    }
  };

  const statusFilters: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All Runs', count: stats.total },
    { key: 'completed', label: 'Completed', count: stats.completed },
    { key: 'failed', label: 'Failed', count: stats.failed },
    { key: 'running', label: 'Running', count: stats.running },
  ];

  return (
    <div className="max-w-[1600px] mx-auto px-6 lg:px-10 pt-4 pb-8 animate-in fade-in duration-500">

      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/25">
            <ChartBarIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Automation Results</h1>
            <p className="text-sm text-slate-400">History and analysis of browser automation runs</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search automations..."
              className="w-56 bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 outline-none transition-all" />
          </div>
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50">
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin text-violet-500' : ''}`} /> Refresh
          </button>
          <Link to="/automations" className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-all shadow-sm">
            <PlayCircleIcon className="w-4 h-4" /> Manage
          </Link>
        </div>
      </div>

      {/* ═══ STATS CARDS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl flex items-center justify-center">
              <BoltIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Runs</span>
          </div>
          <p className="text-3xl font-black text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <CheckCircleIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Success Rate</span>
          </div>
          <p className="text-3xl font-black text-emerald-600">{stats.successRate}%</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center">
              <XCircleIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Failed</span>
          </div>
          <p className="text-3xl font-black text-red-600">{stats.failed}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center">
              <ClockIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Avg Duration</span>
          </div>
          <p className="text-3xl font-black text-indigo-600">{formatDuration(stats.avgDuration)}</p>
        </div>
      </div>

      {/* ═══ FILTER TABS ═══ */}
      <div className="flex items-center gap-1.5 mb-5 p-1 bg-slate-100 rounded-xl w-fit">
        {statusFilters.map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === f.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}>
            {f.label} <span className={`ml-1 ${statusFilter === f.key ? 'text-violet-600' : 'text-slate-400'}`}>({f.count})</span>
          </button>
        ))}
      </div>

      {/* ═══ RESULTS LIST ═══ */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-3 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Loading automation history...</p>
        </div>
      ) : filteredAutomations.length === 0 ? (
        <div className="py-20 text-center">
          <ComputerDesktopIcon className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700 mb-1">No automation results</h3>
          <p className="text-sm text-slate-400 mb-4">Run some automations to see results here</p>
          <Link to="/automations" className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition-all">
            <PlayCircleIcon className="w-4 h-4" /> Go to Automations
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAutomations.map(automation => {
            const history = (historyMap[automation.id] || [])
              .filter(h => statusFilter === 'all' || h.status === statusFilter)
              .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
            const isExpanded = expandedAutomation === automation.id;
            const lastRun = history[0];
            const lastStatus = lastRun ? getStatusConfig(lastRun.status) : getStatusConfig('idle');
            const completedCount = history.filter(h => h.status === 'completed').length;
            const failedCount = history.filter(h => h.status === 'failed' || h.status === 'error').length;

            return (
              <div key={automation.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md hover:border-slate-200 transition-all duration-300">
                {/* Automation Header */}
                <div className="px-5 py-4 flex items-center gap-4 cursor-pointer" onClick={() => setExpandedAutomation(isExpanded ? null : automation.id)} >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${lastStatus.bg} ${lastStatus.border} border`}>
                    <lastStatus.icon className={`w-5 h-5 ${lastStatus.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{automation.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${lastStatus.badge}`}>{lastStatus.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{automation.task}</p>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-400">
                    <div className="hidden md:flex items-center gap-3">
                      <span className="flex items-center gap-1"><CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" /> {completedCount}</span>
                      <span className="flex items-center gap-1"><XCircleIcon className="w-3.5 h-3.5 text-red-400" /> {failedCount}</span>
                      <span className="flex items-center gap-1"><ClockIcon className="w-3.5 h-3.5 text-slate-300" /> {history.length} runs</span>
                    </div>
                    {lastRun && <span className="hidden lg:block text-[11px] text-slate-300">{formatDate(lastRun.started_at)}</span>}
                    <ChevronDownIcon className={`w-4 h-4 text-slate-300 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Expanded History */}
                {isExpanded && (
                  <div className="border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                    {history.length === 0 ? (
                      <div className="py-8 text-center">
                        <ClockIcon className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">No runs yet</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {history.map(run => {
                          const sc = getStatusConfig(run.status);
                          const duration = run.completed_at
                            ? formatDuration(new Date(run.completed_at).getTime() - new Date(run.started_at).getTime())
                            : 'In progress';
                          const analysis = run.analysis || analysisResults[run.id];

                          return (
                            <div key={run.id} className="group">
                              <div className="px-6 py-3 flex items-center gap-4 hover:bg-slate-50/50 transition-all">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`} />
                                <div className="flex-1 min-w-0 flex items-center gap-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sc.badge}`}>{sc.label}</span>
                                  <span className="text-xs text-slate-500">{formatDate(run.started_at)}</span>
                                  <span className="text-[11px] text-slate-300">•</span>
                                  <span className="text-[11px] text-slate-400 flex items-center gap-1"><ClockIcon className="w-3 h-3" /> {duration}</span>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                  {run.result && (
                                    <button onClick={(e) => { e.stopPropagation(); setSelectedRun(run); }}
                                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-200 transition-all">
                                      <EyeIcon className="w-3 h-3" /> View
                                    </button>
                                  )}
                                  {run.result && !analysis && (
                                    <button onClick={(e) => { e.stopPropagation(); handleAnalyzeResult({ ...run, automationTask: automation.task }); }}
                                      disabled={analyzingId === run.id}
                                      className="flex items-center gap-1 px-3 py-1.5 bg-violet-100 rounded-lg text-[11px] font-semibold text-violet-700 hover:bg-violet-200 transition-all disabled:opacity-50">
                                      <SparklesIcon className={`w-3 h-3 ${analyzingId === run.id ? 'animate-spin' : ''}`} /> Analyze
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Error message */}
                              {run.error_message && (
                                <div className="mx-6 mb-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                                  <p className="text-xs text-red-700 font-mono">{run.error_message}</p>
                                </div>
                              )}

                              {/* AI Analysis */}
                              {analysis && (
                                <div className="mx-6 mb-3 p-4 bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-xl">
                                  <div className="flex items-center gap-2 mb-2">
                                    <SparklesIcon className="w-3.5 h-3.5 text-violet-600" />
                                    <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">AI Analysis</span>
                                  </div>
                                  <div className="text-xs text-slate-700">
                                    <MarkdownRenderer content={analysis} />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ RESULT DETAIL MODAL ═══ */}
      {selectedRun && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setSelectedRun(null)}>
          <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <DocumentTextIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Run Result</h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>{formatDate(selectedRun.started_at)}</span>
                    {selectedRun.completed_at && (
                      <>
                        <span>•</span>
                        <span>Duration: {formatDuration(new Date(selectedRun.completed_at).getTime() - new Date(selectedRun.started_at).getTime())}</span>
                      </>
                    )}
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getStatusConfig(selectedRun.status).badge}`}>
                      {getStatusConfig(selectedRun.status).label}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedRun(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Close">
                <XMarkIcon className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedRun.result && (
                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Output</h4>
                  <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                    <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-words">{selectedRun.result}</pre>
                  </div>
                </div>
              )}
              {selectedRun.error_message && (
                <div>
                  <h4 className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-2">Error</h4>
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                    <pre className="text-xs text-red-700 font-mono whitespace-pre-wrap">{selectedRun.error_message}</pre>
                  </div>
                </div>
              )}
              {(selectedRun.analysis || analysisResults[selectedRun.id]) && (
                <div>
                  <h4 className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <SparklesIcon className="w-3 h-3" /> AI Analysis
                  </h4>
                  <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-xl p-5">
                    <div className="text-sm text-slate-700">
                      <MarkdownRenderer content={selectedRun.analysis || analysisResults[selectedRun.id]} />
                    </div>
                  </div>
                </div>
              )}
              {selectedRun.result && !selectedRun.analysis && !analysisResults[selectedRun.id] && (
                <button onClick={() => handleAnalyzeResult({ ...selectedRun, automationTask: automations.find(a => a.id === selectedRun.automation_id)?.task || '' })}
                  disabled={analyzingId === selectedRun.id}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-50 transition-all">
                  <SparklesIcon className={`w-4 h-4 ${analyzingId === selectedRun.id ? 'animate-spin' : ''}`} />
                  {analyzingId === selectedRun.id ? 'Analyzing...' : 'Generate AI Analysis'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
