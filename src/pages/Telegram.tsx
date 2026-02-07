/**
 * Telegram Messages Page
 * 
 * View and respond to Telegram messages
 * Supports AI auto-reply, voice messages, media attachments
 */

import React, { useState, useEffect, useRef } from 'react';
import type { TelegramChat, TelegramMessage } from '../types';
import { callAI } from '../services/geminiService';
import { textToSpeech, arrayBufferToBase64, isElevenLabsEnabled } from '../services/elevenLabsService';
import WatchButton from '../components/WatchButton';
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  UserGroupIcon,
  UserIcon,
  CheckIcon,
  ExclamationCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  Cog6ToothIcon,
  SparklesIcon,
  PlusIcon,
  MicrophoneIcon,
  PhotoIcon,
  DocumentIcon,
  MegaphoneIcon,
  KeyIcon
} from '@heroicons/react/24/outline';

// Telegram brand logo
const TelegramLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="#0088cc">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

// AI Auto-Reply Settings Interface
interface AIAutoReplySettings {
  enabled: boolean;
  guidelines: string;
  triggerKeywords: string[];
  excludeGroups: boolean;
  businessHoursOnly: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
  sendAsVoice: boolean;
}

const defaultAISettings: AIAutoReplySettings = {
  enabled: false,
  sendAsVoice: false,
  guidelines: `You are a professional assistant for a business. Follow these guidelines:

1. Be polite and professional at all times
2. If someone asks about services or pricing, provide general information and offer to schedule a call
3. If someone asks about availability, say you'll check and get back to them
4. For urgent matters, ask them to call directly
5. Always thank them for reaching out

Example responses:
- "Thank you for reaching out! I'd be happy to help. Could you please provide more details about what you're looking for?"
- "Thanks for your interest in our services! Our team will review your inquiry and get back to you within 24 hours."
- "I appreciate your message. For immediate assistance, please call us at [your number]. Otherwise, I'll make sure the right person follows up with you soon."`,
  triggerKeywords: [],
  excludeGroups: true,
  businessHoursOnly: false,
  businessHoursStart: '09:00',
  businessHoursEnd: '18:00'
};

