
import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  UserGroupIcon,
  ArrowPathIcon,
  ChevronRightIcon
} from '@heroicons/react/24/solid';

// Discovery objectives — each maps to a knowledge category with deeper follow-ups
const DEFAULT_OBJECTIVES = [
  { id: 'education', icon: 'AcademicCapIcon', label: 'Education', category: 'Education', keywords: ['degree', 'university', 'school', 'course', 'certification', 'study', 'learning', 'graduated', 'major', 'phd', 'masters', 'bachelor'] },
  { id: 'career', icon: 'BriefcaseIcon', label: 'Career', category: 'Work', keywords: ['job', 'work', 'career', 'role', 'company', 'salary', 'position', 'manager', 'developer', 'engineer', 'freelance', 'business'] },
  { id: 'interests', icon: 'RocketLaunchIcon', label: 'Interests', category: 'Interests', keywords: ['hobby', 'interest', 'passion', 'enjoy', 'fun', 'free time', 'weekend', 'like to', 'fascinated', 'curious'] },
  { id: 'style', icon: 'LightBulbIcon', label: 'Style', category: 'Communication', keywords: ['communicate', 'style', 'formal', 'casual', 'email', 'prefer', 'tone', 'writing', 'speak', 'language'] },
  { id: 'projects', icon: 'PresentationChartLineIcon', label: 'Projects', category: 'Projects', keywords: ['project', 'building', 'working on', 'priority', 'deadline', 'milestone', 'goal', 'startup', 'side project', 'app'] },
  { id: 'health', icon: 'HeartIcon', label: 'Health', category: 'Health', keywords: ['health', 'fitness', 'exercise', 'gym', 'diet', 'sleep', 'wellness', 'mental', 'meditation', 'run', 'yoga'] },
  { id: 'home', icon: 'HomeIcon', label: 'Home', category: 'Home', keywords: ['home', 'live', 'city', 'country', 'apartment', 'house', 'based in', 'moved', 'neighborhood', 'location'] },
  { id: 'music', icon: 'MusicalNoteIcon', label: 'Music', category: 'Music', keywords: ['music', 'song', 'artist', 'genre', 'band', 'listen', 'playlist', 'concert', 'spotify', 'instrument'] },
  { id: 'travel', icon: 'GlobeAltIcon', label: 'Travel', category: 'Travel', keywords: ['travel', 'trip', 'vacation', 'country', 'visited', 'flight', 'destination', 'bucket list', 'abroad', 'explore'] },
  { id: 'tech', icon: 'CodeBracketIcon', label: 'Tech', category: 'Skills', keywords: ['technology', 'programming', 'code', 'software', 'tool', 'framework', 'language', 'python', 'javascript', 'ai', 'react', 'stack'] },
  { id: 'social', icon: 'ChatBubbleLeftRightIcon', label: 'Social', category: 'Social', keywords: ['social', 'friends', 'platform', 'twitter', 'linkedin', 'instagram', 'discord', 'slack', 'community', 'online'] },
  { id: 'network', icon: 'UserGroupIcon', label: 'Network', category: 'Contacts', keywords: ['network', 'colleagues', 'collaborate', 'team', 'partner', 'client', 'mentor', 'coworker', 'connections'] },
];

const ICON_MAP: { [key: string]: React.ComponentType<{className?: string}> } = {
  AcademicCapIcon, PresentationChartLineIcon, RocketLaunchIcon, LightBulbIcon,
  BriefcaseIcon, HeartIcon, HomeIcon, MusicalNoteIcon, GlobeAltIcon,
  CodeBracketIcon, ChatBubbleLeftRightIcon, UserGroupIcon,
};

