
import React, { useState, useRef, useEffect } from 'react';
import { getChatResponse } from '../services/langchainService';
import { Message, KnowledgeInsight } from '../types';
import { db } from '../services/database';
import storage, { STORAGE_KEYS } from '../services/electronStore';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { 
  PaperAirplaneIcon, 
  CpuChipIcon, 
  LightBulbIcon, 
  CheckBadgeIcon, 
  BookmarkIcon,
  AcademicCapIcon,
  PresentationChartLineIcon,
  RocketLaunchIcon,
  BriefcaseIcon,
  HeartIcon,
  HomeIcon,
  MusicalNoteIcon,
  GlobeAltIcon,
  CodeBracketIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon
} from '@heroicons/react/24/solid';

// Default objectives with their questions
const DEFAULT_OBJECTIVES = [
  { id: 'education', icon: 'AcademicCapIcon', label: 'Education', question: 'Tell me about your educational background. What degrees, certifications, or courses have you completed?' },
  { id: 'career', icon: 'BriefcaseIcon', label: 'Career', question: 'What is your current role and career path? What are your professional goals and aspirations?' },
  { id: 'interests', icon: 'RocketLaunchIcon', label: 'Interests', question: 'What hobbies or interests occupy your free time? What topics fascinate you the most?' },
  { id: 'style', icon: 'LightBulbIcon', label: 'Style', question: 'How would you describe your communication style? Do you prefer formal or casual interactions?' },
  { id: 'projects', icon: 'PresentationChartLineIcon', label: 'Projects', question: 'What projects are you currently working on? What are your main priorities right now?' },
  { id: 'health', icon: 'HeartIcon', label: 'Health', question: 'What health and wellness goals are important to you? Any fitness routines or health habits?' },
  { id: 'home', icon: 'HomeIcon', label: 'Home', question: 'Tell me about your living situation. Where are you based and what does your ideal environment look like?' },
  { id: 'music', icon: 'MusicalNoteIcon', label: 'Music', question: 'What kind of music do you enjoy? Any favorite artists or genres that define your taste?' },
  { id: 'travel', icon: 'GlobeAltIcon', label: 'Travel', question: 'Do you enjoy traveling? What destinations are on your bucket list or where have you been?' },
  { id: 'tech', icon: 'CodeBracketIcon', label: 'Tech', question: 'What technologies do you work with or find interesting? Any programming languages or tools you prefer?' },
  { id: 'social', icon: 'ChatBubbleLeftRightIcon', label: 'Social', question: 'How do you prefer to communicate? Which platforms do you use most for social interactions?' },
  { id: 'network', icon: 'UserGroupIcon', label: 'Network', question: 'Tell me about your professional network. Who are the key people you collaborate with regularly?' },
];

// Icon mapping
const ICON_MAP: { [key: string]: React.ComponentType<{className?: string}> } = {
  AcademicCapIcon,
  PresentationChartLineIcon,
  RocketLaunchIcon,
  LightBulbIcon,
  BriefcaseIcon,
  HeartIcon,
  HomeIcon,
  MusicalNoteIcon,
  GlobeAltIcon,
  CodeBracketIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
};

export interface DiscoveryObjective {
  id: string;
  icon: string;
  label: string;
  question: string;
  done?: boolean;
}

