import React, { useState, useEffect } from 'react';
import storage, { STORAGE_KEYS } from '../services/electronStore';
import {
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_URL,
  fetchOllamaModels,
  testOllamaConnection,
} from '../services/geminiService';

// OpenAI Configuration Section
export const OpenAIConfigSection = () => {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_OPENAI_MODEL);
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const key = await storage.get(STORAGE_KEYS.OPENAI_API_KEY);
      const model = await storage.get(STORAGE_KEYS.OPENAI_MODEL);
      if (key) setApiKey(key);
      if (model) setSelectedModel(model);
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setTimeout(async () => {
      await storage.set(STORAGE_KEYS.OPENAI_API_KEY, apiKey);
      await storage.set(STORAGE_KEYS.OPENAI_MODEL, selectedModel);
      setIsSaving(false);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2000);
    }, 800);
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="openai-key" className="block text-sm font-bold text-slate-900 mb-2">
          OpenAI API Key
        </label>
        <div className="relative">
          <input
            id="openai-key"
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full px-4 py-3 pr-20 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Get your API key from{' '}
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            OpenAI Platform
          </a>
        </p>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-900 mb-2">
          Model Selection
        </label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          {OPENAI_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} - {model.description}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving || isSuccess}
        className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            Saving...
          </span>
        ) : isSuccess ? (
          '✓ Saved Successfully'
        ) : (
          'Save OpenAI Settings'
        )}
      </button>
    </div>
  );
};
// GitHub Copilot Configuration Section
export const GithubCopilotConfigSection = () => {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [authStatus, setAuthStatus] = useState<{ status: string; code?: string; message?: string } | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const key = await storage.get(STORAGE_KEYS.GITHUB_COPILOT_API_KEY);
      const model = await storage.get(STORAGE_KEYS.GITHUB_COPILOT_MODEL);
      if (key) setApiKey(key);
      if (model) setSelectedModel(model);
      
      // Load available models
      try {
        const models = await window.electronAPI.copilot.listModels();
        setAvailableModels(models);
      } catch (err) {
        console.error('Failed to load Copilot models in settings:', err);
      }
      
      // Check auth status on initial load
      await checkAuthStatus();
    };
    loadSettings();

    const unsub = window.electronAPI.copilot.onAuthStatus((data) => {
      setAuthStatus(data);
      if (data.status === 'success' || data.status === 'error') {
        setIsSigningIn(false);
      }
    });

    return unsub;
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setTimeout(async () => {
      await storage.set(STORAGE_KEYS.GITHUB_COPILOT_API_KEY, apiKey);
      await storage.set(STORAGE_KEYS.GITHUB_COPILOT_MODEL, selectedModel);
      setIsSaving(false);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2000);
    }, 800);
  };

  const checkAuthStatus = async () => {
    try {
      const status = await window.electronAPI.copilot.getAuthStatus();
      console.log('🔐 Copilot auth status:', status);
      
      if (status.authenticated) {
        const username = status.user?.login || status.statusMessage || 'user';
        setAuthStatus({ status: 'success', message: `Authenticated as ${username}!` });
        setIsSigningIn(false);
        return true;
      } else {
        setAuthStatus({ status: 'needs_auth', message: 'Not authenticated' });
        return false;
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setAuthStatus({ status: 'error', message: (error as Error).message });
      return false;
    }
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthStatus({ status: 'starting', message: 'Calling GitHub Copilot CLI...' });
    try {
      await window.electronAPI.copilot.signIn();
      
      // Poll for authentication status every 3 seconds for up to 5 minutes
      const maxAttempts = 100; // 5 minutes
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        const isAuthenticated = await checkAuthStatus();
        
        if (isAuthenticated || attempts >= maxAttempts) {
          clearInterval(pollInterval);
          if (!isAuthenticated && attempts >= maxAttempts) {
            setAuthStatus({ status: 'error', message: 'Authentication timeout. Please try again.' });
            setIsSigningIn(false);
          }
        }
      }, 3000);
    } catch (error) {
      setAuthStatus({ status: 'error', message: 'Failed to trigger CLI authentication.' });
      setIsSigningIn(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
        <p className="text-xs text-indigo-700 leading-relaxed font-semibold">
          <span className="font-bold">GitHub Authentication Required:</span> Click the button below to authenticate with GitHub Copilot. 
          The CLI will display a device code - visit <code className="bg-white px-1 mx-1 rounded border">github.com/login/device</code> in your browser and enter the code. 
          The app will automatically detect when you complete authentication.
        </p>
      </div>

      <div className="space-y-4 pt-2 pb-4 border-b border-slate-100">
        <h4 className="text-sm font-bold text-slate-800">CLI Authentication</h4>
        
        {authStatus?.status === 'needs_auth' && authStatus.code && (
          <div className="bg-slate-900 text-white p-6 rounded-2xl space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Device Code</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">Action Required</span>
            </div>
            <div className="text-center py-4 bg-white/5 rounded-xl border border-white/10">
              <span className="text-3xl font-black tracking-[0.2em] font-mono text-indigo-300">{authStatus.code}</span>
            </div>
            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              Visit <a href="https://github.com/login/device" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">github.com/login/device</a> and enter the code above.
            </p>
          </div>
        )}

        {authStatus?.status === 'success' && (
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl animate-in slide-in-from-top duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold">
                  ✓
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-900">{authStatus.message}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Copilot SDK is ready to use</p>
                </div>
              </div>
              <button
                onClick={checkAuthStatus}
                className="px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 rounded-lg transition-all"
                title="Refresh status"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        )}

        {authStatus?.status === 'error' && (
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center gap-3">
             <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center text-rose-600">
               !
             </div>
             <span className="text-xs font-bold text-rose-700">{authStatus.message}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="flex-1 px-6 py-4 bg-slate-900 hover:bg-black text-white font-black rounded-xl transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isSigningIn ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                <span>Sign in with GitHub</span>
              </>
            )}
          </button>
          
          <button
            onClick={checkAuthStatus}
            disabled={isSigningIn}
            className="px-4 py-4 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold rounded-xl transition-all disabled:opacity-50"
            title="Check authentication status"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-900 mb-2">
          Optional GitHub / Copilot API Key
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="ghp_... or ghu_..."
            className="w-full px-4 py-3 pr-20 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          Supported tokens: <span className="font-mono bg-slate-100 px-1 rounded">gho_</span> (OAuth), 
          <span className="font-mono bg-slate-100 px-1 rounded">ghu_</span> (App), 
          <span className="font-mono bg-slate-100 px-1 rounded">github_pat_</span> (Fine-grained). 
          Classic tokens (<span className="font-mono bg-slate-100 px-1 rounded">ghp_</span>) are not supported.
        </p>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-900 mb-2">
          Default Model Selection
        </label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          {availableModels.length > 0 ? (
            availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name || model.id}
              </option>
            ))
          ) : (
            <>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="o1-preview">o1 Preview</option>
              <option value="o1-mini">o1 Mini</option>
            </>
          )}
        </select>
        <p className="text-xs text-slate-400 mt-1 italic">
          Fetching models from Copilot SDK...
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving || isSuccess}
        className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            Saving...
          </span>
        ) : isSuccess ? (
          '✓ Saved Successfully'
        ) : (
          'Save configuration'
        )}
      </button>
    </div>
  );
};
// Anthropic Configuration Section
export const AnthropicConfigSection = () => {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_ANTHROPIC_MODEL);
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const key = await storage.get(STORAGE_KEYS.ANTHROPIC_API_KEY);
      const model = await storage.get(STORAGE_KEYS.ANTHROPIC_MODEL);
      if (key) setApiKey(key);
      if (model) setSelectedModel(model);
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setTimeout(async () => {
      await storage.set(STORAGE_KEYS.ANTHROPIC_API_KEY, apiKey);
      await storage.set(STORAGE_KEYS.ANTHROPIC_MODEL, selectedModel);
      setIsSaving(false);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2000);
    }, 800);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-bold text-slate-900 mb-2">
          Anthropic API Key
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full px-4 py-3 pr-20 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Get your API key from{' '}
          <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            Anthropic Console
          </a>
        </p>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-900 mb-2">
          Model Selection
        </label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          {ANTHROPIC_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} - {model.description}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving || isSuccess}
        className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            Saving...
          </span>
        ) : isSuccess ? (
          '✓ Saved Successfully'
        ) : (
          'Save Anthropic Settings'
        )}
      </button>
    </div>
  );
};

