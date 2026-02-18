import React, { useEffect, useMemo, useState } from 'react';
import {
  PlusIcon,
  PlayIcon,
  StopIcon,
  TrashIcon,
  Cog6ToothIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline';

interface ChromeProfile {
  name: string;
  path: string;
}

interface AgentSummary {
  id: string;
  name: string;
  description: string;
  status: 'stopped' | 'starting' | 'running' | 'paused' | 'error';
  profileId: string;
  telegramUsername?: string;
  lastActive?: string | null;
}

const defaultForm = {
  name: '',
  description: '',
  profileId: '',
  telegramBotToken: '',
  telegramChatIds: '',
  telegramAutoAuthorize: true,
  headless: false
};

const buildDefaultConfig = (form: typeof defaultForm) => ({
  name: form.name,
  description: form.description,
  profileId: form.profileId,
  telegramBotToken: form.telegramBotToken || undefined,
  telegramChatIds: form.telegramChatIds
    ? form.telegramChatIds.split(',').map(value => value.trim()).filter(Boolean)
    : [],
  telegramUsername: undefined,
  telegramAutoAuthorize: form.telegramAutoAuthorize,
  personality: {
    style: 'professional',
    tone: 'Helpful, concise, and accurate',
    goals: [],
    constraints: [],
    customInstructions: ''
  },
  browser: {
    headless: form.headless,
    persistent: true,
    viewport: { width: 1280, height: 720 }
  },
  execution: {
    maxConcurrentTasks: 1,
    defaultTimeout: 300000,
    retryAttempts: 1,
    screenshotOnError: true
  }
});

export default function BrowserAgentsPage() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [profiles, setProfiles] = useState<ChromeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [apiError, setApiError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authorizedIds, setAuthorizedIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
    const agentApi = window.electronAPI?.agent;
    const unsubscribe = agentApi?.onStatus?.(update => {
      setAgents(prev => prev.map(agent => (agent.id === update.id ? update : agent)));
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const agentApi = window.electronAPI?.agent;
      if (!agentApi) {
        setApiError('Agent API not available. Rebuild preload with `node build-preload.js` and restart the app.');
        setLoading(false);
        return;
      }

      const profilesList = await window.electronAPI.chrome.getProfiles();
      setProfiles(profilesList);
      if (profilesList.length && !form.profileId) {
        setForm(prev => ({ ...prev, profileId: profilesList[0].path }));
      }

      const items = await agentApi.getAll();
      setAgents(items || []);
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.profileId) return;
    const config = buildDefaultConfig(form);
    await window.electronAPI.agent?.create(config);
    setForm(defaultForm);
    setShowForm(false);
    await loadData();
  };

  const handleEdit = async (agent: AgentSummary) => {
    setEditingId(agent.id);
    setShowForm(true);
    setAuthCode(null);
    setAuthError(null);
    setAuthorizedIds([]);
    try {
      const config = await window.electronAPI.agent?.getById(agent.id);
      setForm({
        name: config?.name || agent.name,
        description: config?.description || agent.description || '',
        profileId: config?.profileId || agent.profileId,
        telegramBotToken: '',
        telegramChatIds: '',
        telegramAutoAuthorize: config?.telegramAutoAuthorize ?? true,
        headless: config?.browser?.headless ?? false
      });
      // Fetch live authorized chat IDs from running agent
      const ids = await window.electronAPI.agent?.getAuthorizedChatIds(agent.id);
      if (ids?.length) setAuthorizedIds(ids);
    } catch (error) {
      console.error('Failed to load agent config:', error);
      setForm({
        name: agent.name,
        description: agent.description || '',
        profileId: agent.profileId,
        telegramBotToken: '',
        telegramChatIds: '',
        telegramAutoAuthorize: true,
        headless: false
      });
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const updates = buildDefaultConfig(form);
    await window.electronAPI.agent?.update(editingId, updates);
    setEditingId(null);
    setForm(defaultForm);
    setShowForm(false);
    setAuthCode(null);
    setAuthError(null);
    await loadData();
  };

  const handleGenerateAuthCode = async () => {
    if (!editingId) return;
    setAuthError(null);
    try {
      const result = await window.electronAPI.agent?.generateAuthCode(editingId);
      if (!result?.success || !result.code) {
        setAuthError(result?.error || 'Failed to generate code');
        return;
      }
      setAuthCode(result.code);
    } catch (error: any) {
      setAuthError(error?.message || 'Failed to generate code');
    }
  };

  const handleStart = async (id: string) => {
    await window.electronAPI.agent?.start(id);
  };

  const handleStop = async (id: string) => {
    await window.electronAPI.agent?.stop(id);
  };

  const handleDelete = async (id: string) => {
    await window.electronAPI.agent?.delete(id);
    await loadData();
  };

  const statusColor = (status: AgentSummary['status']) => {
    switch (status) {
      case 'running':
        return 'bg-emerald-500';
      case 'paused':
        return 'bg-amber-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-slate-300';
    }
  };

  const emptyState = useMemo(() => agents.length === 0 && !loading, [agents.length, loading]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Browser Agents</h1>
          <p className="text-sm text-slate-500 mt-2">Create persistent browser agents powered by browser-use.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800"
        >
          <PlusIcon className="w-4 h-4" /> New Agent
        </button>
      </div>

      {apiError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 text-sm">
          {apiError}
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              {editingId ? 'Edit Agent' : 'Create Agent'}
            </h2>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(defaultForm);
              }}
              className="text-sm text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500">Agent Name</label>
              <input
                value={form.name}
                onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                placeholder="Work Assistant"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500">Chrome Profile</label>
              <select
                value={form.profileId}
                onChange={event => setForm(prev => ({ ...prev, profileId: event.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              >
                {profiles.map(profile => (
                  <option key={profile.path} value={profile.path}>{profile.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500">Description</label>
            <input
              value={form.description}
              onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
              placeholder="Handles browser tasks for work accounts"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={form.headless}
              onChange={event => setForm(prev => ({ ...prev, headless: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            <span>Run headless (hide browser window)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500">Telegram Bot Token</label>
              <input
                value={form.telegramBotToken}
                onChange={event => setForm(prev => ({ ...prev, telegramBotToken: event.target.value }))}
                placeholder="123456:ABC..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500">Telegram Chat IDs</label>
              <input
                value={form.telegramChatIds}
                onChange={event => setForm(prev => ({ ...prev, telegramChatIds: event.target.value }))}
                placeholder="12345,67890"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
              <p className="text-[11px] text-slate-400">Leave empty to auto-authorize the first people who message the bot.</p>
            </div>
          </div>

          {editingId && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600">Telegram Authorization Code</p>
                  <p className="text-[11px] text-slate-400">Generate a code and send it to the bot to authorize a user.</p>
                </div>
                <button
                  onClick={handleGenerateAuthCode}
                  className="px-3 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800"
                >
                  Generate Code
                </button>
              </div>
              {authCode && (
                <div className="text-sm font-bold text-slate-900">{authCode}</div>
              )}
              {authError && (
                <div className="text-xs text-rose-600">{authError}</div>
              )}
            </div>
          )}

          {editingId && authorizedIds.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-semibold text-emerald-700">Authorized Telegram Accounts ({authorizedIds.length})</p>
              <div className="flex flex-wrap gap-2">
                {authorizedIds.map(id => (
                  <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-mono">
                    {id}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-emerald-500">These chat IDs are currently authorized to interact with this bot.</p>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={form.telegramAutoAuthorize}
              onChange={event => setForm(prev => ({ ...prev, telegramAutoAuthorize: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            <span>Auto-authorize chat IDs when people message the bot</span>
          </div>

          <button
            onClick={editingId ? handleUpdate : handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500"
          >
            <ComputerDesktopIcon className="w-4 h-4" /> {editingId ? 'Save Changes' : 'Create Agent'}
          </button>
        </div>
      )}

      {loading && <div className="text-sm text-slate-500">Loading agents...</div>}

      {emptyState && (
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center">
          <h3 className="text-lg font-bold text-slate-900">No agents yet</h3>
          <p className="text-sm text-slate-500 mt-2">Create your first browser agent to begin automation.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {agents.map(agent => (
          <div key={agent.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${statusColor(agent.status)}`} />
                  <h3 className="text-lg font-bold text-slate-900">{agent.name}</h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">{agent.description || 'No description yet'}</p>
              </div>
              <button
                onClick={() => handleEdit(agent)}
                className="text-slate-400 hover:text-slate-700"
              >
                <Cog6ToothIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-500 space-y-1">
              <div>Profile: {agent.profileId}</div>
              <div>Status: {agent.status}</div>
              {agent.telegramUsername && <div>Telegram: {agent.telegramUsername}</div>}
            </div>

            <div className="flex items-center gap-2">
              {agent.status !== 'running' ? (
                <button
                  onClick={() => handleStart(agent.id)}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-emerald-500 text-white rounded-xl hover:bg-emerald-400"
                >
                  <PlayIcon className="w-4 h-4" /> Start
                </button>
              ) : (
                <button
                  onClick={() => handleStop(agent.id)}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-amber-500 text-white rounded-xl hover:bg-amber-400"
                >
                  <StopIcon className="w-4 h-4" /> Stop
                </button>
              )}
              <button
                onClick={() => handleDelete(agent.id)}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200"
              >
                <TrashIcon className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
