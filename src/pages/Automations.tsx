import React, { useState, useEffect } from 'react';
import { 
  ComputerDesktopIcon, 
  PlayIcon, 
  StopIcon,
  PlusIcon,
  TrashIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  SparklesIcon,
  EyeSlashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline';
import { browserAutomationService } from '../services/browserUseService';
import storage, { STORAGE_KEYS } from '../services/electronStore';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { getModel } from '../services/geminiService';

interface ChromeProfile {
  id: string;
  name: string;
  path: string;
  email?: string;
  avatar?: string;
}

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

export default function AutomationsPage() {
  const [profiles, setProfiles] = useState<ChromeProfile[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [chromeInstalled, setChromeInstalled] = useState(false);
  const [hasLLM, setHasLLM] = useState(false);
  const [llmProvider, setLlmProvider] = useState<string>('');
  
  // Installation state
  const [pythonInstalled, setPythonInstalled] = useState(false);
  const [pythonVersion, setPythonVersion] = useState<string | null>(null);
  const [uvInstalled, setUvInstalled] = useState(false);
  const [uvVersion, setUvVersion] = useState<string | null>(null);
  const [browserUseInstalled, setBrowserUseInstalled] = useState(false);
  const [browserUseVersion, setBrowserUseVersion] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<string>('');
  
  // Settings
  const [maxConcurrent, setMaxConcurrent] = useState(3);
  const [runningCount, setRunningCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  
  // New automation form
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    task: '',
    profile_id: '',
    headless: false,
    run_on_startup: false,
    cron_schedule: '',
  });

  // History and analysis
  const [selectedHistory, setSelectedHistory] = useState<{[key: string]: AutomationHistory[]}>({});
  const [expandedAutomation, setExpandedAutomation] = useState<string | null>(null);
  const [analyzingResult, setAnalyzingResult] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<{[key: string]: string}>({});

  useEffect(() => {
    loadData();
    loadSchedulerStatus();
    
    // Poll for running status every 2 seconds
    const interval = setInterval(() => {
      loadSchedulerStatus();
      loadAutomations();
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const installed = await window.electronAPI.chrome.isInstalled();
      setChromeInstalled(installed);

      if (installed) {
        const chromeProfiles = await window.electronAPI.chrome.getProfiles();
        setProfiles(chromeProfiles);
        
        if (chromeProfiles.length > 0 && !formData.profile_id) {
          setFormData(prev => ({ ...prev, profile_id: chromeProfiles[0].path }));
        }
      }

      const configured = await browserAutomationService.hasLLMConfigured();
      setHasLLM(configured);
      if (configured) {
        const provider = await browserAutomationService.getProviderName();
        setLlmProvider(provider);
      }

      const pythonCheck = await window.electronAPI.python.checkInstalled();
      setPythonInstalled(pythonCheck.installed);
      setPythonVersion(pythonCheck.version);

      if (pythonCheck.installed) {
        const uvCheck = await window.electronAPI.uv.checkInstalled();
        setUvInstalled(uvCheck.installed);
        setUvVersion(uvCheck.version);

        try {
          const browserUseCheck = await window.electronAPI.browseruse.checkInstalled();
          setBrowserUseInstalled(browserUseCheck.installed);
          setBrowserUseVersion(browserUseCheck.version);
        } catch (e) {
          setBrowserUseInstalled(false);
        }
      }

      await loadAutomations();
      
      const stored = await storage.get(STORAGE_KEYS.MAX_CONCURRENT_AUTOMATIONS);
      if (stored) setMaxConcurrent(stored);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const loadAutomations = async () => {
    try {
      const result = await window.electronAPI.automation.getAll();
      if (result.success && result.automations) {
        setAutomations(result.automations);
      }
    } catch (error) {
      console.error('Failed to load automations:', error);
    }
  };

  const loadSchedulerStatus = async () => {
    try {
      const result = await window.electronAPI.automation.getSchedulerStatus();
      if (result.success) {
        setRunningCount(result.runningCount || 0);
        if (result.maxConcurrent) setMaxConcurrent(result.maxConcurrent);
      }
    } catch (error) {
      console.error('Failed to load scheduler status:', error);
    }
  };

  const handleSaveMaxConcurrent = async () => {
    try {
      await window.electronAPI.automation.setMaxConcurrent(maxConcurrent);
      await storage.set(STORAGE_KEYS.MAX_CONCURRENT_AUTOMATIONS, maxConcurrent);
      setShowSettings(false);
    } catch (error) {
      console.error('Failed to save max concurrent:', error);
    }
  };

  const handleInstallUv = async () => {
    setIsInstalling(true);
    setInstallProgress('Installing uv package manager...');

    try {
      const result = await window.electronAPI.uv.install();
      
      if (result.success) {
        setInstallProgress('uv installed successfully!');
        setUvInstalled(true);
        const uvCheck = await window.electronAPI.uv.checkInstalled();
        setUvVersion(uvCheck.version);
        
        setTimeout(() => {
          setInstallProgress('');
          setIsInstalling(false);
        }, 3000);
      } else {
        setInstallProgress(`Failed: ${result.error}`);
        setTimeout(() => {
          setInstallProgress('');
          setIsInstalling(false);
        }, 5000);
      }
    } catch (error: any) {
      setInstallProgress(`Error: ${error.message}`);
      setTimeout(() => {
        setInstallProgress('');
        setIsInstalling(false);
      }, 5000);
    }
  };

  const handleInstallBrowserUse = async () => {
    setIsInstalling(true);
    setInstallProgress('Starting installation...');

    const removeListener = window.electronAPI.browseruse.onInstallProgress((message) => {
      setInstallProgress(message);
    });

    try {
      const result = await window.electronAPI.browseruse.install();
      
      if (result.success) {
        setInstallProgress('Installation successful!');
        setBrowserUseInstalled(true);
        
        const browserUseCheck = await window.electronAPI.browseruse.checkInstalled();
        setBrowserUseVersion(browserUseCheck.version);

        setTimeout(() => {
          setInstallProgress('');
        }, 3000);
      } else {
        setInstallProgress(`Installation failed: ${result.error}`);
      }
    } catch (error: any) {
      setInstallProgress(`Installation error: ${error.message}`);
    }

    removeListener();
    setIsInstalling(false);
  };

  const handleSaveAutomation = async () => {
    if (!formData.name.trim() || !formData.task.trim() || !formData.profile_id) {
      return;
    }

    try {
      if (editingId) {
        await window.electronAPI.automation.update(editingId, {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          task: formData.task.trim(),
          profile_id: formData.profile_id,
          headless: formData.headless ? 1 : 0,
          run_on_startup: formData.run_on_startup ? 1 : 0,
          cron_schedule: formData.cron_schedule.trim() || null,
        });
      } else {
        await window.electronAPI.automation.create({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          task: formData.task.trim(),
          profile_id: formData.profile_id,
          headless: formData.headless ? 1 : 0,
          run_on_startup: formData.run_on_startup ? 1 : 0,
          cron_schedule: formData.cron_schedule.trim() || null,
          status: 'idle',
        });
      }

      setFormData({
        name: '',
        description: '',
        task: '',
        profile_id: profiles[0]?.path || '',
        headless: false,
        run_on_startup: false,
        cron_schedule: '',
      });
      setShowNewForm(false);
      setEditingId(null);
      await loadAutomations();
      await window.electronAPI.automation.reloadSchedules();
    } catch (error) {
      console.error('Failed to save automation:', error);
    }
  };

  const handleEditAutomation = (automation: Automation) => {
    setFormData({
      name: automation.name,
      description: automation.description || '',
      task: automation.task,
      profile_id: automation.profile_id,
      headless: automation.headless === 1,
      run_on_startup: automation.run_on_startup === 1,
      cron_schedule: automation.cron_schedule || '',
    });
    setEditingId(automation.id);
    setShowNewForm(true);
  };

  const handleDeleteAutomation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation?')) return;
    
    try {
      await window.electronAPI.automation.delete(id);
      await loadAutomations();
    } catch (error) {
      console.error('Failed to delete automation:', error);
    }
  };

  const handleRunAutomation = async (automation: Automation) => {
    if (!hasLLM || !pythonInstalled || !browserUseInstalled) {
      alert('Please configure AI provider and install required packages first.');
      return;
    }

    try {
      const config = {
        task: automation.task,
        chrome_profile_path: automation.profile_id,
        headless: automation.headless === 1,
        llm: await getLLMConfig(),
      };

      await window.electronAPI.automation.execute(automation.id, config);
      await loadAutomations();
    } catch (error) {
      console.error('Failed to run automation:', error);
    }
  };

  const handleStopAutomation = async (id: string) => {
    try {
      await window.electronAPI.automation.stop(id);
      await loadAutomations();
    } catch (error) {
      console.error('Failed to stop automation:', error);
    }
  };

  const getLLMConfig = async () => {
    const provider = await storage.get(STORAGE_KEYS.AI_PROVIDER) as string || 'google';
    const config: any = { provider: provider === 'google' ? 'gemini' : provider };
    
    switch (provider) {
      case 'google':
      case 'gemini':
        config.api_key = await storage.get(STORAGE_KEYS.GEMINI_API_KEY);
        config.model = await storage.get(STORAGE_KEYS.GEMINI_MODEL) || 'gemini-2.0-flash';
        break;
      case 'openrouter':
        config.api_key = await storage.get(STORAGE_KEYS.OPENROUTER_API_KEY);
        config.model = await storage.get(STORAGE_KEYS.OPENROUTER_MODEL) || 'x-ai/grok-2-1212';
        break;
      case 'openai':
        config.api_key = await storage.get(STORAGE_KEYS.OPENAI_API_KEY);
        config.model = await storage.get(STORAGE_KEYS.OPENAI_MODEL) || 'gpt-4o-mini';
        break;
      case 'anthropic':
        config.api_key = await storage.get(STORAGE_KEYS.ANTHROPIC_API_KEY);
        config.model = await storage.get(STORAGE_KEYS.ANTHROPIC_MODEL) || 'claude-3-5-sonnet-20241022';
        break;
      case 'ollama':
        config.model = await getModel(); // Auto-detects if not set
        config.base_url = await storage.get(STORAGE_KEYS.OLLAMA_URL) || 'http://localhost:11434';
        break;
      case 'local':
        config.api_key = await storage.get(STORAGE_KEYS.LOCAL_AI_KEY) || '';
        config.model = await storage.get(STORAGE_KEYS.LOCAL_AI_MODEL) || 'default';
        config.base_url = await storage.get(STORAGE_KEYS.LOCAL_AI_URL) || 'http://localhost:8080';
        break;
    }
    
    return config;
  };

  const loadHistory = async (automationId: string) => {
    try {
      const result = await window.electronAPI.automation.getHistory(automationId);
      if (result.success && result.history) {
        setSelectedHistory(prev => ({ ...prev, [automationId]: result.history! }));
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const handleAnalyzeResult = async (historyItem: AutomationHistory, task: string) => {
    if (!historyItem.result) return;
    
    setAnalyzingResult(historyItem.id);
    try {
      const result = await window.electronAPI.automation.analyzeResult(historyItem.result, task);
      if (result.success && result.analysis) {
        setAiAnalysis(prev => ({ ...prev, [historyItem.id]: result.analysis! }));
      }
    } catch (error) {
      console.error('Failed to analyze result:', error);
    }
    setAnalyzingResult(null);
  };

  const toggleExpanded = async (automationId: string) => {
    if (expandedAutomation === automationId) {
      setExpandedAutomation(null);
    } else {
      setExpandedAutomation(automationId);
      if (!selectedHistory[automationId]) {
        await loadHistory(automationId);
      }
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getProfileName = (profileId: string) => {
    const profile = profiles.find(p => p.path === profileId);
    return profile ? `${profile.name}${profile.email ? ` (${profile.email})` : ''}` : 'Unknown Profile';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ArrowPathIcon className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading automations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                <ComputerDesktopIcon className="w-6 h-6 text-white" />
              </div>
              Browser Automations
            </h1>
            <p className="text-slate-500 mt-2">
              AI-powered browser automation • {runningCount}/{maxConcurrent} running
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all"
            >
              <Cog6ToothIcon className="w-5 h-5" />
              Settings
            </button>
            <button
              onClick={() => {
                setEditingId(null);
                setFormData({
                  name: '',
                  description: '',
                  task: '',
                  profile_id: profiles[0]?.path || '',
                  headless: false,
                  run_on_startup: false,
                  cron_schedule: '',
                });
                setShowNewForm(true);
              }}
              disabled={!hasLLM || !pythonInstalled || !browserUseInstalled}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PlusIcon className="w-5 h-5" />
              New Automation
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">Automation Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Max Concurrent Automations
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={maxConcurrent}
                  onChange={(e) => setMaxConcurrent(parseInt(e.target.value) || 1)}
                  className="w-32 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Maximum number of automations that can run simultaneously
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveMaxConcurrent}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700"
                >
                  Save Settings
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chrome Status Warning */}
        {!chromeInstalled && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <ExclamationCircleIcon className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-800">Chrome Not Detected</h3>
                <p className="text-amber-700 text-sm mt-1">
                  Google Chrome or Chromium must be installed to use browser automations.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Installation Status */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 mb-6 shadow-sm">
          <div className="grid grid-cols-3 gap-6">
            {/* Python */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {pythonInstalled ? (
                  <CheckCircleIcon className="w-6 h-6 text-green-500" />
                ) : (
                  <ExclamationCircleIcon className="w-6 h-6 text-amber-500" />
                )}
                <div>
                  <p className="font-semibold text-slate-900">Python</p>
                  <p className="text-xs text-slate-500">
                    {pythonInstalled ? `v${pythonVersion}` : 'Not installed'}
                  </p>
                </div>
              </div>
            </div>

            {/* uv */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {uvInstalled ? (
                  <CheckCircleIcon className="w-6 h-6 text-green-500" />
                ) : (
                  <ExclamationCircleIcon className="w-6 h-6 text-amber-500" />
                )}
                <div>
                  <p className="font-semibold text-slate-900">uv</p>
                  <p className="text-xs text-slate-500">
                    {uvInstalled ? `v${uvVersion}` : 'Not installed'}
                  </p>
                </div>
              </div>
              {!uvInstalled && pythonInstalled && (
                <button
                  onClick={handleInstallUv}
                  disabled={isInstalling}
                  className="px-3 py-1 bg-violet-600 text-white text-xs rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50"
                >
                  Install
                </button>
              )}
            </div>

            {/* browser-use */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {browserUseInstalled ? (
                  <CheckCircleIcon className="w-6 h-6 text-green-500" />
                ) : (
                  <ExclamationCircleIcon className="w-6 h-6 text-amber-500" />
                )}
                <div>
                  <p className="font-semibold text-slate-900">browser-use</p>
                  <p className="text-xs text-slate-500">
                    {browserUseInstalled ? `v${browserUseVersion}` : 'Not installed'}
                  </p>
                </div>
              </div>
              {!browserUseInstalled && uvInstalled && (
                <button
                  onClick={handleInstallBrowserUse}
                  disabled={isInstalling}
                  className="px-3 py-1 bg-violet-600 text-white text-xs rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50"
                >
                  Install
                </button>
              )}
            </div>
          </div>

          {installProgress && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-700">{installProgress}</p>
            </div>
          )}
        </div>

        {/* AI Provider Status */}
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl border border-violet-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SparklesIcon className="w-6 h-6 text-violet-600" />
              <div>
                <p className="font-bold text-violet-900">AI Provider Status</p>
                <p className="text-sm text-violet-700">
                  {hasLLM ? `Using ${llmProvider} for browser automation` : 'Not configured'}
                </p>
              </div>
            </div>
            {hasLLM ? (
              <CheckCircleIcon className="w-6 h-6 text-green-500" />
            ) : (
              <div className="text-right">
                <span className="text-xs text-violet-600 font-medium">Ready</span>
              </div>
            )}
          </div>
        </div>

        {/* Automations List */}
        <div className="space-y-4">
          {automations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <ComputerDesktopIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No automations yet</p>
              <p className="text-sm text-slate-400 mt-1">Create your first automation to get started</p>
            </div>
          ) : (
            automations.map((automation) => (
              <div
                key={automation.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-slate-900">{automation.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          automation.status === 'running' ? 'bg-blue-100 text-blue-700' :
                          automation.status === 'completed' ? 'bg-green-100 text-green-700' :
                          automation.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {automation.status}
                        </span>
                        {automation.headless === 1 && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium flex items-center gap-1">
                            <EyeSlashIcon className="w-3 h-3" />
                            Headless
                          </span>
                        )}
                        {automation.run_on_startup === 1 && (
                          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                            Auto-start
                          </span>
                        )}
                        {automation.cron_schedule && (
                          <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium flex items-center gap-1">
                            <ClockIcon className="w-3 h-3" />
                            {automation.cron_schedule}
                          </span>
                        )}
                      </div>
                      
                      {automation.description && (
                        <p className="text-sm text-slate-600 mb-3">{automation.description}</p>
                      )}
                      
                      <div className="space-y-2 text-sm">
                        <p className="text-slate-700">
                          <span className="font-medium">Task:</span> {automation.task}
                        </p>
                        <p className="text-slate-600">
                          <span className="font-medium">Profile:</span> {getProfileName(automation.profile_id)}
                        </p>
                        {automation.last_run && (
                          <p className="text-slate-500">
                            <span className="font-medium">Last Run:</span> {formatDate(automation.last_run)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      {automation.status === 'running' ? (
                        <button
                          onClick={() => handleStopAutomation(automation.id)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                          title="Stop"
                        >
                          <StopIcon className="w-5 h-5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRunAutomation(automation)}
                          disabled={!hasLLM || !pythonInstalled || !browserUseInstalled}
                          className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Run"
                        >
                          <PlayIcon className="w-5 h-5" />
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleEditAutomation(automation)}
                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                        title="Edit"
                      >
                        <Cog6ToothIcon className="w-5 h-5" />
                      </button>
                      
                      <button
                        onClick={() => handleDeleteAutomation(automation.id)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                      
                      <button
                        onClick={() => toggleExpanded(automation.id)}
                        className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                        title="View History"
                      >
                        {expandedAutomation === automation.id ? (
                          <ChevronDownIcon className="w-5 h-5" />
                        ) : (
                          <ChevronRightIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* History */}
                {expandedAutomation === automation.id && (
                  <div className="border-t border-slate-200 bg-slate-50 p-6">
                    <h4 className="font-bold text-slate-900 mb-4">Execution History</h4>
                    {selectedHistory[automation.id]?.length > 0 ? (
                      <div className="space-y-3">
                        {selectedHistory[automation.id].map((history) => (
                          <div key={history.id} className="bg-white rounded-lg p-4 border border-slate-200">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  history.status === 'completed' ? 'bg-green-100 text-green-700' :
                                  history.status === 'failed' ? 'bg-red-100 text-red-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {history.status}
                                </span>
                                <span className="text-xs text-slate-600">
                                  {formatDate(history.started_at)}
                                </span>
                                {history.completed_at && (
                                  <span className="text-xs text-slate-500">
                                    Duration: {Math.round((new Date(history.completed_at).getTime() - new Date(history.started_at).getTime()) / 1000)}s
                                  </span>
                                )}
                              </div>
                              
                              {history.result && history.status === 'completed' && !history.analysis && (
                                <button
                                  onClick={() => handleAnalyzeResult(history, automation.task)}
                                  disabled={analyzingResult === history.id}
                                  className="flex items-center gap-1 px-3 py-1 bg-violet-100 text-violet-700 rounded-lg text-xs font-medium hover:bg-violet-200 disabled:opacity-50"
                                >
                                  <SparklesIcon className="w-4 h-4" />
                                  {analyzingResult === history.id ? 'Analyzing...' : 'AI Analysis'}
                                </button>
                              )}
                            </div>
                            
                            {history.error_message && (
                              <div className="mt-2 p-3 bg-red-50 rounded-lg">
                                <p className="text-xs font-mono text-red-700">{history.error_message}</p>
                              </div>
                            )}
                            
                            {history.result && (
                              <div className="mt-2">
                                <details className="cursor-pointer">
                                  <summary className="text-xs font-medium text-slate-700">View Result</summary>
                                  <pre className="mt-2 p-3 bg-slate-50 rounded-lg text-xs overflow-auto max-h-48">
                                    {JSON.stringify(JSON.parse(history.result), null, 2)}
                                  </pre>
                                </details>
                              </div>
                            )}
                            
                            {(history.analysis || aiAnalysis[history.id]) && (
                              <div className="mt-2 p-3 bg-violet-50 rounded-lg border border-violet-200">
                                <p className="text-xs font-medium text-violet-900 mb-1">AI Analysis:</p>
                                <MarkdownRenderer 
                                  content={history.analysis || aiAnalysis[history.id]} 
                                  className="text-xs"
                                  variant="purple"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">No execution history yet</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* New/Edit Automation Modal */}
        {showNewForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-2xl font-bold text-slate-900">
                  {editingId ? 'Edit Automation' : 'New Automation'}
                </h2>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    placeholder="My Automation"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Description (Optional)</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    placeholder="What does this automation do?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Task</label>
                  <textarea
                    value={formData.task}
                    onChange={(e) => setFormData({ ...formData, task: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    placeholder="Go to my Apify console and check my earnings"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Chrome Profile</label>
                  <select
                    value={formData.profile_id}
                    onChange={(e) => setFormData({ ...formData, profile_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  >
                    {profiles.map((profile) => (
                      <option key={profile.path} value={profile.path}>
                        {profile.name} {profile.email && `(${profile.email})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Cron Schedule (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.cron_schedule}
                    onChange={(e) => setFormData({ ...formData, cron_schedule: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    placeholder="0 9 * * * (every day at 9am)"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Format: minute hour day month weekday (e.g., "0 */2 * * *" = every 2 hours)
                  </p>
                </div>

                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.headless}
                      onChange={(e) => setFormData({ ...formData, headless: e.target.checked })}
                      className="w-4 h-4 text-violet-600 rounded focus:ring-violet-500"
                    />
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                      <EyeSlashIcon className="w-4 h-4" />
                      Run Headless (invisible browser)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.run_on_startup}
                      onChange={(e) => setFormData({ ...formData, run_on_startup: e.target.checked })}
                      className="w-4 h-4 text-violet-600 rounded focus:ring-violet-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Run on App Startup</span>
                  </label>
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 flex gap-3">
                <button
                  onClick={handleSaveAutomation}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                >
                  {editingId ? 'Save Changes' : 'Create Automation'}
                </button>
                <button
                  onClick={() => {
                    setShowNewForm(false);
                    setEditingId(null);
                  }}
                  className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