// Ollama Configuration Section
export const OllamaConfigSection = () => {
  const [ollamaUrl, setOllamaUrl] = useState(DEFAULT_OLLAMA_URL);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_OLLAMA_MODEL);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const url = await storage.get(STORAGE_KEYS.OLLAMA_URL);
      const model = await storage.get(STORAGE_KEYS.OLLAMA_MODEL);
      if (url) setOllamaUrl(url);
      if (model) setSelectedModel(model);
      
      // Try to fetch models
      const models = await fetchOllamaModels();
      setAvailableModels(models);
      if (!model && models.length > 0) {
        setSelectedModel(models[0].id);
      }
    };
    loadSettings();
  }, []);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    // Save URL first
    await storage.set(STORAGE_KEYS.OLLAMA_URL, ollamaUrl);
    
    const result = await testOllamaConnection();
    setTestResult(result);
    
    if (result.success) {
      const models = await fetchOllamaModels();
      setAvailableModels(models);
    }
    
    setIsTesting(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await storage.set(STORAGE_KEYS.OLLAMA_URL, ollamaUrl);
    await storage.set(STORAGE_KEYS.OLLAMA_MODEL, selectedModel);
    setIsSaving(false);
    setIsSuccess(true);
    setTimeout(() => setIsSuccess(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-bold text-slate-900 mb-2">
          Ollama Server URL
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={ollamaUrl}
            onChange={(e) => setOllamaUrl(e.target.value)}
            placeholder="http://localhost:11434"
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-xl transition-all disabled:opacity-50"
          >
            {isTesting ? '...' : 'Test'}
          </button>
        </div>
        {testResult && (
          <p className={`text-xs mt-1 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
            {testResult.message}
          </p>
        )}
        <p className="text-xs text-slate-400 mt-1">
          Make sure Ollama is running locally. Install from{' '}
          <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            ollama.ai
          </a>
        </p>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-900 mb-2">
          Model Selection
        </label>
        {availableModels.length > 0 ? (
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} - {model.description}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            placeholder="qwen2:0.5b"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        )}
        <p className="text-xs text-slate-400 mt-1">
          {availableModels.length > 0 
            ? `Found ${availableModels.length} model(s)` 
            : 'No models detected. Pull models with: ollama pull qwen2:0.5b'}
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving || isSuccess}
        className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            Saving...
          </span>
        ) : isSuccess ? (
          '✓ Saved Successfully'
        ) : (
          'Save Ollama Settings'
        )}
      </button>
    </div>
  );
};

// Local AI Configuration Section
export const LocalAIConfigSection = () => {
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('default');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const url = await storage.get(STORAGE_KEYS.LOCAL_AI_URL);
      const key = await storage.get(STORAGE_KEYS.LOCAL_AI_KEY);
      const model = await storage.get(STORAGE_KEYS.LOCAL_AI_MODEL);
      if (url) setApiUrl(url);
      if (key) setApiKey(key);
      if (model) setSelectedModel(model);
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setTimeout(async () => {
      await storage.set(STORAGE_KEYS.LOCAL_AI_URL, apiUrl);
      await storage.set(STORAGE_KEYS.LOCAL_AI_KEY, apiKey);
      await storage.set(STORAGE_KEYS.LOCAL_AI_MODEL, selectedModel);
      setIsSaving(false);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2000);
    }, 800);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-bold text-slate-900 mb-2">
          API Endpoint URL
        </label>
        <input
          type="text"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="http://localhost:8080"
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <p className="text-xs text-slate-400 mt-1">
          OpenAI-compatible endpoint (LM Studio, vLLM, text-generation-webui, etc.)
        </p>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-900 mb-2">
          API Key (Optional)
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Leave empty if not required"
            className="w-full px-4 py-3 pr-20 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-900 mb-2">
          Model Name
        </label>
        <input
          type="text"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          placeholder="default"
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <p className="text-xs text-slate-400 mt-1">
          Model identifier (e.g., "gpt-3.5-turbo" for local endpoint)
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving || isSuccess}
        className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            Saving...
          </span>
        ) : isSuccess ? (
          '✓ Saved Successfully'
        ) : (
          'Save Local AI Settings'
        )}
      </button>
    </div>
  );
};