const TelegramPage: React.FC = () => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [authState, setAuthState] = useState<string>('disconnected');
  
  // API credentials state
  const [showApiSetup, setShowApiSetup] = useState(false);
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  
  // Phone auth state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  
  // Chat state
  const [chats, setChats] = useState<TelegramChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<TelegramChat | null>(null);
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // AI Auto-Reply state
  const [showSettings, setShowSettings] = useState(false);
  const [aiSettings, setAISettings] = useState<AIAutoReplySettings>(defaultAISettings);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  
  // Voice & Media state
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Account state
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; phone: string; username: string; isActive: boolean }>>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Refs to access current values in event listeners
  const selectedChatRef = useRef<TelegramChat | null>(null);
  const aiSettingsRef = useRef<AIAutoReplySettings>(defaultAISettings);
  const voiceEnabledRef = useRef(false);
  
  // Keep refs in sync with state
  useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);
  useEffect(() => { aiSettingsRef.current = aiSettings; }, [aiSettings]);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

  // Load AI settings and check voice availability on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Get Telegram account from database
        const account = await window.electronAPI.db.telegram.getConnectedAccount();
        if (account && account.ai_settings) {
          const parsed = JSON.parse(account.ai_settings);
          setAISettings({ ...defaultAISettings, ...parsed });
        }
        const elevenLabsEnabled = await isElevenLabsEnabled();
        setVoiceEnabled(elevenLabsEnabled);
      } catch (err) {
        console.error('Failed to load AI settings:', err);
      }
    };
    loadSettings();
  }, []);

  // Save AI settings when changed
  const saveAISettings = async (newSettings: AIAutoReplySettings) => {
    setAISettings(newSettings);
    try {
      // Get Telegram account from database
      const account = await window.electronAPI.db.telegram.getConnectedAccount();
      if (account) {
        await window.electronAPI.db.telegram.updateAISettings(account.id, JSON.stringify(newSettings));
      }
    } catch (err) {
      console.error('Failed to save AI settings:', err);
    }
  };

  // Check connection status and initialize
  useEffect(() => {
    const checkAndInitialize = async () => {
      if (!window.electronAPI?.telegram) {
        setError('Telegram API not available');
        setIsLoading(false);
        return;
      }

      try {
        // Check if API credentials are configured
        const hasCredentials = await window.electronAPI.telegram.hasApiCredentials();
        if (!hasCredentials) {
          setShowApiSetup(true);
          setIsLoading(false);
          return;
        }

        const ready = await window.electronAPI.telegram.isReady();
        
        if (ready) {
          setIsConnected(true);
          setAuthState('ready');
          setIsLoading(false);
          await loadChats();
          await loadAccountInfo();
          return;
        }

        const sessionExists = await window.electronAPI.telegram.hasSession();

        if (sessionExists) {
          setIsInitializing(true);
          setAuthState('authenticating');
          
          window.electronAPI.telegram.initialize().catch((err: any) => {
            console.error('Failed to initialize Telegram:', err);
            setError('Failed to connect to Telegram');
            setIsInitializing(false);
          });
        } else {
          setAuthState('disconnected');
        }
      } catch (err) {
        console.error('Failed to check Telegram status:', err);
        setError('Failed to check Telegram status');
      }
      
      setIsLoading(false);
    };

    checkAndInitialize();
  }, []);

  // Load account info
  const loadAccountInfo = async () => {
    try {
      const info = await window.electronAPI?.telegram?.getInfo();
      if (info) {
        setAccounts([{
          id: 'default',
          name: info.name || 'Telegram Account',
          phone: info.phone || '',
          username: info.username || '',
          isActive: true
        }]);
      }
    } catch (err) {
      console.error('Failed to load account info:', err);
    }
  };

  // Listen for events
  useEffect(() => {
    if (!window.electronAPI?.on) return;

    if (window.electronAPI.on.telegramReady) {
      window.electronAPI.on.telegramReady(() => {
        console.log('🟢 Telegram ready event received');
        setIsConnected(true);
        setIsInitializing(false);
        setAuthState('ready');
        loadChats();
        loadAccountInfo();
      });
    }

    if (window.electronAPI.on.telegramDisconnected) {
      window.electronAPI.on.telegramDisconnected(() => {
        console.log('🔴 Telegram disconnected event received');
        setIsConnected(false);
        setIsInitializing(false);
        setAuthState('disconnected');
        setChats([]);
        setMessages([]);
        setSelectedChat(null);
        setAccounts([]);
      });
    }

    if (window.electronAPI.on.telegramPhoneNeeded) {
      window.electronAPI.on.telegramPhoneNeeded(() => {
        console.log('📱 Telegram phone needed');
        setAuthState('phone');
        setIsInitializing(false);
      });
    }

    if (window.electronAPI.on.telegramCodeNeeded) {
      window.electronAPI.on.telegramCodeNeeded(() => {
        console.log('🔢 Telegram code needed');
        setAuthState('code');
      });
    }

    if (window.electronAPI.on.telegramPasswordNeeded) {
      window.electronAPI.on.telegramPasswordNeeded(() => {
        console.log('🔐 Telegram 2FA password needed');
        setAuthState('password');
      });
    }

    if (window.electronAPI.on.telegramMessage) {
      window.electronAPI.on.telegramMessage(async (message: TelegramMessage) => {
        console.log('📩 Telegram message received:', message.body?.substring(0, 50));
        
        const currentChat = selectedChatRef.current;
        if (currentChat && message.chatId === currentChat.id) {
          setMessages(prev => [...prev, message]);
        }
        
        // Update chat list
        setChats(prev => {
          const chatExists = prev.some(c => c.id === message.chatId);
          let updatedChats = prev.map(chat => {
            if (chat.id === message.chatId) {
              return {
                ...chat,
                lastMessage: {
                  body: message.body,
                  timestamp: message.timestamp,
                  fromMe: message.isFromMe
                },
                unreadCount: message.isFromMe ? chat.unreadCount : chat.unreadCount + 1,
                timestamp: message.timestamp
              };
            }
            return chat;
          });
          
          if (!chatExists) {
            updatedChats = [...updatedChats, {
              id: message.chatId,
              name: message.chatName || message.fromName || 'Unknown',
              isGroup: false,
              isChannel: false,
              unreadCount: message.isFromMe ? 0 : 1,
              timestamp: message.timestamp,
              lastMessage: {
                body: message.body,
                timestamp: message.timestamp,
                fromMe: message.isFromMe
              }
            }];
          }
          
          return updatedChats.sort((a, b) => b.timestamp - a.timestamp);
        });

        // Handle AI auto-reply
        const currentSettings = aiSettingsRef.current;
        if (!message.isFromMe && currentSettings.enabled) {
          handleAutoReply(message, currentSettings);
        }
      });
    }

    return () => {
      window.electronAPI?.removeListener?.telegramMessage?.();
      window.electronAPI?.removeListener?.telegramReady?.();
      window.electronAPI?.removeListener?.telegramDisconnected?.();
      window.electronAPI?.removeListener?.telegramPhoneNeeded?.();
      window.electronAPI?.removeListener?.telegramCodeNeeded?.();
      window.electronAPI?.removeListener?.telegramPasswordNeeded?.();
    };
  }, []);

  // AI Auto-Reply handler
  const handleAutoReply = async (message: TelegramMessage, settings: AIAutoReplySettings) => {
    if (settings.excludeGroups && message.chatId.startsWith('-')) {
      return;
    }

    if (settings.businessHoursOnly) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      if (currentTime < settings.businessHoursStart || currentTime > settings.businessHoursEnd) {
        return;
      }
    }

    if (settings.triggerKeywords.length > 0) {
      const msgLower = message.body.toLowerCase();
      const hasKeyword = settings.triggerKeywords.some(kw => msgLower.includes(kw.toLowerCase()));
      if (!hasKeyword) {
        return;
      }
    }

    try {
      const prompt = `${settings.guidelines}

---
Incoming message from ${message.fromName}:
"${message.body}"

Generate a helpful, professional response. Keep it concise (1-3 sentences). Only output the response text, nothing else.`;

      const response = await callAI(prompt);
      
      if (response && window.electronAPI?.telegram) {
        const isVoiceEnabled = voiceEnabledRef.current;
        if (settings.sendAsVoice && isVoiceEnabled) {
          try {
            const audioResult = await textToSpeech(response);
            if (audioResult) {
              const base64Audio = arrayBufferToBase64(audioResult.audioBuffer);
              await window.electronAPI.telegram.sendMedia(
                message.chatId,
                base64Audio,
                'audio/mpeg',
                'voice_response.mp3'
              );
            }
          } catch (voiceErr) {
            console.error('Voice generation failed, falling back to text:', voiceErr);
            await window.electronAPI.telegram.sendMessage(message.chatId, response);
          }
        } else {
          await window.electronAPI.telegram.sendMessage(message.chatId, response);
        }
      }
    } catch (err) {
      console.error('AI auto-reply failed:', err);
    }
  };

  // Generate AI reply suggestion
  const generateAIReply = async () => {
    if (!selectedChat || messages.length === 0) return;
    
    setIsGeneratingReply(true);
    try {
      const recentMessages = messages.slice(-10).map(m => 
        `${m.isFromMe ? 'You' : m.fromName}: ${m.body}`
      ).join('\n');

      const prompt = `${aiSettings.guidelines}

---
Recent conversation:
${recentMessages}

Generate a helpful, professional response to continue this conversation. Keep it concise. Only output the response text.`;

      const response = await callAI(prompt);
      if (response) {
        setNewMessage(response);
      }
    } catch (err) {
      console.error('Failed to generate AI reply:', err);
      setError('Failed to generate AI reply');
    }
    setIsGeneratingReply(false);
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChats = async () => {
    try {
      const chatList = await window.electronAPI!.telegram.getChats(50);
      setChats(chatList);
    } catch (err) {
      console.error('Failed to load chats:', err);
      setError('Failed to load chats');
    }
  };

  const loadMessages = async (chat: TelegramChat) => {
    setSelectedChat(chat);
    setMessages([]);
    
    try {
      const chatMessages = await window.electronAPI!.telegram.getChatMessages(chat.id, 50);
      setMessages(chatMessages);
      
      if (chat.unreadCount > 0) {
        await window.electronAPI!.telegram.markAsRead(chat.id);
        setChats(prev => prev.map(c => 
          c.id === chat.id ? { ...c, unreadCount: 0 } : c
        ));
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
      setError('Failed to load messages');
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || !selectedChat || isSending) return;
    
    setIsSending(true);
    try {
      if (selectedFile) {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const mimetype = selectedFile.type;
          const filename = selectedFile.name;
          
          await window.electronAPI!.telegram.sendMedia(
            selectedChat.id,
            base64,
            mimetype,
            filename,
            newMessage.trim() || undefined
          );
          
          const optimisticMessage: TelegramMessage = {
            id: `temp_${Date.now()}`,
            chatId: selectedChat.id,
            chatName: selectedChat.name,
            body: newMessage.trim() ? `📎 ${filename}\n${newMessage}` : `📎 ${filename}`,
            from: 'me',
            fromName: 'You',
            timestamp: Math.floor(Date.now() / 1000),
            isFromMe: true,
            hasMedia: true,
            type: mimetype.startsWith('image/') ? 'image' : 'document'
          };
          setMessages(prev => [...prev, optimisticMessage]);
          setNewMessage('');
          setSelectedFile(null);
          setMediaPreview(null);
          setIsSending(false);
        };
        reader.readAsDataURL(selectedFile);
        return;
      }
      
      await window.electronAPI!.telegram.sendMessage(selectedChat.id, newMessage);
      
      const optimisticMessage: TelegramMessage = {
        id: `temp_${Date.now()}`,
        chatId: selectedChat.id,
        chatName: selectedChat.name,
        body: newMessage,
        from: 'me',
        fromName: 'You',
        timestamp: Math.floor(Date.now() / 1000),
        isFromMe: true,
        hasMedia: false,
        type: 'text'
      };
      setMessages(prev => [...prev, optimisticMessage]);
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message');
    }
    setIsSending(false);
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => setMediaPreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setMediaPreview(null);
      }
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const refreshChats = async () => {
    setIsLoading(true);
    await loadChats();
    setIsLoading(false);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const handleConnect = async () => {
    setIsInitializing(true);
    setError(null);
    
    try {
      const result = await window.electronAPI!.telegram.initialize();
      if (!result.success) {
        setError(result.error || 'Failed to connect');
        setIsInitializing(false);
      }
    } catch (err) {
      console.error('Failed to initialize Telegram:', err);
      setError('Failed to connect to Telegram');
      setIsInitializing(false);
    }
  };

  const handleSaveApiCredentials = async () => {
    if (!apiId || !apiHash) {
      setError('Please enter both API ID and API Hash');
      return;
    }

    try {
      await window.electronAPI!.telegram.setApiCredentials(parseInt(apiId), apiHash);
      setShowApiSetup(false);
      setAuthState('disconnected');
    } catch (err) {
      console.error('Failed to save API credentials:', err);
      setError('Failed to save API credentials');
    }
  };

  const handleSubmitPhone = async () => {
    if (!phoneNumber) return;
    try {
      await window.electronAPI!.telegram.submitPhoneNumber(phoneNumber);
    } catch (err) {
      console.error('Failed to submit phone:', err);
      setError('Failed to submit phone number');
    }
  };

  const handleSubmitCode = async () => {
    if (!verificationCode) return;
    try {
      await window.electronAPI!.telegram.submitCode(verificationCode);
    } catch (err) {
      console.error('Failed to submit code:', err);
      setError('Failed to submit verification code');
    }
  };

  const handleSubmitPassword = async () => {
    if (!twoFactorPassword) return;
    try {
      await window.electronAPI!.telegram.submitPassword(twoFactorPassword);
    } catch (err) {
      console.error('Failed to submit password:', err);
      setError('Failed to submit 2FA password');
    }
  };

  const handleLogout = async () => {
    try {
      await window.electronAPI!.telegram.logout();
      setIsConnected(false);
      setAuthState('disconnected');
      setChats([]);
      setMessages([]);
      setSelectedChat(null);
      setAccounts([]);
    } catch (err) {
      console.error('Failed to logout:', err);
      setError('Failed to logout');
    }
  };

  // Filter chats by search query
  const filteredChats = chats.filter(chat => 
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // API Setup Screen
  if (showApiSetup) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="bg-white rounded-3xl p-10 shadow-xl max-w-md w-full text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <TelegramLogo className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Set Up Telegram API</h2>
          <p className="text-slate-500 mb-6 text-sm">
            To connect your personal Telegram account, you need API credentials from{' '}
            <a 
              href="https://my.telegram.org" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
              onClick={(e) => {
                e.preventDefault();
                window.electronAPI?.oauth?.openExternal('https://my.telegram.org');
              }}
            >
              my.telegram.org
            </a>
          </p>

          <div className="space-y-4 mb-6">
            <div className="text-left">
              <label className="block text-xs font-bold text-slate-500 mb-1">API ID</label>
              <input
                type="text"
                value={apiId}
                onChange={(e) => setApiId(e.target.value)}
                placeholder="123456"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="text-left">
              <label className="block text-xs font-bold text-slate-500 mb-1">API Hash</label>
              <input
                type="password"
                value={apiHash}
                onChange={(e) => setApiHash(e.target.value)}
                placeholder="0123456789abcdef..."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSaveApiCredentials}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all"
          >
            <KeyIcon className="w-5 h-5 inline mr-2" />
            Save Credentials
          </button>

          <p className="mt-4 text-xs text-slate-400">
            Go to my.telegram.org → API Development Tools → Create Application
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 animate-pulse">
          <TelegramLogo className="w-10 h-10" />
        </div>
        <p className="text-slate-500">Loading Telegram...</p>
      </div>
    );
  }

  // Phone number input
  if (authState === 'phone') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="bg-white rounded-3xl p-10 shadow-xl max-w-md w-full text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <TelegramLogo className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Enter Phone Number</h2>
          <p className="text-slate-500 mb-6 text-sm">
            Enter your phone number with country code
          </p>

          <div className="mb-6">
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-center text-xl"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmitPhone}
            disabled={!phoneNumber}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // Verification code input
  if (authState === 'code') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="bg-white rounded-3xl p-10 shadow-xl max-w-md w-full text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <TelegramLogo className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Enter Verification Code</h2>
          <p className="text-slate-500 mb-6 text-sm">
            We sent a code to your Telegram app
          </p>

          <div className="mb-6">
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="12345"
              maxLength={5}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-center text-2xl tracking-widest"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmitCode}
            disabled={!verificationCode}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50"
          >
            Verify
          </button>
        </div>
      </div>
    );
  }

  // 2FA password input
  if (authState === 'password') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="bg-white rounded-3xl p-10 shadow-xl max-w-md w-full text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <TelegramLogo className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Two-Factor Authentication</h2>
          <p className="text-slate-500 mb-6 text-sm">
            Enter your 2FA password
          </p>

          <div className="mb-6">
            <input
              type="password"
              value={twoFactorPassword}
              onChange={(e) => setTwoFactorPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmitPassword}
            disabled={!twoFactorPassword}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // Not connected state
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="bg-white rounded-3xl p-10 shadow-xl max-w-md w-full text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <TelegramLogo className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Connect Telegram</h2>
          <p className="text-slate-500 mb-6">
            Connect your personal Telegram account to view and send messages
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={isInitializing}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-4 px-6 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50"
          >
            {isInitializing ? (
              <>
                <ArrowPathIcon className="w-5 h-5 inline mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <TelegramLogo className="w-5 h-5 inline mr-2" />
                Connect Telegram
              </>
            )}
          </button>

          <button
            onClick={() => setShowApiSetup(true)}
            className="mt-4 text-sm text-slate-500 hover:text-slate-700"
          >
            Change API credentials
          </button>
        </div>
      </div>
    );
  }

  // Connected - Chat Interface
  return (
    <div className="flex h-full bg-white rounded-3xl shadow-sm overflow-hidden">
      {/* Chat List Sidebar */}
      <div className="w-80 border-r border-slate-100 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <TelegramLogo className="w-8 h-8" />
              <div>
                <h2 className="font-bold text-slate-900">Telegram</h2>
                <p className="text-xs text-blue-600">
                  {accounts[0]?.username ? `@${accounts[0].username}` : accounts[0]?.phone || 'Connected'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={refreshChats}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title="Refresh chats"
              >
                <ArrowPathIcon className={`w-5 h-5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title="AI Settings"
              >
                <Cog6ToothIcon className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4">
              <ChatBubbleLeftRightIcon className="w-12 h-12 mb-2" />
              <p className="text-sm">No chats found</p>
            </div>
          ) : (
            filteredChats.map(chat => (
              <div
                key={chat.id}
                className={`w-full p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 ${
                  selectedChat?.id === chat.id ? 'bg-blue-50' : ''
                }`}
              >
                <button
                  onClick={() => loadMessages(chat)}
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                    chat.isChannel ? 'bg-purple-100' : chat.isGroup ? 'bg-blue-100' : 'bg-slate-100'
                  }`}>
                    {chat.isChannel ? (
                      <MegaphoneIcon className="w-5 h-5 text-purple-600" />
                    ) : chat.isGroup ? (
                      <UserGroupIcon className="w-5 h-5 text-blue-600" />
                    ) : (
                      <UserIcon className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-slate-900 truncate">{chat.name}</span>
                      {chat.lastMessage && (
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatTime(chat.lastMessage.timestamp)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-slate-500 truncate flex-1">
                        {chat.lastMessage?.body || 'No messages'}
                      </p>
                      {chat.unreadCount > 0 && (
                        <span className="bg-blue-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                          {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                
                {/* Watch Button */}
                <WatchButton
                  platform="telegram"
                  itemType={chat.isChannel ? 'telegram_channel' : 'telegram_chat'}
                  itemId={chat.id}
                  itemName={chat.name}
                  itemMetadata={{
                    isGroup: chat.isGroup,
                    isChannel: chat.isChannel,
                    unreadCount: chat.unreadCount
                  }}
                  variant="icon"
                  className="shrink-0"
                />
              </div>
            ))
          )}
        </div>

        {/* Logout button */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Chat View */}
      <div className="flex-1 flex flex-col">
        {!selectedChat ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <TelegramLogo className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">Select a chat to start messaging</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedChat.isChannel ? 'bg-purple-100' : selectedChat.isGroup ? 'bg-blue-100' : 'bg-slate-100'
                }`}>
                  {selectedChat.isChannel ? (
                    <MegaphoneIcon className="w-5 h-5 text-purple-600" />
                  ) : selectedChat.isGroup ? (
                    <UserGroupIcon className="w-5 h-5 text-blue-600" />
                  ) : (
                    <UserIcon className="w-5 h-5 text-slate-500" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{selectedChat.name}</h3>
                  <p className="text-xs text-slate-500">
                    {selectedChat.isChannel ? 'Channel' : selectedChat.isGroup ? 'Group' : 'Private Chat'}
                  </p>
                </div>
              </div>
              <button
                onClick={generateAIReply}
                disabled={isGeneratingReply || messages.length === 0}
                className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                <SparklesIcon className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {isGeneratingReply ? 'Generating...' : 'AI Reply'}
                </span>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.isFromMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                      msg.isFromMe
                        ? 'bg-blue-500 text-white rounded-br-sm'
                        : 'bg-white text-slate-900 rounded-bl-sm shadow-sm'
                    }`}
                  >
                    {!msg.isFromMe && selectedChat.isGroup && (
                      <p className="text-xs font-semibold text-blue-600 mb-1">
                        {msg.fromName}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                    <p className={`text-xs mt-1 ${msg.isFromMe ? 'text-blue-100' : 'text-slate-400'}`}>
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Media Preview */}
            {selectedFile && (
              <div className="px-4 py-2 bg-slate-100 border-t border-slate-200">
                <div className="flex items-center space-x-3">
                  {mediaPreview ? (
                    <img src={mediaPreview} className="w-16 h-16 object-cover rounded-lg" alt="Preview" />
                  ) : (
                    <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center">
                      <DocumentIcon className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    onClick={clearSelectedFile}
                    className="p-1 hover:bg-slate-200 rounded-full"
                  >
                    <XMarkIcon className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              </div>
            )}

            {/* Message Input */}
            <div className="p-4 border-t border-slate-100">
              <div className="flex items-center space-x-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <PhotoIcon className="w-5 h-5 text-slate-500" />
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 bg-slate-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={sendMessage}
                  disabled={(!newMessage.trim() && !selectedFile) || isSending}
                  className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {isSending ? (
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  ) : (
                    <PaperAirplaneIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">AI Auto-Reply Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <XMarkIcon className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">Enable Auto-Reply</p>
                  <p className="text-sm text-slate-500">Automatically respond to messages with AI</p>
                </div>
                <button
                  onClick={() => saveAISettings({ ...aiSettings, enabled: !aiSettings.enabled })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    aiSettings.enabled ? 'bg-blue-500' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    aiSettings.enabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Exclude Groups */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">Exclude Groups & Channels</p>
                  <p className="text-sm text-slate-500">Only auto-reply to direct messages</p>
                </div>
                <button
                  onClick={() => saveAISettings({ ...aiSettings, excludeGroups: !aiSettings.excludeGroups })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    aiSettings.excludeGroups ? 'bg-blue-500' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    aiSettings.excludeGroups ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Guidelines */}
              <div>
                <label className="block font-medium text-slate-900 mb-2">
                  Response Guidelines
                </label>
                <textarea
                  value={aiSettings.guidelines}
                  onChange={(e) => saveAISettings({ ...aiSettings, guidelines: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  placeholder="Describe how the AI should respond..."
                />
              </div>

              {/* Business Hours */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">Business Hours Only</p>
                  <p className="text-sm text-slate-500">Only reply during specified hours</p>
                </div>
                <button
                  onClick={() => saveAISettings({ ...aiSettings, businessHoursOnly: !aiSettings.businessHoursOnly })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    aiSettings.businessHoursOnly ? 'bg-blue-500' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    aiSettings.businessHoursOnly ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {aiSettings.businessHoursOnly && (
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <label className="block text-sm text-slate-500 mb-1">Start</label>
                    <input
                      type="time"
                      value={aiSettings.businessHoursStart}
                      onChange={(e) => saveAISettings({ ...aiSettings, businessHoursStart: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm text-slate-500 mb-1">End</label>
                    <input
                      type="time"
                      value={aiSettings.businessHoursEnd}
                      onChange={(e) => saveAISettings({ ...aiSettings, businessHoursEnd: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full mt-6 bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center space-x-3">
          <ExclamationCircleIcon className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default TelegramPage;
