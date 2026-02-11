
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import storage, { STORAGE_KEYS } from '../services/electronStore';
import { db } from '../services/database';
import { 
  GEMINI_MODELS, 
  DEFAULT_MODEL, 
  DEFAULT_OPENROUTER_MODEL,
  AIProvider, 
  getAIProvider, 
  fetchOpenRouterModels,
  OpenRouterModel, 
  isFreeModeEnabled 
} from '../services/geminiService';
import { fetchVoices, fetchModels, testApiKey as testElevenLabsKey, ElevenLabsVoice, ElevenLabsModel, getSubscriptionInfo } from '../services/elevenLabsService';
import {
  OpenAIConfigSection,
  AnthropicConfigSection,
  OllamaConfigSection,
  LocalAIConfigSection,
  GithubCopilotConfigSection,
} from '../components/AIProviderConfigs';
import {
  getNotificationSettings,
  saveNotificationSettings,
  testNotificationSound,
  sendTestNotification,
  resetSeenIds,
  NOTIFICATION_SOUNDS,
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
  type SoundType
} from '../services/notificationService';
import { 
  UserCircleIcon, 
  ShieldCheckIcon, 
  SparklesIcon, 
  CpuChipIcon, 
  BellIcon, 
  BoltIcon, 
  ArrowLeftOnRectangleIcon,
  FingerPrintIcon,
  GlobeAltIcon,
  TrashIcon,
  ChevronRightIcon,
  KeyIcon,
  CommandLineIcon,
  CloudIcon,
  CheckIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  InformationCircleIcon,
  ExclamationCircleIcon,
  ArrowTopRightOnSquareIcon,
  UserIcon,
  SpeakerWaveIcon,
  MicrophoneIcon,
  PlayIcon,
  EnvelopeIcon,
  XMarkIcon,
  PlusIcon,
  ArrowPathIcon,
  ComputerDesktopIcon,
  RocketLaunchIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  ChatBubbleBottomCenterTextIcon,
  CameraIcon
} from '@heroicons/react/24/solid';

// Dynamic Profile Section that loads from connected accounts
const ProfileSection = () => {
  const [userInfo, setUserInfo] = useState<{name: string, email: string, avatar?: string} | null>(null);
  const [accountCount, setAccountCount] = useState(0);

  useEffect(() => {
    const loadUserInfo = async () => {
      // Try database first (new system)
      try {
        const accounts = await db.accounts.getAll();
        const primaryAccount = accounts.find(acc => acc.isConnected) || accounts[0];
        
        if (primaryAccount) {
          setAccountCount(accounts.length);
          setUserInfo({ 
            name: primaryAccount.name || 'User', 
            email: primaryAccount.email || '', 
            avatar: primaryAccount.avatarUrl || undefined 
          });
          return;
        }
      } catch (err) {
        console.warn('Failed to load user info from database in Settings:', err);
      }

      // Legacy fallback
      const googleUser = await storage.get('google_user') as {name: string, email: string, picture?: string} | null;
      if (googleUser) {
        setUserInfo({ name: googleUser.name, email: googleUser.email, avatar: googleUser.picture });
      }
      
      const allAccounts = await db.accounts.getAll();
      setAccountCount(allAccounts?.length || 0);
    };
    loadUserInfo();
  }, []);

  if (!userInfo) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <UserIcon className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-lg font-bold text-slate-600">No Account Connected</h3>
        <p className="text-sm text-slate-400 mt-2">Connect an account in the Connections page to see your profile here.</p>
        <a href="#/accounts" className="inline-block mt-4 px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">
          Connect Account
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-8 mb-10 pb-10 border-b border-slate-50">
        <div className="relative group">
          {userInfo.avatar ? (
            <img src={userInfo.avatar} className="w-24 h-24 rounded-[2rem] ring-4 ring-indigo-50 shadow-xl" alt="Avatar" />
          ) : (
            <div className="w-24 h-24 rounded-[2rem] ring-4 ring-indigo-50 shadow-xl bg-indigo-100 flex items-center justify-center">
              <span className="text-indigo-600 font-black text-3xl">{userInfo.name.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">{userInfo.name}</h3>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">
            {accountCount} Account{accountCount !== 1 ? 's' : ''} Connected
          </p>
          <div className="flex gap-2 mt-4">
            <a href="#/accounts" className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-colors">
              Manage Accounts
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</label>
          <input type="text" value={userInfo.name} readOnly className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-3.5 text-sm font-bold outline-none text-slate-600" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</label>
          <input type="email" value={userInfo.email} readOnly className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-3.5 text-sm font-bold outline-none text-slate-600" />
        </div>
      </div>
    </>
  );
};

// Integration setup guides with URLs
const INTEGRATION_GUIDES: Record<string, { url: string, guide: string, apiUrl?: string, scopes?: string[], redirectUri?: string }> = {
  'Google Cloud': {
    url: 'https://console.cloud.google.com/apis/credentials',
    apiUrl: 'https://console.cloud.google.com/apis/library',
    guide: '1. Go to Google Cloud Console → Credentials\n2. Create OAuth 2.0 Client ID (Desktop app)\n3. Enable APIs: Gmail API, Google Calendar API\n4. Add redirect URI below\n5. Copy Client ID and Secret here',
    scopes: [
      '.../auth/gmail.readonly',
      '.../auth/calendar.readonly', 
      '.../auth/userinfo.email',
      '.../auth/userinfo.profile'
    ],
    redirectUri: 'http://127.0.0.1:8089/oauth/callback'
  },
  'Microsoft Azure': {
    url: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    guide: '1. Register a new application\n2. Note the Application (client) ID\n3. Go to Certificates & secrets\n4. Create a new client secret'
  },
  'Slack API': {
    url: 'https://api.slack.com/apps',
    guide: '1. Create a new Slack app\n2. Go to OAuth & Permissions\n3. Add required scopes\n4. Install to workspace\n5. Copy OAuth Token'
  },
  'Discord': {
    url: 'https://discord.com/developers/applications',
    guide: '1. Create a new application\n2. Go to Bot section\n3. Enable required intents\n4. Copy bot token\n5. Add bot to your server'
  },
  'Google Analytics': {
    url: 'https://analytics.google.com/analytics/web',
    guide: '1. Open your GA4 property\n2. Admin > Data Streams\n3. Copy Property ID and Measurement ID'
  }
};

// AI Provider Selector
const AIProviderSelector = () => {
  const [provider, setProvider] = useState<AIProvider>('google');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadProvider = async () => {
      const saved = await getAIProvider();
      setProvider(saved);
    };
    loadProvider();
  }, []);

  const handleProviderChange = async (newProvider: AIProvider) => {
    setProvider(newProvider);
    setIsSaving(true);
    await storage.set(STORAGE_KEYS.AI_PROVIDER, newProvider);
    setTimeout(() => setIsSaving(false), 500);
  };

  const providers = [
    {
      id: 'google' as AIProvider,
      name: 'Google Gemini',
      description: 'Native Google AI with search grounding',
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      ),
    },
    {
      id: 'openrouter' as AIProvider,
      name: 'OpenRouter',
      description: 'Access Claude, GPT-4, Llama & more',
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" className="text-orange-500" />
        </svg>
      ),
    },
    {
      id: 'openai' as AIProvider,
      name: 'OpenAI',
      description: 'GPT-4o, o1, and other OpenAI models',
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
          <path className="text-gray-900" d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
        </svg>
      ),
    },
    {
      id: 'anthropic' as AIProvider,
      name: 'Anthropic',
      description: 'Claude 3.5 Sonnet, Opus, and Haiku',
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
          <path className="text-amber-800" d="M16.67 2L9.34 22h3.41l7.33-20zm-9.34 0L.01 22h3.41L10.75 2z"/>
        </svg>
      ),
    },
    {
      id: 'ollama' as AIProvider,
      name: 'Ollama',
      description: 'Local AI models (Llama, Mistral, etc.)',
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
          <circle cx="12" cy="12" r="10" className="text-purple-600"/>
          <text x="12" y="16" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">O</text>
        </svg>
      ),
    },
    {
      id: 'local' as AIProvider,
      name: 'Local AI',
      description: 'Custom OpenAI-compatible endpoint',
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" className="text-blue-600"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-slate-900 text-base">AI Provider</h3>
        <p className="text-sm text-slate-400 mt-1 leading-relaxed">
          Choose your preferred AI provider. Each provider offers different models and capabilities.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {providers.map((p) => (
          <button
            key={p.id}
            onClick={() => handleProviderChange(p.id)}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              provider === p.id
                ? 'border-indigo-600 bg-indigo-50/50 shadow-lg shadow-indigo-100'
                : 'border-slate-100 bg-slate-50 hover:border-slate-200'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                {p.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`font-bold text-sm truncate ${provider === p.id ? 'text-indigo-900' : 'text-slate-900'}`}>
                  {p.name}
                </h4>
                {provider === p.id && (
                  <span className="text-[10px] font-bold text-indigo-600 uppercase">Active</span>
                )}
              </div>
            </div>
            <p className={`text-xs leading-tight ${provider === p.id ? 'text-indigo-700/70' : 'text-slate-500'}`}>
              {p.description}
            </p>
          </button>
        ))}
      </div>

      {isSaving && (
        <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold">
          <div className="w-3 h-3 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
          Switching provider...
        </div>
      )}
    </div>
  );
};

// Assistant Name Configuration Section
const AssistantNameSection = () => {
  const [assistantName, setAssistantName] = useState('Atlas');
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const loadName = async () => {
      const saved = await storage.get(STORAGE_KEYS.ASSISTANT_NAME);
      if (saved && typeof saved === 'string') {
        setAssistantName(saved);
      }
    };
    loadName();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setTimeout(async () => {
      await storage.set(STORAGE_KEYS.ASSISTANT_NAME, assistantName);
      setIsSaving(false);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2000);
    }, 800);
  };

  const handleReset = () => {
    setAssistantName('Atlas');
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-slate-900 text-base">Assistant Name</h3>
        <p className="text-sm text-slate-400 mt-1 leading-relaxed">
          Customize your AI assistant's name. This will appear in the chat interface and responses.
        </p>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={assistantName}
            onChange={(e) => setAssistantName(e.target.value)}
            placeholder="Enter assistant name..."
            className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-slate-900 placeholder-slate-400"
          />
        </div>
        
        <button
          onClick={handleReset}
          className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2 font-medium"
        >
          Reset
        </button>
        
        <button
          onClick={handleSave}
          disabled={isSaving || !assistantName.trim()}
          className={`px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 font-medium ${
            isSuccess
              ? 'bg-green-500 text-white'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed'
          }`}
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : isSuccess ? (
            <>
              <CheckCircleIcon className="w-5 h-5" />
              Saved!
            </>
          ) : (
            <>
              <CheckCircleIcon className="w-5 h-5" />
              Save
            </>
          )}
        </button>
      </div>
      
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100">
        <div className="flex items-start gap-3">
          <SparklesIcon className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-sm text-indigo-900/80">
            <p className="font-medium mb-1">Preview:</p>
            <p className="text-indigo-700">
              "Hello! I'm <strong>{assistantName || 'Atlas'}</strong>, your intelligent personal assistant..."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Discovery Objectives Section
interface DiscoveryObjective {
  id: string;
  icon: string;
  label: string;
  question: string;
}

const DEFAULT_OBJECTIVES: DiscoveryObjective[] = [
  { id: 'education', icon: 'AcademicCapIcon', label: 'Education', question: 'Tell me about your educational background. What degrees, certifications, or courses have you completed?' },
  { id: 'career', icon: 'BriefcaseIcon', label: 'Career', question: 'What is your current role and career path? What are your professional goals and aspirations?' },
  { id: 'interests', icon: 'RocketLaunchIcon', label: 'Interests', question: 'What hobbies or interests occupy your free time? What topics fascinate you the most?' },
  { id: 'style', icon: 'LightBulbIcon', label: 'Style', question: 'How would you describe your communication style? Do you prefer formal or casual interactions?' },
  { id: 'projects', icon: 'PresentationChartLineIcon', label: 'Projects', question: 'What projects are you currently working on? What are your main priorities right now?' },
  { id: 'health', icon: 'HeartIcon', label: 'Health', question: 'What health and wellness goals are important to you? Any fitness routines or health habits?' },
];

