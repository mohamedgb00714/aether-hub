import React, { useState, useEffect } from 'react';
import { 
  ChatBubbleLeftRightIcon, 
  ServerIcon, 
  UserGroupIcon,
  ArrowPathIcon,
  SparklesIcon,
  PlusIcon,
  HashtagIcon,
  KeyIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  XMarkIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import storage from '../services/electronStore';
import { db } from '../services/database';
import type { Account, DiscordMessage, DiscordGuild } from '../types';
import { 
  connectDiscordAccount, 
  syncDiscordData,
  discordMessagesToNotifications
} from '../services/connectors/discordConnector';
import { summarizeNotifications } from '../services/geminiService';
import MarkdownRenderer from '../components/MarkdownRenderer';
import WatchButton from '../components/WatchButton';

// Auth mode type
type AuthMode = 'oauth' | 'token';

// Selfbot user info interface
interface SelfBotUserInfo {
  id: string;
  username: string;
  tag: string;
  avatar: string;
}

// Selfbot channel interface
interface SelfBotChannel {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  parentName: string | null;
  position: number;
  topic?: string | null;
  isThread?: boolean;
  threadMetadata?: {
    archived: boolean;
    locked: boolean;
  } | null;
}

// Selfbot guild interface
interface SelfBotGuild {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  channels: SelfBotChannel[];
  categories?: { id: string; name: string; position: number }[];
}

// Selfbot message interface
interface SelfBotMessage {
  id: string;
  channelId: string;
  channelName: string;
  guildId: string | null;
  guildName: string | null;
  content: string;
  author: string;
  authorId: string;
  authorAvatar: string | null;
  timestamp: number;
  isFromMe: boolean;
  isDM: boolean;
  attachments: string[];
}

// DM Channel interface
interface SelfBotDMChannel {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar: string | null;
  lastMessageId: string | null;
}

export default function DiscordPage() {
  const [discordAccounts, setDiscordAccounts] = useState<Account[]>([]);
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGuild, setSelectedGuild] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  
  // Token auth state
  const [authMode, setAuthMode] = useState<AuthMode>('oauth');
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showTosWarning, setShowTosWarning] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [selfBotReady, setSelfBotReady] = useState(false);
  const [selfBotUser, setSelfBotUser] = useState<SelfBotUserInfo | null>(null);
  const [selfBotGuilds, setSelfBotGuilds] = useState<SelfBotGuild[]>([]);
  const [selfBotMessages, setSelfBotMessages] = useState<SelfBotMessage[]>([]);
  const [selfBotConnecting, setSelfBotConnecting] = useState(false);
  
  // Channel and threading state
  const [selectedChannel, setSelectedChannel] = useState<SelfBotChannel | null>(null);
  const [channelThreads, setChannelThreads] = useState<SelfBotChannel[]>([]);
  const [dmChannels, setDmChannels] = useState<SelfBotDMChannel[]>([]);
  const [fetchingMessages, setFetchingMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Load Discord accounts and data
  useEffect(() => {
    loadDiscordData();
    checkSelfBotStatus();
    
    // Set up selfbot event listeners
    const api = (window as any).electronAPI;
    if (api?.discordSelfBot) {
      api.discordSelfBot.onReady((data: { user: SelfBotUserInfo; guildCount: number }) => {
        setSelfBotReady(true);
        setSelfBotUser(data.user);
        setSelfBotConnecting(false);
      });
      
      api.discordSelfBot.onMessage((message: SelfBotMessage) => {
        setSelfBotMessages(prev => [message, ...prev].slice(0, 100));
      });
      
      api.discordSelfBot.onDisconnected(() => {
        setSelfBotReady(false);
        setSelfBotUser(null);
        setSelfBotGuilds([]);
        setSelfBotMessages([]);
      });
      
      api.discordSelfBot.onError((error: { error: string }) => {
        setError(`Selfbot error: ${error.error}`);
        setSelfBotConnecting(false);
      });
      
      api.discordSelfBot.onSyncComplete((data: { guilds: number; dmChannels: number; messages: number }) => {
        console.log('Sync complete:', data);
        setSyncing(false);
      });
    }
    
    return () => {
      // Cleanup listeners
      if (api?.discordSelfBot?.removeListeners) {
        api.discordSelfBot.removeListeners();
      }
    };
  }, []);
  
  const checkSelfBotStatus = async () => {
    try {
      const api = (window as any).electronAPI;
      if (!api?.discordSelfBot) return;
      
      const isEnabled = await api.discordSelfBot.isEnabled();
      const isReady = await api.discordSelfBot.isReady();
      
      if (isEnabled) {
        setAuthMode('token');
        if (isReady) {
          setSelfBotReady(true);
          const userInfo = await api.discordSelfBot.getUserInfo();
          if (userInfo) setSelfBotUser(userInfo);
          
          // Load guilds
          const guilds = await api.discordSelfBot.getGuilds();
          setSelfBotGuilds(guilds);
        } else {
          // Try auto-connect
          await api.discordSelfBot.autoConnect();
        }
      }
    } catch (err) {
      console.error('Failed to check selfbot status:', err);
    }
  };

  const loadDiscordData = async () => {
    try {
      // Load Discord accounts from database
      const allAccounts = await db.accounts.getAll();
      const discordAccs = allAccounts?.filter(acc => acc.platform === 'discord') || [];
      setDiscordAccounts(discordAccs);

      // Load cached Discord data
      const cachedGuilds = await storage.get('discord_guilds') as DiscordGuild[] | null;
      const cachedMessages = await storage.get('discord_messages') as DiscordMessage[] | null;
      
      if (cachedGuilds) setGuilds(cachedGuilds);
      if (cachedMessages) setMessages(cachedMessages);
    } catch (err) {
      console.error('Failed to load Discord data:', err);
    }
  };

  const handleConnectDiscord = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const account = await connectDiscordAccount();
      
      // Save account to database
      await db.accounts.upsert(account);
      
      // Also save to storage for backward compatibility
      const existingAccounts = await storage.get('connected_accounts') as Account[] | null;
      const updatedAccounts = [...(existingAccounts || []), account];
      await storage.set('connected_accounts', updatedAccounts);
      
      const updatedDiscordAccounts = [...discordAccounts, account];
      setDiscordAccounts(updatedDiscordAccounts);
      
      // Sync data immediately with the new account
      await handleSyncWithAccount(account);
    } catch (err: any) {
      setError(err.message || 'Failed to connect Discord account');
      console.error('Discord connection error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sync with a specific account (used after connecting)
  const handleSyncWithAccount = async (account: Account) => {
    setSyncing(true);
    setError(null);

    try {
      const { guilds: fetchedGuilds, dmMessages } = await syncDiscordData(account);
      
      // Transform messages to include guild/channel info
      const transformedMessages: DiscordMessage[] = dmMessages.map(msg => ({
        id: msg.id,
        channelId: msg.channel_id,
        author: msg.author,
        content: msg.content,
        timestamp: msg.timestamp,
        editedTimestamp: msg.edited_timestamp,
        attachments: msg.attachments,
        embeds: msg.embeds,
        mentions: msg.mentions,
        type: msg.type,
      }));

      // Save to storage
      await storage.set('discord_guilds', fetchedGuilds);
      await storage.set('discord_messages', transformedMessages);
      
      setGuilds(fetchedGuilds);
      setMessages(transformedMessages);
    } catch (err: any) {
      setError(err.message || 'Failed to sync Discord data');
      console.error('Discord sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleSync = async () => {
    if (authMode === 'token' && selfBotReady) {
      // Sync via selfbot
      await handleSelfBotSync();
    } else if (discordAccounts.length === 0) {
      setError('No Discord account connected');
      return;
    } else {
      const account = discordAccounts[0];
      await handleSyncWithAccount(account);
    }
  };

  // Handle selfbot token connection
  const handleTokenConnect = async () => {
    if (!tokenInput.trim()) {
      setError('Please enter your Discord token');
      return;
    }
    
    setSelfBotConnecting(true);
    setError(null);
    
    try {
      const api = (window as any).electronAPI;
      if (!api?.discordSelfBot) {
        throw new Error('Selfbot API not available');
      }
      
      const result = await api.discordSelfBot.initialize(tokenInput.trim());
      
      if (result.success) {
        setShowTokenModal(false);
        setTokenInput('');
        setAuthMode('token');
        
        // Wait a bit then load guilds
        setTimeout(async () => {
          const guilds = await api.discordSelfBot.getGuilds();
          setSelfBotGuilds(guilds);
        }, 1000);
      } else {
        throw new Error(result.error || 'Failed to connect');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect with token');
      setSelfBotConnecting(false);
    }
  };
  
  // Handle selfbot sync
  const handleSelfBotSync = async () => {
    setSyncing(true);
    setError(null);
    
    try {
      const api = (window as any).electronAPI;
      if (!api?.discordSelfBot) {
        throw new Error('Selfbot API not available');
      }
      
      await api.discordSelfBot.syncAll();
      
      // Reload guilds after sync
      const guilds = await api.discordSelfBot.getGuilds();
      setSelfBotGuilds(guilds);
      
      // Load DM channels  
      const dms = await api.discordSelfBot.getDMChannels();
      setDmChannels(dms);
      console.log('DM channels:', dms);
      
    } catch (err: any) {
      setError(err.message || 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  };
  
  // Fetch messages from a specific channel
  const handleFetchChannelMessages = async (channel: SelfBotChannel, isDM: boolean = false) => {
    setFetchingMessages(true);
    setError(null);
    setSelectedChannel(channel);
    setSelfBotMessages([]);
    setChannelThreads([]);
    
    try {
      const api = (window as any).electronAPI;
      if (!api?.discordSelfBot) {
        throw new Error('Selfbot API not available');
      }
      
      // Fetch messages
      const messages = await api.discordSelfBot.fetchMessages(channel.id, 50);
      setSelfBotMessages(messages);
      
      // Fetch threads if not a DM and not already a thread
      if (!isDM && !channel.isThread) {
        const threads = await api.discordSelfBot.getThreads(channel.id);
        setChannelThreads(threads);
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to fetch messages');
    } finally {
      setFetchingMessages(false);
    }
  };
  
  // Load more (older) messages
  const handleLoadMoreMessages = async () => {
    if (selfBotMessages.length === 0 || !selectedChannel) return;
    
    setLoadingMore(true);
    setError(null);
    
    try {
      const api = (window as any).electronAPI;
      if (!api?.discordSelfBot) {
        throw new Error('Selfbot API not available');
      }
      
      // Get the oldest message ID
      const oldestMessage = selfBotMessages.reduce((oldest, msg) => 
        msg.timestamp < oldest.timestamp ? msg : oldest
      , selfBotMessages[0]);
      
      // Fetch older messages
      const olderMessages = await api.discordSelfBot.fetchMessages(
        selectedChannel.id, 
        50, 
        oldestMessage.id
      );
      
      // Append to existing messages (avoid duplicates)
      const existingIds = new Set(selfBotMessages.map(m => m.id));
      const newMessages = olderMessages.filter((m: SelfBotMessage) => !existingIds.has(m.id));
      
      if (newMessages.length > 0) {
        setSelfBotMessages(prev => [...prev, ...newMessages]);
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to load more messages');
    } finally {
      setLoadingMore(false);
    }
  };
  
  // Handle selfbot disconnect
  const handleSelfBotDisconnect = async () => {
    try {
      const api = (window as any).electronAPI;
      if (api?.discordSelfBot) {
        await api.discordSelfBot.disconnect();
      }
      setSelfBotReady(false);
      setSelfBotUser(null);
      setSelfBotGuilds([]);
      setSelfBotMessages([]);
      setSelectedChannel(null);
      setChannelThreads([]);
      setDmChannels([]);
      setAuthMode('oauth');
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  const handleGenerateSummary = async () => {
    if (messages.length === 0) {
      setError('No messages to summarize');
      return;
    }

    setGeneratingSummary(true);
    setError(null);

    try {
      const account = discordAccounts[0];
      const notifications = discordMessagesToNotifications(
        messages.map(m => ({
          id: m.id,
          channel_id: m.channelId,
          author: m.author,
          content: m.content,
          timestamp: m.timestamp,
          edited_timestamp: m.editedTimestamp,
          tts: false,
          mention_everyone: false,
          mentions: m.mentions,
          attachments: m.attachments,
          embeds: m.embeds,
          type: m.type,
        })),
        account.id
      );
      
      const summary = await summarizeNotifications(notifications);
      setAiSummary(summary);
    } catch (err: any) {
      setError(err.message || 'Failed to generate AI summary');
      console.error('AI summary error:', err);
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Filter guilds if one is selected (for future use)
  const _ = selectedGuild
    ? guilds.filter(g => g.id === selectedGuild)
    : guilds;

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 overflow-hidden">
      {/* Token Auth Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            {showTosWarning ? (
              <>
                <div className="flex items-center space-x-3 mb-4">
                  <ShieldExclamationIcon className="w-8 h-8 text-amber-500" />
                  <h2 className="text-xl font-black text-slate-900">Important Warning</h2>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-amber-800 leading-relaxed">
                    <strong>Using a user token violates Discord's Terms of Service.</strong> This could result in your account being suspended or banned. 
                    This feature is provided for users who understand and accept this risk.
                  </p>
                </div>
                <ul className="text-sm text-slate-600 space-y-2 mb-6">
                  <li className="flex items-start space-x-2">
                    <InformationCircleIcon className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                    <span>This is READ-ONLY - we never send messages or take actions</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <InformationCircleIcon className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                    <span>Your token is stored encrypted locally, never sent to any server</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <InformationCircleIcon className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                    <span>Use at your own risk - we're not responsible for any consequences</span>
                  </li>
                </ul>
                <div className="flex space-x-3">
                  <button
                    onClick={() => { setShowTokenModal(false); setShowTosWarning(false); }}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowTosWarning(false)}
                    className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-all"
                  >
                    I Understand, Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <KeyIcon className="w-6 h-6 text-indigo-600" />
                    <h2 className="text-xl font-black text-slate-900">Connect with Token</h2>
                  </div>
                  <button
                    onClick={() => setShowTokenModal(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-all"
                  >
                    <XMarkIcon className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <p className="text-sm text-slate-500 mb-4">
                  Enter your Discord user token to access all messages and DMs.
                </p>
                <div className="mb-4">
                  <label htmlFor="discord-token-input" className="block text-sm font-semibold text-slate-700 mb-2">
                    Discord Token
                  </label>
                  <input
                    id="discord-token-input"
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Enter your Discord token..."
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                </div>
                <details className="mb-4 text-sm">
                  <summary className="cursor-pointer text-indigo-600 font-semibold hover:text-indigo-700">
                    How to get your Discord token
                  </summary>
                  <div className="mt-2 p-3 bg-slate-50 rounded-lg text-slate-600">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Open Discord in your browser</li>
                      <li>Press F12 to open Developer Tools</li>
                      <li>Go to Network tab, filter by "api"</li>
                      <li>Refresh the page</li>
                      <li>Click any request and find "Authorization" header</li>
                      <li>Copy the token value</li>
                    </ol>
                  </div>
                </details>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowTokenModal(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTokenConnect}
                    disabled={selfBotConnecting || !tokenInput.trim()}
                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                  >
                    {selfBotConnecting ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <span>Connect</span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-indigo-100 px-8 py-6 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <ChatBubbleLeftRightIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900">Discord</h1>
              <p className="text-sm text-slate-500 font-medium">
                {discordAccounts.length > 0 
                  ? `${guilds.length} servers • ${messages.length} DM messages`
                  : 'Connect your Discord account to get started'
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {discordAccounts.length > 0 && (
              <>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-all shadow-lg shadow-indigo-200"
                >
                  <ArrowPathIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
                </button>
                
                <button
                  onClick={handleGenerateSummary}
                  disabled={generatingSummary || messages.length === 0}
                  className="px-4 py-2.5 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-all shadow-lg shadow-purple-200"
                >
                  <SparklesIcon className={`w-4 h-4 ${generatingSummary ? 'animate-pulse' : ''}`} />
                  <span>{generatingSummary ? 'Generating...' : 'AI Summary'}</span>
                </button>
              </>
            )}
            
            {discordAccounts.length === 0 && (
              <button
                onClick={handleConnectDiscord}
                disabled={loading}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-sm hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-all shadow-lg"
              >
                <PlusIcon className="w-5 h-5" />
                <span>{loading ? 'Connecting...' : 'Connect Discord'}</span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
            {error}
          </div>
        )}

        {aiSummary && (
          <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl">
            <div className="flex items-start space-x-3">
              <SparklesIcon className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-purple-900 mb-1">AI Summary</h3>
                <MarkdownRenderer content={aiSummary} variant="purple" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8 space-y-6">
          {discordAccounts.length === 0 && !selfBotReady ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-indigo-100 shadow-lg">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <ChatBubbleLeftRightIcon className="w-10 h-10 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-3">Connect Discord</h2>
              <p className="text-slate-500 mb-8 max-w-md mx-auto">
                Connect your Discord account to view your servers, channels, and direct messages.
                Choose your preferred authentication method.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
                {/* OAuth Option */}
                <div className="flex-1 p-4 border-2 border-indigo-100 rounded-xl hover:border-indigo-300 transition-all">
                  <h3 className="font-bold text-slate-900 mb-2">OAuth2 (Recommended)</h3>
                  <p className="text-xs text-slate-500 mb-4">Safe & Official. Servers only, no DM messages.</p>
                  <button
                    onClick={handleConnectDiscord}
                    disabled={loading}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-sm hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                  >
                    <PlusIcon className="w-5 h-5" />
                    <span>{loading ? 'Connecting...' : 'Connect with OAuth'}</span>
                  </button>
                </div>
                
                {/* Token Option */}
                <div className="flex-1 p-4 border-2 border-amber-100 rounded-xl hover:border-amber-300 transition-all bg-amber-50/30">
                  <h3 className="font-bold text-slate-900 mb-2 flex items-center justify-center space-x-1">
                    <span>Token Auth</span>
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">Full access to all messages. TOS risk.</p>
                  <button
                    onClick={() => { setShowTokenModal(true); setShowTosWarning(true); }}
                    className="w-full px-4 py-2.5 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-all flex items-center justify-center space-x-2"
                  >
                    <KeyIcon className="w-5 h-5" />
                    <span>Connect with Token</span>
                  </button>
                </div>
              </div>
            </div>
          ) : selfBotReady ? (
            <>
              {/* Selfbot Connected State */}
              <div className="bg-white rounded-2xl p-6 border border-amber-200 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                      <KeyIcon className="w-7 h-7 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 flex items-center space-x-2">
                        <span>{selfBotUser?.username || 'Discord User'}</span>
                        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">Token Auth</span>
                      </h3>
                      <p className="text-sm text-slate-500">{selfBotUser?.tag || 'Connected via user token'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold">
                      Connected
                    </div>
                    <button
                      onClick={handleSelfBotDisconnect}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200 transition-all"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Main Content Area - Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Servers and Channels */}
                <div className="lg:col-span-1 space-y-4">
                  {/* Selfbot Guilds */}
                  {selfBotGuilds.length > 0 && (
                    <div className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-lg">
                      <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2 mb-3">
                        <ServerIcon className="w-5 h-5 text-indigo-600" />
                        <span>Servers ({selfBotGuilds.length})</span>
                      </h2>
                      
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {selfBotGuilds.map(guild => (
                          <div
                            key={guild.id}
                            className={`w-full p-3 rounded-xl border transition-all text-left flex items-center space-x-3 ${
                              selectedGuild === guild.id 
                                ? 'bg-indigo-100 border-indigo-400' 
                                : 'bg-slate-50 border-slate-100 hover:border-indigo-200 hover:bg-indigo-50'
                            }`}
                          >
                            <button
                              type="button"
                              className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer"
                              onClick={() => {
                                setSelectedGuild(selectedGuild === guild.id ? null : guild.id);
                                setSelectedChannel(null);
                                setSelfBotMessages([]);
                                setChannelThreads([]);
                              }}
                            >
                              {guild.icon ? (
                                <img src={guild.icon} alt={guild.name} className="w-10 h-10 rounded-lg" />
                              ) : (
                                <div className="w-10 h-10 bg-indigo-200 rounded-lg flex items-center justify-center">
                                  <ServerIcon className="w-5 h-5 text-indigo-600" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-sm text-slate-900 truncate">{guild.name}</h3>
                                <p className="text-xs text-slate-500">{guild.channels?.length || 0} channels</p>
                              </div>
                            </button>
                            <WatchButton
                              platform="discord"
                              itemType="discord_server"
                              itemId={guild.id}
                              itemName={guild.name}
                              itemMetadata={{
                                icon: guild.icon,
                                memberCount: guild.memberCount,
                                channelCount: guild.channels?.length || 0
                              }}
                              variant="icon"
                              className="shrink-0"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Channels of Selected Guild */}
                  {selectedGuild && (
                    <div className="bg-white rounded-2xl p-4 border border-purple-100 shadow-lg">
                      <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2 mb-3">
                        <HashtagIcon className="w-5 h-5 text-purple-600" />
                        <span>Channels</span>
                      </h2>
                      
                      <div className="space-y-1 max-h-80 overflow-y-auto">
                        {selfBotGuilds
                          .find(g => g.id === selectedGuild)
                          ?.channels
                          ?.map(channel => {
                            const guild = selfBotGuilds.find(g => g.id === selectedGuild);
                            return (
                              <div
                                key={channel.id}
                                className={`w-full p-2.5 rounded-lg border transition-all text-left flex items-center space-x-2 ${
                                  selectedChannel?.id === channel.id
                                    ? 'bg-purple-100 border-purple-400'
                                    : 'bg-slate-50 border-transparent hover:border-purple-200 hover:bg-purple-50'
                                }`}
                              >
                                <button
                                  type="button"
                                  className="flex items-center space-x-2 flex-1 min-w-0 cursor-pointer"
                                  onClick={() => handleFetchChannelMessages(channel)}
                                  disabled={fetchingMessages}
                                >
                                  <HashtagIcon className="w-4 h-4 text-slate-400 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm text-slate-700 truncate block">{channel.name}</span>
                                    {channel.topic && (
                                      <span className="text-xs text-slate-400 truncate block">{channel.topic}</span>
                                    )}
                                  </div>
                                  {fetchingMessages && selectedChannel?.id === channel.id && (
                                    <ArrowPathIcon className="w-4 h-4 animate-spin text-purple-500" />
                                  )}
                                </button>
                                <WatchButton
                                  platform="discord"
                                  itemType="discord_channel"
                                  itemId={channel.id}
                                  itemName={`#${channel.name}`}
                                  itemMetadata={{
                                    guildId: selectedGuild,
                                    guildName: guild?.name,
                                    topic: channel.topic,
                                    type: channel.type
                                  }}
                                  variant="icon"
                                  className="shrink-0"
                                />
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                  
                  {/* DM Channels */}
                  {dmChannels.length > 0 && (
                    <div className="bg-white rounded-2xl p-4 border border-pink-100 shadow-lg">
                      <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2 mb-3">
                        <ChatBubbleLeftRightIcon className="w-5 h-5 text-pink-600" />
                        <span>Direct Messages ({dmChannels.length})</span>
                      </h2>
                      
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {dmChannels.map(dm => (
                          <button
                            key={dm.id}
                            type="button"
                            className={`w-full p-2.5 rounded-lg border transition-all cursor-pointer text-left flex items-center space-x-2 ${
                              selectedChannel?.id === dm.id
                                ? 'bg-pink-100 border-pink-400'
                                : 'bg-slate-50 border-transparent hover:border-pink-200 hover:bg-pink-50'
                            }`}
                            onClick={() => handleFetchChannelMessages({ 
                              id: dm.id, 
                              name: dm.recipientName, 
                              type: 'DM',
                              parentId: null,
                              parentName: null,
                              position: 0
                            }, true)}
                            disabled={fetchingMessages}
                          >
                            {dm.recipientAvatar ? (
                              <img src={dm.recipientAvatar} alt={dm.recipientName} className="w-8 h-8 rounded-full" />
                            ) : (
                              <div className="w-8 h-8 bg-pink-200 rounded-full flex items-center justify-center">
                                <span className="text-pink-600 font-bold text-xs">
                                  {dm.recipientName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <span className="text-sm text-slate-700 truncate">{dm.recipientName}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Right Column: Messages */}
                <div className="lg:col-span-2">
                  {/* Threads Section */}
                  {channelThreads.length > 0 && (
                    <div className="bg-white rounded-2xl p-4 border border-orange-100 shadow-lg mb-4">
                      <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2 mb-3">
                        <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                        </svg>
                        <span>Threads ({channelThreads.length})</span>
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {channelThreads.map(thread => (
                          <button
                            key={thread.id}
                            type="button"
                            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                              selectedChannel?.id === thread.id
                                ? 'bg-orange-500 text-white'
                                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                            } ${thread.threadMetadata?.archived ? 'opacity-60' : ''}`}
                            onClick={() => handleFetchChannelMessages(thread)}
                          >
                            {thread.name}
                            {thread.threadMetadata?.archived && <span className="ml-1 text-xs">(archived)</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Messages */}
                  {selectedChannel ? (
                    <div className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
                          <HashtagIcon className="w-5 h-5 text-purple-600" />
                          <span>{selectedChannel.name}</span>
                          <span className="text-sm font-normal text-slate-400">({selfBotMessages.length} messages)</span>
                        </h2>
                        <button
                          onClick={() => {
                            setSelectedChannel(null);
                            setSelfBotMessages([]);
                            setChannelThreads([]);
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded-lg transition-all"
                        >
                          <XMarkIcon className="w-5 h-5 text-slate-400" />
                        </button>
                      </div>
                      
                      {fetchingMessages ? (
                        <div className="flex items-center justify-center py-12">
                          <ArrowPathIcon className="w-8 h-8 animate-spin text-indigo-500" />
                          <span className="ml-3 text-slate-500">Loading messages...</span>
                        </div>
                      ) : selfBotMessages.length > 0 ? (
                        <>
                          <div className="space-y-3 max-h-[500px] overflow-y-auto">
                            {selfBotMessages
                              .sort((a, b) => b.timestamp - a.timestamp)
                              .map(msg => (
                                <div
                                  key={msg.id}
                                  className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-purple-200 transition-all"
                                >
                                  <div className="flex items-start justify-between mb-1">
                                    <div className="flex items-center space-x-2">
                                      {msg.authorAvatar ? (
                                        <img src={msg.authorAvatar} alt={msg.author} className="w-7 h-7 rounded-full" />
                                      ) : (
                                        <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center">
                                          <span className="text-purple-600 font-bold text-xs">
                                            {msg.author.charAt(0).toUpperCase()}
                                          </span>
                                        </div>
                                      )}
                                      <p className="font-semibold text-sm text-slate-900">{msg.author}</p>
                                    </div>
                                    <span className="text-xs text-slate-400">
                                      {new Date(msg.timestamp).toLocaleString()}
                                    </span>
                                  </div>
                                  <p className="text-sm text-slate-700 leading-relaxed pl-9">
                                    {msg.content || '(No text content)'}
                                  </p>
                                  {msg.attachments.length > 0 && (
                                    <div className="pl-9 mt-2 flex flex-wrap gap-2">
                                      {msg.attachments.map((url, i) => (
                                        <a 
                                          key={i} 
                                          href={url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-xs text-indigo-600 hover:underline"
                                        >
                                          📎 Attachment {i + 1}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                          
                          {/* Load More Button */}
                          <div className="mt-4 text-center">
                            <button
                              onClick={handleLoadMoreMessages}
                              disabled={loadingMore}
                              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 disabled:opacity-50 transition-all inline-flex items-center space-x-2"
                            >
                              {loadingMore ? (
                                <>
                                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                  <span>Loading...</span>
                                </>
                              ) : (
                                <span>Load Older Messages</span>
                              )}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8 text-slate-400">
                          <ChatBubbleLeftRightIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>No messages in this channel</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl p-12 text-center border border-indigo-100 shadow-lg">
                      <HashtagIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-xl font-black text-slate-900 mb-2">Select a Channel</h3>
                      <p className="text-slate-500">
                        Click on a server, then select a channel to view messages
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {selfBotGuilds.length === 0 && !syncing && (
                <div className="bg-white rounded-2xl p-12 text-center border border-indigo-100 shadow-lg">
                  <HashtagIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-black text-slate-900 mb-2">Ready to Sync</h3>
                  <p className="text-slate-500 mb-6">
                    Click "Sync Now" to fetch your Discord servers and messages
                  </p>
                  <button
                    onClick={handleSelfBotSync}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all inline-flex items-center space-x-2"
                  >
                    <ArrowPathIcon className="w-5 h-5" />
                    <span>Sync Now</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Connected Account Info */}
              <div className="bg-white rounded-2xl p-6 border border-indigo-100 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <CheckCircleIcon className="w-7 h-7 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{discordAccounts[0].name}</h3>
                      <p className="text-sm text-slate-500">{discordAccounts[0].email}</p>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold">
                    Connected
                  </div>
                </div>
              </div>

              {/* Guilds (Servers) */}
              {guilds.length > 0 && (
                <div className="bg-white rounded-2xl p-6 border border-indigo-100 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black text-slate-900 flex items-center space-x-2">
                      <ServerIcon className="w-6 h-6 text-indigo-600" />
                      <span>Your Servers ({guilds.length})</span>
                    </h2>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {guilds.map(guild => (
                      <button
                        key={guild.id}
                        type="button"
                        className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 hover:border-indigo-300 transition-all cursor-pointer hover:shadow-md text-left"
                        onClick={() => setSelectedGuild(selectedGuild === guild.id ? null : guild.id)}
                      >
                        <div className="flex items-start space-x-3">
                          {guild.icon ? (
                            <img
                              src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                              alt={guild.name}
                              className="w-12 h-12 rounded-xl"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-indigo-200 rounded-xl flex items-center justify-center">
                              <ServerIcon className="w-6 h-6 text-indigo-600" />
                            </div>
                          )}
                          <div className="flex-1 overflow-hidden">
                            <h3 className="font-bold text-sm text-slate-900 truncate">
                              {guild.name}
                            </h3>
                            {guild.memberCount && (
                              <p className="text-xs text-slate-500 flex items-center space-x-1 mt-1">
                                <UserGroupIcon className="w-3 h-3" />
                                <span>{guild.memberCount.toLocaleString()}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Direct Messages */}
              {messages.length > 0 && (
                <div className="bg-white rounded-2xl p-6 border border-indigo-100 shadow-lg">
                  <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center space-x-2">
                    <ChatBubbleLeftRightIcon className="w-6 h-6 text-purple-600" />
                    <span>Recent DM Messages ({messages.length})</span>
                  </h2>
                  
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {messages
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .slice(0, 50)
                      .map(msg => (
                        <div
                          key={msg.id}
                          className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-purple-200 transition-all"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              {msg.author.avatar ? (
                                <img
                                  src={`https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`}
                                  alt={msg.author.username}
                                  className="w-8 h-8 rounded-full"
                                />
                              ) : (
                                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                  <span className="text-purple-600 font-bold text-sm">
                                    {msg.author.username.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-sm text-slate-900">
                                  {msg.author.username}
                                  <span className="text-slate-400 font-normal">
                                    #{msg.author.discriminator}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <span className="text-xs text-slate-400">
                              {new Date(msg.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed pl-10">
                            {msg.content || '(No text content)'}
                          </p>
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="pl-10 mt-2">
                              <span className="text-xs text-indigo-600 font-semibold">
                                📎 {msg.attachments.length} attachment(s)
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {guilds.length === 0 && messages.length === 0 && !syncing && (
                <div className="bg-white rounded-2xl p-12 text-center border border-indigo-100 shadow-lg">
                  <HashtagIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-black text-slate-900 mb-2">No Data Yet</h3>
                  <p className="text-slate-500 mb-6">
                    Click "Sync Now" to fetch your Discord servers and messages
                  </p>
                  <button
                    onClick={handleSync}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all inline-flex items-center space-x-2"
                  >
                    <ArrowPathIcon className="w-5 h-5" />
                    <span>Sync Now</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