const KnowledgeBase: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<KnowledgeInsight[]>([]);
  const [objectives, setObjectives] = useState<DiscoveryObjective[]>(DEFAULT_OBJECTIVES);
  const [completedObjectives, setCompletedObjectives] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load knowledge data from database
  useEffect(() => {
    const loadData = async () => {
      // Load custom objectives from storage
      const customObjectives = await storage.get(STORAGE_KEYS.DISCOVERY_OBJECTIVES) as DiscoveryObjective[] | null;
      if (customObjectives && customObjectives.length > 0) {
        // Merge custom with defaults, custom first
        const mergedObjectives = [...customObjectives, ...DEFAULT_OBJECTIVES.filter(d => !customObjectives.find(c => c.id === d.id))];
        setObjectives(mergedObjectives);
      }

      const dbMessages = await db.knowledgeMessages.getAll();
      
      if (dbMessages && dbMessages.length > 0) {
        const transformedMessages: Message[] = dbMessages.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.created_at).toLocaleTimeString()
        }));
        setMessages(transformedMessages);
      } else {
        const welcomeMsg: Message = { 
          id: '1', 
          role: 'assistant' as const, 
          content: "Hi! I'm here to learn everything about you so I can personalize your entire aether-hub experience. Think of this as a casual conversation where I'll ask questions to understand your work, preferences, schedule, and communication style.\n\nLet's start with something simple: **What do you do for work, and what's a typical day like for you?**", 
          timestamp: new Date().toLocaleTimeString() 
        };
        setMessages([welcomeMsg]);
        await db.knowledgeMessages.create({
          id: welcomeMsg.id,
          role: welcomeMsg.role,
          content: welcomeMsg.content
        });
      }
      
      const dbInsights = await db.knowledgeInsights.getAll();
      if (dbInsights && dbInsights.length > 0) {
        setInsights(dbInsights);
      } else {
        const defaultInsight = { id: 'i1', category: 'Identity', fact: 'Premium aether-hub User' };
        setInsights([defaultInsight]);
        await db.knowledgeInsights.create(defaultInsight);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString()
    };

    const currentInput = input;
    setInput('');
    setIsLoading(true);

    // Save user message to database
    await db.knowledgeMessages.create({
      id: userMsg.id,
      role: userMsg.role,
      content: userMsg.content
    });
    setMessages(prev => [...prev, userMsg]);

    // Get conversation history from database for LangChain
    const dbMessages = await db.knowledgeMessages.getAll();
    const historyForAI = dbMessages
      .filter(m => m.id !== userMsg.id) // Exclude current message
      .map(m => ({ role: m.role, content: m.content }));

    // Add special system instructions for knowledge building mode
    const knowledgeBuildingPrompt = `ACTIVITY: PROFILING INTERVIEW
CURRENT USER INPUT: "${currentInput}"

INSTRUCTIONS:
1. IDENTIFY new facts, habits, or preferences from the input.
2. SAVE these facts IMMEDIATELY using the "save_knowledge_insight" tool.
3. ACKNOWLEDGE what you learned.
4. ASK 1-2 follow-up questions to learn more about their work, schedule, or communication style.
5. KEEP it brief and conversational.`;

    // Use LangChain agent with database tools for knowledge access
    const response = await getChatResponse(knowledgeBuildingPrompt, historyForAI);

    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response.text, // Extract .text from LangChain response
      timestamp: new Date().toLocaleTimeString()
    };

    // Save assistant message to database
    await db.knowledgeMessages.create({
      id: assistantMsg.id,
      role: assistantMsg.role,
      content: assistantMsg.content
    });
    setMessages(prev => [...prev, assistantMsg]);
    
    // Refresh insights after AI agent runs (it might have used save_knowledge_insight)
    // AI now extracts insights via knowledge tools - no manual keyword matching needed
    // Reload insights from database in case AI added any
    const updatedInsights = await db.knowledgeInsights.getAll();
    if (updatedInsights && updatedInsights.length > 0) {
      setInsights(updatedInsights);
    }
    
    setIsLoading(false);

    // Mark objectives as completed based on AI analysis
    objectives.forEach(obj => {
      if (currentInput.toLowerCase().includes(obj.label.toLowerCase()) || 
          currentInput.toLowerCase().includes(obj.id.toLowerCase())) {
        setCompletedObjectives(prev => new Set([...prev, obj.id]));
      }
    });
  };

  // Handle objective click - set input to the objective's question
  const handleObjectiveClick = (objective: DiscoveryObjective) => {
    setInput(objective.question);
    inputRef.current?.focus();
  };

  const completeness = Math.min(insights.length * 15, 100);

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-10rem)] flex gap-8 animate-in fade-in duration-700">
      {/* Chat Section */}
      <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
              <CpuChipIcon className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Context Discovery</h2>
              <div 
                className="flex items-center gap-2 cursor-help group/session"
                title="Active Profiling: aether-hub is listening for new information to build your workspace identity. Every detail helps better filter your dashboard."
              >
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse group-hover/session:scale-125 transition-transform"></span>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest group-hover/session:text-emerald-500 transition-colors">Active Profiling Session</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-8 bg-slate-50/20" ref={scrollRef}>
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] group`}>
                <div className={`rounded-3xl p-6 transition-all ${
                  msg.role === 'user' 
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 rounded-tr-none' 
                  : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none shadow-sm group-hover:shadow-md'
                }`}>
                  {msg.role === 'assistant' ? (
                    <MarkdownRenderer content={msg.content} className="text-[15px] leading-relaxed font-medium" />
                  ) : (
                    <p className="text-[15px] leading-relaxed font-medium">{msg.content}</p>
                  )}
                  <p className={`text-[10px] mt-4 font-black uppercase tracking-widest opacity-40 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.timestamp}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-50 rounded-2xl p-6 rounded-tl-none flex items-center gap-3">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-2">Extracting Insights...</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 border-t border-slate-100 bg-white">
          <div className="flex items-center space-x-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:bg-white transition-all group">
            <input 
              ref={inputRef}
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Answer the agent or click an objective below..." 
              className="flex-1 bg-transparent border-none outline-none text-base font-medium py-1 placeholder:text-slate-300"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-12 h-12 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-20 shadow-lg shadow-emerald-100 flex items-center justify-center group-active:scale-90"
            >
              <PaperAirplaneIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Insights Sidebar */}
      <div className="w-[400px] flex flex-col gap-8 shrink-0">
        <div 
          className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm relative overflow-hidden cursor-help hover:shadow-lg transition-all"
          title="Knowledge Maturity: As aether-hub learns more about your goals and context, its ability to prioritize and summarize increases. Talk to the Discovery Agent to raise this score."
        >
          <div className="relative z-10">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8">Profile Status</h3>
            <div className="flex items-center gap-6 mb-8">
               <div className="relative w-24 h-24 hover:scale-110 transition-transform">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-50" />
                    <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * completeness) / 100} className="text-emerald-500 transition-all duration-1000 ease-out" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-black text-xl text-slate-900">
                    {completeness}%
                  </div>
               </div>
               <div>
                  <p className="font-black text-slate-900 text-lg">Knowledge Maturity</p>
                  <p className="text-xs text-slate-400 font-medium mt-1">Level 1 Discovery</p>
               </div>
            </div>
            <p className="text-[13px] text-slate-500 leading-relaxed font-medium">The more context you provide, the better aethermsaid hub can filter and summarize your daily feed.</p>
          </div>
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-50 rounded-full opacity-50"></div>
        </div>

        <div className="bg-[#1a1c2e] rounded-[3rem] p-10 text-white flex-1 flex flex-col shadow-2xl overflow-hidden relative border border-white/5">
           <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                  <BookmarkIcon className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-100">Learned Context</h3>
              </div>

              <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scroll">
                {insights.map(insight => (
                  <div key={insight.id} className="p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all group/insight">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{insight.category}</span>
                      <CheckBadgeIcon className="w-3.5 h-3.5 text-slate-600 group-hover/insight:text-emerald-400 transition-colors" />
                    </div>
                    <p className="text-[13px] font-bold text-slate-200">{insight.fact}</p>
                  </div>
                ))}
                
                {insights.length === 0 && (
                  <div className="py-20 text-center opacity-30">
                    <LightBulbIcon className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">Awaiting Knowledge...</p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-white/10 flex flex-col min-h-0">
                 <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4 shrink-0">Discovery Objectives</h4>
                 <div className="overflow-y-auto max-h-[180px] pr-2 custom-scroll">
                   <div className="grid grid-cols-2 gap-2">
                      {objectives.map(obj => {
                        const IconComponent = ICON_MAP[obj.icon] || LightBulbIcon;
                        const isDone = completedObjectives.has(obj.id);
                        return (
                          <Objective 
                            key={obj.id}
                            icon={IconComponent} 
                            label={obj.label} 
                            done={isDone}
                            onClick={() => handleObjectiveClick(obj)}
                          />
                        );
                      })}
                   </div>
                 </div>
              </div>
           </div>
           <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

const Objective = ({ icon: Icon, label, done, onClick }: { icon: React.ComponentType<{className?: string}>, label: string, done: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all cursor-pointer text-left w-full ${done ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-white/5 border-white/5 text-slate-500 hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-emerald-300'}`} 
    title={done ? `Goal Achieved: ${label} context is active. Click to ask again.` : `Click to ask about your ${label.toLowerCase()}`}
  >
    <Icon className="w-4 h-4 shrink-0" />
    <span className="text-[10px] font-black uppercase tracking-tighter truncate">{label}</span>
  </button>
);

export default KnowledgeBase;
