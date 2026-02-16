
import React, { useState, useRef, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import AccountsPage from './pages/Accounts';
import DigestPage from './pages/Digest';
import ChatAssistant from './pages/Chat';
import SettingsPage from './pages/Settings';
import KnowledgeBase from './pages/KnowledgeBase';
import KnowledgeInsights from './pages/KnowledgeInsights';
import EmailsPage from './pages/Emails';
import CalendarPage from './pages/Calendar';
import GitHubPage from './pages/GitHub';
import ResendPage from './pages/Resend';
import WhatsAppPage from './pages/WhatsApp';
import DiscordPage from './pages/Discord';
import TelegramPage from './pages/Telegram';
import NotesPage from './pages/Notes';
import WatchPage from './pages/Watch';
import ActionsPage from './pages/Actions';
import IntelligenceFeedPage from './pages/IntelligenceFeed';
import MicOverlayPage from './pages/MicOverlay';
import NotesOverlayPage from './pages/NotesOverlay';
import YouTubePage from './pages/YouTube';
import AutomationsPage from './pages/Automations';
import AutomationResultsPage from './pages/AutomationResults';
import AIDeveloperPage from './pages/AIDeveloper';
import AgentsPage from './pages/Agents';
import InvoicingPage from './pages/Invoicing';
import TitleBar from './components/TitleBar';
import ErrorBoundary from './components/ErrorBoundary';
import FloatingChatBubble from './components/FloatingChatBubble';
import FloatingMicWidget from './components/FloatingMicWidget';
import { useKeyboardShortcuts, getModifierSymbol } from './hooks/useKeyboardShortcuts';
import storage from './services/electronStore';
import { db } from './services/database';
import { startAutoSync, stopAutoSync } from './services/autoSync';
import { startWatchSync, stopWatchSync } from './services/watchSync';
import { knowledgeExtractor } from './services/knowledgeExtractor';
import { getChatResponse } from './services/langchainService';
import { 
  HomeIcon, 
  SparklesIcon, 
  ChatBubbleLeftRightIcon, 
  LinkIcon,
  Cog6ToothIcon,
  BellIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CircleStackIcon,
  CommandLineIcon,
  EnvelopeIcon,
  CalendarDaysIcon,
  CodeBracketIcon,
  PaperAirplaneIcon,
  EyeIcon,
  BoltIcon,
  ChevronDownIcon,
  ChartBarIcon,
  ChatBubbleBottomCenterTextIcon,
  BriefcaseIcon,
  PencilSquareIcon,
  LightBulbIcon,
  WrenchScrewdriverIcon,
  PlayCircleIcon,
  BanknotesIcon,
  ReceiptPercentIcon,
} from '@heroicons/react/24/outline';
import { UserIcon } from '@heroicons/react/24/solid';
import { startWatchMonitor } from './services/watchMonitor';
import { generateIntelligenceFeed } from './services/intelligenceFeed';
import { handleWhatsAppMessage, handleDiscordMessage, handleTelegramMessage, initNotificationService } from './services/notificationService';

// Initialize storage on app startup
storage.initialize().catch(console.error);

// Global IPC listeners
const setupGlobalListeners = () => {
  // WhatsApp listener
  if (window.electronAPI?.on?.whatsappMessage) {
    window.electronAPI.on.whatsappMessage(async (message: any) => {
      console.log('📱 Global WhatsApp message received:', message.id);
      await handleWhatsAppMessage(message);
    });
  }

  // Discord listener
  if (window.electronAPI?.on?.discordMessage) {
    window.electronAPI.on.discordMessage(async (message: any) => {
      console.log('🎮 Global Discord message received:', message.id);
      await handleDiscordMessage(message);
    });
  }

  // Telegram listener
  if (window.electronAPI?.on?.telegramMessage) {
    window.electronAPI.on.telegramMessage(async (message: any) => {
      console.log('✈️ Global Telegram message received:', message.id);
      await handleTelegramMessage(message);
    });
  }
};

// Dynamic user profile widget that shows connected account info
const UserProfileWidget = () => {
  const [userInfo, setUserInfo] = useState<{name: string, email: string, avatar?: string} | null>(null);
  
  useEffect(() => {
    const loadUserInfo = async () => {
      // 1. First check if there are any accounts in the SQLite database (preferred)
      try {
        const dbAccounts = await db.accounts.getAll();
        const primaryAccount = dbAccounts.find(acc => acc.platform === 'google' && acc.isConnected) || 
                               dbAccounts.find(acc => acc.isConnected) || 
                               dbAccounts[0];
        
        if (primaryAccount) {
          setUserInfo({ 
            name: primaryAccount.name || (primaryAccount.platform === 'whatsapp' ? 'WhatsApp User' : 'Connected User'), 
            email: primaryAccount.email || primaryAccount.id,
            avatar: primaryAccount.avatarUrl || undefined
          });
          return;
        }
      } catch (err) {
        console.warn('Failed to load user info from database:', err);
      }

      // 2. Try to get Google user info from storage as legacy fallback
      const googleUser = await storage.get('google_user') as {name: string, email: string, picture?: string} | null;
      if (googleUser) {
        setUserInfo({ name: googleUser.name, email: googleUser.email, avatar: googleUser.picture });
        return;
      }
      
      // 3. Fallback to storage connected_accounts as legacy fallback
      const accounts = await storage.get('connected_accounts') as any[] | null;
      if (accounts && accounts.length > 0) {
        setUserInfo({ name: accounts[0].name || 'Connected User', email: accounts[0].email || '' });
        return;
      }

      // If nothing found, reset user info
      setUserInfo(null);
    };
    loadUserInfo();
    
    // Refresh periodically
    const interval = setInterval(loadUserInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!userInfo) {
    return (
      <Link to="/accounts" className="p-4 bg-slate-50 rounded-[1.5rem] flex items-center space-x-3 border border-slate-100 hover:border-indigo-200 transition-colors">
        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center">
          <UserIcon className="w-5 h-5 text-slate-400" />
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="text-xs font-bold text-slate-500 truncate">No account connected</p>
          <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-tighter truncate">Click to connect</p>
        </div>
      </Link>
    );
  }

  return (
    <Link to="/settings" className="p-4 bg-slate-50 rounded-[1.5rem] flex items-center space-x-3 border border-slate-100 hover:border-indigo-200 transition-colors">
      {userInfo.avatar ? (
        <img src={userInfo.avatar} className="w-9 h-9 rounded-full ring-2 ring-white shadow-sm" alt="Profile" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
          <span className="text-indigo-600 font-bold text-sm">{userInfo.name.charAt(0).toUpperCase()}</span>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <p className="text-xs font-black text-slate-900 truncate">{userInfo.name}</p>
        <p className="text-[10px] text-slate-400 font-bold truncate">{userInfo.email}</p>
      </div>
    </Link>
  );
};

const SidebarLink = ({ to, icon: Icon, label, badge, badgeColor }: { to: string, icon: any, label: string, badge?: string, badgeColor?: string }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link 
      to={to} 
      className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
        isActive 
        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-[0_4px_15_rgba(99,102,241,0.4)]' 
        : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
      <span className="font-semibold text-sm flex-1">{label}</span>
      {badge && (
        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full text-white ${badgeColor || 'bg-indigo-500'}`}>
          {badge}
        </span>
      )}
    </Link>
  );
};

const MenuGroup = ({ 
  title, 
  icon: Icon, 
  children, 
  defaultExpanded = true 
}: { 
  title: string, 
  icon: any, 
  children: React.ReactNode, 
  defaultExpanded?: boolean 
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  useEffect(() => {
    // Load saved state from storage
    storage.get(`menu_group_${title.toLowerCase().replace(/\s+/g, '_')}`).then(saved => {
      if (saved !== null) setIsExpanded(saved as boolean);
    });
  }, [title]);
  
  const toggleExpand = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    // Save state to storage
    storage.set(`menu_group_${title.toLowerCase().replace(/\s+/g, '_')}`, newState);
  };
  
  return (
    <div className="mb-4">
      <button
        onClick={toggleExpand}
        className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all group"
      >
        <div className="flex items-center space-x-2">
          <Icon className="w-3.5 h-3.5 text-indigo-500 group-hover:text-purple-600" />
          <span>{title}</span>
        </div>
        <ChevronDownIcon className={`w-3.5 h-3.5 text-indigo-500 group-hover:text-purple-600 transition-transform duration-300 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
      </button>
      <div 
        className={`space-y-1 mt-2 transition-all duration-300 origin-top ${
          isExpanded ? 'opacity-100 max-h-[1000px]' : 'opacity-0 max-h-0 overflow-hidden'
        }`}
      >
        {children}
      </div>
    </div>
  );
};

const Layout = ({ children }: { children?: React.ReactNode }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Handle IPC navigation
  useEffect(() => {
    if (window.electronAPI?.on?.navigate) {
      console.log('📡 IPC navigation handler registered');
      const cleanup = window.electronAPI.on.navigate((path: string) => {
        console.log('📡 IPC navigate received:', path);
        navigate(path);
      });
      return cleanup;
    }
  }, [navigate]);

  // Register keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: '1',
      ctrl: true,
      callback: () => (window.location.hash = '#/'),
      description: 'Dashboard',
    },
    {
      key: '2',
      ctrl: true,
      callback: () => (window.location.hash = '#/chat'),
      description: 'Chat',
    },
    {
      key: '3',
      ctrl: true,
      callback: () => (window.location.hash = '#/digest'),
      description: 'Digest',
    },
    {
      key: '/',
      ctrl: true,
      callback: () => {
        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      },
      description: 'Search',
    },
    {
      key: '?',
      shift: true,
      callback: () => setShowShortcuts(!showShortcuts),
      description: 'Show shortcuts',
    },
  ]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Activity loaded from real data
  const [activities, setActivities] = useState<{id: number, text: string, time: string, type: string}[]>([]);
  
  // Handle AI requests from browser addon
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (api?.addon?.onAIRequest) {
      console.log('📡 Addon AI request handler registered');
      const cleanup = api.addon.onAIRequest(async (data: { id: string; action: string; payload: any }) => {
        console.log('📡 Received addon AI request:', data.id, data.action);
        try {
          const { id, action, payload } = data;
          if (action === 'chat') {
            // Use the AI service to process the message
            console.log('📡 Processing chat message:', payload?.message?.substring(0, 50));
            const response = await getChatResponse(payload?.message || '', []);
            console.log('📡 AI response received');
            api.addon.sendAIResponse({ id, success: true, data: { response: response.text || 'No response generated' } });
            console.log('📡 Sent AI response back');
          } else {
            api.addon.sendAIResponse({ id, success: false, error: `Unknown AI action: ${action}` });
          }
        } catch (error: any) {
          console.error('📡 Addon AI request error:', error);
          api.addon.sendAIResponse({ id: data.id, success: false, error: error.message || 'AI request failed' });
        }
      });
      return cleanup;
    }
  }, []);

  useEffect(() => {
    const loadActivities = async () => {
      // Use SQLite database instead of storage
      const connectedAccounts = await db.accounts.getAll();
      const gmailMessages = await db.emails.getAll();
      const calendarEvents = await db.events.getAll();
      
      const newActivities = [];

      // 1. Account Overall Sync Status
      if (connectedAccounts && connectedAccounts.length > 0) {
        const activeAccounts = connectedAccounts.filter(acc => acc.isConnected && acc.status === 'connected');
        const errorAccounts = connectedAccounts.filter(acc => acc.status === 'error' || !acc.isConnected);
        
        newActivities.push({ 
          id: 1, 
          text: `${activeAccounts.length}/${connectedAccounts.length} accounts actively synced`, 
          time: 'Now', 
          type: activeAccounts.length === connectedAccounts.length ? 'success' : 'alert' 
        });

        if (errorAccounts.length > 0) {
          errorAccounts.forEach((acc, idx) => {
            newActivities.push({
              id: 10 + idx,
              text: `Reconnection required: ${acc.email || acc.name}`,
              time: 'Action Required',
              type: 'error'
            });
          });
        }
      }

      // 2. Data Volume Stats
      if (gmailMessages && gmailMessages.length > 0) {
        const unread = gmailMessages.filter((m: any) => !m.isRead).length;
        newActivities.push({ 
          id: 2, 
          text: `${gmailMessages.length} emails available (${unread} unread)`, 
          time: 'Recent', 
          type: 'info' 
        });
      }

      if (calendarEvents && calendarEvents.length > 0) {
        newActivities.push({ 
          id: 3, 
          text: `${calendarEvents.length} calendar events synced`, 
          time: 'Recent', 
          type: 'info' 
        });
      }

      if (newActivities.length === 0) {
        newActivities.push({ id: 1, text: 'Connect an account to get started', time: 'Now', type: 'info' });
      }
      setActivities(newActivities);
    };

    loadActivities();
    
    // Refresh activities frequently at startup to catch connectivity check results
    const refreshSequence = [1000, 3000, 7000, 15000];
    const timers = refreshSequence.map(delay => setTimeout(loadActivities, delay));
    
    const interval = setInterval(loadActivities, 60000); // 1 minute regular refresh
    
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-100 flex flex-col shrink-0 overflow-hidden">
          <div className="p-8 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-100">N</div>
              <span className="font-black text-2xl tracking-tight text-slate-900">aether-hub<span className="text-indigo-600">AI</span></span>
            </div>
          </div>

        <nav className="flex-1 px-6 py-2 overflow-y-auto">
          <MenuGroup title="Overview" icon={ChartBarIcon} defaultExpanded={false}>
            <SidebarLink to="/" icon={HomeIcon} label="Dashboard" />
            <SidebarLink to="/actions" icon={BoltIcon} label="Actions" badge="AI" badgeColor="bg-purple-500" />
            <SidebarLink to="/digest" icon={SparklesIcon} label="Intelligent Briefing" />
            <SidebarLink to="/intelligence" icon={BoltIcon} label="Intelligence Feed" badge="AI" badgeColor="bg-purple-500" />
            <SidebarLink to="/automation-results" icon={ChartBarIcon} label="Auto Results" />
          </MenuGroup>

          <MenuGroup title="Communications" icon={ChatBubbleBottomCenterTextIcon} defaultExpanded={false}>
            <SidebarLink to="/emails" icon={EnvelopeIcon} label="Emails" />
            <SidebarLink to="/whatsapp" icon={ChatBubbleLeftRightIcon} label="WhatsApp" badge="NEW" badgeColor="bg-green-500" />
            <SidebarLink to="/telegram" icon={PaperAirplaneIcon} label="Telegram" badge="NEW" badgeColor="bg-blue-500" />
            <SidebarLink to="/discord" icon={ChatBubbleLeftRightIcon} label="Discord" badge="NEW" badgeColor="bg-indigo-500" />
            <SidebarLink to="/resend" icon={PaperAirplaneIcon} label="Campaigns" />
          </MenuGroup>

          <MenuGroup title="Productivity" icon={BriefcaseIcon} defaultExpanded={false}>
            <SidebarLink to="/calendar" icon={CalendarDaysIcon} label="Calendar" />
            <SidebarLink to="/github" icon={CodeBracketIcon} label="GitHub" />
            <SidebarLink to="/notes" icon={PencilSquareIcon} label="Keep Notes" badge="NEW" badgeColor="bg-blue-500" />
            <SidebarLink to="/watch" icon={EyeIcon} label="Watch List" badge="NEW" badgeColor="bg-amber-500" />
          </MenuGroup>

          <MenuGroup title="AI Agents" icon={SparklesIcon} defaultExpanded={false}>
            <SidebarLink to="/agents" icon={SparklesIcon} label="All Agents" badge="NEW" badgeColor="bg-purple-500" />
            <SidebarLink to="/chat" icon={ChatBubbleLeftRightIcon} label="Assistant" />
            <SidebarLink to="/automations" icon={PlayCircleIcon} label="Automations" badge="AI" badgeColor="bg-violet-500" />
            <SidebarLink to="/ai-developer" icon={CommandLineIcon} label="AI Developer" badge="AI" badgeColor="bg-indigo-500" />
            <SidebarLink to="/youtube" icon={PlayCircleIcon} label="YouTube" badge="AI" badgeColor="bg-red-500" />
          </MenuGroup>

          <MenuGroup title="Invoicing" icon={BanknotesIcon} defaultExpanded={false}>
            <SidebarLink to="/invoicing" icon={ReceiptPercentIcon} label="Invoices" badge="NEW" badgeColor="bg-emerald-500" />
          </MenuGroup>

          <MenuGroup title="Knowledge" icon={LightBulbIcon} defaultExpanded={false}>
            <SidebarLink to="/knowledge" icon={CircleStackIcon} label="Knowledge Base" />
            <SidebarLink to="/insights" icon={SparklesIcon} label="Insights" badge="NEW" badgeColor="bg-purple-500" />
          </MenuGroup>

          <MenuGroup title="System" icon={WrenchScrewdriverIcon} defaultExpanded={false}>
            <SidebarLink to="/accounts" icon={LinkIcon} label="Connections" />
          </MenuGroup>
        </nav>

        <div className="p-6 space-y-4 shrink-0">
          <SidebarLink to="/settings" icon={Cog6ToothIcon} label="Settings" />
          <UserProfileWidget />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-20 bg-white/40 backdrop-blur-xl flex items-center justify-between px-10 shrink-0 relative z-50">
          <div className="relative w-[400px]">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
            <input 
              type="text" 
              placeholder="Search conversations, files, or events..." 
              className="w-full bg-slate-100/50 border border-slate-200/50 rounded-full py-2.5 pl-12 pr-6 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none text-slate-600"
            />
          </div>
          <div className="flex items-center space-x-6">
            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2.5 rounded-xl transition-all ${showNotifications ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                <BellIcon className="w-6 h-6" />
                <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-[3px] border-white shadow-sm"></span>
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-4 w-80 bg-white rounded-[2rem] border border-slate-100 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 z-[100]">
                  <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Activity Center</h3>
                    <button onClick={() => setShowNotifications(false)}><XMarkIcon className="w-4 h-4 text-slate-300 hover:text-slate-600" /></button>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
                    {activities.map(item => (
                      <div key={item.id} className="p-5 hover:bg-slate-50 transition-colors flex gap-4 items-start">
                        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                          item.type === 'error' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' :
                          item.type === 'alert' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 
                          item.type === 'success' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 
                          'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.6)]'
                        }`}></div>
                        <div>
                          <p className="text-[13px] font-bold text-slate-700 leading-snug">{item.text}</p>
                          <p className="text-[10px] text-slate-400 mt-1 font-black uppercase tracking-widest">{item.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="w-full py-4 bg-slate-50 text-[10px] font-black uppercase text-indigo-600 hover:bg-indigo-50 tracking-[0.2em] border-t border-slate-100 transition-colors">
                    Dismiss All Activity
                  </button>
                </div>
              )}
            </div>
            
            <div 
              className="flex items-center space-x-3 bg-indigo-50/50 border border-indigo-100/50 text-indigo-700 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-transform hover:scale-105 cursor-help group"
              title="Auto-Sync Active: Syncing all connected accounts every 5 minutes. Click Connections to manually sync."
            >
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)] group-hover:bg-emerald-600 transition-colors"></div>
              <span>AI Sync Active</span>
            </div>
          </div>
        </header>
        
        {/* Main Page Content - Scrollable Container */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
      
      {showShortcuts && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-6"
          onClick={() => setShowShortcuts(false)}
        >
          <div 
            className="bg-white rounded-[3rem] p-12 max-w-2xl w-full shadow-2xl animate-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 mb-10">
              <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center">
                <CommandLineIcon className="w-7 h-7 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Keyboard Shortcuts</h2>
                <p className="text-sm text-slate-500 mt-1">Navigate faster</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {[
                { key: `${getModifierSymbol()}+1`, desc: 'Dashboard' },
                { key: `${getModifierSymbol()}+2`, desc: 'Chat' },
                { key: `${getModifierSymbol()}+3`, desc: 'Digest' },
                { key: `${getModifierSymbol()}+/`, desc: 'Search' },
                { key: 'Shift+?', desc: 'This help' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <span className="text-sm font-bold text-slate-700">{item.desc}</span>
                  <kbd className="px-3 py-1.5 bg-white border-2 border-slate-200 rounded-lg text-xs font-black text-slate-600">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowShortcuts(false)}
              className="w-full mt-8 bg-slate-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-indigo-600 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    // Determine if we should start background services
    // Background syncs should only run once in the main window
    const isOverlay = window.location.hash.includes('mic-overlay');
    
    if (!isOverlay) {
      console.log('🚀 Starting background services in main window...');
      
      // Start services
      startAutoSync();
      setupGlobalListeners();
      initNotificationService().catch(err => console.error('🔔 Failed to init notifications:', err));
      startWatchSync();
      
      // Start periodic tasks
      knowledgeExtractor.start(60); // Run every 60 minutes
      startWatchMonitor(15);

      // Generate intelligence feed with 30s delay
      const intelTimer = setTimeout(() => {
        generateIntelligenceFeed().catch(err => {
          console.warn('⚠️ Failed to generate initial intelligence feed:', err);
        });
      }, 30000);

      return () => {
        clearTimeout(intelTimer);
        // We don't strictly need to stop services on unmount here 
        // as App only unmounts on app close, but it's good practice
      };
    }
  }, []);

  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          {/* Standalone pages without TitleBar or Layout */}
          <Route path="/mic-overlay" element={<MicOverlayPage />} />
          <Route path="/notes-overlay" element={<NotesOverlayPage />} />
          
          {/* Main App with TitleBar and Layout */}
          <Route path="*" element={
            <>
              <TitleBar />
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/emails" element={<EmailsPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/github" element={<GitHubPage />} />
                  <Route path="/notes" element={<NotesPage />} />
                  <Route path="/whatsapp" element={<WhatsAppPage />} />
                  <Route path="/telegram" element={<TelegramPage />} />
                  <Route path="/discord" element={<DiscordPage />} />
                  <Route path="/resend" element={<ResendPage />} />
                  <Route path="/youtube" element={<YouTubePage />} />
                  <Route path="/watch" element={<WatchPage />} />
                  <Route path="/actions" element={<ActionsPage />} />
                  <Route path="/agents" element={<AgentsPage />} />
                  <Route path="/automations" element={<AutomationsPage />} />
                  <Route path="/automation-results" element={<AutomationResultsPage />} />
                  <Route path="/ai-developer" element={<AIDeveloperPage />} />
                  <Route path="/invoicing" element={<InvoicingPage />} />
                  <Route path="/accounts" element={<AccountsPage />} />
                  <Route path="/digest" element={<DigestPage />} />
                  <Route path="/chat" element={<ChatAssistant />} />
                  <Route path="/knowledge" element={<KnowledgeBase />} />
                  <Route path="/insights" element={<KnowledgeInsights />} />
                  <Route path="/intelligence" element={<IntelligenceFeedPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
                <FloatingChatBubble />
                {/* Internal mic widget only if not in overlay mode */}
                {/* <FloatingMicWidget /> */}
              </Layout>
            </>
          } />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;