const AVAILABLE_ICONS = [
  'AcademicCapIcon', 'BriefcaseIcon', 'RocketLaunchIcon', 'LightBulbIcon', 
  'HeartIcon', 'HomeIcon', 'MusicalNoteIcon', 'GlobeAltIcon', 
  'CodeBracketIcon', 'ChatBubbleLeftRightIcon', 'UserGroupIcon', 'PresentationChartLineIcon'
];

const DiscoveryObjectivesSection = () => {
  const [objectives, setObjectives] = useState<DiscoveryObjective[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [newIcon, setNewIcon] = useState('LightBulbIcon');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadObjectives = async () => {
      const saved = await storage.get(STORAGE_KEYS.DISCOVERY_OBJECTIVES) as DiscoveryObjective[] | null;
      if (saved && saved.length > 0) {
        setObjectives(saved);
      }
    };
    loadObjectives();
  }, []);

  const handleAddObjective = async () => {
    if (!newLabel.trim() || !newQuestion.trim()) return;
    
    setIsSaving(true);
    const newObjective: DiscoveryObjective = {
      id: `custom_${Date.now()}`,
      icon: newIcon,
      label: newLabel.trim(),
      question: newQuestion.trim(),
    };
    
    const updated = [...objectives, newObjective];
    await storage.set(STORAGE_KEYS.DISCOVERY_OBJECTIVES, updated);
    setObjectives(updated);
    setNewLabel('');
    setNewQuestion('');
    setNewIcon('LightBulbIcon');
    setShowAddForm(false);
    setIsSaving(false);
  };

  const handleRemoveObjective = async (id: string) => {
    const updated = objectives.filter(o => o.id !== id);
    await storage.set(STORAGE_KEYS.DISCOVERY_OBJECTIVES, updated);
    setObjectives(updated);
  };

  const handleResetToDefaults = async () => {
    await storage.set(STORAGE_KEYS.DISCOVERY_OBJECTIVES, []);
    setObjectives([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Discovery Objectives</h3>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">
            Customize the knowledge discovery prompts in your Knowledge Base. Click objectives to ask questions.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-bold"
        >
          <PlusIcon className="w-4 h-4" />
          Add
        </button>
      </div>

      {showAddForm && (
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Label</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g., Hobbies, Goals, Family..."
              className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-slate-900 placeholder-slate-400"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Question</label>
            <textarea
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="What question should be asked when clicking this objective?"
              rows={3}
              className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-slate-900 placeholder-slate-400 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Icon</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_ICONS.map(icon => (
                <button
                  key={icon}
                  onClick={() => setNewIcon(icon)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    newIcon === icon 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
                  }`}
                >
                  {icon.replace('Icon', '')}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-all text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleAddObjective}
              disabled={!newLabel.trim() || !newQuestion.trim() || isSaving}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-bold disabled:opacity-50"
            >
              {isSaving ? 'Adding...' : 'Add Objective'}
            </button>
          </div>
        </div>
      )}

      {objectives.length > 0 ? (
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
          {objectives.map(obj => (
            <div key={obj.id} className="flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-xl group hover:border-indigo-200 transition-all">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-indigo-600 text-xs font-bold">{obj.label.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-900 text-sm">{obj.label}</h4>
                <p className="text-xs text-slate-400 mt-1 truncate">{obj.question}</p>
              </div>
              <button
                onClick={() => handleRemoveObjective(obj.id)}
                className="opacity-0 group-hover:opacity-100 p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                title="Remove objective"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center">
          <p className="text-slate-500 text-sm">No custom objectives yet. Using default objectives.</p>
          <p className="text-slate-400 text-xs mt-1">Add custom objectives to personalize your knowledge discovery experience.</p>
        </div>
      )}

      {objectives.length > 0 && (
        <button
          onClick={handleResetToDefaults}
          className="text-sm text-rose-500 hover:text-rose-600 font-medium flex items-center gap-2"
        >
          <TrashIcon className="w-4 h-4" />
          Reset to Default Objectives
        </button>
      )}
    </div>
  );
};

const GeminiApiKeySection = () => {
  const [provider, setProvider] = useState<AIProvider>('google');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [lastLoadedProvider, setLastLoadedProvider] = useState<AIProvider | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const currentProvider = await getAIProvider();
      
      // Only reload API key when provider actually changes
      if (currentProvider !== lastLoadedProvider) {
        setProvider(currentProvider);
        setLastLoadedProvider(currentProvider);
        
        const storageKey = currentProvider === 'openrouter' 
          ? STORAGE_KEYS.OPENROUTER_API_KEY 
          : STORAGE_KEYS.GEMINI_API_KEY;
        
        const saved = await storage.get(storageKey);
        if (saved && typeof saved === 'string') {
          setApiKey(saved);
          setHasKey(true);
        } else {
          setApiKey('');
          setHasKey(false);
        }
      }
    };
    loadData();
    
    // Re-check when provider changes
    const interval = setInterval(loadData, 1000);
    return () => clearInterval(interval);
  }, [lastLoadedProvider]);

  const handleSave = async () => {
    setIsSaving(true);
    const storageKey = provider === 'openrouter' 
      ? STORAGE_KEYS.OPENROUTER_API_KEY 
      : STORAGE_KEYS.GEMINI_API_KEY;
    
    setTimeout(async () => {
      await storage.set(storageKey, apiKey);
      setIsSaving(false);
      setIsSuccess(true);
      setHasKey(!!apiKey);
      setTimeout(() => setIsSuccess(false), 2000);
    }, 800);
  };

  const handleClear = async () => {
    const storageKey = provider === 'openrouter' 
      ? STORAGE_KEYS.OPENROUTER_API_KEY 
      : STORAGE_KEYS.GEMINI_API_KEY;
    await storage.remove(storageKey);
    setApiKey('');
    setHasKey(false);
  };

  const isOpenRouter = provider === 'openrouter';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-base">
            {isOpenRouter ? 'OpenRouter API Key' : 'Google Gemini API Key'}
          </h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md leading-relaxed">
            {isOpenRouter ? (
              <>
                Configure your OpenRouter API key to access multiple AI models. Get your key from{' '}
                <a 
                  href="https://openrouter.ai/keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-700 font-semibold"
                >
                  OpenRouter Dashboard
                </a>
                .
              </>
            ) : (
              <>
                Configure your Gemini API key to enable AI-powered summaries and insights. Get your key from{' '}
                <a 
                  href="https://aistudio.google.com/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-700 font-semibold"
                >
                  Google AI Studio
                </a>
                .
              </>
            )}
          </p>
        </div>
        {hasKey && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg">
            <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-emerald-700">Configured</span>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <input 
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Gemini API key..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 pr-12 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/20" 
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showKey ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
          </button>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving || !apiKey}
          className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all min-w-[120px] ${
            isSuccess 
              ? 'bg-emerald-600 text-white' 
              : apiKey 
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto"></div>
          ) : isSuccess ? (
            'Saved!'
          ) : (
            'Save Key'
          )}
        </button>
        {hasKey && (
          <button 
            onClick={handleClear}
            className="px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all"
          >
            Clear
          </button>
        )}
      </div>

      {apiKey && (
        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100/50 flex items-start gap-3">
          <ShieldCheckIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900/70 leading-relaxed">
            <strong className="font-bold">Security Note:</strong> Your API key is encrypted and stored locally on your device. It is never sent to aethermsaid hub servers - only directly to Google's Gemini API for processing your requests.
          </div>
        </div>
      )}
    </div>
  );
};

// Discord Credentials Section
const DiscordCredentialsSection = () => {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);

  useEffect(() => {
    const loadCredentials = async () => {
      const savedClientId = await storage.get(STORAGE_KEYS.DISCORD_CLIENT_ID);
      const savedClientSecret = await storage.get(STORAGE_KEYS.DISCORD_CLIENT_SECRET);
      
      if (savedClientId && typeof savedClientId === 'string') {
        setClientId(savedClientId);
        setHasCredentials(true);
      }
      if (savedClientSecret && typeof savedClientSecret === 'string') {
        setClientSecret(savedClientSecret);
      }
    };
    loadCredentials();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setTimeout(async () => {
      await storage.set(STORAGE_KEYS.DISCORD_CLIENT_ID, clientId);
      await storage.set(STORAGE_KEYS.DISCORD_CLIENT_SECRET, clientSecret);
      setHasCredentials(true);
      setIsSaving(false);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2000);
    }, 800);
  };

  const handleClear = async () => {
    if (window.confirm('Clear Discord credentials? You will need to reconfigure to connect Discord.')) {
      setClientId('');
      setClientSecret('');
      await storage.set(STORAGE_KEYS.DISCORD_CLIENT_ID, '');
      await storage.set(STORAGE_KEYS.DISCORD_CLIENT_SECRET, '');
      setHasCredentials(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Discord OAuth Credentials</h3>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">
            Configure your Discord application credentials. Required for Discord integration.{' '}
            <a
              href="https://discord.com/developers/applications"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1"
            >
              Get from Discord Developer Portal
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            </a>
            .
          </p>
        </div>
        {hasCredentials && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg">
            <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-emerald-700">Configured</span>
          </div>
        )}
      </div>

      {/* Setup Guide */}
      <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-3">
        <div className="flex items-start gap-2">
          <InformationCircleIcon className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-sm text-indigo-900/80 leading-relaxed">
            <strong className="font-bold">Setup Steps:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1.5 text-xs">
              <li>Create an application at Discord Developer Portal</li>
              <li>Copy your Application ID (Client ID) below</li>
              <li>Go to OAuth2 section → Reset Secret → Copy Client Secret</li>
              <li>Add redirect URI: <code className="bg-white px-2 py-0.5 rounded font-mono text-[11px]">http://localhost:8089/oauth/callback</code></li>
              <li>Select scopes: identify, email, guilds, guilds.members.read, messages.read</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Client ID Input */}
      <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Application ID (Client ID)</label>
        <input 
          type="text"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="e.g., 1457225949706846261"
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/20" 
        />
      </div>

      {/* Client Secret Input */}
      <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Secret</label>
        <div className="relative">
          <input 
            type={showClientSecret ? 'text' : 'password'}
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="Enter your Client Secret..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 pr-12 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/20" 
          />
          <button
            onClick={() => setShowClientSecret(!showClientSecret)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showClientSecret ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button 
          onClick={handleSave}
          disabled={isSaving || !clientId || !clientSecret}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            isSuccess 
              ? 'bg-emerald-600 text-white' 
              : (clientId && clientSecret)
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto"></div>
          ) : isSuccess ? (
            'Saved!'
          ) : (
            'Save Credentials'
          )}
        </button>
        {hasCredentials && (
          <button 
            onClick={handleClear}
            className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all"
          >
            Clear
          </button>
        )}
      </div>

      {/* Security Note */}
      {(clientId || clientSecret) && (
        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100/50 flex items-start gap-3">
          <ShieldCheckIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900/70 leading-relaxed">
            <strong className="font-bold">Security Note:</strong> Your Discord credentials are encrypted and stored locally on your device. They are never sent to aethermsaid hub servers - only used directly to authenticate with Discord's OAuth API.
          </div>
        </div>
      )}
    </div>
  );
};

// Sensitive/Unofficial Integrations Section
const SensitiveIntegrationsSection = () => {
  const [settings, setSettings] = useState<{whatsapp: boolean, telegram: boolean, discord: boolean}>({
    whatsapp: false,
    telegram: false,
    discord: false
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const saved = await storage.get(STORAGE_KEYS.SENSITIVE_INTEGRATIONS);
      if (saved) {
        setSettings(saved);
      }
    };
    loadSettings();
  }, []);

  const handleToggle = async (key: keyof typeof settings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    setIsSaving(true);
    await storage.set(STORAGE_KEYS.SENSITIVE_INTEGRATIONS, newSettings);
    setTimeout(() => setIsSaving(false), 500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center shadow-sm">
          <ExclamationCircleIcon className="w-6 h-6 text-rose-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-base">Advanced Integrations</h3>
          <p className="text-sm text-slate-400 mt-0.5">Sensitive integrations that use unofficial APIs and may violate platform TOS.</p>
        </div>
      </div>

      <div className="bg-rose-50/50 border border-rose-100 rounded-[2rem] p-6 space-y-6">
        <div className="flex items-start gap-3 p-4 bg-rose-100/30 rounded-2xl border border-rose-100/50">
          <InformationCircleIcon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-800 leading-relaxed font-medium">
            <strong className="font-bold">WARNING:</strong> These integrations use browser automation or self-bot techniques. Enabling them may lead to account bans or restrictions. aethermsaid hub provides these as-is for local interoperability. Use at your own risk.
          </p>
        </div>

        <div className="space-y-6">
          <Toggle 
            label="Enable WhatsApp" 
            description="Allows connecting WhatsApp via Puppeteer. Meta may ban accounts using unofficial clients." 
            enabled={settings.whatsapp} 
            onChange={() => handleToggle('whatsapp')} 
          />
          <div className="h-[1px] bg-rose-100/50"></div>
          <Toggle 
            label="Enable Telegram" 
            description="Enables Telegram synchronization. Generally safer but still strictly unofficial." 
            enabled={settings.telegram} 
            onChange={() => handleToggle('telegram')} 
          />
          <div className="h-[1px] bg-rose-100/50"></div>
          <Toggle 
            label="Enable Discord Self-bot" 
            description="Retrieves Discord messages using your user token. HIGH RISK - violates Discord TOS." 
            enabled={settings.discord} 
            onChange={() => handleToggle('discord')} 
          />
        </div>
      </div>
      
      {isSaving && (
        <div className="flex items-center gap-2 text-[10px] text-emerald-600 font-black uppercase tracking-widest animate-pulse">
          <CheckIcon className="w-3 h-3" />
          Settings Synchronized
        </div>
      )}
    </div>
  );
};

const GeminiModelSelector = () => {
  const [provider, setProvider] = useState<AIProvider>('google');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [isSaving, setIsSaving] = useState(false);
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [freeMode, setFreeMode] = useState(false);
  const [modelFilter, setModelFilter] = useState<'all' | 'free' | 'paid'>('all');

  useEffect(() => {
    const loadData = async () => {
      const currentProvider = await getAIProvider();
      setProvider(currentProvider);
      
      // Load free mode setting
      const freeModeEnabled = await isFreeModeEnabled();
      setFreeMode(freeModeEnabled);
      
      // Fetch OpenRouter models if needed
      if (currentProvider === 'openrouter') {
        setIsLoadingModels(true);
        const models = await fetchOpenRouterModels();
        setOpenRouterModels(models);
        setIsLoadingModels(false);
      }
      
      const storageKey = currentProvider === 'openrouter' 
        ? STORAGE_KEYS.OPENROUTER_MODEL 
        : STORAGE_KEYS.GEMINI_MODEL;
      const defaultModel = currentProvider === 'openrouter' 
        ? DEFAULT_OPENROUTER_MODEL 
        : DEFAULT_MODEL;
      
      const saved = await storage.get(storageKey);
      setSelectedModel((saved && typeof saved === 'string') ? saved : defaultModel);
    };
    loadData();
    
    // Re-check when provider changes
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId);
    setIsSaving(true);
    
    const storageKey = provider === 'openrouter' 
      ? STORAGE_KEYS.OPENROUTER_MODEL 
      : STORAGE_KEYS.GEMINI_MODEL;
    
    setTimeout(async () => {
      await storage.set(storageKey, modelId);
      setIsSaving(false);
    }, 500);
  };

  const handleFreeModeToggle = async (enabled: boolean) => {
    setFreeMode(enabled);
    await storage.set(STORAGE_KEYS.OPENROUTER_FREE_MODE, enabled);
  };

  const isOpenRouter = provider === 'openrouter';
  
  // Filter models based on selection
  const filteredOpenRouterModels = openRouterModels.filter(m => {
    if (modelFilter === 'free') return m.isFree;
    if (modelFilter === 'paid') return !m.isFree;
    return true;
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-slate-900 text-base">AI Model</h3>
        <p className="text-sm text-slate-400 mt-1 leading-relaxed">
          {isOpenRouter 
            ? 'Choose from a variety of AI models available through OpenRouter. Different models have different capabilities and pricing.'
            : 'Choose the Gemini model that best fits your needs. Different models offer varying levels of capability, speed, and cost.'
          }
        </p>
      </div>

      {/* Free Mode Toggle - OpenRouter only */}
      {isOpenRouter && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-emerald-900 text-sm">🎁 Free Model Rotation</h4>
              <p className="text-xs text-emerald-700 mt-1">
                Automatically rotate between free models to avoid rate limits. Great for testing!
              </p>
            </div>
            <button
              onClick={() => handleFreeModeToggle(!freeMode)}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                freeMode ? 'bg-emerald-600' : 'bg-slate-200'
              }`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                freeMode ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>
          {freeMode && (
            <p className="text-xs text-emerald-600 mt-2 italic">
              ✓ Free mode active - model selection below is disabled
            </p>
          )}
        </div>
      )}

      {/* Model Filter - OpenRouter only */}
      {isOpenRouter && !freeMode && (
        <div className="flex gap-2">
          {(['all', 'free', 'paid'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setModelFilter(filter)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                modelFilter === filter 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {filter === 'all' ? `All (${openRouterModels.length})` : 
               filter === 'free' ? `Free (${openRouterModels.filter(m => m.isFree).length})` : 
               `Paid (${openRouterModels.filter(m => !m.isFree).length})`}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {isLoadingModels && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
          <span className="ml-3 text-sm text-slate-500">Loading models from OpenRouter...</span>
        </div>
      )}

      {/* Model list */}
      <div className={`space-y-3 max-h-96 overflow-y-auto pr-2 ${freeMode ? 'opacity-50 pointer-events-none' : ''}`}>
        {isOpenRouter ? (
          filteredOpenRouterModels.map((model) => (
            <button
              key={model.id}
              onClick={() => handleModelChange(model.id)}
              disabled={freeMode}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                selectedModel === model.id
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-lg shadow-indigo-100'
                  : 'border-slate-100 bg-slate-50 hover:border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-bold text-sm ${selectedModel === model.id ? 'text-indigo-900' : 'text-slate-900'}`}>
                      {model.name}
                    </h4>
                    {model.isFree && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">FREE</span>
                    )}
                    {selectedModel === model.id && (
                      <CheckCircleIcon className="w-5 h-5 text-indigo-600" />
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${selectedModel === model.id ? 'text-indigo-700/70' : 'text-slate-500'}`}>
                    {model.description}
                  </p>
                </div>
              </div>
            </button>
          ))
        ) : (
          GEMINI_MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => handleModelChange(model.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                selectedModel === model.id
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-lg shadow-indigo-100'
                  : 'border-slate-100 bg-slate-50 hover:border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className={`font-bold text-sm ${selectedModel === model.id ? 'text-indigo-900' : 'text-slate-900'}`}>
                      {model.name}
                    </h4>
                    {selectedModel === model.id && (
                      <CheckCircleIcon className="w-5 h-5 text-indigo-600" />
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${selectedModel === model.id ? 'text-indigo-700/70' : 'text-slate-500'}`}>
                    {model.description}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {isSaving && (
        <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold">
          <div className="w-3 h-3 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
          Saving selection...
        </div>
      )}
    </div>
  );
};

// ElevenLabs TTS Configuration Section
const GoogleSpeechSection = () => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const savedKey = await storage.get(STORAGE_KEYS.GOOGLE_SPEECH_API_KEY);
      if (savedKey) {
        setApiKey(savedKey as string);
      }
    };
    loadSettings();
  }, []);

  const handleSaveKey = async () => {
    setIsSaving(true);
    await storage.set(STORAGE_KEYS.GOOGLE_SPEECH_API_KEY, apiKey);
    setIsSuccess(true);
    setTimeout(() => setIsSuccess(false), 2000);
    setIsSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-sm">
          <CloudIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-base">Google Cloud Speech</h3>
          <p className="text-sm text-slate-400 mt-0.5">
            Cloud-based speech recognition and synthesis
          </p>
        </div>
      </div>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          Google Cloud API Key
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your Google Cloud API key here"
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showKey ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={handleSaveKey}
            disabled={isSaving}
            className={`px-4 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${
              isSuccess 
                ? 'bg-emerald-500 text-white shadow-emerald-200' 
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
            } shadow-lg disabled:opacity-50`}
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
            ) : isSuccess ? (
              <CheckIcon className="w-4 h-4" />
            ) : (
              <ArrowPathIcon className="w-4 h-4" />
            )}
            {isSuccess ? 'Saved' : 'Save'}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
          <InformationCircleIcon className="w-3 h-3" />
          If left blank, the app will try to use your Gemini API key.
        </p>
      </div>
    </div>
  );
};

const ElevenLabsSection = () => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [models, setModels] = useState<ElevenLabsModel[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [selectedModel, setSelectedModel] = useState('eleven_multilingual_v2');
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [subscription, setSubscription] = useState<{ character_count: number; character_limit: number } | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const savedKey = await storage.get(STORAGE_KEYS.ELEVENLABS_API_KEY);
      const savedEnabled = await storage.get(STORAGE_KEYS.ELEVENLABS_ENABLED);
      const savedVoice = await storage.get(STORAGE_KEYS.ELEVENLABS_VOICE_ID);
      const savedModel = await storage.get(STORAGE_KEYS.ELEVENLABS_MODEL_ID);
      
      if (savedKey) {
        setHasKey(true);
        setApiKey(savedKey as string);
        // Fetch voices and models
        setIsLoadingVoices(true);
        const [fetchedVoices, fetchedModels, sub] = await Promise.all([
          fetchVoices(),
          fetchModels(),
          getSubscriptionInfo()
        ]);
        setVoices(fetchedVoices);
        setModels(fetchedModels);
        if (sub) setSubscription(sub);
        setIsLoadingVoices(false);
      }
      if (savedEnabled) setEnabled(true);
      if (savedVoice) setSelectedVoice(savedVoice as string);
      if (savedModel) setSelectedModel(savedModel as string);
    };
    loadSettings();
  }, []);

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    
    setIsSaving(true);
    
    // Test the API key
    const isValid = await testElevenLabsKey(apiKey);
    
    if (isValid) {
      await storage.set(STORAGE_KEYS.ELEVENLABS_API_KEY, apiKey);
      setHasKey(true);
      setIsSuccess(true);
      
      // Fetch voices and models
      setIsLoadingVoices(true);
      const [fetchedVoices, fetchedModels, sub] = await Promise.all([
        fetchVoices(),
        fetchModels(),
        getSubscriptionInfo()
      ]);
      setVoices(fetchedVoices);
      setModels(fetchedModels);
      if (sub) setSubscription(sub);
      setIsLoadingVoices(false);
      
      setTimeout(() => setIsSuccess(false), 2000);
    } else {
      alert('Invalid API key. Please check and try again.');
    }
    
    setIsSaving(false);
  };

  const handleToggleEnabled = async (value: boolean) => {
    setEnabled(value);
    await storage.set(STORAGE_KEYS.ELEVENLABS_ENABLED, value);
  };

  const handleVoiceChange = async (voiceId: string) => {
    setSelectedVoice(voiceId);
    await storage.set(STORAGE_KEYS.ELEVENLABS_VOICE_ID, voiceId);
    
    // Find preview URL for the voice
    const voice = voices.find(v => v.voice_id === voiceId);
    if (voice?.preview_url) {
      setPreviewUrl(voice.preview_url);
    }
  };

  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId);
    await storage.set(STORAGE_KEYS.ELEVENLABS_MODEL_ID, modelId);
  };

  const playPreview = () => {
    if (!previewUrl) return;
    const audio = new Audio(previewUrl);
    setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
    audio.play();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
          <SpeakerWaveIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-base">ElevenLabs Voice AI</h3>
          <p className="text-sm text-slate-400 mt-0.5">Text-to-speech for AI voice responses</p>
        </div>
      </div>

      {/* Enable Toggle */}
      <div className="flex items-center justify-between p-4 bg-violet-50 rounded-2xl">
        <div>
          <h4 className="font-bold text-violet-900 text-sm">Enable Voice Responses</h4>
          <p className="text-xs text-violet-700 mt-0.5">AI can respond with voice messages in WhatsApp</p>
        </div>
        <button
          onClick={() => handleToggleEnabled(!enabled)}
          className={`w-14 h-7 rounded-full transition-colors ${
            enabled ? 'bg-violet-600' : 'bg-slate-300'
          }`}
        >
          <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-1 ${
            enabled ? 'translate-x-7' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* API Key Input */}
      <div className="space-y-3">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ElevenLabs API Key</label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your ElevenLabs API key..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 pr-24 text-sm font-mono focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 outline-none"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button
              onClick={() => setShowKey(!showKey)}
              className="p-2 rounded-lg hover:bg-slate-100"
            >
              {showKey ? <EyeSlashIcon className="w-4 h-4 text-slate-400" /> : <EyeIcon className="w-4 h-4 text-slate-400" />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveKey}
            disabled={!apiKey.trim() || isSaving}
            className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              apiKey.trim() && !isSaving
                ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-lg shadow-violet-100'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? 'Validating...' : isSuccess ? '✓ Saved!' : hasKey ? 'Update Key' : 'Save Key'}
          </button>
          <a
            href="https://elevenlabs.io/app/settings/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-violet-600 font-bold hover:underline flex items-center gap-1"
          >
            Get API Key <ArrowTopRightOnSquareIcon className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Subscription Info */}
      {subscription && (
        <div className="p-4 bg-slate-50 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">Character Usage</p>
            <p className="text-lg font-black text-slate-900">
              {subscription.character_count.toLocaleString()} / {subscription.character_limit.toLocaleString()}
            </p>
          </div>
          <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-violet-600 rounded-full"
              style={{ width: `${Math.min(100, (subscription.character_count / subscription.character_limit) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Voice Selection */}
      {hasKey && (
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Voice</label>
          {isLoadingVoices ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="w-4 h-4 border-2 border-violet-600/20 border-t-violet-600 rounded-full animate-spin"></div>
              Loading voices...
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <select
                value={selectedVoice}
                onChange={(e) => handleVoiceChange(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 outline-none"
              >
                <option value="">Select a voice...</option>
                {voices.map(voice => (
                  <option key={voice.voice_id} value={voice.voice_id}>
                    {voice.name} {voice.labels?.accent ? `(${voice.labels.accent})` : ''}
                  </option>
                ))}
              </select>
              {previewUrl && (
                <button
                  onClick={playPreview}
                  disabled={isPlaying}
                  className="p-3 bg-violet-100 text-violet-600 rounded-xl hover:bg-violet-200 transition-colors"
                >
                  {isPlaying ? (
                    <div className="w-5 h-5 border-2 border-violet-600/20 border-t-violet-600 rounded-full animate-spin" />
                  ) : (
                    <PlayIcon className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Model Selection */}
      {hasKey && (
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Model</label>
          <select
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 outline-none"
          >
            {models.map(model => (
              <option key={model.model_id} value={model.model_id}>
                {model.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400">
            Multilingual v2 supports 29 languages with best quality. Turbo models are faster but English-focused.
          </p>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-violet-50 border border-violet-100 rounded-xl text-xs text-violet-900 leading-relaxed">
        <div className="flex items-start gap-2">
          <InformationCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold">Voice Messages:</strong> When enabled, AI responses in WhatsApp can be sent as voice messages. The text will be converted to speech using your selected voice.
          </div>
        </div>
      </div>
    </div>
  );
};

// Autostart Settings Section
const AutostartSection = () => {
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<string>('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const isEnabled = await window.electronAPI.autostart.get();
        const currentPlatform = await window.electronAPI.app.getPlatform();
        setAutostartEnabled(isEnabled);
        setPlatform(currentPlatform);
      } catch (error) {
        console.error('Failed to load autostart settings:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleToggle = async () => {
    try {
      setLoading(true);
      const newValue = !autostartEnabled;
      const result = await window.electronAPI.autostart.set(newValue);
      setAutostartEnabled(result);
    } catch (error) {
      console.error('Failed to update autostart setting:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlatformName = () => {
    switch (platform) {
      case 'darwin': return 'macOS';
      case 'win32': return 'Windows';
      case 'linux': return 'Linux';
      default: return 'your system';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
          <RocketLaunchIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-base">Launch at Startup</h3>
          <p className="text-sm text-slate-400 mt-0.5">
            Automatically start aethermsaid hub when you log into {getPlatformName()}
          </p>
        </div>
      </div>

      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
              <ComputerDesktopIcon className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Start with System</h4>
              <p className="text-xs text-slate-400 mt-1">
                {autostartEnabled 
                  ? 'aethermsaid hub will launch automatically at login' 
                  : 'aethermsaid hub will only open when you start it manually'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={loading}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              autostartEnabled ? 'bg-indigo-600' : 'bg-slate-200'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                autostartEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 flex items-start gap-3">
        <InformationCircleIcon className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-xs text-indigo-800/70 leading-relaxed">
          When enabled, aethermsaid hub will automatically start in the background when you log into your computer, 
          keeping your AI assistant ready and your notifications up to date.
        </p>
      </div>
    </div>
  );
};

const SettingSection = ({ title, icon: Icon, children }: { title: string, icon: any, children?: React.ReactNode }) => (
  <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden mb-8">
    <div className="px-10 py-8 border-b border-slate-50 flex items-center gap-4">
      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
        <Icon className="w-6 h-6" />
      </div>
      <h2 className="text-xl font-black text-slate-900 tracking-tight">{title}</h2>
    </div>
    <div className="p-10 space-y-8">
      {children}
    </div>
  </div>
);

const Toggle = ({ label, description, enabled, onChange }: { label: string, description: string, enabled: boolean, onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between group">
    <div className="flex-1">
      <h3 className="font-bold text-slate-900 text-base">{label}</h3>
      <p className="text-sm text-slate-400 mt-1 max-w-md leading-relaxed">{description}</p>
    </div>
    <button 
      onClick={() => onChange(!enabled)}
      className={`w-14 h-8 rounded-full transition-all relative ${enabled ? 'bg-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-200'}`}
    >
      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${enabled ? 'left-7' : 'left-1'}`}></div>
    </button>
  </div>
);

const IntegrationCard = ({ platform, fieldKeys }: { platform: string, fieldKeys: string[] }) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const loadSaved = async () => {
      const saved = await storage.get(`aether-hub_keys_${platform.toLowerCase()}`);
      if (saved) setValues(saved);
    };
    loadSaved();
  }, [platform]);

  const handleSave = async () => {
    setIsSaving(true);
    setTimeout(async () => {
      await storage.set(`aether-hub_keys_${platform.toLowerCase()}`, values);
      setIsSaving(false);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2000);
    }, 800);
  };

  const guideInfo = INTEGRATION_GUIDES[platform];

  return (
    <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2rem] hover:border-indigo-200 transition-all">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
            <CommandLineIcon className="w-5 h-5 text-indigo-500" />
          </div>
          <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">{platform}</h3>
        </div>
        {guideInfo && (
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1.5"
          >
            <InformationCircleIcon className="w-4 h-4" />
            {showGuide ? 'Hide' : 'Setup Guide'}
          </button>
        )}
      </div>

      {showGuide && guideInfo && (
        <div className="mb-6 p-5 bg-indigo-50 border border-indigo-100 rounded-xl space-y-4 animate-in slide-in-from-top-2 duration-200 max-h-80 overflow-y-auto">
          <p className="text-xs text-indigo-900 font-medium whitespace-pre-line leading-relaxed">
            {guideInfo.guide}
          </p>
          
          {/* Required Scopes for Google */}
          {guideInfo.scopes && (
            <div className="pt-3 border-t border-indigo-200">
              <label className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-2 block">Required OAuth Scopes</label>
              <div className="bg-white border border-indigo-200 rounded-lg p-3 space-y-1">
                {guideInfo.scopes.map((scope, idx) => (
                  <code key={idx} className="block text-[11px] font-mono text-slate-700">{scope}</code>
                ))}
              </div>
              <p className="text-[10px] text-indigo-600 mt-2">💡 Add your email as a test user in OAuth consent screen.</p>
            </div>
          )}
          
          {/* Redirect URI */}
          {guideInfo.redirectUri && (
            <div className="pt-3 border-t border-indigo-200">
              <label className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-2 block">Redirect URI</label>
              <code className="block bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 select-all">
                {guideInfo.redirectUri}
              </code>
            </div>
          )}
          
          {/* API Library Link */}
          {guideInfo.apiUrl && (
            <a
              href={guideInfo.apiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-slate-800 text-white px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition-all"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              Enable APIs
            </a>
          )}
          
          <a
            href={guideInfo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
          >
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            Open {platform} Console
          </a>
        </div>
      )}

      <div className="space-y-5">
        {fieldKeys.map((key) => (
          <div key={key} className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{key}</label>
            <input 
              type={key.toLowerCase().includes('secret') || key.toLowerCase().includes('token') || key.toLowerCase().includes('password') ? 'password' : 'text'}
              value={values[key] || ''}
              onChange={(e) => setValues(prev => ({ ...prev, [key]: e.target.value }))}
              placeholder={`Enter ${key}...`}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20" 
            />
          </div>
        ))}
        <div className="pt-4 flex gap-3">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              isSuccess ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white hover:bg-indigo-600'
            }`}
          >
            {isSaving ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : isSuccess ? <CheckCircleIcon className="w-4 h-4" /> : null}
            {isSuccess ? 'Keys Saved' : 'Save Keys'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Ignored Senders Management Section
const IgnoredSendersSection = () => {
  const [ignoredSenders, setIgnoredSenders] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadIgnoredSenders();
  }, []);

  const loadIgnoredSenders = async () => {
    setIsLoading(true);
    const senders = await storage.ignoredSenders.getAll();
    setIgnoredSenders(senders);
    setIsLoading(false);
  };

  const handleAddSender = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    
    // Basic email validation
    if (!email.includes('@') || !email.includes('.')) {
      return;
    }
    
    await storage.ignoredSenders.add(email);
    setNewEmail('');
    await loadIgnoredSenders();
  };

  const handleRemoveSender = async (email: string) => {
    await storage.ignoredSenders.remove(email);
    await loadIgnoredSenders();
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to remove all ignored senders?')) {
      await storage.ignoredSenders.clear();
      await loadIgnoredSenders();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4 p-5 bg-gradient-to-r from-rose-50 to-orange-50 rounded-2xl border border-rose-100">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
          <EyeSlashIcon className="w-5 h-5 text-rose-500" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-sm mb-1">Ignored Email Senders</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Emails from ignored senders will not be processed by AI or shown in your inbox. 
            This helps reduce noise from newsletters, promotions, or unwanted emails.
          </p>
        </div>
      </div>

      {/* Add new sender */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <EnvelopeIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSender()}
            placeholder="Enter email address to ignore..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <button
          onClick={handleAddSender}
          disabled={!newEmail.trim()}
          className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <PlusIcon className="w-4 h-4" />
          Add
        </button>
      </div>

      {/* Ignored senders list */}
      <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Ignored Senders ({ignoredSenders.length})
          </span>
          {ignoredSenders.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
          </div>
        ) : ignoredSenders.length === 0 ? (
          <div className="p-8 text-center">
            <EyeSlashIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">No ignored senders</p>
            <p className="text-xs text-slate-400 mt-1">Add email addresses above to ignore them</p>
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {ignoredSenders.map((email) => (
              <div
                key={email}
                className="flex items-center justify-between px-5 py-3 hover:bg-white transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center">
                    <EnvelopeIcon className="w-4 h-4 text-rose-500" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">{email}</span>
                </div>
                <button
                  onClick={() => handleRemoveSender(email)}
                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  title="Remove from ignored list"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <InformationCircleIcon className="w-4 h-4" />
        <span>You can also ignore senders directly from the Emails page by clicking "Ignore Sender" on any email.</span>
      </div>
    </div>
  );
};

// Data Cleanup & Privacy Section
const DataCleanupSection = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<{
    emails: number;
    events: number;
    whatsappMessages: number;
    discordMessages: number;
    chatMessages: number;
    knowledgeInsights: number;
    userActivities: number;
  } | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const dbStats = await window.electronAPI.db.cleanup.getStats();
      setStats(dbStats);
    } catch (error) {
      console.error('Failed to load database stats:', error);
    }
  };

  const handleClearEmailContent = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.db.cleanup.clearEmailContent();
      alert(`Cleared content from ${result.deleted} emails. Metadata preserved.`);
      await loadStats();
    } catch (error) {
      console.error('Failed to clear email content:', error);
      alert('Failed to clear email content. See console for details.');
    } finally {
      setIsLoading(false);
      setShowConfirm(null);
    }
  };

  const handleClearWhatsAppMessages = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.db.cleanup.clearWhatsAppMessages();
      alert(`Cleared content from ${result.deleted} WhatsApp messages. Metadata preserved.`);
      await loadStats();
    } catch (error) {
      console.error('Failed to clear WhatsApp messages:', error);
      alert('Failed to clear WhatsApp messages. See console for details.');
    } finally {
      setIsLoading(false);
      setShowConfirm(null);
    }
  };

  const handleClearDiscordMessages = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.db.cleanup.clearDiscordMessages();
      alert(`Cleared content from ${result.deleted} Discord messages. Metadata preserved.`);
      await loadStats();
    } catch (error) {
      console.error('Failed to clear Discord messages:', error);
      alert('Failed to clear Discord messages. See console for details.');
    } finally {
      setIsLoading(false);
      setShowConfirm(null);
    }
  };

  const handleClearAllChatMessages = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.db.cleanup.clearAllChatMessages();
      alert(`Deleted ${result.deleted} chat messages.`);
      await loadStats();
    } catch (error) {
      console.error('Failed to clear chat messages:', error);
      alert('Failed to clear chat messages. See console for details.');
    } finally {
      setIsLoading(false);
      setShowConfirm(null);
    }
  };

  const handleClearAllSensitiveContent = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.db.cleanup.clearAllSensitiveContent();
      const total = result.emails + result.whatsapp + result.discord + result.chats + result.knowledge + result.insights + result.summaries;
      alert(`Cleared all sensitive content:\n- ${result.emails} emails\n- ${result.whatsapp} WhatsApp messages\n- ${result.discord} Discord messages\n- ${result.chats} chat messages\n- ${result.knowledge} knowledge messages\n- ${result.insights} insights\n- ${result.summaries} summaries\n\nTotal: ${total} items cleaned`);
      await loadStats();
      // Vacuum database to reclaim space
      await window.electronAPI.db.cleanup.vacuum();
    } catch (error) {
      console.error('Failed to clear all sensitive content:', error);
      alert('Failed to clear all sensitive content. See console for details.');
    } finally {
      setIsLoading(false);
      setShowConfirm(null);
    }
  };

  const ConfirmDialog = ({ action, onConfirm, onCancel }: { action: string; onConfirm: () => void; onCancel: () => void }) => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
        <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldCheckIcon className="w-8 h-8 text-rose-600" />
        </div>
        <h3 className="text-xl font-black text-slate-900 text-center mb-2">Confirm Action</h3>
        <p className="text-sm text-slate-600 text-center mb-6 leading-relaxed">
          Are you sure you want to {action}? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Database Stats */}
      {stats && (
        <div className="bg-gradient-to-br from-slate-50 to-indigo-50 p-6 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <InformationCircleIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Database Statistics</h4>
              <p className="text-xs text-slate-500 mt-0.5">Current data stored locally</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded-xl">
              <p className="text-xs text-slate-500 font-semibold">Emails</p>
              <p className="text-xl font-black text-slate-900">{stats.emails.toLocaleString()}</p>
            </div>
            <div className="bg-white p-3 rounded-xl">
              <p className="text-xs text-slate-500 font-semibold">Events</p>
              <p className="text-xl font-black text-slate-900">{stats.events.toLocaleString()}</p>
            </div>
            <div className="bg-white p-3 rounded-xl">
              <p className="text-xs text-slate-500 font-semibold">WhatsApp</p>
              <p className="text-xl font-black text-slate-900">{stats.whatsappMessages.toLocaleString()}</p>
            </div>
            <div className="bg-white p-3 rounded-xl">
              <p className="text-xs text-slate-500 font-semibold">Discord</p>
              <p className="text-xl font-black text-slate-900">{stats.discordMessages.toLocaleString()}</p>
            </div>
            <div className="bg-white p-3 rounded-xl">
              <p className="text-xs text-slate-500 font-semibold">Chat Messages</p>
              <p className="text-xl font-black text-slate-900">{stats.chatMessages.toLocaleString()}</p>
            </div>
            <div className="bg-white p-3 rounded-xl">
              <p className="text-xs text-slate-500 font-semibold">Insights</p>
              <p className="text-xl font-black text-slate-900">{stats.knowledgeInsights.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      <div className="h-[1px] bg-slate-100"></div>

      {/* Selective Data Cleanup */}
      <div className="space-y-3">
        <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <TrashIcon className="w-4 h-4 text-slate-400" />
          Selective Data Cleanup
        </h4>
        <p className="text-xs text-slate-500 leading-relaxed">
          Remove sensitive content while keeping metadata for functionality. Email subjects, timestamps, and sender info are preserved.
        </p>

        <div className="grid gap-3">
          <button
            onClick={() => setShowConfirm('email')}
            disabled={isLoading}
            className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <EnvelopeIcon className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900">Clear Email Content</p>
                <p className="text-xs text-slate-500">Remove email body, keep metadata</p>
              </div>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
          </button>

          <button
            onClick={() => setShowConfirm('whatsapp')}
            disabled={isLoading}
            className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-green-300 hover:bg-green-50/50 transition-all group disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 text-slate-400 group-hover:text-green-600 transition-colors">💬</div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900">Clear WhatsApp Messages</p>
                <p className="text-xs text-slate-500">Remove message content, keep metadata</p>
              </div>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-slate-300 group-hover:text-green-600 transition-colors" />
          </button>

          <button
            onClick={() => setShowConfirm('discord')}
            disabled={isLoading}
            className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/50 transition-all group disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 text-slate-400 group-hover:text-purple-600 transition-colors">💬</div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900">Clear Discord Messages</p>
                <p className="text-xs text-slate-500">Remove message content, keep metadata</p>
              </div>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-slate-300 group-hover:text-purple-600 transition-colors" />
          </button>

          <button
            onClick={() => setShowConfirm('chat')}
            disabled={isLoading}
            className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-amber-300 hover:bg-amber-50/50 transition-all group disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <SparklesIcon className="w-5 h-5 text-slate-400 group-hover:text-amber-600 transition-colors" />
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900">Clear Chat History</p>
                <p className="text-xs text-slate-500">Delete all AI assistant conversations</p>
              </div>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-slate-300 group-hover:text-amber-600 transition-colors" />
          </button>
        </div>
      </div>

      <div className="h-[1px] bg-slate-100"></div>

      {/* Complete Cleanup */}
      <div className="space-y-3">
        <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <ShieldCheckIcon className="w-4 h-4 text-rose-500" />
          Complete Privacy Cleanup
        </h4>
        <p className="text-xs text-slate-500 leading-relaxed">
          Remove all sensitive content from the database. This includes email bodies, message content, chat histories, and AI insights. Only structural metadata will remain.
        </p>

        <button
          onClick={() => setShowConfirm('all')}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 p-5 bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-2xl font-bold hover:from-rose-600 hover:to-rose-700 transition-all shadow-lg shadow-rose-100 disabled:opacity-50"
        >
          <TrashIcon className="w-5 h-5" />
          Clear All Sensitive Content
        </button>

        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
          <div className="flex gap-3">
            <InformationCircleIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong>What gets removed:</strong> Email content, message bodies, chat histories, AI insights, conversation summaries.
              <br />
              <strong>What stays:</strong> Account info, timestamps, sender/recipient names, folder structure, metadata.
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      {showConfirm === 'email' && (
        <ConfirmDialog
          action="clear all email content"
          onConfirm={handleClearEmailContent}
          onCancel={() => setShowConfirm(null)}
        />
      )}
      {showConfirm === 'whatsapp' && (
        <ConfirmDialog
          action="clear all WhatsApp message content"
          onConfirm={handleClearWhatsAppMessages}
          onCancel={() => setShowConfirm(null)}
        />
      )}
      {showConfirm === 'discord' && (
        <ConfirmDialog
          action="clear all Discord message content"
          onConfirm={handleClearDiscordMessages}
          onCancel={() => setShowConfirm(null)}
        />
      )}
      {showConfirm === 'chat' && (
        <ConfirmDialog
          action="delete all chat messages"
          onConfirm={handleClearAllChatMessages}
          onCancel={() => setShowConfirm(null)}
        />
      )}
      {showConfirm === 'all' && (
        <ConfirmDialog
          action="clear ALL sensitive content"
          onConfirm={handleClearAllSensitiveContent}
          onCancel={() => setShowConfirm(null)}
        />
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-bold text-slate-900 text-center">Processing...</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Voice & Microphone Settings Section
const VoiceMicrophoneSection = () => {
  const [settings, setSettings] = useState<{
    provider: 'webSpeech' | 'whisper' | 'google' | 'elevenlabs';
    actionMode: 'dictation' | 'aiGenerate' | 'chat';
    vadEnabled: boolean;
    vadSilenceMs: number;
    language: string;
    position: { edge: 'left' | 'right'; y: number };
    screenshotsEnabled: boolean;
  }>({
    provider: 'webSpeech',
    actionMode: 'aiGenerate',
    vadEnabled: true,
    vadSilenceMs: 1500,
    language: 'en-US',
    position: { edge: 'right', y: 50 },
    screenshotsEnabled: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [platform, setPlatform] = useState<string>('linux');
  const [whisperStatus, setWhisperStatus] = useState<{
    installed: boolean;
    whisperPath: string | null;
    modelPath: string | null;
    hasFfmpeg: boolean;
    modelsDir: string;
    installInstructions: string | null;
  } | null>(null);
  const [webSpeechSupported, setWebSpeechSupported] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  const SUPPORTED_LANGUAGES = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'es-ES', name: 'Spanish' },
    { code: 'fr-FR', name: 'French' },
    { code: 'de-DE', name: 'German' },
    { code: 'it-IT', name: 'Italian' },
    { code: 'pt-BR', name: 'Portuguese' },
    { code: 'ja-JP', name: 'Japanese' },
    { code: 'ko-KR', name: 'Korean' },
    { code: 'zh-CN', name: 'Chinese' },
  ];

  useEffect(() => {
    loadSettings();
    checkProviderSupport();
    getPlatform();
  }, []);

  const getPlatform = async () => {
    try {
      const p = await window.electronAPI?.app?.getPlatform();
      setPlatform(p || 'linux');
    } catch {
      setPlatform('linux');
    }
  };

  const loadSettings = async () => {
    try {
      const [provider, actionMode, vadEnabled, vadSilenceMs, language, position, screenshotsEnabled] = await Promise.all([
        storage.get(STORAGE_KEYS.MIC_STT_PROVIDER),
        storage.get(STORAGE_KEYS.MIC_ACTION_MODE),
        storage.get(STORAGE_KEYS.MIC_VAD_ENABLED),
        storage.get(STORAGE_KEYS.MIC_VAD_SILENCE_MS),
        storage.get(STORAGE_KEYS.MIC_LANGUAGE),
        storage.get(STORAGE_KEYS.MIC_POSITION),
        storage.get(STORAGE_KEYS.MIC_SCREENSHOTS_ENABLED),
      ]);

      setSettings({
        provider: provider || 'webSpeech',
        actionMode: actionMode || 'aiGenerate',
        vadEnabled: vadEnabled ?? true,
        vadSilenceMs: vadSilenceMs || 1500,
        language: language || 'en-US',
        position: position || { edge: 'right', y: 50 },
        screenshotsEnabled: screenshotsEnabled ?? true,
      });
    } catch (error) {
      console.error('Failed to load mic settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkProviderSupport = async () => {
    // Check Web Speech API support
    const speechSupported = !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition);
    setWebSpeechSupported(speechSupported);

    // Check Whisper installation status
    try {
      const status = await window.electronAPI?.whisper?.checkInstalled();
      setWhisperStatus(status);
    } catch {
      setWhisperStatus(null);
    }
  };

  const downloadModel = async () => {
    try {
      setIsDownloading(true);
      // Download tiny model as default
      await window.electronAPI?.whisper?.downloadModel('tiny');
      await checkProviderSupport();
    } catch (error) {
      console.error('Failed to download whisper model:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const updateSetting = async <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));

    const storageKeyMap: Record<string, string> = {
      provider: STORAGE_KEYS.MIC_STT_PROVIDER,
      actionMode: STORAGE_KEYS.MIC_ACTION_MODE,
      vadEnabled: STORAGE_KEYS.MIC_VAD_ENABLED,
      vadSilenceMs: STORAGE_KEYS.MIC_VAD_SILENCE_MS,
      language: STORAGE_KEYS.MIC_LANGUAGE,
      position: STORAGE_KEYS.MIC_POSITION,
      screenshotsEnabled: STORAGE_KEYS.MIC_SCREENSHOTS_ENABLED,
    };

    await storage.set(storageKeyMap[key], value);
  };

  if (isLoading) {
    return <div className="animate-pulse bg-slate-100 rounded-2xl h-64"></div>;
  }

  return (
    <div className="space-y-8">
      {/* STT Provider Selection */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-sm">
            <MicrophoneIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Speech-to-Text Provider</h3>
            <p className="text-sm text-slate-400 mt-0.5">Choose how your voice is converted to text</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Web Speech API */}
          <button
            onClick={() => updateSetting('provider', 'webSpeech')}
            disabled={!webSpeechSupported}
            className={`p-5 rounded-2xl border-2 transition-all text-left ${
              settings.provider === 'webSpeech'
                ? 'border-teal-500 bg-teal-50'
                : 'border-slate-200 hover:border-slate-300'
            } ${!webSpeechSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <GlobeAltIcon className="w-5 h-5 text-teal-600" />
              <span className="font-bold text-slate-900">Web Speech API</span>
              {settings.provider === 'webSpeech' && (
                <CheckCircleIcon className="w-5 h-5 text-teal-500 ml-auto" />
              )}
            </div>
            <p className="text-xs text-slate-500">Browser built-in, instant, no setup required</p>
            {!webSpeechSupported && (
              <p className="text-xs text-red-500 mt-2">Not supported in this browser</p>
            )}
          </button>

          {/* Google Cloud Speech */}
          <button
            onClick={() => updateSetting('provider', 'google')}
            className={`p-5 rounded-2xl border-2 transition-all text-left ${
              settings.provider === 'google'
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <CloudIcon className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-slate-900">Google Cloud</span>
              {settings.provider === 'google' && (
                <CheckCircleIcon className="w-5 h-5 text-blue-500 ml-auto" />
              )}
            </div>
            <p className="text-xs text-slate-500">High accuracy, multi-language support</p>
          </button>

          {/* ElevenLabs Scribe */}
          <button
            onClick={() => updateSetting('provider', 'elevenlabs')}
            className={`p-5 rounded-2xl border-2 transition-all text-left ${
              settings.provider === 'elevenlabs'
                ? 'border-amber-500 bg-amber-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <BoltIcon className="w-5 h-5 text-amber-600" />
              <span className="font-bold text-slate-900">ElevenLabs Scribe</span>
              {settings.provider === 'elevenlabs' && (
                <CheckCircleIcon className="w-5 h-5 text-amber-500 ml-auto" />
              )}
            </div>
            <p className="text-xs text-slate-500">Cutting-edge speed and accuracy</p>
          </button>

          {/* Whisper.cpp */}
          <button
            onClick={() => updateSetting('provider', 'whisper')}
            className={`p-5 rounded-2xl border-2 transition-all text-left relative ${
              settings.provider === 'whisper'
                ? 'border-purple-500 bg-purple-50'
                : 'border-slate-200 hover:border-slate-300'
            } ${!whisperStatus?.installed ? 'opacity-90' : ''}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <CpuChipIcon className="w-5 h-5 text-purple-600" />
              <span className="font-bold text-slate-900">Whisper (Local)</span>
              {settings.provider === 'whisper' && whisperStatus?.installed && (
                <CheckCircleIcon className="w-5 h-5 text-purple-500 ml-auto" />
              )}
            </div>
            <p className="text-xs text-slate-500">Offline, private, uses your CPU</p>
            
            {whisperStatus && !whisperStatus.installed && (
              <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-purple-600 uppercase">
                <InformationCircleIcon className="w-3.5 h-3.5" />
                Setup Required
              </div>
            )}
          </button>
        </div>

        {/* Whisper Setup & Models */}
        {settings.provider === 'whisper' && (
          <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-6 mt-4 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                <CommandLineIcon className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-purple-900">
                  {whisperStatus?.installed ? 'Whisper is active' : 'Whisper setup required'}
                </h4>
                <p className="text-sm text-purple-700/70 mt-1 leading-relaxed">
                  {whisperStatus?.installed 
                    ? 'Your local transcription engine is ready and configured.' 
                    : 'To use offline speech-to-text, you need to have whisper.cpp and ffmpeg installed on your system.'}
                </p>
              </div>
              <button 
                onClick={checkProviderSupport}
                className="p-2 hover:bg-purple-100 rounded-lg transition-colors text-purple-600"
                title="Refresh status"
              >
                <ArrowPathIcon className="w-5 h-5 text-purple-600 active:rotate-180 transition-transform duration-500" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className={`p-3 rounded-xl border ${whisperStatus?.whisperPath ? 'bg-green-50 border-green-100' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {whisperStatus?.whisperPath ? <CheckCircleIcon className="w-4 h-4 text-green-500" /> : <XMarkIcon className="w-4 h-4 text-red-500" />}
                  <span className="text-xs font-bold text-slate-700">Whisper Binary</span>
                </div>
                {whisperStatus?.whisperPath ? (
                  <p className="text-[10px] text-green-600 truncate">{whisperStatus.whisperPath}</p>
                ) : (
                  <p className="text-[10px] text-slate-400">Install whisper-cpp</p>
                )}
              </div>

              <div className={`p-3 rounded-xl border ${whisperStatus?.hasFfmpeg ? 'bg-green-50 border-green-100' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {whisperStatus?.hasFfmpeg ? <CheckCircleIcon className="w-4 h-4 text-green-500" /> : <XMarkIcon className="w-4 h-4 text-red-500" />}
                  <span className="text-xs font-bold text-slate-700">FFmpeg</span>
                </div>
                {whisperStatus?.hasFfmpeg ? (
                  <p className="text-[10px] text-green-600 font-mono">Found in system PATH</p>
                ) : (
                  <p className="text-[10px] text-slate-400">Install ffmpeg</p>
                )}
              </div>

              <div className={`p-3 rounded-xl border ${whisperStatus?.modelPath ? 'bg-green-50 border-green-100' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {whisperStatus?.modelPath ? <CheckCircleIcon className="w-4 h-4 text-green-500" /> : <XMarkIcon className="w-4 h-4 text-red-500" />}
                  <span className="text-xs font-bold text-slate-700">AI Model</span>
                </div>
                {whisperStatus?.modelPath ? (
                  <p className="text-[10px] text-green-600 truncate">{whisperStatus.modelPath.split(/[\\/]/).pop()}</p>
                ) : (
                  <p className="text-[10px] text-slate-400 text-truncate">No Model Found</p>
                )}
              </div>
            </div>

            {/* Installation Instructions (if anything missing) */}
            {!whisperStatus?.installed && (
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-purple-900 uppercase tracking-wider">How to install on {platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : 'Linux'}:</div>
                
                <div className="space-y-4 bg-white/50 p-4 rounded-xl border border-purple-100">
                  {/* FFmpeg Installation */}
                  {(!whisperStatus || !whisperStatus.hasFfmpeg) && (
                    <div className="space-y-2">
                      <div className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        FFmpeg (Audio Engine)
                      </div>
                      <div className="bg-slate-900 rounded-lg p-3 font-mono text-xs text-blue-400 select-all">
                        {platform === 'darwin' ? 'brew install ffmpeg' : platform === 'win32' ? 'winget install ffmpeg' : 'sudo apt install ffmpeg'}
                      </div>
                    </div>
                  )}

                  {/* Whisper Binary Installation */}
                  {(!whisperStatus || !whisperStatus.whisperPath) && (
                    <div className="space-y-2">
                      <div className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                        Whisper.cpp (Transcription Engine)
                      </div>
                      <div className="bg-slate-900 rounded-lg p-3 font-mono text-xs text-purple-400 select-all">
                        {platform === 'darwin' ? 'brew install whisper-cpp' : platform === 'win32' ? 'winget install whisper-cpp' : 'sudo snap install whisper-cpp || sudo apt install whisper-cpp'}
                      </div>
                    </div>
                  )}

                  {/* Model Instructions */}
                  {whisperStatus?.whisperPath && !whisperStatus?.modelPath && (
                    <div className="flex items-center gap-3 text-sm text-purple-800">
                      <CheckCircleIcon className="w-5 h-5 text-green-500" />
                      <span className="font-medium">Binary and FFmpeg found! Click the button below to download the AI model.</span>
                    </div>
                  )}
                </div>
              </div>
            )}
              
            {/* Download Button */}
            {whisperStatus?.whisperPath && !whisperStatus?.modelPath && (
              <button
                onClick={downloadModel}
                disabled={isDownloading}
                className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {isDownloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    Downloading Model (75MB)...
                  </>
                ) : (
                  <>
                    <RocketLaunchIcon className="w-4 h-4" />
                    Download Tiny Model (Recommended)
                  </>
                )}
              </button>
            )}

            {/* Manual Refresh button when installed */}
            {whisperStatus?.installed && (
              <div className="flex justify-center">
                <button 
                  onClick={checkProviderSupport}
                  className="text-[10px] text-purple-400 uppercase tracking-widest font-bold hover:text-purple-600 transition-colors"
                >
                  Verify Engine Status
                </button>
              </div>
            )}
          </div>
        )}

        {/* Google Cloud Panel */}
        {settings.provider === 'google' && (
          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <GoogleSpeechSection />
          </div>
        )}

        {/* ElevenLabs Panel */}
        {settings.provider === 'elevenlabs' && (
          <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-6 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <ElevenLabsSection />
          </div>
        )}
      </div>

      <div className="h-[1px] bg-slate-100"></div>

      {/* Default Action Mode */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
            <SparklesIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Default Action Mode</h3>
            <p className="text-sm text-slate-400 mt-0.5">What happens after you speak</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => updateSetting('actionMode', 'chat')}
            className={`p-5 rounded-2xl border-2 transition-all text-left ${
              settings.actionMode === 'chat'
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <ChatBubbleLeftRightIcon className="w-5 h-5 text-indigo-600" />
              <span className="font-bold text-slate-900">AI Chat</span>
              {settings.actionMode === 'chat' && (
                <CheckCircleIcon className="w-5 h-5 text-indigo-500 ml-auto" />
              )}
            </div>
            <p className="text-xs text-slate-500">Conversational mode with voice responses</p>
          </button>

          <button
            onClick={() => updateSetting('actionMode', 'aiGenerate')}
            className={`p-5 rounded-2xl border-2 transition-all text-left ${
              settings.actionMode === 'aiGenerate'
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <SparklesIcon className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-slate-900">AI Generate</span>
              {settings.actionMode === 'aiGenerate' && (
                <CheckCircleIcon className="w-5 h-5 text-blue-500 ml-auto" />
              )}
            </div>
            <p className="text-xs text-slate-500">Send speech to AI and get local response</p>
          </button>

          <button
            onClick={() => updateSetting('actionMode', 'dictation')}
            className={`p-5 rounded-2xl border-2 transition-all text-left ${
              settings.actionMode === 'dictation'
                ? 'border-green-500 bg-green-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <DocumentTextIcon className="w-5 h-5 text-green-600" />
              <span className="font-bold text-slate-900">Dictation</span>
              {settings.actionMode === 'dictation' && (
                <CheckCircleIcon className="w-5 h-5 text-green-500 ml-auto" />
              )}
            </div>
            <p className="text-xs text-slate-500">Type speech directly into active field</p>
          </button>
        </div>
      </div>

      <div className="h-[1px] bg-slate-100"></div>

      {/* Voice Activity Detection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-sm">
              <SpeakerWaveIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Voice Activity Detection</h3>
              <p className="text-sm text-slate-400 mt-0.5">Auto-stop when you stop speaking</p>
            </div>
          </div>
          <button
            onClick={() => updateSetting('vadEnabled', !settings.vadEnabled)}
            className={`w-12 h-6 rounded-full transition-all relative ${
              settings.vadEnabled ? 'bg-indigo-600' : 'bg-slate-300'
            }`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${
              settings.vadEnabled ? 'left-7' : 'left-1'
            }`}></div>
          </button>
        </div>

        {settings.vadEnabled && (
          <div className="bg-slate-50 p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Silence Threshold</span>
              <span className="text-sm font-bold text-slate-900">{settings.vadSilenceMs}ms</span>
            </div>
            <input
              type="range"
              min="500"
              max="5000"
              step="100"
              value={settings.vadSilenceMs}
              onChange={(e) => updateSetting('vadSilenceMs', parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <p className="text-xs text-slate-400">
              Recording stops automatically after {settings.vadSilenceMs / 1000} seconds of silence
            </p>
          </div>
        )}
      </div>

      <div className="h-[1px] bg-slate-100"></div>

      {/* Screenshot Capture */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-sm">
              <CameraIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Screenshot Capture</h3>
              <p className="text-sm text-slate-400 mt-0.5">Include screenshots with AI requests</p>
            </div>
          </div>
          <button
            onClick={() => updateSetting('screenshotsEnabled', !settings.screenshotsEnabled)}
            className={`w-12 h-6 rounded-full transition-all relative ${
              settings.screenshotsEnabled ? 'bg-purple-600' : 'bg-slate-300'
            }`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${
              settings.screenshotsEnabled ? 'left-7' : 'left-1'
            }`}></div>
          </button>
        </div>

        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
          <div className="flex items-start gap-3">
            <InformationCircleIcon className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div className="text-sm text-purple-900/80">
              <p className="font-medium mb-1">How it works:</p>
              <ul className="list-disc list-inside space-y-1 text-xs text-purple-800">
                <li>Only available in <strong>AI Chat</strong> and <strong>AI Generate</strong> modes</li>
                <li>Click the camera button in the widget to capture a screenshot</li>
                <li>Screenshot is attached to your next voice input for visual context</li>
                <li>Helps AI understand what you're seeing on screen</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="h-[1px] bg-slate-100"></div>

      {/* Language Selection */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-900 text-base">Recognition Language</h3>
        <select
          value={settings.language}
          onChange={(e) => updateSetting('language', e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      <div className="h-[1px] bg-slate-100"></div>

      {/* Widget Position */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-900 text-base">Mic Widget Position</h3>
        <div className="flex gap-4">
          <button
            onClick={() => updateSetting('position', { ...settings.position, edge: 'left' })}
            className={`flex-1 p-4 rounded-xl border-2 transition-all ${
              settings.position.edge === 'left'
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <span className="font-bold text-slate-900">Left Edge</span>
          </button>
          <button
            onClick={() => updateSetting('position', { ...settings.position, edge: 'right' })}
            className={`flex-1 p-4 rounded-xl border-2 transition-all ${
              settings.position.edge === 'right'
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <span className="font-bold text-slate-900">Right Edge</span>
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Tip: Double-click the mic widget to switch sides, or drag it vertically to reposition.
        </p>
      </div>

      <div className="h-[1px] bg-slate-100"></div>

      {/* Keyboard Shortcuts Info */}
      <div className="bg-slate-50 p-6 rounded-2xl space-y-3">
        <h3 className="font-bold text-slate-900 text-base">Keyboard Shortcuts</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Toggle Mic</span>
            <kbd className="px-2 py-1 bg-white rounded border border-slate-200 text-xs font-mono">Ctrl+Shift+M</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Push-to-Talk</span>
            <kbd className="px-2 py-1 bg-white rounded border border-slate-200 text-xs font-mono">Ctrl+Space</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Switch Mode</span>
            <kbd className="px-2 py-1 bg-white rounded border border-slate-200 text-xs font-mono">Ctrl+Shift+D</kbd>
          </div>
        </div>
      </div>
    </div>
  );
};

// Notification Settings Section
const NotificationSection = () => {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loaded = await getNotificationSettings();
        setSettings(loaded);
      } catch (error) {
        console.error('Failed to load notification settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const updateSetting = async <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await saveNotificationSettings({ [key]: value });
  };

  const handleTestSound = async () => {
    setIsTesting(true);
    try {
      await testNotificationSound(settings.soundType);
    } finally {
      setTimeout(() => setIsTesting(false), 500);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Master Toggle */}
      <div className="flex items-center justify-between group">
        <div className="flex-1">
          <h3 className="font-bold text-slate-900 text-base">Enable Notifications</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md leading-relaxed">
            Receive alerts for new emails, messages, and activity across all connected accounts.
          </p>
        </div>
        <button 
          onClick={() => updateSetting('enabled', !settings.enabled)}
          className={`w-14 h-8 rounded-full transition-all relative ${settings.enabled ? 'bg-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-200'}`}
        >
          <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${settings.enabled ? 'left-7' : 'left-1'}`}></div>
        </button>
      </div>

      {settings.enabled && (
        <>
          <div className="h-[1px] bg-slate-50"></div>

          {/* Sound Settings */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-sm">
                <SpeakerWaveIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Sound Notifications</h3>
                <p className="text-sm text-slate-400 mt-0.5">Play an audio alert when new activity is detected.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl space-y-6">
              {/* Sound Enable Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">Enable Sound</span>
                <button 
                  onClick={() => updateSetting('soundEnabled', !settings.soundEnabled)}
                  className={`w-12 h-6 rounded-full transition-all relative ${settings.soundEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${settings.soundEnabled ? 'left-6' : 'left-0.5'}`}></div>
                </button>
              </div>

              {settings.soundEnabled && (
                <>
                  {/* Sound Type Selector */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Sound Type</label>
                    <div className="grid grid-cols-5 gap-2">
                      {(Object.keys(NOTIFICATION_SOUNDS) as SoundType[]).map((type) => (
                        <button
                          key={type}
                          onClick={() => updateSetting('soundType', type)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                            settings.soundType === type
                              ? 'bg-indigo-600 text-white shadow-lg'
                              : 'bg-white text-slate-600 hover:bg-indigo-50'
                          }`}
                        >
                          {NOTIFICATION_SOUNDS[type].name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Volume Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Volume</label>
                      <span className="text-xs font-bold text-indigo-600">{settings.soundVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.soundVolume}
                      onChange={(e) => updateSetting('soundVolume', parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  {/* Test Sound Button */}
                  <button
                    onClick={handleTestSound}
                    disabled={isTesting}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-all border border-indigo-100"
                  >
                    {isTesting ? (
                      <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    ) : (
                      <PlayIcon className="w-4 h-4" />
                    )}
                    Test Sound
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="h-[1px] bg-slate-50"></div>

          {/* Test Notification Section */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Test Notifications</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={async () => {
                  await sendTestNotification();
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                <BellIcon className="w-4 h-4" />
                Test System Notification
              </button>
              <button
                onClick={async () => {
                  await resetSeenIds();
                  alert('Seen IDs reset! Next sync will trigger notifications for all emails.');
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-600 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-all"
              >
                Reset Notification History
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Test system notification to verify desktop alerts are working. Reset history to receive notifications for existing emails on next sync.
            </p>
          </div>

          <div className="h-[1px] bg-slate-50"></div>

          {/* Notification Categories */}
          <div className="space-y-6">
            <h3 className="font-bold text-slate-900 text-base">Notification Types</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Email Notifications */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <EnvelopeIcon className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-bold text-slate-700">Emails</span>
                </div>
                <button 
                  onClick={() => updateSetting('emailNotifications', !settings.emailNotifications)}
                  className={`w-10 h-5 rounded-full transition-all relative ${settings.emailNotifications ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${settings.emailNotifications ? 'left-5' : 'left-0.5'}`}></div>
                </button>
              </div>

              {/* Messages/Slack */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <BellIcon className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-sm font-bold text-slate-700">Slack Messages</span>
                </div>
                <button 
                  onClick={() => updateSetting('slackNotifications', !settings.slackNotifications)}
                  className={`w-10 h-5 rounded-full transition-all relative ${settings.slackNotifications ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${settings.slackNotifications ? 'left-5' : 'left-0.5'}`}></div>
                </button>
              </div>

              {/* GitHub */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                  </div>
                  <span className="text-sm font-bold text-slate-700">GitHub Activity</span>
                </div>
                <button 
                  onClick={() => updateSetting('githubNotifications', !settings.githubNotifications)}
                  className={`w-10 h-5 rounded-full transition-all relative ${settings.githubNotifications ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${settings.githubNotifications ? 'left-5' : 'left-0.5'}`}></div>
                </button>
              </div>

              {/* WhatsApp */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <span className="text-sm font-bold text-slate-700">WhatsApp</span>
                </div>
                <button 
                  onClick={() => updateSetting('whatsappNotifications', !settings.whatsappNotifications)}
                  className={`w-10 h-5 rounded-full transition-all relative ${settings.whatsappNotifications ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${settings.whatsappNotifications ? 'left-5' : 'left-0.5'}`}></div>
                </button>
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-slate-50"></div>

          {/* Do Not Disturb */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl flex items-center justify-center shadow-sm">
                  <MicrophoneIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Do Not Disturb</h3>
                  <p className="text-sm text-slate-400 mt-0.5">Silence notifications during specified hours.</p>
                </div>
              </div>
              <button 
                onClick={() => updateSetting('doNotDisturb', !settings.doNotDisturb)}
                className={`w-12 h-6 rounded-full transition-all relative ${settings.doNotDisturb ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${settings.doNotDisturb ? 'left-6' : 'left-0.5'}`}></div>
              </button>
            </div>

            {settings.doNotDisturb && (
              <div className="bg-slate-50 p-6 rounded-2xl">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Start Time</label>
                    <input
                      type="time"
                      value={settings.dndStart}
                      onChange={(e) => updateSetting('dndStart', e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">End Time</label>
                    <input
                      type="time"
                      value={settings.dndEnd}
                      onChange={(e) => updateSetting('dndEnd', e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-4">
                  Notifications will be silenced from {settings.dndStart} to {settings.dndEnd}.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const SettingsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
  const [privacyMode, setPrivacyMode] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState(true);
  const [provider, setProvider] = useState<AIProvider>('google');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadProvider = async () => {
      const currentProvider = await getAIProvider();
      setProvider(currentProvider);
    };
    loadProvider();
    
    const interval = setInterval(loadProvider, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-in fade-in duration-700 px-10 pt-6">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">System Preferences</h1>
          <p className="text-slate-500 font-medium mt-2 text-lg">Control your intelligence engine and privacy parameters.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Settings Navigation */}
        <aside className="lg:col-span-3">
          <nav className="space-y-2 bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm sticky top-6">
            {[
              { id: 'profile', icon: UserCircleIcon, label: 'Profile' },
              { id: 'integrations', icon: KeyIcon, label: 'Integrations' },
              { id: 'developer', icon: CommandLineIcon, label: 'Developer' },
              { id: 'intelligence', icon: SparklesIcon, label: 'AI Engine' },
              { id: 'voice', icon: MicrophoneIcon, label: 'Voice Input' },
              { id: 'notifications', icon: BellIcon, label: 'Notifications' },
              { id: 'privacy', icon: ShieldCheckIcon, label: 'Security' },
              { id: 'system', icon: CpuChipIcon, label: 'System' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-black transition-all ${
                  activeTab === tab.id 
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' 
                  : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
            <div className="h-[1px] bg-slate-50 my-2 mx-5"></div>
            <button className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-black text-rose-500 hover:bg-rose-50 transition-all">
              <ArrowLeftOnRectangleIcon className="w-5 h-5" />
              Log Out
            </button>
          </nav>
        </aside>

        {/* Setting Panels */}
        <div className="lg:col-span-9">
          {activeTab === 'profile' && (
            <SettingSection title="User Profile" icon={UserCircleIcon}>
              <ProfileSection />
            </SettingSection>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-8">
              <SettingSection title="Integrations & API Management" icon={KeyIcon}>
                <div className="mb-6 bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100/50 flex items-start gap-4">
                  <ShieldCheckIcon className="w-6 h-6 text-indigo-500 shrink-0" />
                  <p className="text-sm text-indigo-900/70 leading-relaxed font-medium">
                    Store your API keys and Client IDs here. aethermsaid hub uses these to connect directly to your third-party providers. All keys are encrypted and stored locally on your device.
                  </p>
                </div>

                {/* Discord OAuth Credentials */}
                <DiscordCredentialsSection />
                <div className="h-[1px] bg-slate-50"></div>

                {/* Advanced/Sensitive Integrations */}
                <SensitiveIntegrationsSection />
                <div className="h-[1px] bg-slate-50"></div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <IntegrationCard platform="Google Cloud" fieldKeys={["Client ID", "Client Secret"]} />
                  <IntegrationCard platform="Microsoft Azure" fieldKeys={["Client ID", "Tenant ID"]} />
                  <IntegrationCard platform="Slack API" fieldKeys={["OAuth Token"]} />
                  <IntegrationCard platform="Discord" fieldKeys={["Bot Token"]} />
                  <IntegrationCard platform="Google Analytics" fieldKeys={["Property ID", "Measurement ID"]} />
                </div>
              </SettingSection>
            </div>
          )}

          {activeTab === 'developer' && (
            <SettingSection title="Developer Workbench" icon={CommandLineIcon}>
              <div className="mb-6 bg-slate-900 p-6 rounded-3xl border border-slate-800 flex items-start gap-4 text-white">
                <CommandLineIcon className="w-6 h-6 text-indigo-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-indigo-400 mb-1">Agent Settings</h4>
                  <p className="text-sm text-slate-300 leading-relaxed font-medium">
                    Configure settings for the AI Developer features. These settings are specific to the coding agent and developer tools.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-base mb-4">GitHub Copilot SDK</h3>
                <GithubCopilotConfigSection />
              </div>
              
              <div className="h-[1px] bg-slate-50 my-8"></div>
              
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                <ExclamationCircleIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900/70 leading-relaxed font-medium">
                  <strong className="font-bold">Experimental:</strong> The AI Developer workbench is currently in preview. some tools may require additional system dependencies (e.g., git, node, etc.) to be globally available in your environment.
                </div>
              </div>
            </SettingSection>
          )}

          {activeTab === 'intelligence' && (
            <SettingSection title="Intelligence Engine" icon={SparklesIcon}>
              <AIProviderSelector />
              <div className="h-[1px] bg-slate-50"></div>
              
              {/* Provider-specific configurations */}
              {provider === 'openai' && (
                <>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base mb-4">OpenAI Configuration</h3>
                    <OpenAIConfigSection />
                  </div>
                  <div className="h-[1px] bg-slate-50"></div>
                </>
              )}

              {provider === 'anthropic' && (
                <>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base mb-4">Anthropic Configuration</h3>
                    <AnthropicConfigSection />
                  </div>
                  <div className="h-[1px] bg-slate-50"></div>
                </>
              )}

              {provider === 'ollama' && (
                <>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base mb-4">Ollama Configuration</h3>
                    <OllamaConfigSection />
                  </div>
                  <div className="h-[1px] bg-slate-50"></div>
                </>
              )}

              {provider === 'local' && (
                <>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base mb-4">Local AI Configuration</h3>
                    <LocalAIConfigSection />
                  </div>
                  <div className="h-[1px] bg-slate-50"></div>
                </>
              )}

              <AssistantNameSection />
              <div className="h-[1px] bg-slate-50"></div>
              <GeminiApiKeySection />
              <div className="h-[1px] bg-slate-50"></div>
              <GeminiModelSelector />
              <div className="h-[1px] bg-slate-50"></div>
              
              {/* LangChain Chat Configuration */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                    <CommandLineIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">LangChain Chat Agent</h3>
                    <p className="text-sm text-slate-400 mt-0.5">
                      Powered by {provider === 'openrouter' ? 'OpenRouter' : provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Anthropic' : provider === 'ollama' ? 'Ollama (Local)' : provider === 'local' ? 'Local AI' : 'Google Gemini'} via LangChain framework
                    </p>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-5 rounded-2xl border border-purple-100">
                  <div className="flex items-start gap-3 mb-4">
                    <SparklesIcon className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-purple-900 text-sm mb-1">AI Chat Features</h4>
                      <ul className="text-xs text-purple-700/80 space-y-1.5 leading-relaxed">
                        <li className="flex items-start gap-2">
                          <CheckCircleIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span><strong>Account Context:</strong> Access all your emails, events, notifications & GitHub activity</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircleIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span><strong>Session Management:</strong> Persistent chat history with account filtering</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircleIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span><strong>Smart Responses:</strong> Context-aware answers using your actual data</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircleIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span><strong>Multi-Provider:</strong> Supports Google Gemini, OpenRouter, OpenAI, Anthropic, Ollama & Custom endpoints</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-purple-600 font-semibold mt-3 pt-3 border-t border-purple-200">
                    <InformationCircleIcon className="w-4 h-4" />
                    Chat agent uses the selected provider and model above
                  </div>
                </div>
              </div>
              
              <div className="h-[1px] bg-slate-50"></div>
              
              {/* ElevenLabs Voice AI Section */}
              <ElevenLabsSection />
              
              <div className="h-[1px] bg-slate-50"></div>
              
              {/* Google Cloud Speech Section */}
              <GoogleSpeechSection />
              
              <div className="h-[1px] bg-slate-50"></div>
              <Toggle 
                label="Predictive Background Analysis" 
                description="Allow aethermsaid hub to pre-process communications in the background to provide instant summaries upon opening the app." 
                enabled={aiAnalysis} 
                onChange={setAiAnalysis} 
              />
              <div className="h-[1px] bg-slate-50"></div>
              <Toggle 
                label="Deep Schedule Awareness" 
                description="Integrates travel times, weather patterns, and past calendar behavior into your daily morning briefing." 
                enabled={true} 
                onChange={() => {}} 
              />
              <div className="h-[1px] bg-slate-50"></div>
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 text-base">Summary Frequency</h3>
                <div className="flex bg-slate-50 p-1.5 rounded-2xl w-fit">
                  {['Manual', 'Hourly', 'Daily'].map(option => (
                    <button 
                      key={option} 
                      className={`px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${option === 'Daily' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-900'}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[1px] bg-slate-50"></div>
              <DiscoveryObjectivesSection />
            </SettingSection>
          )}

          {activeTab === 'voice' && (
            <SettingSection title="Voice Input & Microphone" icon={MicrophoneIcon}>
              <VoiceMicrophoneSection />
            </SettingSection>
          )}

          {activeTab === 'notifications' && (
            <SettingSection title="Notifications & Alerts" icon={BellIcon}>
              <NotificationSection />
            </SettingSection>
          )}

          {activeTab === 'privacy' && (
            <SettingSection title="Privacy & Security" icon={ShieldCheckIcon}>
              <Toggle 
                label="aether-hub Stateless Inference" 
                description="When enabled, your data context is purged from the processing buffer immediately after each AI request." 
                enabled={privacyMode} 
                onChange={setPrivacyMode} 
              />
              <div className="h-[1px] bg-slate-50"></div>
              <DataCleanupSection />
              <div className="h-[1px] bg-slate-50"></div>
              <div className="flex items-center justify-between group cursor-pointer p-6 bg-slate-50 rounded-[1.5rem] border border-transparent hover:border-indigo-100 transition-all">
                <div className="flex items-center gap-5">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <FingerPrintIcon className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Biometric Authentication</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Require TouchID or FaceID to access connections.</p>
                  </div>
                </div>
                <ChevronRightIcon className="w-5 h-5 text-slate-300" />
              </div>
              <div className="h-[1px] bg-slate-50"></div>
              <IgnoredSendersSection />
            </SettingSection>
          )}

          {activeTab === 'system' && (
            <SettingSection title="System Controls" icon={CpuChipIcon}>
              {/* Autostart Section */}
              <AutostartSection />
              
              <div className="h-[1px] bg-slate-100 my-8"></div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Local Storage</h4>
                    <p className="text-3xl font-black text-slate-900 tracking-tight">1.2 GB</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Cached metadata & indexes</p>
                  </div>
                  <button className="mt-8 flex items-center gap-2 text-rose-500 font-black text-xs uppercase hover:text-rose-600 transition-colors">
                    <TrashIcon className="w-4 h-4" />
                    Clear Local Cache
                  </button>
                </div>
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Build Version</h4>
                    <p className="text-3xl font-black text-slate-900 tracking-tight">v2.0.4-B</p>
                    <p className="text-[10px] text-green-500 font-black uppercase mt-2">Latest Stable Release</p>
                  </div>
                  <button className="mt-8 flex items-center gap-2 text-indigo-600 font-black text-xs uppercase hover:text-indigo-700 transition-colors">
                    Check for Updates
                  </button>
                </div>
              </div>
            </SettingSection>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
