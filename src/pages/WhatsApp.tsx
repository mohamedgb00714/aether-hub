/**
 * WhatsApp Messages Page
 * 
 * View and respond to WhatsApp messages
 * Supports AI auto-reply, voice messages, media attachments
 */

import React, { useState, useEffect, useRef } from 'react';
import type { WhatsAppChat, WhatsAppMessage } from '../types';
import { activityLogger } from '../services/activityLogger';
import { callAI } from '../services/geminiService';
import { textToSpeech, arrayBufferToBase64, isElevenLabsEnabled } from '../services/elevenLabsService';
import { handleWhatsAppMessage } from '../services/notificationService';
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
  LinkIcon,
  Cog6ToothIcon,
  SparklesIcon,
  PlusIcon,
  MicrophoneIcon,
  PhotoIcon,
  DocumentIcon
} from '@heroicons/react/24/outline';

// WhatsApp brand logo
const WhatsAppLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="#25D366">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
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
  sendAsVoice: boolean; // Send AI replies as voice messages
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

const WhatsAppPage: React.FC = () => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [authState, setAuthState] = useState<string>('disconnected');
  
  // Chat state
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // QR Code state (for expired sessions)
  const [qrCode, setQrCode] = useState<string | null>(null);
  
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
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; phone: string; isActive: boolean }>>([]);
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Refs to access current values in event listeners (avoid stale closures)
  const selectedChatRef = useRef<WhatsAppChat | null>(null);
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
        // Get WhatsApp accounts from database
        const accounts = await window.electronAPI.db.whatsapp.getAccounts();
        if (accounts && accounts.length > 0) {
          const account = accounts[0]; // Get first account
          if (account.ai_settings) {
            const parsed = JSON.parse(account.ai_settings);
            setAISettings({ ...defaultAISettings, ...parsed });
          }
        }
        // Check if ElevenLabs is enabled
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
      // Get WhatsApp accounts from database
      const accounts = await window.electronAPI.db.whatsapp.getAccounts();
      if (accounts && accounts.length > 0) {
        const account = accounts[0]; // Get first account
        await window.electronAPI.db.whatsapp.updateAISettings(account.id, JSON.stringify(newSettings));
      }
    } catch (err) {
      console.error('Failed to save AI settings:', err);
    }
  };

  // Check connection status and auto-initialize if needed
  useEffect(() => {
    const checkAndInitialize = async () => {
      if (!window.electronAPI?.whatsapp) {
        setError('WhatsApp API not available');
        setIsLoading(false);
        return;
      }

      try {
        const ready = await window.electronAPI.whatsapp.isReady();
        
        if (ready) {
          setIsConnected(true);
          setAuthState('ready');
          setIsLoading(false);
          await loadChats();
          await loadAccountInfo();
          return;
        }

        const sessionExists = await window.electronAPI.whatsapp.hasSession();

        // ONLY auto-initialize if there is a session AND disclaimer (implicit in session)
        // or if manually triggered (handled by button now)
        if (sessionExists && !isInitializing) {
          // We still want to show the disclaimer for new/existing session if not "ready"
          // but we\'ll let the user click "Initialize" if they aren\'t already
        } else {
          setAuthState('disconnected');
        }
      } catch (err) {
        console.error('Failed to check WhatsApp status:', err);
        setError('Failed to check WhatsApp status');
      }
      
      setIsLoading(false);
    };

    checkAndInitialize();
  }, [isInitializing]);

  // Load account info
  const loadAccountInfo = async () => {
    try {
      const info = await window.electronAPI?.whatsapp?.getInfo();
      if (info) {
        setAccounts([{
          id: info.wid || 'default',
          name: info.pushname || 'WhatsApp Account',
          phone: info.me?.user || '',
          isActive: true
        }]);
      }
    } catch (err) {
      console.error('Failed to load account info:', err);
    }
  };

  // Listen for real-time messages and handle AI auto-reply
  // Using refs to avoid stale closures - this effect runs once
  useEffect(() => {
    if (!window.electronAPI?.on) return;

    // Listen for QR code (session expired or new connection)
    if (window.electronAPI.on.whatsappQR) {
      window.electronAPI.on.whatsappQR((qr: string) => {
        console.log('🔵 WhatsApp QR code received - session may have expired');
        setQrCode(qr);
        setAuthState('qr');
        setIsInitializing(false);
      });
    }

    if (window.electronAPI.on.whatsappReady) {
      window.electronAPI.on.whatsappReady(() => {
        console.log('🟢 WhatsApp ready event received');
        setIsConnected(true);
        setIsInitializing(false);
        setAuthState('ready');
        setQrCode(null);
        loadChats();
        loadAccountInfo();
      });
    }

    if (window.electronAPI.on.whatsappDisconnected) {
      window.electronAPI.on.whatsappDisconnected(() => {
        console.log('🔴 WhatsApp disconnected event received');
        setIsConnected(false);
        setIsInitializing(false);
        setAuthState('disconnected');
        setChats([]);
        setMessages([]);
        setSelectedChat(null);
        setAccounts([]);
      });
    }

    if (window.electronAPI.on.whatsappMessage) {
      window.electronAPI.on.whatsappMessage(async (message: WhatsAppMessage) => {
        console.log('📩 WhatsApp message received:', message.body?.substring(0, 50));
        
        // Use ref to get current selected chat (avoids stale closure)
        const currentChat = selectedChatRef.current;
        if (currentChat && message.chatId === currentChat.id) {
          setMessages(prev => [...prev, message]);
        }
        
        // Update chat list - always update regardless of selected chat
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
          
          // If chat doesn't exist in list, add it (new conversation)
          if (!chatExists) {
            updatedChats = [...updatedChats, {
              id: message.chatId,
              name: message.chatName || message.fromName || 'Unknown',
              isGroup: message.chatId.includes('@g.us'),
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

        // Play notification sound for incoming messages
        if (!message.isFromMe) {
          try {
            await handleWhatsAppMessage(message);
          } catch (err) {
            console.error('Notification failed:', err);
          }
        }

        // Handle AI auto-reply for incoming messages (use ref for current settings)
        const currentSettings = aiSettingsRef.current;
        if (!message.isFromMe && currentSettings.enabled) {
          console.log('🤖 AI auto-reply triggered');
          handleAutoReplyWithRefs(message, currentSettings);
        }
      });
    }

    return () => {
      window.electronAPI?.removeListener?.whatsappQR?.();
      window.electronAPI?.removeListener?.whatsappMessage?.();
      window.electronAPI?.removeListener?.whatsappReady?.();
      window.electronAPI?.removeListener?.whatsappDisconnected?.();
    };
  }, []); // Empty deps - runs once, uses refs for current values

  // AI Auto-Reply handler that uses refs for current settings
  const handleAutoReplyWithRefs = async (message: WhatsAppMessage, settings: AIAutoReplySettings) => {
    // Skip group messages if configured
    if (settings.excludeGroups && message.chatId.includes('@g.us')) {
      console.log('⏭️ Skipping group message');
      return;
    }

    // Check business hours if configured
    if (settings.businessHoursOnly) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      if (currentTime < settings.businessHoursStart || currentTime > settings.businessHoursEnd) {
        console.log('⏭️ Outside business hours');
        return;
      }
    }

    // Check trigger keywords if any
    if (settings.triggerKeywords.length > 0) {
      const msgLower = message.body.toLowerCase();
      const hasKeyword = settings.triggerKeywords.some(kw => msgLower.includes(kw.toLowerCase()));
      if (!hasKeyword) {
        console.log('⏭️ No trigger keyword found');
        return;
      }
    }

    try {
      console.log('🤖 Generating AI response...');
      const prompt = `${settings.guidelines}

---
Incoming message from ${message.fromName}:
"${message.body}"

Generate a helpful, professional response. Keep it concise (1-3 sentences). Only output the response text, nothing else.`;

      const response = await callAI(prompt);
      
      if (response && window.electronAPI?.whatsapp) {
        console.log('📤 Sending AI response:', response.substring(0, 50));
        
        // Check if voice response is enabled (use ref)
        const isVoiceEnabled = voiceEnabledRef.current;
        if (settings.sendAsVoice && isVoiceEnabled) {
          try {
            const audioResult = await textToSpeech(response);
            if (audioResult) {
              const base64Audio = arrayBufferToBase64(audioResult.audioBuffer);
              await window.electronAPI.whatsapp.sendMedia(
                message.chatId,
                base64Audio,
                'audio/mpeg',
                'voice_response.mp3',
                undefined,
                true
              );
              console.log('🔊 Voice message sent');
            }
          } catch (voiceErr) {
            console.error('Voice generation failed, falling back to text:', voiceErr);
            await window.electronAPI.whatsapp.sendMessage(message.chatId, response);
          }
        } else {
          await window.electronAPI.whatsapp.sendMessage(message.chatId, response);
          console.log('💬 Text message sent');
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
      const chatList = await window.electronAPI!.whatsapp.getChats(50);
      setChats(chatList);
    } catch (err) {
      console.error('Failed to load chats:', err);
      setError('Failed to load chats');
    }
  };

  const loadMessages = async (chat: WhatsAppChat) => {
    setSelectedChat(chat);
    setMessages([]);
    
    try {
      const chatMessages = await window.electronAPI!.whatsapp.getChatMessages(chat.id, 50);
      // Messages are already sorted by timestamp ascending from backend
      setMessages(chatMessages);
      
      // Log message read activity
      await activityLogger.logMessage(
        'read',
        'whatsapp',
        chat.id,
        {
          chatName: chat.name,
          isGroup: chat.isGroup,
          unreadCount: chat.unreadCount
        }
      );
      
      if (chat.unreadCount > 0) {
        await window.electronAPI!.whatsapp.markAsRead(chat.id);
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
      // If there's a file attached, send as media
      if (selectedFile) {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1]; // Remove data:...;base64, prefix
          const mimetype = selectedFile.type;
          const filename = selectedFile.name;
          
          await window.electronAPI!.whatsapp.sendMedia(
            selectedChat.id,
            base64,
            mimetype,
            filename,
            newMessage.trim() || undefined, // Caption
            false
          );
          
          const optimisticMessage: WhatsAppMessage = {
            id: `temp_${Date.now()}`,
            chatId: selectedChat.id,
            chatName: selectedChat.name,
            body: newMessage.trim() ? `📎 ${filename}\n${newMessage}` : `📎 ${filename}`,
            from: 'me',
            fromName: 'You',
            timestamp: Math.floor(Date.now() / 1000),
            isFromMe: true,
            hasMedia: true,
            type: mimetype.startsWith('image/') ? 'image' : 
                  mimetype.startsWith('video/') ? 'video' : 
                  mimetype.startsWith('audio/') ? 'audio' : 'document'
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
      
      await window.electronAPI!.whatsapp.sendMessage(selectedChat.id, newMessage);
      
      // Log message send activity
      await activityLogger.logMessage(
        'send',
        'whatsapp',
        `msg_${Date.now()}`,
        {
          chatName: selectedChat.name,
          isGroup: selectedChat.isGroup,
          messagePreview: newMessage.substring(0, 100),
          participants: selectedChat.isGroup ? selectedChat.participants : [selectedChat.name]
        }
      );
      
      const optimisticMessage: WhatsAppMessage = {
        id: `temp_${Date.now()}`,
        chatId: selectedChat.id,
        chatName: selectedChat.name,
        body: newMessage,
        from: 'me',
        fromName: 'You',
        timestamp: Math.floor(Date.now() / 1000),
        isFromMe: true,
        hasMedia: false,
        type: 'chat'
      };
      setMessages(prev => [...prev, optimisticMessage]);
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message');
    }
    setIsSending(false);
  };

  // Send AI reply as voice message
  const sendAsVoiceMessage = async () => {
    if (!newMessage.trim() || !selectedChat || isGeneratingVoice) return;
    
    setIsGeneratingVoice(true);
    try {
      const audioResult = await textToSpeech(newMessage);
      if (audioResult) {
        const base64Audio = arrayBufferToBase64(audioResult.audioBuffer);
        await window.electronAPI!.whatsapp.sendMedia(
          selectedChat.id,
          base64Audio,
          'audio/mpeg',
          'voice_message.mp3',
          undefined,
          true // sendAsVoice = true for PTT
        );
        
        const optimisticMessage: WhatsAppMessage = {
          id: `temp_${Date.now()}`,
          chatId: selectedChat.id,
          chatName: selectedChat.name,
          body: '🎤 Voice message',
          from: 'me',
          fromName: 'You',
          timestamp: Math.floor(Date.now() / 1000),
          isFromMe: true,
          hasMedia: true,
          type: 'ptt'
        };
        setMessages(prev => [...prev, optimisticMessage]);
        setNewMessage('');
      }
    } catch (err) {
      console.error('Failed to send voice message:', err);
      setError('Failed to generate voice message');
    }
    setIsGeneratingVoice(false);
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => setMediaPreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setMediaPreview(null);
      }
    }
  };

  // Clear selected file
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

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <ArrowPathIcon className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading WhatsApp...</p>
        </div>
      </div>
    );
  }

  // Initializing/Connecting state
  if (isInitializing || authState === 'authenticating') {
    return (
      <div className="h-full overflow-y-auto p-10 bg-slate-50">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
              <WhatsAppLogo className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">WhatsApp</h1>
              <p className="text-slate-500 mt-1">Connecting to your account...</p>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-10 text-center">
            <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <ArrowPathIcon className="w-12 h-12 text-green-500 animate-spin" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-3">Connecting to WhatsApp</h2>
            <p className="text-slate-500 mb-4 max-w-md mx-auto">
              Please wait while we connect to your WhatsApp account. This may take a moment...
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-medium">Initializing WhatsApp Web...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // QR Code state - session expired or new connection
  if (authState === 'qr' && qrCode) {
    return (
      <div className="h-full overflow-y-auto p-10 bg-slate-50">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
              <WhatsAppLogo className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">WhatsApp</h1>
              <p className="text-slate-500 mt-1">Scan to reconnect</p>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-10 text-center">
            <div className="bg-green-50 rounded-2xl p-2 inline-block mb-6">
              <img 
                src={qrCode} 
                alt="WhatsApp QR Code" 
                className="w-64 h-64 rounded-xl"
              />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-3">Scan QR Code</h2>
            <p className="text-slate-500 mb-4 max-w-md mx-auto">
              Your WhatsApp session has expired. Open WhatsApp on your phone and scan this QR code to reconnect.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-xl">
              <ExclamationCircleIcon className="w-5 h-5" />
              <span>QR code expires in 2 minutes</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not connected state
  if (!isConnected) {
    return (
      <div className="h-full overflow-y-auto p-10 bg-slate-50">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
              <WhatsAppLogo className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">WhatsApp</h1>
              <p className="text-slate-500 mt-1">Connect to view and send messages</p>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-10 text-center space-y-8">
            <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <LinkIcon className="w-12 h-12 text-green-500" />
            </div>
            
            <div>
              <h2 className="text-2xl font-black text-slate-900 mb-3">WhatsApp Not Connected</h2>
              <p className="text-slate-500 max-w-md mx-auto">
                Connect your WhatsApp account to view and send messages from aethermsaid hub.
              </p>
            </div>

            {/* Disclaimer for Unofficial Integrations */}
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 text-left space-y-4 max-w-md mx-auto">
              <div className="flex items-center gap-2">
                <ExclamationCircleIcon className="w-5 h-5 text-rose-600" />
                <h4 className="text-xs font-black text-rose-900 uppercase tracking-widest">Safety Disclaimer</h4>
              </div>
              <div className="text-xs text-rose-800 leading-relaxed space-y-2">
                <p>
                   This integration uses an unofficial API (whatsapp-web.js) which technically violates WhatsApp\'s Terms of Service.
                </p>
                <p>
                  While many use it safely, there is always a <span className="font-bold underline">risk of your account being banned</span> or restricted by Meta. Use this feature at your own discretion.
                </p>
              </div>
              <label className="flex items-center gap-3 p-3 bg-white/70 border border-rose-200 rounded-xl cursor-pointer hover:bg-white transition-all group">
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

            <div className="pt-4">
              <a 
                href="#/accounts" 
                className={`inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-black transition-all shadow-lg ${
                  acceptedDisclaimer 
                    ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-100' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none pointer-events-none'
                }`}
              >
                <WhatsAppLogo className="w-5 h-5" />
                Go to Accounts to Connect
              </a>
              {!acceptedDisclaimer && (
                <p className="text-[10px] text-slate-400 mt-3 italic">Please accept the disclaimer to proceed</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-slate-50">
      {/* Chat List Sidebar - Fixed full height with scroll */}
      <div className="w-80 lg:w-96 bg-white border-r border-slate-100 flex flex-col h-full">
        {/* Header - Fixed */}
        <div className="p-4 border-b border-slate-100 shrink-0">
          {/* Account Info */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <WhatsAppLogo className="w-6 h-6" />
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900">
                  {accounts[0]?.name || 'WhatsApp'}
                </p>
                {accounts[0]?.phone && (
                  <p className="text-[10px] text-slate-400">+{accounts[0].phone}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                title="AI Settings"
              >
                <Cog6ToothIcon className="w-5 h-5 text-slate-400" />
              </button>
              <button
                onClick={refreshChats}
                disabled={isLoading}
                className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                title="Refresh chats"
              >
                <ArrowPathIcon className={`w-5 h-5 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* AI Status Indicator */}
          {aiSettings.enabled && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl mb-3">
              <SparklesIcon className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-green-700">AI Auto-Reply Active</span>
            </div>
          )}
          
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-400 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                title="Clear search"
              >
                <XMarkIcon className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        {/* Chat List - Scrollable with flex-1 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4">
              <ChatBubbleLeftRightIcon className="w-12 h-12 mb-3" />
              <p className="text-sm font-medium">
                {searchQuery ? 'No chats found' : 'No chats yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filteredChats.map(chat => (
                <div
                  key={chat.id}
                  className={`w-full p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors ${
                    selectedChat?.id === chat.id ? 'bg-green-50' : ''
                  }`}
                >
                  <button
                    onClick={() => loadMessages(chat)}
                    className="flex-1 flex items-center gap-3 text-left"
                  >
                    {/* Avatar */}
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                      chat.isGroup ? 'bg-indigo-100' : 'bg-green-100'
                    }`}>
                      {chat.isGroup ? (
                        <UserGroupIcon className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <UserIcon className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-sm text-slate-900 truncate">{chat.name}</h3>
                        {chat.lastMessage && (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {formatTime(chat.lastMessage.timestamp)}
                          </span>
                        )}
                      </div>
                      {chat.lastMessage && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {chat.lastMessage.fromMe && (
                            <CheckIcon className="w-3 h-3 inline mr-1 text-slate-400" />
                          )}
                          {chat.lastMessage.body || '📎 Media'}
                        </p>
                      )}
                    </div>
                    
                    {/* Unread Badge */}
                    {chat.unreadCount > 0 && (
                      <span className="bg-green-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                        {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
                      </span>
                    )}
                  </button>
                  
                  {/* Watch Button */}
                  <WatchButton
                    platform="whatsapp"
                    itemType="whatsapp_chat"
                    itemId={chat.id}
                    itemName={chat.name}
                    itemMetadata={{
                      isGroup: chat.isGroup,
                      unreadCount: chat.unreadCount
                    }}
                    variant="icon"
                    className="shrink-0"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Account Button - Fixed at bottom */}
        <div className="p-3 border-t border-slate-100 shrink-0">
          <a
            href="#/accounts"
            className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Manage WhatsApp
          </a>
        </div>
      </div>

      {/* Message Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {selectedChat ? (
          <>
            {/* Chat Header - Fixed */}
            <div className="h-16 bg-white border-b border-slate-100 flex items-center px-4 gap-3 shrink-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                selectedChat.isGroup ? 'bg-indigo-100' : 'bg-green-100'
              }`}>
                {selectedChat.isGroup ? (
                  <UserGroupIcon className="w-5 h-5 text-indigo-600" />
                ) : (
                  <UserIcon className="w-5 h-5 text-green-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 truncate">{selectedChat.name}</h3>
                <p className="text-[10px] text-slate-400">
                  {selectedChat.isGroup ? 'Group Chat' : 'Private Chat'}
                </p>
              </div>
            </div>

            {/* Messages - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-slate-400">
                    <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm">Loading messages...</p>
                  </div>
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.isFromMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        msg.isFromMe
                          ? 'bg-green-500 text-white rounded-br-md'
                          : 'bg-white text-slate-900 rounded-bl-md shadow-sm border border-slate-100'
                      }`}
                    >
                      {!msg.isFromMe && selectedChat.isGroup && (
                        <p className="text-[10px] font-bold mb-1 text-green-600">
                          {msg.fromName}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                      <p className={`text-[9px] mt-1 ${
                        msg.isFromMe ? 'text-green-100' : 'text-slate-400'
                      }`}>
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input - Fixed */}
            <div className="p-3 bg-white border-t border-slate-100 shrink-0">
              {/* Media Preview */}
              {selectedFile && (
                <div className="mb-2 p-2 bg-slate-50 rounded-xl flex items-center gap-3">
                  {mediaPreview ? (
                    <img src={mediaPreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg" />
                  ) : (
                    <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center">
                      <DocumentIcon className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    onClick={clearSelectedFile}
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400"
                    title="Remove file"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                {/* AI Reply Button */}
                <button
                  onClick={generateAIReply}
                  disabled={isGeneratingReply || messages.length === 0}
                  className={`p-2.5 rounded-xl transition-all shrink-0 ${
                    isGeneratingReply 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-slate-100 text-slate-500 hover:bg-green-50 hover:text-green-600'
                  }`}
                  title="Generate AI Reply"
                >
                  {isGeneratingReply ? (
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  ) : (
                    <SparklesIcon className="w-5 h-5" />
                  )}
                </button>
                
                {/* Attach Media Button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  onChange={handleFileSelect}
                  className="hidden"
                  title="Select file to attach"
                  aria-label="File attachment input"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-all shrink-0"
                  title="Attach Media"
                >
                  <PhotoIcon className="w-5 h-5" />
                </button>
                
                {/* Message Input */}
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={selectedFile ? "Add a caption..." : "Type a message..."}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-400 outline-none"
                />
                
                {/* Voice Message Button (only if ElevenLabs enabled) */}
                {voiceEnabled && newMessage.trim() && (
                  <button
                    onClick={sendAsVoiceMessage}
                    disabled={isGeneratingVoice || !newMessage.trim()}
                    className={`p-2.5 rounded-xl transition-all shrink-0 ${
                      isGeneratingVoice 
                        ? 'bg-violet-100 text-violet-600' 
                        : 'bg-violet-500 text-white hover:bg-violet-600'
                    }`}
                    title="Send as Voice Message"
                  >
                    {isGeneratingVoice ? (
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    ) : (
                      <MicrophoneIcon className="w-5 h-5" />
                    )}
                  </button>
                )}
                
                {/* Send Button */}
                <button
                  onClick={sendMessage}
                  disabled={(!newMessage.trim() && !selectedFile) || isSending}
                  className={`p-2.5 rounded-xl transition-all shrink-0 ${
                    (newMessage.trim() || selectedFile) && !isSending
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-slate-100 text-slate-400'
                  }`}
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
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <ChatBubbleLeftRightIcon className="w-10 h-10 text-green-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-400 mb-1">Select a chat</h3>
              <p className="text-slate-400 text-sm">Choose a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* AI Settings Modal */}
      {showSettings && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowSettings(false)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <SparklesIcon className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">AI Auto-Reply Settings</h2>
                  <p className="text-sm text-slate-500">Configure automatic responses</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-2 rounded-xl hover:bg-slate-100"
                title="Close settings"
              >
                <XMarkIcon className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div>
                  <h3 className="font-bold text-slate-900">Enable AI Auto-Reply</h3>
                  <p className="text-sm text-slate-500">Automatically respond to incoming messages</p>
                </div>
                <button
                  onClick={() => saveAISettings({ ...aiSettings, enabled: !aiSettings.enabled })}
                  title={aiSettings.enabled ? 'Disable AI Auto-Reply' : 'Enable AI Auto-Reply'}
                  className={`w-14 h-7 rounded-full transition-colors ${
                    aiSettings.enabled ? 'bg-green-500' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-1 ${
                    aiSettings.enabled ? 'translate-x-7' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Guidelines */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Response Guidelines
                </label>
                <textarea
                  value={aiSettings.guidelines}
                  onChange={(e) => saveAISettings({ ...aiSettings, guidelines: e.target.value })}
                  className="w-full h-48 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-400 outline-none resize-none"
                  placeholder="Enter guidelines for AI responses..."
                />
                <p className="text-xs text-slate-400 mt-2">
                  Describe how the AI should respond. Include example responses and any rules to follow.
                </p>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiSettings.excludeGroups}
                    onChange={(e) => saveAISettings({ ...aiSettings, excludeGroups: e.target.checked })}
                    className="w-4 h-4 text-green-500 rounded focus:ring-green-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Exclude Group Chats</p>
                    <p className="text-xs text-slate-400">Only auto-reply to private messages</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiSettings.businessHoursOnly}
                    onChange={(e) => saveAISettings({ ...aiSettings, businessHoursOnly: e.target.checked })}
                    className="w-4 h-4 text-green-500 rounded focus:ring-green-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">Business Hours Only</p>
                    <p className="text-xs text-slate-400">Only auto-reply during specified hours</p>
                  </div>
                </label>

                {aiSettings.businessHoursOnly && (
                  <div className="flex items-center gap-3 pl-7">
                    <input
                      type="time"
                      value={aiSettings.businessHoursStart}
                      onChange={(e) => saveAISettings({ ...aiSettings, businessHoursStart: e.target.value })}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                      title="Business hours start time"
                      aria-label="Start time"
                    />
                    <span className="text-slate-400">to</span>
                    <input
                      type="time"
                      value={aiSettings.businessHoursEnd}
                      onChange={(e) => saveAISettings({ ...aiSettings, businessHoursEnd: e.target.value })}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                      title="Business hours end time"
                      aria-label="End time"
                    />
                  </div>
                )}

                {/* Voice Response Toggle */}
                {voiceEnabled && (
                  <label className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiSettings.sendAsVoice}
                      onChange={(e) => saveAISettings({ ...aiSettings, sendAsVoice: e.target.checked })}
                      className="w-4 h-4 text-violet-500 rounded focus:ring-violet-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-violet-700">Send as Voice Message</p>
                      <p className="text-xs text-violet-500">AI responses will be sent as voice messages using ElevenLabs</p>
                    </div>
                    <MicrophoneIcon className="w-5 h-5 text-violet-500" />
                  </label>
                )}
                
                {!voiceEnabled && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-500">
                      <MicrophoneIcon className="w-5 h-5" />
                      <div>
                        <p className="text-sm font-medium">Voice Responses Disabled</p>
                        <p className="text-xs text-slate-400">Enable ElevenLabs in Settings → AI Engine to send voice messages</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Trigger Keywords */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Trigger Keywords (Optional)
                </label>
                <input
                  type="text"
                  value={aiSettings.triggerKeywords.join(', ')}
                  onChange={(e) => saveAISettings({ 
                    ...aiSettings, 
                    triggerKeywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean)
                  })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-400 outline-none"
                  placeholder="price, quote, availability, booking..."
                />
                <p className="text-xs text-slate-400 mt-2">
                  Comma-separated keywords. If set, AI only replies when messages contain these words. Leave empty to reply to all.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-6 right-6 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-lg flex items-center gap-3 z-50">
          <ExclamationCircleIcon className="w-5 h-5" />
          <span className="font-medium">{error}</span>
          <button onClick={() => setError(null)} title="Dismiss error">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default WhatsAppPage;
