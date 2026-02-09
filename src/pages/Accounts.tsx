
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Account, Platform, Folder } from '../types';
import { db } from '../services/database';
import storage, { STORAGE_KEYS } from '../services/electronStore';
import googleAuth, { getAuthUrl, exchangeCodeForTokens, getUserInfo, fetchGmailMessages, fetchCalendarEvents, getRedirectUri } from '../services/connectors/googleAuth';
import { checkNewEmails, checkNewNotifications, checkNewGitHubActivity } from '../services/notificationService';
import { validateResendApiKey, saveResendApiKey, removeResendApiKey } from '../services/connectors/resendConnector';
import BrowserAddonSection from '../components/BrowserAddonSection';
import { 
  PlusIcon, 
  ShieldCheckIcon, 
  TrashIcon, 
  ArrowPathIcon,
  CircleStackIcon,
  BellAlertIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  NoSymbolIcon,
  TagIcon,
  ServerIcon,
  EnvelopeIcon,
  ChartBarIcon,
  FolderIcon,
  FolderPlusIcon,
  ChevronUpDownIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  CheckIcon
} from '@heroicons/react/24/solid';

const BrandLogo = ({ platform, className = "w-6 h-6" }: { platform: Platform, className?: string }) => {
  switch (platform) {
    case 'google':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      );
    case 'google_analytics':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path d="M15.5 13H11V5h4.5v8zm-5 0h-4.5V9H10.5v4zm10 0H16V1h4.5v12zM22 21H2v-2h20v2z" fill="#E37400"/>
        </svg>
      );
    case 'clarity':
      return (
        <svg viewBox="0 0 24 24" className={className}>
           <circle cx="12" cy="12" r="10" fill="#0078D4"/>
           <path d="M12 7v10m-4-5h8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    case 'resend':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M0 4h24v16H0V4zm2 2v1.832l10 5 10-5V6H2zm0 4.062V18h20V10.062L12 15.062l-10-5z"/>
        </svg>
      );
    case 'smtp':
      return <ServerIcon className={className} />;
    case 'outlook':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="#0078d4">
          <path d="M2 3l14-2.5V21l-14-2.5V3zm16 1.5l4 0.5v14l-4 0.5V4.5z"/>
        </svg>
      );
    case 'slack':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.528 2.528 0 0 1 2.522-2.52h2.52v2.52zm1.263 0a2.528 2.528 0 0 1-2.52-2.52h6.313a2.528 2.528 0 0 1 0 5.056H8.826a2.528 2.528 0 0 1-2.521-2.536z" fill="#36C5F0"/>
          <path d="M8.826 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.826 0a2.528 2.528 0 0 1 2.522 2.522v2.52h-2.522zm0 1.263a2.528 2.528 0 0 1 2.522 2.52v6.313a2.528 2.528 0 1 1-5.056 0V8.826a2.528 2.528 0 0 1 2.534-2.521z" fill="#2EB67D"/>
          <path d="M18.958 8.826a2.528 2.528 0 0 1 2.521-2.522A2.528 2.528 0 0 1 24 8.826a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.826zm-1.263 0a2.528 2.528 0 0 1-2.52 2.521H8.862a2.528 2.528 0 1 1 0-5.056h6.313a2.528 2.528 0 0 1 2.52 2.535z" fill="#ECB22E"/>
          <path d="M15.174 18.958a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.174 24a2.528 2.528 0 0 1-2.522-2.522v-2.52h2.522zm0-1.263a2.528 2.528 0 0 1-2.522-2.52V8.862a2.528 2.528 0 1 1 5.056 0v6.313a2.528 2.528 0 0 1-2.534 2.521z" fill="#E01E5A"/>
        </svg>
      );
    case 'whatsapp':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="#25D366">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      );
    default:
      return <TagIcon className={className} />;
  }
};

const DISCOVERY_GROUPS: {
  title: string;
  icon: any;
  items: Record<Platform, { name: string, color: string, desc: string }>;
}[] = [
  {
    title: "Productivity & Social",
    icon: TagIcon,
    items: {
      google: { name: 'Google Workspace', color: 'bg-red-50', desc: 'Syncs Gmail, Drive, and Calendar' },
      outlook: { name: 'Microsoft Outlook', color: 'bg-blue-50', desc: 'Enterprise Email and Calendar' },
      slack: { name: 'Slack', color: 'bg-pink-50', desc: 'Workplace chat and direct messages' },
      facebook: { name: 'Facebook', color: 'bg-indigo-50', desc: 'Social feed events and updates' },
      github: { name: 'GitHub', color: 'bg-slate-50', desc: 'Pull Requests and Issues' },
      whatsapp: { name: 'WhatsApp', color: 'bg-green-50', desc: 'Personal and group messages via QR scan' },
    } as any
  },
  {
    title: "Website Management",
    icon: ChartBarIcon,
    items: {
      google_analytics: { name: 'Google Analytics', color: 'bg-orange-50', desc: 'Live traffic, users, and session metrics' },
      clarity: { name: 'Microsoft Clarity', color: 'bg-blue-50', desc: 'Heatmaps and session recording insights' },
    } as any
  },
  {
    title: "Messaging & APIs",
    icon: ServerIcon,
    items: {
      resend: { name: 'Resend', color: 'bg-slate-50', desc: 'Developer-first email delivery tracking' },
      smtp: { name: 'Custom SMTP/IMAP', color: 'bg-slate-50', desc: 'Direct server connection for custom mailboxes' },
    } as any
  }
];

const StatusBadge = ({ status }: { status: Account['status'] }) => {
  const baseClasses = "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm transition-all cursor-help relative group";
  
  switch (status) {
    case 'connected':
      return (
        <span 
          className={`${baseClasses} bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100`}
          title="Active connection: aether-hub is receiving live data updates from this platform."
        >
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <CheckCircleIcon className="relative inline-flex h-2 w-2 text-emerald-600" />
          </div>
          Active
        </span>
      );
    case 'syncing':
      return (
        <span 
          className={`${baseClasses} bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100`}
          title="Synchronizing: Currently pulling the latest communications and schedule data into local cache."
        >
          <ArrowPathIcon className="w-3 h-3 animate-spin text-sky-500" />
          Syncing
        </span>
      );
    case 'error':
      return (
        <span 
          className={`${baseClasses} bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100`}
          title="Connection Error: Unable to authenticate. This usually means the API key or token has expired."
        >
          <ExclamationTriangleIcon className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
          Error
        </span>
      );
    case 'disconnected':
      return (
        <span 
          className={`${baseClasses} bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200`}
          title="Disconnected: This account is currently inactive. Summaries will only use cached historical data."
        >
          <NoSymbolIcon className="w-3 h-3 text-slate-400" />
          Paused
        </span>
      );
    default:
      return (
        <span className={`${baseClasses} bg-slate-50 text-slate-500 border-slate-100`}>
          Offline
        </span>
      );
  }
};

