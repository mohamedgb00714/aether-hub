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
        <label className="block text-sm font-bold text-slate-900 mb-2">
          OpenAI API Key
        </label>
        <div className="relative">
          <input
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