// Category colors for the knowledge map
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  Work:          { bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/20',   bar: 'bg-blue-500' },
  Education:     { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', bar: 'bg-violet-500' },
  Interests:     { bg: 'bg-amber-500/10',  text: 'text-amber-400',  border: 'border-amber-500/20',  bar: 'bg-amber-500' },
  Communication: { bg: 'bg-pink-500/10',   text: 'text-pink-400',   border: 'border-pink-500/20',   bar: 'bg-pink-500' },
  Projects:      { bg: 'bg-emerald-500/10',text: 'text-emerald-400',border: 'border-emerald-500/20',bar: 'bg-emerald-500' },
  Health:        { bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-500/20',    bar: 'bg-red-500' },
  Contacts:      { bg: 'bg-cyan-500/10',   text: 'text-cyan-400',   border: 'border-cyan-500/20',   bar: 'bg-cyan-500' },
  Skills:        { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', bar: 'bg-indigo-500' },
  Goals:         { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', bar: 'bg-orange-500' },
  Schedule:      { bg: 'bg-teal-500/10',   text: 'text-teal-400',   border: 'border-teal-500/20',   bar: 'bg-teal-500' },
  Preferences:   { bg: 'bg-fuchsia-500/10',text: 'text-fuchsia-400',border: 'border-fuchsia-500/20',bar: 'bg-fuchsia-500' },
  Identity:      { bg: 'bg-slate-500/10',  text: 'text-slate-400',  border: 'border-slate-500/20',  bar: 'bg-slate-500' },
};

const getColor = (cat: string) => CATEGORY_COLORS[cat] || CATEGORY_COLORS['Identity'];

export interface DiscoveryObjective {
  id: string;
  icon: string;
  label: string;
  category: string;
  keywords: string[];
  done?: boolean;
}

/**
 * Build an intelligent, adaptive profiling prompt that reasons about
 * what we already know vs. what gaps remain, then asks a single
 * focused question with depth.
 */
function buildSmartPrompt(
  currentInput: string,
  existingInsights: KnowledgeInsight[],
  objectives: DiscoveryObjective[],
  completedObjIds: Set<string>,
  messageCount: number,
): string {
  // Categorize existing knowledge
  const knownCategories: Record<string, string[]> = {};
  existingInsights.forEach(ins => {
    if (!knownCategories[ins.category]) knownCategories[ins.category] = [];
    knownCategories[ins.category].push(ins.fact);
  });

  const knownSummary = Object.entries(knownCategories)
    .map(([cat, facts]) => `  ${cat}: ${facts.join('; ')}`)
    .join('\n') || '  (nothing yet)';

  const uncoveredAreas = objectives
    .filter(o => !completedObjIds.has(o.id))
    .map(o => o.label);

  const coveredAreas = objectives
    .filter(o => completedObjIds.has(o.id))
    .map(o => o.label);

  const conversationDepth = messageCount < 6 ? 'early' : messageCount < 16 ? 'mid' : 'deep';

  return `You are a world-class user profiling interviewer for a personal AI hub called aether-hub.
Your role is to deeply understand the user through thoughtful, adaptive conversation.

═══ WHAT WE ALREADY KNOW ═══
${knownSummary}

═══ AREAS COVERED ═══
${coveredAreas.length > 0 ? coveredAreas.join(', ') : 'None yet'}

═══ AREAS STILL UNEXPLORED ═══
${uncoveredAreas.length > 0 ? uncoveredAreas.join(', ') : 'All areas covered!'}

═══ CONVERSATION DEPTH: ${conversationDepth.toUpperCase()} ═══
Total insights: ${existingInsights.length} | Messages exchanged: ${messageCount}

═══ USER'S LATEST MESSAGE ═══
"${currentInput}"

═══ YOUR TASK ═══
1. EXTRACT: Read the user's message carefully. Identify EVERY concrete fact, preference, habit, tool, person, schedule detail, or goal mentioned — even implicit ones.
   - If they say "I'm a fullstack dev working on a SaaS", extract: role=fullstack developer, project type=SaaS
   - If they say "I usually code at night", extract: schedule=night worker, habit=late coding sessions
   - Be thorough — extract 2-5 insights per meaningful answer.

2. SAVE: For EACH extracted fact, call save_knowledge_insight immediately with:
   - A specific, descriptive category (Work, Education, Interests, Communication, Schedule, Projects, Health, Goals, Skills, Contacts, Preferences, Travel, Social, Home, Music, Habits)
   - A clear, concise fact statement
   - Confidence 70-95 depending on how explicitly stated

3. RESPOND: Write a brief, warm acknowledgment (1-2 sentences) showing you understood them.

4. PROBE DEEPER: Ask exactly ONE follow-up question. Your question MUST be:
   ${conversationDepth === 'early' ? `- Since we're just starting: Pick the most natural next topic from unexplored areas: [${uncoveredAreas.slice(0, 3).join(', ')}]
   - Ask something open-ended but specific. NOT "tell me about X" — instead ask situational questions like:
     "When you sit down to work in the morning, what's the first thing you do?" or
     "If you had a free Saturday with zero obligations, how would you spend it?"` :
   conversationDepth === 'mid' ? `- We know the basics. Now go DEEPER into areas we've touched:
   - Ask about specifics, routines, preferences, frustrations, or goals
   - Example: If we know they're a developer, ask "What's your biggest productivity bottleneck right now?" or "Which tools in your stack do you wish were better?"
   - If there are unexplored areas [${uncoveredAreas.slice(0, 2).join(', ')}], naturally transition to one` :
   `- We have good coverage. Now ask INSIGHTFUL questions that reveal deeper patterns:
   - Ask about decision-making processes, priorities, trade-offs
   - Example: "What's one thing you'd change about your daily routine if you could?" or "How do you decide which projects get your attention?"
   - Look for connections between things we know`}

CRITICAL RULES:
- NEVER ask generic questions like "Tell me about your education" or "What are your interests?"
- ALWAYS make the question feel like a natural continuation of what they just said
- If the user gives a short/vague answer, don't repeat the question — pivot to something related but different
- If the user asks YOU a question, answer helpfully, then smoothly steer back to learning about them
- Keep your total response under 3 sentences + the question
- Save insights BEFORE responding`;
}

const KnowledgeBase: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<KnowledgeInsight[]>([]);
  const [objectives, setObjectives] = useState<DiscoveryObjective[]>(DEFAULT_OBJECTIVES);
  const [completedObjectives, setCompletedObjectives] = useState<Set<string>>(new Set());
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute category depth map from insights
  const categoryMap = useMemo(() => {
    const map: Record<string, KnowledgeInsight[]> = {};
    insights.forEach(ins => {
      if (!map[ins.category]) map[ins.category] = [];
      map[ins.category].push(ins);
    });
    return map;
  }, [insights]);

  // Auto-detect completed objectives from actual insight categories + conversation content
  useEffect(() => {
    const done = new Set<string>();
    objectives.forEach(obj => {
      // Check if insights exist in this objective's category
      const catInsights = categoryMap[obj.category] || [];
      if (catInsights.length >= 1) {
        done.add(obj.id);
        return;
      }
      // Also check if any insight fact matches keywords
      const allFacts = insights.map(i => i.fact.toLowerCase()).join(' ');
      const matched = obj.keywords.some(kw => allFacts.includes(kw));
      if (matched) done.add(obj.id);
    });
    setCompletedObjectives(done);
  }, [insights, objectives, categoryMap]);

  // Load knowledge data
  useEffect(() => {
    const loadData = async () => {
      const customObjectives = await storage.get(STORAGE_KEYS.DISCOVERY_OBJECTIVES) as DiscoveryObjective[] | null;
      if (customObjectives && customObjectives.length > 0) {
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
          content: "Hey! I'm your personal context engine. The more I know about you, the smarter aether-hub becomes — better summaries, smarter priorities, more relevant alerts.\n\nLet's start with something easy: **Walk me through what a typical workday looks like for you, from the moment you open your laptop.**", 
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

    await db.knowledgeMessages.create({ id: userMsg.id, role: userMsg.role, content: userMsg.content });
    setMessages(prev => [...prev, userMsg]);

    // Get conversation history
    const dbMessages = await db.knowledgeMessages.getAll();
    const historyForAI = dbMessages
      .filter(m => m.id !== userMsg.id)
      .map(m => ({ role: m.role, content: m.content }));

    // Build the intelligent adaptive prompt
    const smartPrompt = buildSmartPrompt(
      currentInput,
      insights,
      objectives,
      completedObjectives,
      messages.length,
    );

    const response = await getChatResponse(smartPrompt, historyForAI);

    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response.text,
      timestamp: new Date().toLocaleTimeString()
    };

    await db.knowledgeMessages.create({ id: assistantMsg.id, role: assistantMsg.role, content: assistantMsg.content });
    setMessages(prev => [...prev, assistantMsg]);
    
    // Refresh insights after AI agent runs
    const updatedInsights = await db.knowledgeInsights.getAll();
    if (updatedInsights && updatedInsights.length > 0) {
      setInsights(updatedInsights);
    }
    
    setIsLoading(false);
  };

  // Smart objective click: instead of pasting a fixed question, send a contextual prompt
  const handleObjectiveClick = (objective: DiscoveryObjective) => {
    const catInsights = categoryMap[objective.category] || [];
    if (catInsights.length > 0) {
      // Already have some knowledge — ask to go deeper
      setInput(`I'd like to tell you more about my ${objective.label.toLowerCase()}`);
    } else {
      // New area — ask naturally
      const starters: Record<string, string> = {
        education: "Let me tell you about my educational background",
        career: "Here's what I do for work",
        interests: "Some things I'm really into",
        style: "About how I like to communicate",
        projects: "Let me tell you about what I'm building",
        health: "Regarding my health and fitness",
        home: "About where I live",
        music: "Music I'm into",
        travel: "Places I've been or want to go",
        tech: "Tech stack and tools I use",
        social: "How I use social platforms",
        network: "People I work with regularly",
      };
      setInput(starters[objective.id] || `Let me tell you about my ${objective.label.toLowerCase()}`);
    }
    inputRef.current?.focus();
  };

  // Compute meaningful completeness based on category coverage depth
  const completeness = useMemo(() => {
    const categoryCount = Object.keys(categoryMap).length;
    const insightCount = insights.length;
    const objectivesCovered = completedObjectives.size;
    // Weight: 40% category breadth, 40% insight depth, 20% objectives
    const breadth = Math.min(categoryCount / 8, 1) * 40;
    const depth = Math.min(insightCount / 20, 1) * 40;
    const objCoverage = Math.min(objectivesCovered / objectives.length, 1) * 20;
    return Math.round(breadth + depth + objCoverage);
  }, [categoryMap, insights, completedObjectives, objectives]);

  const maturityLevel = completeness < 25 ? 'Beginner' : completeness < 50 ? 'Growing' : completeness < 75 ? 'Established' : 'Expert';

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-10rem)] flex gap-6 animate-in fade-in duration-700">
      {/* Chat Section */}
      <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-emerald-50/30">
          <div className="flex items-center space-x-4">
            <div className="w-11 h-11 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <CpuChipIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Context Discovery</h2>
              <div className="flex items-center gap-2 cursor-help group/session">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                  {isLoading ? 'Analyzing...' : `${insights.length} insights · ${Object.keys(categoryMap).length} categories`}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-emerald-100 rounded-xl">
              <span className="text-xs font-black text-emerald-700">{completeness}% Complete</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/20" ref={scrollRef}>
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] group`}>
                <div className={`rounded-3xl p-5 transition-all ${
                  msg.role === 'user' 
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 rounded-tr-none' 
                  : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none shadow-sm group-hover:shadow-md'
                }`}>
                  {msg.role === 'assistant' ? (
                    <MarkdownRenderer content={msg.content} className="text-[15px] leading-relaxed font-medium" />
                  ) : (
                    <p className="text-[15px] leading-relaxed font-medium">{msg.content}</p>
                  )}
                  <p className={`text-[10px] mt-3 font-black uppercase tracking-widest opacity-40 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.timestamp}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-50 rounded-2xl p-5 rounded-tl-none flex items-center gap-3">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-2">Thinking deeply...</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-white">
          <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:bg-white transition-all group">
            <input 
              ref={inputRef}
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Share something about yourself..." 
              className="flex-1 bg-transparent border-none outline-none text-base font-medium py-1 placeholder:text-slate-300"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-11 h-11 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-20 shadow-lg shadow-emerald-100 flex items-center justify-center"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel: Knowledge Map + Context */}
      <div className="w-[380px] flex flex-col gap-5 shrink-0">
        {/* Profile Maturity */}
        <div className="bg-white border border-slate-200 rounded-[2rem] p-7 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Knowledge Profile</h3>
              <span className="text-[10px] font-black text-emerald-600 uppercase">{maturityLevel}</span>
            </div>
            <div className="flex items-center gap-5 mb-4">
               <div className="relative w-20 h-20 shrink-0">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100" />
                    <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={213.6} strokeDashoffset={213.6 - (213.6 * completeness) / 100} className="text-emerald-500 transition-all duration-1000 ease-out" strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-black text-lg text-slate-900">
                    {completeness}%
                  </div>
               </div>
               <div className="flex-1">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-black text-slate-900">{insights.length}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Facts</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-900">{Object.keys(categoryMap).length}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Areas</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-900">{completedObjectives.size}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Goals</p>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Knowledge Map — shows categories with depth bars */}
        <div className="bg-[#1a1c2e] rounded-[2rem] p-7 text-white flex-1 flex flex-col shadow-2xl overflow-hidden relative border border-white/5">
           <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center border border-emerald-500/30">
                    <BookmarkIcon className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100">Knowledge Map</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-500">{insights.length} total</span>
              </div>

              {/* Category bars */}
              <div className="space-y-2 overflow-y-auto flex-1 pr-2 custom-scroll mb-5">
                {Object.keys(categoryMap).length > 0 ? (
                  Object.entries(categoryMap)
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([category, catInsights]) => {
                      const color = getColor(category);
                      const isExpanded = expandedCategory === category;
                      const maxDepth = 5; // 5 insights = full bar
                      const depth = Math.min(catInsights.length / maxDepth, 1) * 100;
                      return (
                        <div key={category}>
                          <button
                            onClick={() => setExpandedCategory(isExpanded ? null : category)}
                            className={`w-full p-3 rounded-xl border transition-all text-left ${color.bg} ${color.border} hover:opacity-90`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-[10px] font-black uppercase tracking-wider ${color.text}`}>{category}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500">{catInsights.length}</span>
                                <ChevronRightIcon className={`w-3 h-3 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </div>
                            </div>
                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-700 ${color.bar}`} style={{ width: `${depth}%` }} />
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="mt-1 ml-3 space-y-1 animate-in slide-in-from-top-2 duration-200">
                              {catInsights.map(ins => (
                                <div key={ins.id} className="flex items-start gap-2 py-1.5 px-3 rounded-lg bg-white/5">
                                  <CheckBadgeIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${color.text}`} />
                                  <p className="text-[12px] font-medium text-slate-300 leading-tight">{ins.fact}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                ) : (
                  <div className="py-16 text-center opacity-30">
                    <LightBulbIcon className="w-10 h-10 mx-auto mb-3" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Start talking to build your map</p>
                  </div>
                )}
              </div>

              {/* Discovery Objectives */}
              <div className="pt-4 border-t border-white/10 flex flex-col min-h-0">
                 <div className="flex items-center justify-between mb-3 shrink-0">
                   <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Quick Topics</h4>
                   <span className="text-[9px] font-bold text-emerald-500">{completedObjectives.size}/{objectives.length}</span>
                 </div>
                 <div className="overflow-y-auto max-h-[150px] pr-2 custom-scroll">
                   <div className="grid grid-cols-2 gap-1.5">
                      {objectives.map(obj => {
                        const IconComponent = ICON_MAP[obj.icon] || LightBulbIcon;
                        const isDone = completedObjectives.has(obj.id);
                        return (
                          <Objective 
                            key={obj.id}
                            icon={IconComponent} 
                            label={obj.label} 
                            done={isDone}
                            insightCount={(categoryMap[obj.category] || []).length}
                            onClick={() => handleObjectiveClick(obj)}
                          />
                        );
                      })}
                   </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const Objective = ({ icon: Icon, label, done, insightCount, onClick }: { 
  icon: React.ComponentType<{className?: string}>, 
  label: string, 
  done: boolean, 
  insightCount: number,
  onClick: () => void 
}) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer text-left w-full ${
      done 
        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
        : 'bg-white/5 border-white/5 text-slate-500 hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-emerald-300'
    }`} 
    title={done ? `${insightCount} insights learned. Click to go deeper.` : `Click to start talking about ${label.toLowerCase()}`}
  >
    <Icon className="w-3.5 h-3.5 shrink-0" />
    <span className="text-[10px] font-black uppercase tracking-tighter truncate flex-1">{label}</span>
    {done && <span className="text-[9px] font-bold text-emerald-500">{insightCount}</span>}
  </button>
);

export default KnowledgeBase;