const AccountsPage: React.FC = () => {
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null);
  const discoveryRef = useRef<HTMLDivElement>(null);
  const [folders, setFolders] = useState<Folder[]>([
    { id: 'f_work', name: 'Work Accounts' },
    { id: 'f_personal', name: 'Personal Projects' }
  ]);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [accountToRemove, setAccountToRemove] = useState<string | null>(null);
  const [copiedUri, setCopiedUri] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [githubToken, setGithubToken] = useState('');
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [resendApiKey, setResendApiKey] = useState('');
  const [showResendApiKey, setShowResendApiKey] = useState(false);
  
  // Disclaimer state
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);
  
  // WhatsApp connection state
  const [whatsappQRCode, setWhatsappQRCode] = useState<string | null>(null);
  const [whatsappAuthState, setWhatsappAuthState] = useState<'disconnected' | 'qr' | 'authenticating' | 'ready' | 'error'>('disconnected');
  const [whatsappError, setWhatsappError] = useState<string | null>(null);

  const REDIRECT_URI = getRedirectUri();

  const [connectedAccounts, setConnectedAccounts] = useState<Account[]>([]);

  // Helper to derive status from account properties
  const deriveStatus = (acc: Account): Account => ({
    ...acc,
    status: acc.status || (acc.isConnected ? 'connected' : 'offline'),
    lastSync: acc.lastSync || 'Never'
  });

  // Load accounts and folders from database on mount
  useEffect(() => {
    const loadData = async () => {
      const savedAccounts = await db.accounts.getAll();
      const savedFolders = await db.folders.getAll();
      
      if (savedAccounts && Array.isArray(savedAccounts)) {
        // Derive status for each account
        setConnectedAccounts(savedAccounts.map(deriveStatus));
      } else {
        // Start with empty accounts - user needs to connect real accounts
        setConnectedAccounts([]);
      }
      
      if (savedFolders && Array.isArray(savedFolders)) {
        setFolders(savedFolders);
      }
    };
    loadData();
  }, []);

  const groupedAccounts = useMemo(() => {
    const groups: Record<string, Account[]> = { uncategorized: [] };
    folders.forEach(f => groups[f.id] = []);
    connectedAccounts.forEach(acc => {
      if (acc.folderId && groups[acc.folderId]) {
        groups[acc.folderId].push(acc);
      } else {
        groups.uncategorized.push(acc);
      }
    });
    return groups;
  }, [folders, connectedAccounts]);

  const scrollToDiscovery = () => discoveryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleAddAccount = (platform: Platform) => setConnectingPlatform(platform);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const newFolder: Folder = { 
      id: `f_${Date.now()}`, 
      name: newFolderName,
      color: '#6366f1',
      accountIds: []
    };
    const newFolders = [...folders, newFolder];
    setFolders(newFolders);
    await db.folders.create(newFolder);
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  const moveAccount = async (accountId: string, folderId: string | undefined) => {
    const updatedAccounts = connectedAccounts.map(acc => 
      acc.id === accountId ? { ...acc, folderId } : acc
    );
    setConnectedAccounts(updatedAccounts);
    
    // Update in database
    const account = updatedAccounts.find(a => a.id === accountId);
    if (account) {
      await db.accounts.upsert(account);
    }
  };

  // Handle OAuth callback from the protocol
  useEffect(() => {
    if (!window.electronAPI?.on?.oauthCallback) return;
    
    const handleOAuthCallback = async (url: string) => {
      console.log('🔵 OAuth callback received:', url);
      
      try {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        const error = urlObj.searchParams.get('error');
        
        if (error) {
          console.error('OAuth error:', error);
          alert(`OAuth failed: ${error}`);
          setConnectingPlatform(null);
          return;
        }
        
        if (!code) {
          console.error('No code in callback');
          return;
        }
        
        console.log('🔵 Exchanging code for tokens...');
        
        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code);
        
        // Get user info
        const userInfo = await getUserInfo();
        console.log('🔵 User info:', userInfo);
        
        if (userInfo) {
          // Create the account
          const newAccount: Account = {
            id: `google_${userInfo.id}`,
            name: userInfo.name || 'Google Account',
            email: userInfo.email,
            platform: 'google',
            category: 'productivity',
            isConnected: true,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            tokenExpiresAt: new Date(tokens.expires_at).toISOString()
          };
          
          // Check if account already exists
          const existingIndex = connectedAccounts.findIndex(a => a.email === userInfo.email);
          let updatedAccounts: Account[];
          
          if (existingIndex >= 0) {
            updatedAccounts = [...connectedAccounts];
            updatedAccounts[existingIndex] = newAccount;
          } else {
            updatedAccounts = [...connectedAccounts, newAccount];
          }
          
          setConnectedAccounts(updatedAccounts);
          
          // Save account to database
          await db.accounts.upsert(newAccount);
          
          // Fetch initial data
          console.log('🔵 Fetching Gmail messages...');
          const gmailMessages = await fetchGmailMessages(tokens.access_token, 100);
          console.log(`🔵 Fetched ${gmailMessages.length} messages`);
          
          // Map to Email model
          const emailsToSave = gmailMessages.map((msg: any) => ({
            id: msg.id,
            accountId: newAccount.id,
            threadId: msg.threadId,
            subject: msg.subject,
            sender: msg.from,
            recipient: msg.to || userInfo.email,
            preview: msg.snippet,
            timestamp: msg.date,
            isRead: !msg.isUnread,
            isImportant: msg.isImportant || false,
            labels: msg.labelIds || [],
            tags: [],
            platform: 'google'
          }));
          
          if (emailsToSave.length > 0) {
            await db.emails.bulkUpsert(emailsToSave);
          }
          
          console.log('🔵 Fetching Calendar events...');
          const calendarEvents = await fetchCalendarEvents(tokens.access_token, 30);
          console.log(`🔵 Fetched ${calendarEvents.length} events`);
          
          // Transform and save events to database
          const eventsToSave = calendarEvents.map((event: any) => ({
            ...event,
            accountId: newAccount.id
          }));
          
          if (eventsToSave.length > 0) {
            await db.events.bulkUpsert(eventsToSave);
          }
        }
        
        setConnectingPlatform(null);
      } catch (err) {
        console.error('OAuth callback error:', err);
        alert(`Failed to connect: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setConnectingPlatform(null);
      }
    };
    
    window.electronAPI.on.oauthCallback(handleOAuthCallback);
    
    return () => {
      window.electronAPI.removeListener.oauthCallback();
    };
  }, [connectedAccounts]);

  // Handle WhatsApp events
  useEffect(() => {
    if (!window.electronAPI?.on?.whatsappQR) return;
    
    // QR Code received - update state for display
    window.electronAPI.on.whatsappQR((qr: string) => {
      console.log('🔵 WhatsApp QR code received');
      setWhatsappQRCode(qr);
      setWhatsappAuthState('qr');
    });
    
    // WhatsApp client ready - create account
    window.electronAPI.on.whatsappReady(async () => {
      console.log('🟢 WhatsApp ready');
      setWhatsappAuthState('ready');
      setWhatsappQRCode(null);
      
      // Get user info and create account
      try {
        const info = await window.electronAPI!.whatsapp.getInfo();
        if (info) {
          const newAccount: Account = {
            id: `whatsapp_${info.number}`,
            name: info.name || 'WhatsApp',
            email: `+${info.number}`,
            platform: 'whatsapp',
            category: 'communication',
            isConnected: true
          };
          
          // Check if already exists
          const existingIndex = connectedAccounts.findIndex(a => a.platform === 'whatsapp');
          let updatedAccounts: Account[];
          
          if (existingIndex >= 0) {
            updatedAccounts = [...connectedAccounts];
            updatedAccounts[existingIndex] = newAccount;
          } else {
            updatedAccounts = [...connectedAccounts, newAccount];
          }
          
          setConnectedAccounts(updatedAccounts);
          await db.accounts.upsert(newAccount);
        }
      } catch (err) {
        console.error('Failed to get WhatsApp info:', err);
      }
      
      setConnectingPlatform(null);
    });
    
    // WhatsApp disconnected
    window.electronAPI.on.whatsappDisconnected((reason: string) => {
      console.log('🟡 WhatsApp disconnected:', reason);
      setWhatsappAuthState('disconnected');
      setWhatsappQRCode(null);
    });
    
    // WhatsApp auth failure
    window.electronAPI.on.whatsappAuthFailure((error: string) => {
      console.error('❌ WhatsApp auth failure:', error);
      setWhatsappAuthState('error');
      setWhatsappError(error);
      setWhatsappQRCode(null);
    });
    
    // WhatsApp message received - save to database
    window.electronAPI.on.whatsappMessage?.(async (message: any) => {
      console.log('📨 WhatsApp message received:', message);
      
      // Find WhatsApp account
      const whatsappAccount = connectedAccounts.find(a => a.platform === 'whatsapp');
      if (!whatsappAccount) {
        console.warn('⚠️ WhatsApp account not found, cannot save message');
        return;
      }
      
      // Save message as notification in database
      try {
        const notification = {
          id: message.id || `whatsapp_${Date.now()}`,
          accountId: whatsappAccount.id,
          type: 'message' as const,
          title: message.chatName || 'WhatsApp Message',
          message: message.body || '',
          timestamp: new Date(message.timestamp * 1000).toISOString(),
          isRead: false,
          priority: 0,
          actionUrl: null
        };
        
        await db.notifications.bulkUpsert([notification]);
        console.log('✅ WhatsApp message saved to database:', notification.id);
      } catch (err) {
        console.error('❌ Failed to save WhatsApp message to database:', err);
      }
    });
    
    return () => {
      window.electronAPI!.removeListener.whatsappQR();
      window.electronAPI!.removeListener.whatsappReady();
      window.electronAPI!.removeListener.whatsappDisconnected();
      window.electronAPI!.removeListener.whatsappAuthFailure();
      if (window.electronAPI!.removeListener.whatsappMessage) {
        window.electronAPI!.removeListener.whatsappMessage();
      }
    };
  }, [connectedAccounts]);

  const confirmConnect = async () => {
    if (!connectingPlatform) return;
    
    // For Google, initiate real OAuth flow
    if (connectingPlatform === 'google') {
      setOauthError(null);
      const authUrl = await getAuthUrl();
      
      if (!authUrl) {
        setOauthError('Google OAuth credentials not configured. Please add Client ID and Secret in Settings → Integrations → Google Cloud.');
        return;
      }
      
      console.log('🔵 Opening Google OAuth URL:', authUrl);
      
      if (window.electronAPI?.oauth?.openExternal) {
        await window.electronAPI.oauth.openExternal(authUrl);
      } else {
        // Fallback for browser
        window.open(authUrl, '_blank');
      }
      // Don't close modal yet - wait for callback
      return;
    }
    
    // For GitHub, save the Personal Access Token
    if (connectingPlatform === 'github') {
      if (!githubToken.trim()) {
        setOauthError('Please enter your GitHub Personal Access Token');
        return;
      }
      
      // Save token to storage
      const existingKeys = await storage.get('aether-hub_keys_github') || {};
      await storage.set('nexus_keys_github', {
        ...existingKeys,
        'Personal Access Token': githubToken.trim()
      });
      
      // Create account entry
      const newAccount: Account = {
        id: `acc_github_${Date.now()}`,
        name: 'GitHub',
        email: 'github.com',
        platform: 'github',
        category: 'development',
        isConnected: true
      };
      const updatedAccounts = [...connectedAccounts, newAccount];
      setConnectedAccounts(updatedAccounts);
      await db.accounts.upsert(newAccount);
      setGithubToken('');
      setConnectingPlatform(null);
      return;
    }
    
    // For Resend, validate and save the API key
    if (connectingPlatform === 'resend') {
      if (!resendApiKey.trim()) {
        setOauthError('Please enter your Resend API Key');
        return;
      }
      
      // Validate the API key
      setOauthError(null);
      const isValid = await validateResendApiKey(resendApiKey.trim());
      if (!isValid) {
        setOauthError('Invalid Resend API key. Please check and try again.');
        return;
      }
      
      // Create account entry
      const accountId = `acc_resend_${Date.now()}`;
      const newAccount: Account = {
        id: accountId,
        name: 'Resend',
        email: 'resend.com',
        platform: 'resend',
        category: 'email',
        isConnected: true
      };
      
      // Save API key for this account
      await saveResendApiKey(accountId, resendApiKey.trim());
      
      const updatedAccounts = [...connectedAccounts, newAccount];
      setConnectedAccounts(updatedAccounts);
      await db.accounts.upsert(newAccount);
      setResendApiKey('');
      setConnectingPlatform(null);
      return;
    }
    
    // For WhatsApp, initialize the client and show QR code
    if (connectingPlatform === 'whatsapp') {
      setOauthError(null);
      setWhatsappError(null);
      setWhatsappAuthState('authenticating');
      
      try {
        console.log('🔵 Initializing WhatsApp client...');
        const result = await window.electronAPI!.whatsapp.initialize();
        
        if (!result.success) {
          setWhatsappError(result.error || 'Failed to initialize WhatsApp');
          setWhatsappAuthState('error');
          setOauthError(result.error || 'Failed to initialize WhatsApp. Make sure Chromium can be started.');
        }
        // QR code will be sent via IPC event, handled in useEffect above
      } catch (err) {
        console.error('WhatsApp initialization error:', err);
        setWhatsappError(err instanceof Error ? err.message : 'Unknown error');
        setWhatsappAuthState('error');
        setOauthError(err instanceof Error ? err.message : 'Failed to initialize WhatsApp');
      }
      // Don't close modal yet - wait for QR scan and ready event
      return;
    }
    
    // For other platforms, save to database
    const newAccount: Account = {
      id: `acc_${Date.now()}`,
      name: `${connectingPlatform.toUpperCase()} Identity`,
      email: `user@${connectingPlatform}.com`,
      platform: connectingPlatform,
      category: 'Other',
      isConnected: true
    };
    const updatedAccounts = [...connectedAccounts, newAccount];
    setConnectedAccounts(updatedAccounts);
    await db.accounts.upsert(newAccount);
    setConnectingPlatform(null);
  };

  const removeAccount = async () => {
    if (accountToRemove) {
      const account = connectedAccounts.find(a => a.id === accountToRemove);
      
      // If it's a Google account, logout and clear ALL associated data
      if (account?.platform === 'google') {
        await googleAuth.logout(); // This removes google_tokens and google_user
        // Also remove all cached data
        await storage.remove('gmail_messages');
        await storage.remove('calendar_events');
        await storage.remove('google_user');
        await storage.remove(storage.KEYS.GOOGLE_TOKENS);
      }
      
      // If it's a GitHub account, clear token and cached data
      if (account?.platform === 'github') {
        await storage.remove('aether-hub_keys_github');
        await storage.remove('github_issues');
        await storage.remove('github_prs');
        await storage.remove('github_repos');
      }
      
      // If it's a WhatsApp account, logout and clear session
      if (account?.platform === 'whatsapp') {
        try {
          await window.electronAPI!.whatsapp.logout();
          setWhatsappAuthState('disconnected');
          setWhatsappQRCode(null);
        } catch (err) {
          console.error('Failed to logout WhatsApp:', err);
        }
      }
      
      // If it's a Resend account, clear API key
      if (account?.platform === 'resend') {
        await removeResendApiKey(account.id);
      }
      
      // TODO: Add cleanup for other platforms when implemented
      // if (account?.platform === 'outlook') { ... }
      // if (account?.platform === 'slack') { ... }
      
      const updatedAccounts = connectedAccounts.filter(a => a.id !== accountToRemove);
      setConnectedAccounts(updatedAccounts);
      await db.accounts.delete(accountToRemove);
      setAccountToRemove(null);
    }
  };

  const handleSync = async (accountId: string) => {
    const account = connectedAccounts.find(a => a.id === accountId);
    if (!account) return;
    
    // Set syncing status
    setConnectedAccounts(prev => prev.map(acc => 
      acc.id === accountId ? { ...acc, status: 'syncing' as const } : acc
    ));
    
    try {
      // For Google accounts, fetch real data
      if (account.platform === 'google') {
        console.log(`🔵 Syncing Google account ${account.email}...`);
        
        // Use the new syncGoogleAccount function which handles multi-account tokens and refresh
        const { syncGoogleAccount } = await import('../services/connectors/googleAuth');
        const { emails: newEmails, events: newEvents } = await syncGoogleAccount(account);
        
        console.log(`🔵 Fetched ${newEmails.length} emails and ${newEvents.length} events`);
        
        // Get existing data from database to preserve AI analysis
        const [existingEmails, existingEvents] = await Promise.all([
          db.emails.getByAccount(accountId),
          db.events.getByAccount(accountId)
        ]);
        
        // Merge and save emails
        const emailsToSave = newEmails.map(email => {
          const existing = existingEmails.find(e => e.id === email.id);
          return existing ? { ...email, ...existing, ...email } : email;
        });
        
        if (emailsToSave.length > 0) {
          await db.emails.bulkUpsert(emailsToSave);
          await checkNewEmails(emailsToSave as any);
        }
        
        // Merge and save events
        const eventsToSave = newEvents.map(event => {
          const existing = existingEvents.find(e => e.id === event.id);
          return existing ? { ...event, ...existing, ...event } : event;
        });
        
        if (eventsToSave.length > 0) {
          await db.events.bulkUpsert(eventsToSave);
        }

        // Update last sync time in database and UI
        const now = new Date().toLocaleTimeString();
        await db.accounts.upsert({ ...account, lastSync: now, status: 'connected' });
        
        setConnectedAccounts(prev => prev.map(acc => 
          acc.id === accountId ? { ...acc, status: 'connected' as const, lastSync: now } : acc
        ));
        
        console.log(`✅ Manual sync complete for ${account.email}`);
        return;
      }
      
      // For Outlook accounts
      if (account.platform === 'outlook') {
        console.log('🔵 Syncing Outlook account...');
        const { syncOutlookAccount } = await import('../services/connectors/outlookAuth');
        const { emails, events } = await syncOutlookAccount(account);
        await db.emails.bulkUpsert(emails as any);
        await db.events.bulkUpsert(events as any);
        
        // Trigger notifications for new emails
        if (emails.length > 0) {
          await checkNewEmails(emails as any);
        }
      }
      
      // For Slack accounts
      if (account.platform === 'slack') {
        console.log('🔵 Syncing Slack account...');
        const { syncSlackAccount } = await import('../services/connectors/slackAuth');
        const { notifications } = await syncSlackAccount(account);
        await db.notifications.bulkUpsert(notifications as any);
        
        // Trigger notifications for new Slack messages
        if (notifications.length > 0) {
          await checkNewNotifications(notifications);
        }
      }
      
      // For GitHub accounts
      if (account.platform === 'github') {
        console.log('🔵 Syncing GitHub account...');
        const { syncGitHubAccount } = await import('../services/connectors/githubConnector');
        const { items } = await syncGitHubAccount(account);
        await db.github.bulkUpsert(items as any);
        
        // Trigger notifications for new GitHub activity
        if (items.length > 0) {
          await checkNewGitHubActivity(items);
        }
      }
      
      const now = new Date().toLocaleTimeString();
      
      // Update account in database with connected status
      await db.accounts.upsert({ ...account, isConnected: true });
      
      // Update UI with connected status and last sync time
      setConnectedAccounts(prev => prev.map(acc => 
        acc.id === accountId ? { ...acc, isConnected: true, status: 'connected' as const, lastSync: now } : acc
      ));
      
      console.log(`✅ Synced ${account.platform} account: ${account.name}`);
    } catch (error) {
      console.error('Sync error:', error);
      
      // Update account in database with error status
      await db.accounts.upsert({ ...account, isConnected: false });
      
      // Update UI with error status
      setConnectedAccounts(prev => prev.map(acc => 
        acc.id === accountId ? { ...acc, isConnected: false, status: 'error' as const } : acc
      ));
    }
  };

  const copyRedirectUri = async () => {
    try {
      if (window.electronAPI?.clipboard) {
        await window.electronAPI.clipboard.writeText(REDIRECT_URI);
      } else {
        await navigator.clipboard.writeText(REDIRECT_URI);
      }
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700 px-10 pt-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Hub Connections</h1>
          <p className="text-slate-500 mt-1">Unified access control for all your digital identities and platforms.</p>
        </div>
        <button 
          onClick={() => setIsCreatingFolder(true)}
          className="flex items-center gap-2 bg-white text-slate-600 px-5 py-2.5 rounded-2xl border border-slate-200 text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors"
        >
          <FolderPlusIcon className="w-5 h-5 text-indigo-500" />
          New Group
        </button>
      </div>

      <section className="space-y-12">
        {folders.map(folder => (
          <div key={folder.id} className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <div className="p-2 bg-indigo-100 rounded-xl">
                <FolderIcon className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">{folder.name}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groupedAccounts[folder.id].map(account => (
                <AccountCard 
                  key={account.id} 
                  account={account} 
                  folders={folders} 
                  onRemove={setAccountToRemove} 
                  onMove={moveAccount}
                  onSync={handleSync}
                />
              ))}
            </div>
          </div>
        ))}

        {groupedAccounts.uncategorized.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <div className="p-2 bg-slate-100 rounded-xl">
                <TagIcon className="w-5 h-5 text-slate-500" />
              </div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Uncategorized</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groupedAccounts.uncategorized.map(account => (
                <AccountCard key={account.id} account={account} folders={folders} onRemove={setAccountToRemove} onMove={moveAccount} onSync={handleSync} />
              ))}
            </div>
          </div>
        )}

        <button 
          onClick={scrollToDiscovery}
          className="w-full border-4 border-dashed border-slate-100 rounded-[2.5rem] p-12 flex flex-col items-center justify-center gap-4 text-slate-300 hover:border-indigo-200 hover:text-indigo-400 hover:bg-indigo-50/10 transition-all group"
        >
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
             <PlusIcon className="w-8 h-8" />
          </div>
          <span className="font-black text-sm">Link New Platform</span>
        </button>
      </section>

      {/* Browser Extension Section */}
      <section className="space-y-6">
        <BrowserAddonSection />
      </section>

      <section className="space-y-12 scroll-mt-20" ref={discoveryRef}>
        <div className="text-center max-w-2xl mx-auto space-y-4">
           <h2 className="text-sm font-black text-indigo-600 uppercase tracking-[0.3em]">Discovery</h2>
           <h3 className="text-4xl font-black text-slate-900 tracking-tight">Expand Your Awareness</h3>
        </div>
        {DISCOVERY_GROUPS.map((group, idx) => (
          <div key={idx} className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <group.icon className="w-5 h-5 text-slate-400" />
              <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">{group.title}</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {(Object.entries(group.items) as [Platform, any][]).map(([id, meta]) => (
                <div key={id} className="bg-white border border-slate-200 rounded-[2.5rem] p-10 flex flex-col justify-between hover:shadow-2xl hover:shadow-indigo-50 transition-all">
                  <div>
                    <div className={`w-20 h-20 ${meta.color} rounded-3xl flex items-center justify-center shadow-inner mb-8`}>
                      <BrandLogo platform={id} className="w-12 h-12" />
                    </div>
                    <h3 className="font-black text-slate-900 text-3xl mb-3 tracking-tight">{meta.name}</h3>
                    <p className="text-slate-500 mb-10 text-sm leading-relaxed">{meta.desc}</p>
                    <button onClick={() => handleAddAccount(id)} className="w-full px-8 py-4 bg-slate-900 text-white rounded-2xl text-sm font-black shadow-xl hover:bg-indigo-600 transition-all">
                      Connect {meta.name}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Confirmation Modal */}
      {accountToRemove && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[70] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 space-y-6 shadow-2xl animate-in zoom-in duration-200 text-center">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto">
              <TrashIcon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Remove Account?</h3>
              <p className="text-sm text-slate-500 mt-2">All local cache and summaries for this identity will be purged.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={removeAccount} className="flex-1 bg-rose-600 text-white font-black py-4 rounded-2xl hover:bg-rose-700 transition-all">Remove</button>
              <button onClick={() => setAccountToRemove(null)} className="flex-1 bg-slate-100 text-slate-500 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all">Keep</button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Creation Modal */}
      {isCreatingFolder && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[70] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 space-y-6 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center">
                <FolderPlusIcon className="w-7 h-7 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Create Folder</h3>
                <p className="text-xs text-slate-400 mt-1">Organize your accounts</p>
              </div>
            </div>
            <input 
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              placeholder="e.g., Client Projects, Finance..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
              autoFocus
            />
            <div className="flex gap-3">
              <button 
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
              <button 
                onClick={() => { setIsCreatingFolder(false); setNewFolderName(''); }}
                className="flex-1 bg-slate-100 text-slate-500 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Loader */}
      {connectingPlatform && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[70] flex items-center justify-center p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 text-center space-y-6 animate-in zoom-in duration-200 shadow-2xl my-8">
            <div className="w-20 h-20 bg-slate-50 rounded-[2rem] mx-auto flex items-center justify-center border border-slate-100 shadow-xl">
              <BrandLogo platform={connectingPlatform} className="w-12 h-12" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Connect {connectingPlatform}</h3>
              <p className="text-sm text-slate-500 px-4 mt-2 leading-relaxed">aethermsaid hub will request read-only access to synchronize metadata for summarization.</p>
            </div>
            
            {/* GitHub Token Setup - Uses Personal Access Token */}
            {connectingPlatform === 'github' && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left space-y-4">
                <div className="flex items-center gap-2">
                  <InformationCircleIcon className="w-5 h-5 text-slate-600" />
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Personal Access Token</h4>
                </div>
                
                <ol className="text-xs text-slate-700 leading-relaxed space-y-2 list-decimal list-inside">
                  <li>Go to <a 
                    href="https://github.com/settings/tokens/new?scopes=repo,read:user"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 underline font-bold hover:text-indigo-700"
                  >
                    GitHub → Settings → Developer Settings → Personal Access Tokens
                  </a></li>
                  <li>Generate a new token (classic) with these scopes:
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5 text-slate-600">
                      <li><code className="bg-white px-1.5 py-0.5 rounded text-xs">repo</code> - Full repository access</li>
                      <li><code className="bg-white px-1.5 py-0.5 rounded text-xs">read:user</code> - Read user profile</li>
                    </ul>
                  </li>
                  <li>Copy and paste your token below</li>
                </ol>
                
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2 block">Personal Access Token</label>
                  <div className="flex items-center gap-2">
                    <input
                      type={showGithubToken ? 'text' : 'password'}
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    />
                    <button
                      onClick={() => setShowGithubToken(!showGithubToken)}
                      className="p-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 transition-all"
                      title={showGithubToken ? 'Hide token' : 'Show token'}
                    >
                      {showGithubToken ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">💡 Your token is stored locally and encrypted. Never share it.</p>
                </div>
              </div>
            )}
            
            {/* Resend API Key Setup */}
            {connectingPlatform === 'resend' && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left space-y-4">
                <div className="flex items-center gap-2">
                  <InformationCircleIcon className="w-5 h-5 text-slate-600" />
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Resend API Key</h4>
                </div>
                
                <ol className="text-xs text-slate-700 leading-relaxed space-y-2 list-decimal list-inside">
                  <li>Go to <a 
                    href="https://resend.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 underline font-bold hover:text-indigo-800"
                  >
                    Resend Dashboard → API Keys
                  </a></li>
                  <li>Click "Create API Key"</li>
                  <li>Give it a name (e.g., "aethermsaid hub")</li>
                  <li>Copy and paste your API key below</li>
                </ol>
                
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2 block">API Key</label>
                  <div className="flex items-center gap-2">
                    <input
                      type={showResendApiKey ? 'text' : 'password'}
                      value={resendApiKey}
                      onChange={(e) => setResendApiKey(e.target.value)}
                      placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    />
                    <button
                      onClick={() => setShowResendApiKey(!showResendApiKey)}
                      className="p-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 transition-all"
                      title={showResendApiKey ? 'Hide key' : 'Show key'}
                    >
                      {showResendApiKey ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">💡 Your API key is stored locally and encrypted. You can connect multiple Resend accounts.</p>
                </div>
              </div>
            )}
            
            {/* OAuth Setup Guide - for Google, Outlook, Slack */}
            {['google', 'outlook', 'slack'].includes(connectingPlatform) && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-left space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="flex items-center gap-2">
                  <InformationCircleIcon className="w-5 h-5 text-amber-600" />
                  <h4 className="text-xs font-black text-amber-900 uppercase tracking-widest">OAuth Setup Required</h4>
                </div>
                
                <ol className="text-xs text-amber-900 leading-relaxed space-y-2 list-decimal list-inside">
                  <li>Go to <a 
                    href={
                      connectingPlatform === 'google' ? 'https://console.cloud.google.com/apis/credentials' :
                      connectingPlatform === 'outlook' ? 'https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade' :
                      'https://api.slack.com/apps'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-700 underline font-bold hover:text-amber-800"
                  >
                    {connectingPlatform === 'google' ? 'Google Cloud Console' :
                     connectingPlatform === 'outlook' ? 'Azure Portal' :
                     'Slack API Dashboard'}
                  </a></li>
                  <li>Create OAuth 2.0 Client ID (or App)</li>
                  {connectingPlatform === 'google' && (
                    <li>Enable required APIs: <a href="https://console.cloud.google.com/apis/library" target="_blank" rel="noopener noreferrer" className="text-amber-700 underline font-bold">API Library</a>
                      <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5 text-amber-800">
                        <li>Gmail API</li>
                        <li>Google Calendar API</li>
                      </ul>
                    </li>
                  )}
                  <li>Add the authorized redirect URI below</li>
                  <li>Copy Client ID and Secret to Settings → Integrations</li>
                </ol>
                
                {/* Required Scopes for Google */}
                {connectingPlatform === 'google' && (
                  <div className="mt-3 pt-3 border-t border-amber-200">
                    <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2 block">Required OAuth Scopes</label>
                    <p className="text-[10px] text-amber-600 mb-2">Add these scopes in OAuth consent screen → Scopes:</p>
                    <div className="bg-white border border-amber-200 rounded-xl p-3 space-y-1">
                      <code className="block text-[11px] font-mono text-slate-700">.../auth/gmail.readonly</code>
                      <code className="block text-[11px] font-mono text-slate-700">.../auth/calendar.readonly</code>
                      <code className="block text-[11px] font-mono text-slate-700">.../auth/userinfo.email</code>
                      <code className="block text-[11px] font-mono text-slate-700">.../auth/userinfo.profile</code>
                    </div>
                    <p className="text-[10px] text-amber-600 mt-2">💡 Add your email as a test user in OAuth consent screen for unverified apps.</p>
                  </div>
                )}
                
                {/* Redirect URI with Copy Button */}
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2 block">Authorized Redirect URI</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white border border-amber-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-800 select-all">
                      {REDIRECT_URI}
                    </code>
                    <button
                      onClick={copyRedirectUri}
                      className={`p-3 rounded-xl border transition-all ${
                        copiedUri 
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-700' 
                          : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-100'
                      }`}
                      title={copiedUri ? 'Copied!' : 'Copy to clipboard'}
                    >
                      {copiedUri ? (
                        <CheckIcon className="w-5 h-5" />
                      ) : (
                        <ClipboardDocumentIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* WhatsApp QR Code Setup */}
            {connectingPlatform === 'whatsapp' && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-left space-y-4">
                <div className="flex items-center gap-2">
                  <InformationCircleIcon className="w-5 h-5 text-green-600" />
                  <h4 className="text-xs font-black text-green-900 uppercase tracking-widest">WhatsApp Web Connection</h4>
                </div>
                
                {whatsappAuthState === 'authenticating' && !whatsappQRCode && (
                  <div className="text-center py-8">
                    <ArrowPathIcon className="w-12 h-12 text-green-500 animate-spin mx-auto" />
                    <p className="text-sm text-green-700 mt-4">Initializing WhatsApp Web...</p>
                    <p className="text-xs text-green-600 mt-2">This may take a moment for the first connection.</p>
                  </div>
                )}
                
                {whatsappAuthState === 'qr' && whatsappQRCode && (
                  <div className="text-center space-y-4">
                    <p className="text-xs text-green-800">Scan this QR code with WhatsApp on your phone:</p>
                    <div className="bg-white rounded-2xl p-4 inline-block mx-auto shadow-lg border border-green-100">
                      <img 
                        src={whatsappQRCode} 
                        alt="WhatsApp QR Code" 
                        className="w-56 h-56 mx-auto"
                      />
                    </div>
                    <ol className="text-xs text-green-700 leading-relaxed space-y-1.5 text-left max-w-xs mx-auto">
                      <li className="flex gap-2"><span className="font-bold">1.</span> Open WhatsApp on your phone</li>
                      <li className="flex gap-2"><span className="font-bold">2.</span> Tap Menu <span className="font-mono bg-white px-1 rounded">⋮</span> or Settings <span className="font-mono bg-white px-1 rounded">⚙</span></li>
                      <li className="flex gap-2"><span className="font-bold">3.</span> Tap Linked Devices → Link a Device</li>
                      <li className="flex gap-2"><span className="font-bold">4.</span> Point your phone at this QR code</li>
                    </ol>
                  </div>
                )}
                
                {whatsappAuthState === 'ready' && (
                  <div className="text-center py-6">
                    <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto" />
                    <p className="text-lg font-bold text-green-700 mt-4">Successfully Connected!</p>
                    <p className="text-sm text-green-600 mt-2">Your WhatsApp messages will now sync with aethermsaid hub.</p>
                  </div>
                )}
                
                {whatsappAuthState === 'error' && (
                  <div className="text-center py-6">
                    <ExclamationCircleIcon className="w-16 h-16 text-red-500 mx-auto" />
                    <p className="text-lg font-bold text-red-700 mt-4">Connection Failed</p>
                    <p className="text-sm text-red-600 mt-2">{whatsappError || 'Failed to initialize WhatsApp Web'}</p>
                    <button
                      onClick={async () => {
                        setWhatsappError(null);
                        setWhatsappAuthState('authenticating');
                        try {
                          await window.electronAPI!.whatsapp.initialize();
                        } catch (err) {
                          setWhatsappError(err instanceof Error ? err.message : 'Unknown error');
                          setWhatsappAuthState('error');
                        }
                      }}
                      className="mt-4 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                )}
                
                <div className="mt-3 pt-3 border-t border-green-200">
                  <div className="flex items-start gap-2 text-[11px] text-green-700">
                    <InformationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p>WhatsApp Web.js runs locally. Your messages stay on your device and are never sent to external servers.</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Disclaimer for Unofficial Integrations */}
            {['whatsapp', 'telegram', 'discord'].includes(connectingPlatform || '') && (
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 text-left space-y-3">
                <div className="flex items-center gap-2">
                  <ExclamationCircleIcon className="w-5 h-5 text-rose-600" />
                  <h4 className="text-xs font-black text-rose-900 uppercase tracking-widest">Safety Disclaimer</h4>
                </div>
                <div className="text-xs text-rose-800 leading-relaxed space-y-2">
                  <p>
                    <span className="font-bold">Important:</span> This integration uses unofficial APIs and browser automation. Usage may violate the platform\'s Terms of Service and could result in account restrictions or permanent bans.
                  </p>
                  <p>
                    aethermsaid hub provides this as a tool for local interoperability. We are not responsible for any actions taken by platforms against your account.
                  </p>
                </div>
                <label className="flex items-center gap-3 p-3 bg-white/50 border border-rose-200 rounded-xl cursor-pointer hover:bg-white transition-all group">
                  <input 
                    type="checkbox" 
                    checked={acceptedDisclaimer}
                    onChange={(e) => setAcceptedDisclaimer(e.target.checked)}
                    className="w-5 h-5 rounded border-rose-300 text-rose-600 focus:ring-rose-500 transition-all cursor-pointer"
                  />
                  <span className="text-xs font-bold text-rose-900 group-hover:text-rose-700 transition-colors">
                    I understand and accept the risks to my account
                  </span>
                </label>
              </div>
            )}

            {/* Quick Setup Guide for non-OAuth */}
            {!['google', 'outlook', 'slack', 'github', 'whatsapp', 'resend'].includes(connectingPlatform) && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 text-left space-y-3">
                <div className="flex items-center gap-2">
                  <InformationCircleIcon className="w-5 h-5 text-indigo-600" />
                  <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest">Quick Setup</h4>
                </div>
                <p className="text-xs text-indigo-900 leading-relaxed whitespace-pre-line">
                  {connectingPlatform === 'google_analytics' && '1. Go to Google Analytics Admin\n2. Copy your Property ID (GA4)\n3. Enter credentials in Settings → Integrations'}
                  {connectingPlatform === 'clarity' && '1. Create Clarity project at clarity.microsoft.com\n2. Copy your Project ID\n3. Enter API key in Settings → Integrations'}
                  {connectingPlatform === 'smtp' && '1. Get SMTP/IMAP credentials from your email provider\n2. Enter host, port, username, and password\n3. Test connection before saving'}
                </p>
              </div>
            )}

            {/* OAuth Error Display */}
            {oauthError && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-left">
                <div className="flex items-start gap-3">
                  <ExclamationCircleIcon className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-rose-900">Connection Error</h4>
                    <p className="text-xs text-rose-700 mt-1">{oauthError}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 pt-2">
              {/* WhatsApp shows different button states */}
              {connectingPlatform === 'whatsapp' ? (
                <>
                  {whatsappAuthState === 'ready' ? (
                    <button 
                      onClick={() => { 
                        setConnectingPlatform(null); 
                        setWhatsappQRCode(null);
                        setWhatsappAuthState('disconnected');
                      }} 
                      className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-green-100 hover:bg-green-700 transition-all"
                    >
                      Done
                    </button>
                  ) : whatsappAuthState === 'qr' ? (
                    <button 
                      onClick={() => { 
                        setConnectingPlatform(null); 
                        setWhatsappQRCode(null);
                        setWhatsappAuthState('disconnected');
                      }} 
                      className="w-full py-4 text-slate-400 font-bold text-sm"
                    >
                      Cancel
                    </button>
                  ) : whatsappAuthState === 'authenticating' ? (
                    <button 
                      onClick={() => { 
                        setConnectingPlatform(null); 
                        setWhatsappQRCode(null);
                        setWhatsappAuthState('disconnected');
                      }} 
                      className="w-full py-4 text-slate-400 font-bold text-sm"
                    >
                      Cancel
                    </button>
                  ) : (
                    <>
                        <button 
                          onClick={confirmConnect} 
                          disabled={!acceptedDisclaimer}
                          className={`w-full font-black py-4 rounded-2xl shadow-xl transition-all ${
                            acceptedDisclaimer 
                              ? 'bg-green-600 text-white shadow-green-100 hover:bg-green-700' 
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                          }`}
                        >
                          Connect WhatsApp
                        </button>
                      <button 
                        onClick={() => { 
                          setConnectingPlatform(null); 
                          setWhatsappError(null);
                          setOauthError(null); 
                        }} 
                        className="w-full py-4 text-slate-400 font-bold text-sm"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <button 
                    onClick={confirmConnect} 
                    disabled={['telegram', 'discord'].includes(connectingPlatform || '') && !acceptedDisclaimer}
                    className={`w-full font-black py-4 rounded-2xl shadow-xl transition-all ${
                      (['telegram', 'discord'].includes(connectingPlatform || '') && !acceptedDisclaimer)
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'
                    }`}
                  >
                    {connectingPlatform === 'github' ? 'Connect GitHub' : 'Authorize Connection'}
                  </button>
                  <button onClick={() => { setConnectingPlatform(null); setGithubToken(''); setOauthError(null); setAcceptedDisclaimer(false); }} className="w-full py-4 text-slate-400 font-bold text-sm">Cancel</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface AccountCardProps {
  account: Account;
  folders: Folder[];
  onRemove: (id: string) => void;
  onMove: (accountId: string, folderId: string | undefined) => void;
  onSync: (accountId: string) => void;
}

const AccountCard: React.FC<AccountCardProps> = ({ account, folders, onRemove, onMove, onSync }) => {
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  return (
    <div className="bg-white border-2 border-slate-100 rounded-[2rem] p-6 shadow-sm hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-50/50 transition-all group relative">
      <div className="flex items-center gap-4 mb-6">
        <div className="relative group/avatar">
          <img src={account.avatarUrl || `https://ui-avatars.com/api/?name=${account.name}&background=random`} className="w-14 h-14 rounded-2xl object-cover transition-transform group-hover/avatar:scale-105" alt="avatar" />
          <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-lg shadow-md transition-transform group-hover/avatar:translate-x-0.5 group-hover/avatar:translate-y-0.5"><BrandLogo platform={account.platform} className="w-4 h-4" /></div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-black text-slate-900 truncate">{account.name}</h4>
            <StatusBadge status={account.status} />
          </div>
          <p className="text-xs text-slate-500 truncate">{account.email}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-6">
        <div className="bg-slate-50 rounded-xl p-3 flex flex-col">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Updates</span>
          <span className="text-sm font-black text-slate-900">4 New</span>
        </div>
        <button 
          onClick={() => onSync(account.id)} 
          disabled={account.status === 'syncing'} 
          className="bg-slate-50 rounded-xl p-3 flex flex-col items-center justify-center hover:bg-indigo-50 transition-colors group/sync disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-4 h-4 text-indigo-400 ${account.status === 'syncing' ? 'animate-spin' : 'group-hover/sync:rotate-180 transition-transform duration-500'}`} />
          <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mt-1">Manual Sync</span>
        </button>
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <ClockIcon className="w-3 h-3" />
          Synced {account.lastSync}
        </span>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowMoveMenu(!showMoveMenu)} 
            className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            title="Move to Folder"
          >
            <ChevronUpDownIcon className="w-5 h-5" />
          </button>
          <button 
            onClick={() => onRemove(account.id)} 
            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
            title="Remove Connection"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
          {showMoveMenu && (
            <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-20 animate-in slide-in-from-bottom-2 duration-200">
              <button onClick={() => { onMove(account.id, undefined); setShowMoveMenu(false); }} className="w-full px-4 py-2.5 text-left text-xs font-bold hover:bg-slate-50 transition-colors">Uncategorized</button>
              {folders.map(f => (
                <button key={f.id} onClick={() => { onMove(account.id, f.id); setShowMoveMenu(false); }} className="w-full px-4 py-2.5 text-left text-xs font-bold hover:bg-slate-50 transition-colors">
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountsPage;
