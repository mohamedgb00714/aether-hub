import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getChatResponse } from '../services/langchainService';
import { db } from '../services/database';
import storage, { STORAGE_KEYS } from '../services/electronStore';
import { 
  PaperAirplaneIcon, 
  SparklesIcon, 
  TrashIcon, 
  PlusIcon,
  ChatBubbleLeftRightIcon,
  FunnelIcon,
  XMarkIcon
} from '@heroicons/react/24/solid';

interface ChatSession {
  id: string;
  title: string;
  accountIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
  toolsUsed?: string[]; // Add tools used tracking
  reasoning?: string[]; // Add reasoning steps
  createdAt: string;
}

interface Account {
  id: string;
  name: string;
  email: string;
  platform: string;
}

const ChatAssistant: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [showAccountFilter, setShowAccountFilter] = useState(false);
  const [showSessions, setShowSessions] = useState(true);
  const [assistantName, setAssistantName] = useState('Atlas');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load sessions and accounts on mount
  useEffect(() => {
    loadSessions();
    loadAccounts();
    loadAssistantName();
  }, []);

  const loadAssistantName = async () => {
    const name = await storage.get(STORAGE_KEYS.ASSISTANT_NAME);
    if (name) {
      setAssistantName(name);
    }
  };

  // Load messages when session changes
  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId);
    }
  }, [currentSessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadSessions = async () => {
    const dbSessions = await db.chatSessions.getAll();
    const transformedSessions: ChatSession[] = dbSessions.map(s => ({
      id: s.id,
      title: s.title,
      accountIds: s.account_ids ? JSON.parse(s.account_ids) : [],
      createdAt: s.created_at,
      updatedAt: s.updated_at
    }));
    setSessions(transformedSessions);

    // If no sessions, create a default one
    if (transformedSessions.length === 0) {
      await createNewSession();
    } else if (!currentSessionId) {
      setCurrentSessionId(transformedSessions[0].id);
    }
  };

  const loadAccounts = async () => {
    const dbAccounts = await db.accounts.getAll();
    setAccounts(dbAccounts);
  };

  const loadMessages = async (sessionId: string) => {
    const dbMessages = await db.chatMessages.getBySession(sessionId);
    const transformedMessages: ChatMessage[] = dbMessages.map(m => ({
      id: m.id,
      sessionId: m.session_id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      sources: m.sources ? JSON.parse(m.sources) : undefined,
      createdAt: m.created_at,
      toolsUsed: m.tools_used ? JSON.parse(m.tools_used) : [],
      reasoning: m.reasoning ? JSON.parse(m.reasoning) : []
    }));
    setMessages(transformedMessages);

    // Load session's account filter
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setSelectedAccountIds(session.accountIds);
    }
  };

  const createNewSession = async () => {
    const newSessionId = `session_${Date.now()}`;
    const newSession = {
      id: newSessionId,
      title: 'New Conversation',
      accountIds: []
    };

    await db.chatSessions.create(newSession);
    
    // Add welcome message
    const welcomeMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: newSessionId,
      role: 'assistant' as const,
      content: `Hello! I'm **${assistantName}**, your intelligent personal assistant with complete access to all your connected accounts and data. How can I help you today?\n\n**What I can do:**\n- 🔍 Search across all your communications (emails, WhatsApp, Discord)\n- 📅 Manage your calendar and upcoming events\n- 💬 Access your message history from all platforms\n- 📊 Provide statistics and insights across your data\n- 🎯 Filter by specific accounts or search everything at once\n\nJust ask me anything!`,
      sources: undefined
    };

    await db.chatMessages.create(welcomeMessage);
    
    await loadSessions();
    setCurrentSessionId(newSessionId);
    if (!showSessions) setShowSessions(true);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !currentSessionId) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: currentSessionId,
      role: 'user',
      content: input,
      createdAt: new Date().toISOString()
    };

    const currentInput = input;
    setInput('');
    setIsLoading(true);

    // Save user message to database
    await db.chatMessages.create(userMessage);
    setMessages(prev => [...prev, userMessage]);

    // Update session title if it's the first message
    const session = sessions.find(s => s.id === currentSessionId);
    if (session && session.title === 'New Conversation') {
      const newTitle = currentInput.slice(0, 50) + (currentInput.length > 50 ? '...' : '');
      await db.chatSessions.update(currentSessionId, { title: newTitle });
      await loadSessions();
    }

    // Get AI response with account context
    const conversationHistory = messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    const response = await getChatResponse(currentInput, conversationHistory, selectedAccountIds);

    const assistantMessage: ChatMessage = {
      id: `msg_${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: currentSessionId,
      role: 'assistant',
      content: response.text,
      sources: response.sources,
      createdAt: new Date().toISOString(),
      toolsUsed: response.toolsUsed, // Add tools used
      reasoning: response.reasoning // Add reasoning steps
    };

    // Save assistant message to database
    await db.chatMessages.create(assistantMessage);
    setMessages(prev => [...prev, assistantMessage]);
    
    setIsLoading(false);
  };

  const deleteSession = async (sessionId: string) => {
    await db.chatSessions.delete(sessionId);
    await loadSessions();
    
    if (currentSessionId === sessionId) {
      setCurrentSessionId(sessions.length > 1 ? sessions[0].id : null);
    }
  };

  const updateSessionFilter = async () => {
    if (!currentSessionId) return;
    await db.chatSessions.update(currentSessionId, { accountIds: selectedAccountIds });
    await loadSessions();
    setShowAccountFilter(false);
  };

  const toggleAccount = (accountId: string) => {
    setSelectedAccountIds(prev => 
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      google: '📧',
      github: '🐙',
      whatsapp: '💬',
      slack: '💬',
      outlook: '📮'
    };
    return icons[platform] || '📱';
  };

  return (
    <div className="flex h-[calc(100vh-10rem)] bg-slate-50">
      {/* Sessions Sidebar */}
      <div className={`${showSessions ? 'w-64' : 'w-0'} transition-all duration-300 bg-white border-r border-slate-200 overflow-hidden`}>
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 mb-3">Chat Sessions</h3>
          <button
            onClick={createNewSession}
            className="w-full py-2 px-3 bg-indigo-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            New Chat
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-5rem)]">
          {sessions.map(session => (
            <div
              key={session.id}
              onClick={() => setCurrentSessionId(session.id)}
              className={`p-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors group ${
                currentSessionId === session.id ? 'bg-indigo-50 border-indigo-200' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-900 truncate">{session.title}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </p>
                  {session.accountIds.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {session.accountIds.slice(0, 3).map(accId => {
                        const account = accounts.find(a => a.id === accId);
                        return account ? (
                          <span key={accId} className="text-xs">
                            {getPlatformIcon(account.platform)}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-opacity"
                >
                  <TrashIcon className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowSessions(!showSessions)}
              className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5 text-slate-600" />
            </button>
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-md">
              <SparklesIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">{assistantName}</h2>
              <p className="text-xs text-green-500 flex items-center font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                Connected to {selectedAccountIds.length > 0 ? selectedAccountIds.length : 'all'} account{selectedAccountIds.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowAccountFilter(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <FunnelIcon className="w-4 h-4" />
            Filter Accounts
            {selectedAccountIds.length > 0 && (
              <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full">
                {selectedAccountIds.length}
              </span>
            )}
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-900'} rounded-2xl p-4 shadow-sm`}>
                <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : 'prose-slate'}`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Custom styling for code blocks
                      pre: ({ node, children, ...props }: any) => (
                        <pre className={`${msg.role === 'user' ? 'bg-indigo-700' : 'bg-slate-800'} p-3 rounded-lg overflow-x-auto`} {...props}>
                          {children}
                        </pre>
                      ),
                      code: ({ node, inline, className, children, ...props }: any) => {
                        return inline ? (
                          <code className={`${msg.role === 'user' ? 'bg-indigo-700' : 'bg-slate-200 text-slate-900'} px-1.5 py-0.5 rounded text-sm font-mono`} {...props}>
                            {children}
                          </code>
                        ) : (
                          <code className={`${msg.role === 'user' ? 'text-indigo-100' : 'text-slate-100'} text-sm font-mono`} {...props}>
                            {children}
                          </code>
                        );
                      },
                      // Style links
                      a: ({ node, children, ...props }: any) => (
                        <a 
                          className={`${msg.role === 'user' ? 'text-indigo-200 hover:text-white' : 'text-indigo-600 hover:text-indigo-800'} underline font-medium`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          {...props}
                        >
                          {children}
                        </a>
                      ),
                      // Style tables
                      table: ({ node, children, ...props }: any) => (
                        <div className="overflow-x-auto my-4">
                          <table className={`min-w-full divide-y ${msg.role === 'user' ? 'divide-indigo-500' : 'divide-slate-300'} text-sm`} {...props}>
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({ node, children, ...props }: any) => (
                        <thead className={msg.role === 'user' ? 'bg-indigo-700' : 'bg-slate-50'} {...props}>
                          {children}
                        </thead>
                      ),
                      th: ({ node, children, ...props }: any) => (
                        <th className="px-3 py-2 text-left font-semibold" {...props}>
                          {children}
                        </th>
                      ),
                      td: ({ node, children, ...props }: any) => (
                        <td className={`px-3 py-2 ${msg.role === 'user' ? 'border-indigo-500' : 'border-slate-200'} border-t`} {...props}>
                          {children}
                        </td>
                      ),
                      // Style lists
                      ul: ({ node, children, ...props }: any) => (
                        <ul className="list-disc list-inside space-y-1 my-2" {...props}>
                          {children}
                        </ul>
                      ),
                      ol: ({ node, children, ...props }: any) => (
                        <ol className="list-decimal list-inside space-y-1 my-2" {...props}>
                          {children}
                        </ol>
                      ),
                      // Style blockquotes
                      blockquote: ({ node, children, ...props }: any) => (
                        <blockquote className={`border-l-4 ${msg.role === 'user' ? 'border-indigo-400 bg-indigo-700' : 'border-slate-400 bg-slate-50'} pl-4 py-2 my-2 italic`} {...props}>
                          {children}
                        </blockquote>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
                
                {/* Tool Usage Indicator */}
                {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200/40">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-600">🔧 Tools used:</span>
                      {msg.toolsUsed.map((tool, i) => (
                        <span 
                          key={i} 
                          className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-md font-medium"
                        >
                          {tool.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Reasoning Steps (ReAct) */}
                {msg.reasoning && msg.reasoning.length > 0 && (
                  <details className="mt-3 pt-3 border-t border-slate-200/40">
                    <summary className="text-xs font-semibold text-slate-600 cursor-pointer hover:text-indigo-600">
                      🧠 View Agent Reasoning ({msg.reasoning.length} steps)
                    </summary>
                    <div className="mt-2 space-y-1 text-xs text-slate-600 font-mono bg-slate-50 p-2 rounded-lg max-h-48 overflow-y-auto">
                      {msg.reasoning.map((step, i) => (
                        <div key={i} className="leading-relaxed">{step}</div>
                      ))}
                    </div>
                  </details>
                )}
                
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200/20">
                    <p className="text-xs opacity-75">
                      📊 Based on {msg.sources[0].accountIds?.length || 'all'} account(s)
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-sm text-slate-600">{assistantName} is thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder={`Ask ${assistantName} anything about your data, schedule, or messages...`}
              className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Account Filter Modal */}
      {showAccountFilter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md m-4">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Filter by Accounts</h3>
              <button
                onClick={() => setShowAccountFilter(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
              <button
                onClick={() => setSelectedAccountIds([])}
                className="w-full text-left px-4 py-3 rounded-lg border-2 border-slate-200 hover:border-indigo-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">All Accounts</span>
                  {selectedAccountIds.length === 0 && (
                    <span className="text-indigo-600 text-sm">✓ Selected</span>
                  )}
                </div>
              </button>
              
              {accounts.map(account => (
                <button
                  key={account.id}
                  onClick={() => toggleAccount(account.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                    selectedAccountIds.includes(account.id)
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getPlatformIcon(account.platform)}</span>
                      <div>
                        <p className="font-medium text-slate-900">{account.name}</p>
                        <p className="text-xs text-slate-500">{account.email}</p>
                      </div>
                    </div>
                    {selectedAccountIds.includes(account.id) && (
                      <span className="text-indigo-600 text-sm">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setShowAccountFilter(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={updateSessionFilter}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatAssistant;
