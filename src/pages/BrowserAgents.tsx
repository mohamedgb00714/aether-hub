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
  headless: false,
  // Personality
  personalityStyle: 'professional' as 'professional' | 'casual' | 'technical' | 'creative' | 'friendly' | 'custom',
  personalityTone: 'Helpful, concise, and accurate',
  personalityLanguage: 'the same language as the user',
  personalityResponseLength: 'concise' as 'concise' | 'balanced' | 'detailed',
  personalityUseEmoji: true,
  personalityGoals: '',
  personalityConstraints: '',
  personalityGreeting: '',
  personalitySystemPrompt: '',
  personalityCustomInstructions: ''
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
    style: form.personalityStyle,
    tone: form.personalityTone || 'Helpful, concise, and accurate',
    language: form.personalityLanguage || 'the same language as the user',
    responseLength: form.personalityResponseLength,
    useEmoji: form.personalityUseEmoji,
    goals: form.personalityGoals ? form.personalityGoals.split('\n').map(s => s.trim()).filter(Boolean) : [],
    constraints: form.personalityConstraints ? form.personalityConstraints.split('\n').map(s => s.trim()).filter(Boolean) : [],
    greeting: form.personalityGreeting,
    systemPrompt: form.personalitySystemPrompt,
    customInstructions: form.personalityCustomInstructions
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
      const p = config?.personality;
      setForm({
        name: config?.name || agent.name,
        description: config?.description || agent.description || '',
        profileId: config?.profileId || agent.profileId,
        telegramBotToken: '',
        telegramChatIds: '',
        telegramAutoAuthorize: config?.telegramAutoAuthorize ?? true,
        headless: config?.browser?.headless ?? false,
        personalityStyle: p?.style || 'professional',
        personalityTone: p?.tone || 'Helpful, concise, and accurate',
        personalityLanguage: p?.language || 'the same language as the user',
        personalityResponseLength: p?.responseLength || 'concise',
        personalityUseEmoji: p?.useEmoji ?? true,
        personalityGoals: (p?.goals || []).join('\n'),
        personalityConstraints: (p?.constraints || []).join('\n'),
        personalityGreeting: p?.greeting || '',
        personalitySystemPrompt: p?.systemPrompt || '',
        personalityCustomInstructions: p?.customInstructions || ''
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
        headless: false,
        personalityStyle: 'professional',
        personalityTone: 'Helpful, concise, and accurate',
        personalityLanguage: 'the same language as the user',
        personalityResponseLength: 'concise',
        personalityUseEmoji: true,
        personalityGoals: '',
        personalityConstraints: '',
        personalityGreeting: '',
        personalitySystemPrompt: '',
        personalityCustomInstructions: ''
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
    const result = await window.electronAPI.agent?.start(id);
    if (!result?.success) {
      console.error('Failed to start agent:', result?.error);
    }
    await loadData();
  };

  const handleStop = async (id: string) => {
    await window.electronAPI.agent?.stop(id);
    await loadData();
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

          {/* Personality Settings */}
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-4">
            <p className="text-xs font-bold text-violet-700">🧠 Agent Personality</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-violet-600">Style</label>
                <select
                  value={form.personalityStyle}
                  onChange={e => setForm(prev => ({ ...prev, personalityStyle: e.target.value as any }))}
                  className="w-full px-2 py-1.5 border border-violet-200 rounded-lg text-xs bg-white"
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="technical">Technical</option>
                  <option value="creative">Creative</option>
                  <option value="friendly">Friendly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-violet-600">Response Length</label>
                <select
                  value={form.personalityResponseLength}
                  onChange={e => setForm(prev => ({ ...prev, personalityResponseLength: e.target.value as any }))}
                  className="w-full px-2 py-1.5 border border-violet-200 rounded-lg text-xs bg-white"
                >
                  <option value="concise">Concise (1-3 sentences)</option>
                  <option value="balanced">Balanced (2-5 sentences)</option>
                  <option value="detailed">Detailed (comprehensive)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-violet-600">Language</label>
                <input
                  value={form.personalityLanguage}
                  onChange={e => setForm(prev => ({ ...prev, personalityLanguage: e.target.value }))}
                  placeholder="the same language as the user"
                  className="w-full px-2 py-1.5 border border-violet-200 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-violet-600">Tone</label>
                <input
                  value={form.personalityTone}
                  onChange={e => setForm(prev => ({ ...prev, personalityTone: e.target.value }))}
                  placeholder="Helpful, concise, and accurate"
                  className="w-full px-2 py-1.5 border border-violet-200 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-violet-600">Greeting Message</label>
                <input
                  value={form.personalityGreeting}
                  onChange={e => setForm(prev => ({ ...prev, personalityGreeting: e.target.value }))}
                  placeholder={`Hello! I'm ${form.name || 'your agent'}. How can I help?`}
                  className="w-full px-2 py-1.5 border border-violet-200 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-violet-700">
              <input
                type="checkbox"
                checked={form.personalityUseEmoji}
                onChange={e => setForm(prev => ({ ...prev, personalityUseEmoji: e.target.checked }))}
                className="h-3.5 w-3.5 rounded border-violet-300 text-violet-600"
              />
              <span>Use emoji in responses</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-violet-600">Goals (one per line)</label>
                <textarea
                  value={form.personalityGoals}
                  onChange={e => setForm(prev => ({ ...prev, personalityGoals: e.target.value }))}
                  placeholder={"Help user with work tasks\nBe proactive with suggestions\nAsk for confirmation before actions"}
                  rows={3}
                  className="w-full px-2 py-1.5 border border-violet-200 rounded-lg text-xs resize-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-violet-600">Constraints (one per line)</label>
                <textarea
                  value={form.personalityConstraints}
                  onChange={e => setForm(prev => ({ ...prev, personalityConstraints: e.target.value }))}
                  placeholder={"Never share sensitive information\nDon't make purchases without asking\nAvoid adult content"}
                  rows={3}
                  className="w-full px-2 py-1.5 border border-violet-200 rounded-lg text-xs resize-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-violet-600">Custom Instructions</label>
              <textarea
                value={form.personalityCustomInstructions}
                onChange={e => setForm(prev => ({ ...prev, personalityCustomInstructions: e.target.value }))}
                placeholder="Any additional instructions for how the agent should behave..."
                rows={2}
                className="w-full px-2 py-1.5 border border-violet-200 rounded-lg text-xs resize-none"
              />
            </div>

            <details className="group">
              <summary className="text-[11px] font-semibold text-violet-500 cursor-pointer hover:text-violet-700">
                Advanced: Custom System Prompt (overrides all above)
              </summary>
              <div className="mt-2 space-y-1">
                <textarea
                  value={form.personalitySystemPrompt}
                  onChange={e => setForm(prev => ({ ...prev, personalitySystemPrompt: e.target.value }))}
                  placeholder="Write a full custom system prompt. If set, this replaces the auto-generated prompt (style, tone, goals, etc. are ignored). The browser task prefix will be appended automatically."
                  rows={5}
                  className="w-full px-2 py-1.5 border border-violet-200 rounded-lg text-xs resize-none font-mono"
                />
                <p className="text-[10px] text-violet-400">Leave empty to use the auto-generated prompt from settings above.</p>
              </div>
            </details>
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
