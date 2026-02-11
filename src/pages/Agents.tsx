import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  SparklesIcon, 
  PaperAirplaneIcon, 
  XMarkIcon,
  ChevronLeftIcon,
  LightBulbIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { getAllAgentInfo, getAgent, AgentInfo, AgentMessage, AgentCategory } from '../services/agents';

const categoryInfo: Record<AgentCategory, { name: string; icon: string; color: string; description: string }> = {
  'core-life': {
    name: 'Core Life',
    icon: '🧠',
    color: 'from-indigo-500 to-purple-600',
    description: 'Essential agents for personal life management'
  },
  'productivity': {
    name: 'Productivity',
    icon: '🚀',
    color: 'from-blue-500 to-cyan-600',
    description: 'Boost your work and creative output'
  },
  'lifestyle': {
    name: 'Lifestyle',
    icon: '🌟',
    color: 'from-pink-500 to-rose-600',
    description: 'Wellness, travel, and smart living'
  }
};

const AgentsPage: React.FC = () => {
  const [agents] = useState<AgentInfo[]>(getAllAgentInfo());
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const filteredAgents = searchQuery
    ? agents.filter(agent =>
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.capabilities.some(cap => cap.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : agents;

  const groupedAgents = filteredAgents.reduce((acc, agent) => {
    if (!acc[agent.category]) acc[agent.category] = [];
    acc[agent.category].push(agent);
    return acc;
  }, {} as Record<AgentCategory, AgentInfo[]>);

  const handleSendMessage = async () => {
    if (!input.trim() || !selectedAgent || isLoading) return;

    const userMessage: AgentMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      agentId: selectedAgent.id
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const agent = getAgent(selectedAgent.id);
      if (!agent) throw new Error('Agent not found');

      const response = await agent.run(userMessage.content, messages);

      const assistantMessage: AgentMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text,
        timestamp: new Date().toISOString(),
        toolsUsed: response.toolsUsed,
        reasoning: response.reasoning,
        agentId: selectedAgent.id
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: AgentMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message || 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        agentId: selectedAgent.id
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExamplePrompt = (prompt: string) => {
    setInput(prompt);
  };

  const handleNewConversation = () => {
    setMessages([]);
  };

  const handleBack = () => {
    setSelectedAgent(null);
    setMessages([]);
    setInput('');
  };

  // Agent Grid View
  if (!selectedAgent) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <SparklesIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">AI Agents</h1>
                <p className="text-slate-500 mt-1">Specialized assistants for every aspect of your life</p>
              </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
              <input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-100 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none"
              />
            </div>

            {/* Stats */}
            <div className="mt-6 flex gap-4">
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2">
                <span className="text-2xl font-black text-indigo-600">{agents.length}</span>
                <span className="text-xs text-slate-500 ml-2">Total Agents</span>
              </div>
              {Object.entries(categoryInfo).map(([cat, info]) => {
                const count = groupedAgents[cat as AgentCategory]?.length || 0;
                return (
                  <div key={cat} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2">
                    <span className="text-xl mr-2">{info.icon}</span>
                    <span className="text-lg font-bold text-slate-700">{count}</span>
                    <span className="text-xs text-slate-500 ml-1">{info.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agent Categories */}
          {(['core-life', 'productivity', 'lifestyle'] as AgentCategory[]).map(category => {
            const categoryAgents = groupedAgents[category] || [];
            if (categoryAgents.length === 0) return null;
            const catInfo = categoryInfo[category];

            return (
              <div key={category} className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">{catInfo.icon}</span>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">{catInfo.name}</h2>
                    <p className="text-sm text-slate-500">{catInfo.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categoryAgents.map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent)}
                      className="bg-white border-2 border-slate-100 rounded-2xl p-6 text-left hover:border-indigo-200 hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-14 h-14 bg-gradient-to-br ${agent.color} rounded-xl flex items-center justify-center text-3xl shadow-md group-hover:scale-110 transition-transform`}>
                          {agent.icon}
                        </div>
                        <SparklesIcon className="w-5 h-5 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      
                      <h3 className="text-lg font-black text-slate-900 mb-2">{agent.name}</h3>
                      <p className="text-sm text-slate-600 mb-4 line-clamp-2">{agent.description}</p>
                      
                      <div className="flex flex-wrap gap-2">
                        {agent.capabilities.slice(0, 3).map((cap, idx) => (
                          <span key={idx} className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                            {cap}
                          </span>
                        ))}
                        {agent.capabilities.length > 3 && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                            +{agent.capabilities.length - 3} more
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Agent Chat View
  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5 text-slate-600" />
          </button>
          
          <div className={`w-12 h-12 bg-gradient-to-br ${selectedAgent.color} rounded-xl flex items-center justify-center text-2xl shadow-md`}>
            {selectedAgent.icon}
          </div>
          
          <div>
            <h2 className="text-xl font-black text-slate-900">{selectedAgent.name}</h2>
            <p className="text-sm text-slate-500">{selectedAgent.description}</p>
          </div>
        </div>

        <button
          onClick={handleNewConversation}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl transition-colors"
        >
          <ArrowPathIcon className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-bold text-slate-700">New Chat</span>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8">
        {messages.length === 0 ? (
          <div className="max-w-3xl mx-auto">
            {/* Welcome Message */}
            <div className="text-center mb-12">
              <div className={`w-20 h-20 bg-gradient-to-br ${selectedAgent.color} rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-xl`}>
                {selectedAgent.icon}
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-3">
                {selectedAgent.name}
              </h3>
              <p className="text-slate-600 max-w-xl mx-auto">{selectedAgent.description}</p>
            </div>

            {/* Capabilities */}
            <div className="mb-8">
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <SparklesIcon className="w-4 h-4" />
                Capabilities
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {selectedAgent.capabilities.map((cap, idx) => (
                  <div key={idx} className="bg-white border border-slate-100 rounded-xl px-4 py-3">
                    <span className="text-sm font-semibold text-slate-700">{cap}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Example Prompts */}
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <LightBulbIcon className="w-4 h-4" />
                Try These
              </h4>
              <div className="space-y-3">
                {selectedAgent.examplePrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExamplePrompt(prompt)}
                    className="w-full bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl px-6 py-4 text-left hover:border-indigo-200 hover:shadow-md transition-all group"
                  >
                    <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-700">
                      "{prompt}"
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white' : 'bg-white border border-slate-100'} rounded-2xl px-6 py-4 shadow-sm`}>
                  {msg.role === 'assistant' && (
                    <div className="prose prose-sm max-w-none prose-slate">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ node, ...props }) => (
                            <a
                              {...props}
                              onClick={(e) => {
                                e.preventDefault();
                                if (props.href) window.electronAPI?.shell.openExternal(props.href);
                              }}
                              className="text-indigo-600 hover:text-indigo-700 cursor-pointer underline"
                            />
                          )
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  {msg.role === 'user' && (
                    <p className="text-sm font-medium whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Tools Used:</p>
                      <div className="flex flex-wrap gap-1">
                        {msg.toolsUsed.map((tool, idx) => (
                          <span key={idx} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-medium">
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 rounded-2xl px-6 py-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-sm text-slate-500 font-medium">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-100 p-6 shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={`Ask ${selectedAgent.name}...`}
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-6 pr-14 text-sm resize-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              className="absolute bottom-4 right-4 w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl flex items-center justify-center hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
};

export default AgentsPage;
