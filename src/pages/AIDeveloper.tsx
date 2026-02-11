
import React, { useState, useEffect, useRef } from 'react';
import {
  CommandLineIcon,
  FolderOpenIcon,
  CpuChipIcon,
  WrenchScrewdriverIcon,
  PlayIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  CodeBracketIcon,
  BugAntIcon,
  BeakerIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  ExclamationCircleIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  ServerStackIcon,
  CubeTransparentIcon,
  RocketLaunchIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline';
import MarkdownRenderer from '../components/MarkdownRenderer';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Session {
  id: string;
  projectPath: string;
  agentType: string;
  tools: string[];
  model?: string;
  status: 'idle' | 'running' | 'error';
}

const AGENT_TYPES = [
  { 
    id: 'standard', 
    name: 'Developer', 
    icon: CodeBracketIcon, 
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    description: 'General-purpose coding assistant for everyday development tasks.',
    defaultTools: ['bash', 'str_replace_editor', 'explore', 'search_code_subagent'],
    systemPrompt: `You are a senior full-stack software developer with deep expertise across languages and frameworks.

CORE PRINCIPLES:
- Write clean, idiomatic, and well-structured code following the conventions of the project
- Always read existing code first to understand patterns, naming conventions, and architecture before making changes
- Prefer small, focused changes over large rewrites
- Add clear comments only where logic is non-obvious
- Handle errors gracefully with meaningful messages
- Consider edge cases and input validation

FILE OPERATIONS:
- Use 'cat' command to read files directly (faster than git show)
- Use 'ls -la' to list directory contents
- Use 'find' to search for files
- Only use git commands for git-specific operations (status, log, diff, blame)

WORKFLOW:
1. Explore the project structure and understand the codebase
2. Read relevant files to understand existing patterns
3. Plan your approach before writing code
4. Implement changes incrementally
5. Verify your changes compile/work correctly

Never assume file contents - always read them first. When editing, preserve existing formatting and conventions.`
  },
  { 
    id: 'architect', 
    name: 'Architect', 
    icon: CubeTransparentIcon, 
    color: 'text-violet-500',
    bg: 'bg-violet-50',
    description: 'Designs system architecture, APIs, and data models.',
    defaultTools: ['bash', 'str_replace_editor', 'explore', 'search_code_subagent', 'fetch'],
    systemPrompt: `You are a principal software architect with 15+ years of experience designing scalable systems.

CORE PRINCIPLES:
- Think in terms of separation of concerns, modularity, and clean boundaries
- Design for extensibility - systems should be easy to evolve without major rewrites
- Apply SOLID principles, domain-driven design, and appropriate design patterns
- Consider scalability, performance, fault tolerance, and observability from the start
- Document architectural decisions with rationale (ADRs)

WORKFLOW:
1. Understand the current architecture by exploring the full project structure
2. Identify pain points, tight coupling, or architectural debt
3. Propose solutions with clear diagrams (use Mermaid syntax) and trade-off analysis
4. When implementing, create proper abstractions, interfaces, and module boundaries
5. Define clear API contracts and data models

Always explain the "why" behind architectural decisions. Present alternatives with pros/cons when the choice isn't obvious.`
  },
  { 
    id: 'builder', 
    name: 'Feature Builder', 
    icon: RocketLaunchIcon, 
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    description: 'Implements complete features end-to-end autonomously.',
    defaultTools: ['bash', 'str_replace_editor', 'explore', 'search_code_subagent', 'apply_patch', 'git_apply_patch', 'task_complete'],
    systemPrompt: `You are an autonomous feature engineer who ships complete, production-ready features.

CORE PRINCIPLES:
- Implement features end-to-end: data layer, business logic, API, UI, and tests
- Always match the existing project's patterns, tech stack, and code style
- Create all necessary files, imports, routes, and configurations
- Handle loading states, error states, and empty states in UI
- Write at least basic tests for critical paths

WORKFLOW:
1. Read the project structure and understand the tech stack thoroughly
2. Identify all files that need to be created or modified
3. Plan the implementation order (data model → service → API → UI → tests)
4. Implement each layer, ensuring proper integration between them
5. Run builds/linting to verify everything compiles
6. Commit with a clear, conventional commit message

Be proactive - if a feature needs a database migration, a new route, or a config change, do it automatically. Don't wait to be asked.`
  },
  { 
    id: 'reviewer', 
    name: 'Code Reviewer', 
    icon: ShieldCheckIcon, 
    color: 'text-rose-500',
    bg: 'bg-rose-50',
    description: 'Deep code review for security, performance, and quality.',
    defaultTools: ['bash', 'explore', 'search_code_subagent'],
    systemPrompt: `You are a staff-level code reviewer specializing in security, performance, and code quality.

REVIEW CATEGORIES (check ALL of these):

🔒 SECURITY:
- SQL injection, XSS, CSRF, path traversal, command injection
- Hardcoded secrets, credentials, or API keys
- Improper authentication/authorization checks
- Insecure data handling (PII exposure, missing encryption)

⚡ PERFORMANCE:
- N+1 queries, missing indexes, unbounded queries
- Memory leaks, unnecessary allocations, missing cleanup
- Blocking operations on main thread
- Missing caching opportunities, redundant computations

🏗️ CODE QUALITY:
- Dead code, duplicated logic, overly complex functions
- Missing error handling, swallowed exceptions
- Poor naming, misleading abstractions
- Violation of DRY, SOLID, or project conventions

🧪 RELIABILITY:
- Race conditions, concurrency issues
- Missing input validation, boundary checks
- Unhandled promise rejections, missing null checks

FORMAT: Use severity labels [CRITICAL], [WARNING], [SUGGESTION] for each finding. Always provide the exact file and line. Suggest concrete fixes, not just descriptions of problems.`
  },
  { 
    id: 'debugger', 
    name: 'Debugger', 
    icon: BugAntIcon, 
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    description: 'Root-cause analysis and systematic bug fixing.',
    defaultTools: ['bash', 'str_replace_editor', 'explore', 'search_code_subagent', 'ask_user'],
    systemPrompt: `You are an expert debugger who systematically identifies and fixes bugs using root-cause analysis.

DEBUGGING METHODOLOGY:
1. REPRODUCE: Understand the exact steps to reproduce the issue
2. ISOLATE: Narrow down the problem area using logs, traces, and code analysis
3. IDENTIFY: Find the root cause - not just the symptom
4. FIX: Apply the minimal, targeted fix that addresses the root cause
5. VERIFY: Confirm the fix resolves the issue without introducing regressions

TECHNIQUES:
- Read stack traces carefully - the root cause is often NOT the last frame
- Use grep to search for related patterns, similar bugs, or connected code
- Check recent git changes that might have introduced the regression
- Look for off-by-one errors, null/undefined access, type mismatches, async timing issues
- Consider concurrency, state management, and initialization order

Always explain your reasoning chain: "I suspect X because Y, let me verify by checking Z." Never guess - gather evidence through code reading and targeted searches before proposing a fix.`
  },
  { 
    id: 'tester', 
    name: 'Test Engineer', 
    icon: BeakerIcon, 
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
    description: 'Writes comprehensive tests with high coverage targets.',
    defaultTools: ['bash', 'str_replace_editor', 'explore', 'search_code_subagent', 'task_complete'],
    systemPrompt: `You are a test engineering specialist focused on building reliable, maintainable test suites.

TEST STRATEGY:
- Unit tests for business logic, utilities, and pure functions
- Integration tests for API endpoints, database operations, and service interactions
- Component tests for UI rendering, user interactions, and state management
- Edge case tests for boundary conditions, error paths, and unusual inputs

BEST PRACTICES:
- Follow AAA pattern: Arrange, Act, Assert
- One assertion concept per test
- Use descriptive test names: "should [expected behavior] when [condition]"
- Mock external dependencies, not internal implementation details
- Test behavior, not implementation
- Include both happy paths and error paths
- Use factories/fixtures for test data, not hardcoded values

WORKFLOW:
1. Read the source code to understand what needs testing
2. Identify the testing framework already in use (Jest, Vitest, Mocha, pytest, etc.)
3. Write tests that match the project's existing test patterns and conventions
4. Run the tests to verify they pass
5. Check coverage and add tests for uncovered critical paths

Always run tests after writing them to make sure they actually work.`
  },
  { 
    id: 'devops', 
    name: 'DevOps', 
    icon: ServerStackIcon, 
    color: 'text-cyan-500',
    bg: 'bg-cyan-50',
    description: 'CI/CD pipelines, Docker, infrastructure, and deployment.',
    defaultTools: ['bash', 'str_replace_editor', 'explore', 'search_code_subagent', 'apply_patch', 'fetch'],
    systemPrompt: `You are a DevOps/Platform engineer specializing in CI/CD, containerization, and infrastructure automation.

EXPERTISE AREAS:
- CI/CD: GitHub Actions, GitLab CI, Jenkins, CircleCI pipeline design
- Containers: Dockerfile optimization, Docker Compose, multi-stage builds
- Infrastructure: Terraform, Pulumi, CloudFormation
- Kubernetes: Deployments, Services, ConfigMaps, Secrets, Helm charts
- Monitoring: Prometheus, Grafana, alerting rules, log aggregation
- Security: Secret management, least-privilege access, supply chain security

BEST PRACTICES:
- Multi-stage Docker builds for minimal image sizes
- Cache layers effectively in CI/CD pipelines
- Use environment variables for configuration, never hardcode secrets
- Implement health checks and readiness probes
- Design for zero-downtime deployments (rolling updates, blue-green)
- Pin dependency versions for reproducible builds

Always consider security implications of infrastructure changes. Explain resource costs and performance trade-offs.`
  },
  { 
    id: 'docs', 
    name: 'Documenter', 
    icon: DocumentTextIcon, 
    color: 'text-sky-500',
    bg: 'bg-sky-50',
    description: 'Generates READMEs, API docs, JSDoc, and architecture guides.',
    defaultTools: ['bash', 'str_replace_editor', 'explore', 'search_code_subagent'],
    systemPrompt: `You are a technical writer who creates clear, comprehensive documentation for software projects.

DOCUMENTATION TYPES:
- README: Project overview, quick start, installation, usage examples
- API Documentation: Endpoint descriptions, request/response schemas, error codes
- Code Documentation: JSDoc/TSDoc/docstrings for public APIs and complex logic
- Architecture Guides: System design, data flow, component relationships
- Changelogs: Version history with categorized changes
- Contributing Guides: Setup instructions, coding standards, PR process

BEST PRACTICES:
- Start with a clear, one-line project description
- Include working code examples that can be copy-pasted
- Document the "why" not just the "what"
- Use consistent formatting, headers, and terminology
- Keep docs close to the code they describe
- Include diagrams (Mermaid syntax) for complex flows
- Add table of contents for long documents

Always read the actual code before documenting - never guess at behavior. If existing docs exist, match their style and update rather than replace.`
  },
];

const AVAILABLE_TOOLS = [
  { id: 'bash', name: 'Terminal', description: 'Run shell commands & scripts', icon: '⚡' },
  { id: 'str_replace_editor', name: 'Edit Files', description: 'Create and modify files', icon: '✏️' },
  { id: 'explore', name: 'Explorer', description: 'Navigate & read project files', icon: '📂' },
  { id: 'search_code_subagent', name: 'Code Search', description: 'Deep semantic code search', icon: '🔍' },
  { id: 'apply_patch', name: 'Patch', description: 'Apply code patches & diffs', icon: '🩹' },
  { id: 'git_apply_patch', name: 'Git Patch', description: 'Apply git-formatted patches', icon: '🔀' },
  { id: 'fetch', name: 'Web Fetch', description: 'Fetch docs & external content', icon: '🌐' },
  { id: 'ask_user', name: 'Ask User', description: 'Ask clarifying questions', icon: '💬' },
  { id: 'task_complete', name: 'Complete', description: 'Signal task completion', icon: '✅' },
];

const AIDeveloperPage: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [projectPath, setProjectPath] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState('standard');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [selectedTools, setSelectedTools] = useState<string[]>(['bash', 'str_replace_editor', 'explore', 'search_code_subagent']);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [isThinking, setIsThinking] = useState(false);
  const [activeTools, setActiveTools] = useState<Record<string, string[]>>({});  // sessionId -> active tool names
  const [authStatus, setAuthStatus] = useState<{ authenticated: boolean; state: string; error?: string } | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
    checkAuth();
    loadModels();
    
    // Register event listener for streaming updates
    const cleanupUpdates = window.electronAPI.copilot.onUpdate(({ sessionId, chunk }) => {
      setMessages(prev => {
        const sessionMsgs = prev[sessionId] ? [...prev[sessionId]] : [];
        const lastMsg = sessionMsgs[sessionMsgs.length - 1];
        
        if (lastMsg && lastMsg.role === 'assistant') {
          const updatedMsg = { ...lastMsg, content: lastMsg.content + chunk };
          return { ...prev, [sessionId]: [...sessionMsgs.slice(0, -1), updatedMsg] };
        } else {
          return { ...prev, [sessionId]: [...sessionMsgs, { role: 'assistant', content: chunk }] };
        }
      });
      
      if (sessionId === activeSessionId) {
        scrollToBottom();
      }
    });

    // Listen for auth status updates from Copilot CLI
    const cleanupAuthStatus = window.electronAPI.copilot.onAuthStatus((data) => {
      console.log('🔐 Auth status update:', data);
      if (data.status === 'success') {
        setTimeout(() => {
          checkAuth();
        }, 1000);
      }
    });

    // Listen for tool execution events from the agent
    const cleanupToolEvents = window.electronAPI.copilot.onToolEvent?.((event) => {
      const { sessionId, type, data } = event;
      const toolName = data?.toolName || data?.name || 'unknown';
      
      if (type === 'tool.execution_started' || type === 'tool.call') {
        setActiveTools(prev => ({
          ...prev,
          [sessionId]: [...(prev[sessionId] || []), toolName]
        }));
      } else if (type === 'tool.execution_complete') {
        setActiveTools(prev => ({
          ...prev,
          [sessionId]: (prev[sessionId] || []).filter(t => t !== toolName)
        }));
      }
    });

    return () => {
      cleanupUpdates();
      cleanupAuthStatus();
      cleanupToolEvents?.();
    };
  }, []); // Remove activeSessionId from deps to prevent re-registration, handle manually if needed

  useEffect(() => {
    if (activeSessionId) {
      loadSessionMessages(activeSessionId);
      
      // Restore session state from metadata if available
      const session = sessions.find(s => s.id === activeSessionId);
      if (session) {
        if (session.projectPath) setProjectPath(session.projectPath);
        if (session.agentType) setSelectedAgent(session.agentType);
        
        // Only restore tools if they exist and are non-empty, otherwise use agent's defaults
        if (session.tools && session.tools.length > 0) {
          setSelectedTools(session.tools);
        } else {
          // Fallback to agent's default tools if session has no tools
          const agent = AGENT_TYPES.find(a => a.id === (session.agentType || selectedAgent));
          if (agent?.defaultTools) {
            setSelectedTools(agent.defaultTools);
          }
        }
        
        if (session.model) setSelectedModel(session.model);
      }
      
      scrollToBottom();
    }
  }, [activeSessionId, sessions]);

  const loadModels = async () => {
    try {
      const models = await window.electronAPI.copilot.listModels();
      setAvailableModels(models);
      
      // Get default model from store
      const defaultModel = await window.electronAPI.store.get('github_copilot_model');
      if (defaultModel) {
        setSelectedModel(defaultModel);
      } else if (models.length > 0) {
        // Fallback to first model if no default set
        // But check if gpt-4o exists as it's a good default
        const hasGpt4o = models.find((m: any) => m.id === 'gpt-4o');
        setSelectedModel(hasGpt4o ? 'gpt-4o' : models[0].id);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const loadSessions = async () => {
    const list = await window.electronAPI.copilot.listSessions();
    setSessions(list as any);
    if (list.length > 0 && !activeSessionId) {
      const lastSession = list[0];
      setActiveSessionId(lastSession.id);
    }
  };

  const loadSessionMessages = async (sessionId: string) => {
    if (messages[sessionId]) return; // Already loaded
    try {
      const history = await window.electronAPI.copilot.getMessages(sessionId);
      if (history && history.length > 0) {
        setMessages(prev => ({ ...prev, [sessionId]: history }));
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const checkAuth = async () => {
    setIsCheckingAuth(true);
    try {
      const status = await window.electronAPI.copilot.getAuthStatus();
      console.log('🔐 AI Developer - Auth status:', status);
      setAuthStatus(status);
    } catch (error) {
      console.error('❌ AI Developer - Auth check failed:', error);
      setAuthStatus({ authenticated: false, state: 'error', error: (error as Error).message });
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSelectPath = async () => {
    const paths = await window.electronAPI.dialog.openFile({
      properties: ['openDirectory'],
      title: 'Select Project Directory'
    });
    if (paths && paths.length > 0) {
      setProjectPath(paths[0]);
    }
  };

  const handleCreateSession = async () => {
    if (!projectPath) {
      alert('Please select a project path first');
      return;
    }

    try {
      const agent = AGENT_TYPES.find(a => a.id === selectedAgent);
      const sessionId = await window.electronAPI.copilot.createSession({
        projectPath,
        agentType: selectedAgent,
        tools: selectedTools,
        model: selectedModel,
        systemPrompt: agent?.systemPrompt
      });
      
      await loadSessions();
      setActiveSessionId(sessionId);
      setMessages(prev => ({ ...prev, [sessionId]: [] }));
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !activeSessionId || isThinking) return;

    const currentSessionId = activeSessionId;
    const userMessage: Message = { role: 'user', content: input };
    
    setMessages(prev => ({
      ...prev,
      [currentSessionId]: [...(prev[currentSessionId] || []), userMessage]
    }));
    setInput('');
    setIsThinking(true);

    try {
      const agent = AGENT_TYPES.find(a => a.id === selectedAgent);
      // Pass current UI selection as fallback metadata for old sessions
      await window.electronAPI.copilot.sendRequest(currentSessionId, input, {
        projectPath,
        agentType: selectedAgent,
        tools: selectedTools,
        model: selectedModel,
        systemPrompt: agent?.systemPrompt
      });
    } catch (error) {
      console.error('Failed to send request:', error);
      setMessages(prev => ({
        ...prev,
        [currentSessionId]: [
          ...(prev[currentSessionId] || []),
          { role: 'assistant', content: '❌ Error: Failed to communicate with Copilot SDK.' }
        ]
      }));
    } finally {
      setIsThinking(false);
    }
  };

  const activeSessionMessages = activeSessionId ? (messages[activeSessionId] || []) : [];
  const currentSession = sessions.find(s => s.id === activeSessionId);

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Top Header/Controls */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 shrink-0 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center space-x-6 flex-1">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <CommandLineIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">AI Developer</h1>
              <p className="text-xs text-slate-500 font-medium">Agentic Coding Workflow</p>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200 mx-2" />

          {/* Project Path */}
          <div className="flex items-center space-x-2 bg-slate-100 rounded-lg px-3 py-1.5 border border-slate-200 flex-1 max-w-sm">
            <FolderOpenIcon className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-600 truncate flex-1 font-mono">
              {projectPath || 'Select project path...'}
            </span>
            <button 
              onClick={handleSelectPath}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-white px-2 py-0.5 rounded transition-all"
            >
              Browse
            </button>
          </div>

          {/* Configuration Dropdowns */}
          <div className="flex items-center space-x-3">
            {/* Agent Type */}
            <div className="relative group">
              <button className="flex items-center space-x-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:border-indigo-300 transition-all">
                {(() => { const a = AGENT_TYPES.find(a => a.id === selectedAgent); return a ? <a.icon className={`w-4 h-4 ${a.color || 'text-indigo-500'}`} /> : <CpuChipIcon className="w-4 h-4 text-indigo-500" />; })()}
                <span className="max-w-[120px] truncate">{AGENT_TYPES.find(a => a.id === selectedAgent)?.name}</span>
                <ChevronDownIcon className="w-3 h-3 text-slate-400" />
              </button>
              <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all overflow-hidden z-20">
                <div className="p-2 border-b border-slate-100 bg-slate-50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Select Agent Brain</p>
                </div>
                <div className="max-h-[480px] overflow-y-auto">
                  {AGENT_TYPES.map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        setSelectedAgent(agent.id);
                        if (agent.defaultTools) {
                          setSelectedTools(agent.defaultTools);
                        }
                      }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors flex items-start space-x-3 border-b border-slate-50 last:border-0 ${selectedAgent === agent.id ? agent.bg || 'bg-indigo-50/50' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selectedAgent === agent.id ? agent.bg || 'bg-indigo-50' : 'bg-slate-100'}`}>
                        <agent.icon className={`w-4 h-4 ${selectedAgent === agent.id ? agent.color || 'text-indigo-600' : 'text-slate-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-slate-900 text-xs">{agent.name}</p>
                          {selectedAgent === agent.id && <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{agent.description}</p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {agent.defaultTools.slice(0, 4).map(t => (
                            <span key={t} className="px-1.5 py-0.5 bg-slate-100 text-[9px] font-medium text-slate-500 rounded">
                              {AVAILABLE_TOOLS.find(at => at.id === t)?.icon} {AVAILABLE_TOOLS.find(at => at.id === t)?.name || t}
                            </span>
                          ))}
                          {agent.defaultTools.length > 4 && <span className="px-1.5 py-0.5 text-[9px] font-medium text-slate-400">+{agent.defaultTools.length - 4}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Model Selector */}
            <div className="relative group">
              <button className="flex items-center space-x-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:border-indigo-300 transition-all font-mono">
                <SparklesIcon className="w-4 h-4 text-emerald-500" />
                <span className="max-w-[100px] truncate">{availableModels.find(m => m.id === selectedModel)?.name || selectedModel}</span>
                <ChevronDownIcon className="w-3 h-3 text-slate-400" />
              </button>
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all overflow-hidden z-20">
                <div className="p-2 border-b border-slate-100 bg-slate-50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Select Model</p>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {availableModels.map(model => (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={`w-full text-left px-4 py-2.5 text-xs hover:bg-emerald-50 transition-colors flex items-center justify-between ${selectedModel === model.id ? 'bg-emerald-50/50 text-emerald-600 font-bold' : 'text-slate-600'}`}
                    >
                      <span className="truncate">{model.name || model.id}</span>
                      {selectedModel === model.id && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
                    </button>
                  ))}
                  {availableModels.length === 0 && (
                    <div className="px-4 py-3 text-xs text-slate-400 italic">No models found</div>
                  )}
                </div>
              </div>
            </div>

            {/* Tools Selector */}
            <div className="relative group">
              <button className="flex items-center space-x-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:border-indigo-300 transition-all">
                <WrenchScrewdriverIcon className="w-4 h-4 text-indigo-500" />
                <span>Tools ({selectedTools.length})</span>
                <ChevronDownIcon className="w-3 h-3 text-slate-400" />
              </button>
              <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all overflow-hidden z-20">
                <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Enabled Capabilities</p>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const agent = AGENT_TYPES.find(a => a.id === selectedAgent);
                      if (agent?.defaultTools) setSelectedTools(agent.defaultTools);
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 px-2 py-0.5 rounded hover:bg-indigo-50 transition-all"
                  >
                    Reset
                  </button>
                </div>
                <div className="p-2 space-y-1 max-h-[400px] overflow-y-auto">
                  {AVAILABLE_TOOLS.map(tool => (
                    <button
                      key={tool.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTools(prev => 
                          prev.includes(tool.id) 
                            ? prev.filter(id => id !== tool.id) 
                            : [...prev, tool.id]
                        )
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-50 transition-colors flex items-center justify-between ${selectedTools.includes(tool.id) ? 'bg-indigo-50/50' : ''}`}
                    >
                      <div className="flex-1">
                        <p className={`font-semibold ${selectedTools.includes(tool.id) ? 'text-indigo-600' : 'text-slate-700'}`}>{tool.name}</p>
                        <p className="text-[10px] text-slate-500 line-clamp-1">{tool.description}</p>
                      </div>
                      <div className={`w-8 h-4 rounded-full relative transition-colors shrink-0 ${selectedTools.includes(tool.id) ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${selectedTools.includes(tool.id) ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button 
            onClick={handleCreateSession}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md transition-all active:scale-95"
          >
            <PlusIcon className="w-4 h-4" />
            <span>New Session</span>
          </button>

          <div className="h-6 w-px bg-slate-200" />

          <a 
            href="#/settings?tab=developer"
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            title="Developer Settings"
          >
            <Cog6ToothIcon className="w-5 h-5" />
          </a>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Session List */}
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center">
              <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 mr-2" />
              Recent Sessions
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                className={`w-full text-left p-3 rounded-xl transition-all group relative ${activeSessionId === s.id ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-50 text-slate-600'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${activeSessionId === s.id ? 'text-indigo-100' : 'text-indigo-600'}`}>
                    Session {s.id.slice(-4)}
                  </span>
                  {s.status === 'running' && (
                    <span className="flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  )}
                </div>
                <p className={`text-sm font-bold truncate ${activeSessionId === s.id ? 'text-white' : 'text-slate-900'}`}>
                  {s.projectPath ? String(s.projectPath).split('/').pop() : 'New Project'}
                </p>
                <div className="flex items-center mt-2 space-x-2">
                  <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${activeSessionId === s.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {AGENT_TYPES.find(a => a.id === (s.agentType || 'standard'))?.name || s.agentType || 'standard'}
                  </div>
                  <div className={`text-[10px] truncate max-w-[120px] ${activeSessionId === s.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {s.model || 'gpt-4o'}
                  </div>
                </div>
              </button>
            ))}

            {sessions.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                  <PlusIcon className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-400">No sessions yet</p>
                <p className="text-xs text-slate-300 mt-1">Create a new session to start coding</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100">
            <button 
              onClick={handleCreateSession}
              className="w-full flex items-center justify-center space-x-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 p-2.5 rounded-xl text-xs font-bold transition-all border border-indigo-100"
            >
              <PlusIcon className="w-4 h-4" />
              <span>New Session</span>
            </button>
          </div>
        </aside>

        {/* Main Interaction Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50 relative">
          {/* Authentication Status Banners */}
          {authStatus && authStatus.authenticated && (
            <div className="mx-8 mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between shadow-sm animate-in slide-in-from-top duration-300">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-900 leading-tight">GitHub Copilot Connected</p>
                  <p className="text-xs text-emerald-700 mt-0.5">Authenticated as {authStatus.user?.login || authStatus.statusMessage || 'user'}</p>
                </div>
              </div>
              <button 
                onClick={checkAuth}
                disabled={isCheckingAuth}
                className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-bold rounded-lg transition-all"
              >
                {isCheckingAuth ? '...' : '✓ Connected'}
              </button>
            </div>
          )}
          
          {authStatus && !authStatus.authenticated && (
            <div className="mx-8 mt-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-between shadow-sm animate-in slide-in-from-top duration-300">
              <div className="flex items-center space-x-3">
                <ExclamationCircleIcon className="w-5 h-5 text-rose-500" />
                <div>
                  <p className="text-sm font-bold text-rose-900 leading-tight">Action Required: GitHub Copilot Authentication</p>
                  <p className="text-xs text-rose-700 mt-0.5">The Copilot SDK requires authentication. Please sign in via CLI or provide a token in settings.</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={checkAuth}
                  disabled={isCheckingAuth}
                  className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                >
                  {isCheckingAuth ? (
                    <div className="w-3 h-3 border-2 border-rose-400 border-t-rose-700 rounded-full animate-spin" />
                  ) : (
                    <PlayIcon className="w-3 h-3" />
                  )}
                  Re-check
                </button>
                <a 
                  href="#/settings?tab=developer"
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-md shadow-rose-200 transition-all"
                >
                  Configure
                </a>
              </div>
            </div>
          )}

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth"
          >
            {activeSessionMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-60">
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                  <ChatBubbleLeftRightIcon className="w-10 h-10" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Developer Agent Ready</h2>
                  <p className="text-slate-500 max-w-md mt-2">
                    {projectPath 
                      ? "Start by asking to implement a feature, refactor code, or run tests in your selected project."
                      : "Select a project path and create a session to start building."
                    }
                  </p>
                </div>
                {!activeSessionId && (
                  <button 
                    onClick={handleCreateSession}
                    className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center"
                  >
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Initialize Developer Session
                  </button>
                )}
              </div>
            ) : (
              activeSessionMessages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  <div className={`max-w-[85%] rounded-2xl p-5 ${
                    msg.role === 'user' 
                      ? 'bg-slate-900 text-slate-100 shadow-2xl shadow-indigo-500/10 border border-slate-800' 
                      : 'bg-white text-slate-900 shadow-xl border border-slate-100'
                  }`}>
                    <div className="flex items-center space-x-2 mb-3 opacity-60">
                      {msg.role === 'user' ? (
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Developer</span>
                          <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <SparklesIcon className="w-3.5 h-3.5 text-indigo-500" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Atlas Intelligence</span>
                        </div>
                      )}
                    </div>
                    <div className="prose prose-slate prose-sm max-w-none">
                      <MarkdownRenderer 
                        content={msg.content} 
                        variant={msg.role === 'user' ? 'dark' : 'default'}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 shadow-xl rounded-3xl p-6 space-y-2">
                  <div className="flex items-center space-x-4">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" />
                    </div>
                    <span className="text-sm font-medium text-slate-500 italic">Thinking and orchestrating tools...</span>
                  </div>
                  {activeSessionId && (activeTools[activeSessionId] || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {(activeTools[activeSessionId] || []).map((tool, i) => (
                        <span key={`${tool}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-full text-[10px] font-medium text-amber-700">
                          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                          {AVAILABLE_TOOLS.find(t => t.id === tool)?.name || tool}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-8 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent">
            <div className="max-w-4xl mx-auto relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-500"></div>
              <div className="relative flex items-center bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden pr-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={!activeSessionId || isThinking}
                  placeholder={activeSessionId ? "Describe the coding task (e.g. 'Add a login form component'...)" : "Select a project and create a session first"}
                  rows={2}
                  className="flex-1 bg-transparent px-6 py-4 text-slate-800 focus:outline-none resize-none disabled:opacity-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!activeSessionId || isThinking || !input.trim()}
                  className={`p-3 rounded-lg transition-all ${input.trim() && activeSessionId && !isThinking ? 'bg-indigo-600 text-white shadow-lg hover:scale-105 active:scale-95' : 'text-slate-300'}`}
                >
                  <PlayIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-center mt-3 text-slate-400 font-medium">
              Press Enter to send. Shift+Enter for new line. Agent has access to selected tools.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIDeveloperPage;
