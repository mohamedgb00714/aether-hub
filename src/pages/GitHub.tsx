
import React, { useState, useEffect } from 'react';
import { db } from '../services/database';
import storage from '../services/electronStore';
import { callAI } from '../services/geminiService';
import WatchButton from '../components/WatchButton';
import {
  CodeBracketIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  SparklesIcon,
  DocumentDuplicateIcon,
  XMarkIcon,
  ChevronRightIcon,
  BugAntIcon,
  ShieldExclamationIcon,
  TagIcon,
  ChatBubbleLeftIcon,
  UserCircleIcon,
  ArrowTopRightOnSquareIcon,
  PlusIcon,
  FunnelIcon
} from '@heroicons/react/24/solid';
import { LinkIcon } from '@heroicons/react/24/outline';
import MarkdownRenderer from '../components/MarkdownRenderer';

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  user: { login: string; avatar_url: string };
  labels: { name: string; color: string }[];
  comments: number;
  html_url: string;
  aiAnalysis?: string;
  aiSuggestedFix?: string;
}

interface GitHubPR {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed' | 'merged';
  created_at: string;
  updated_at: string;
  user: { login: string; avatar_url: string };
  labels: { name: string; color: string }[];
  html_url: string;
  draft: boolean;
  aiReviewSummary?: string;
}

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  html_url: string;
  stargazers_count: number;
  open_issues_count: number;
  language?: string;
}

const GitHubPage: React.FC = () => {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [prs, setPRs] = useState<GitHubPR[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'issues' | 'prs' | 'repos'>('issues');
  const [selectedItem, setSelectedItem] = useState<GitHubIssue | GitHubPR | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);

  useEffect(() => {
    loadGitHubData();
  }, []);

  const loadGitHubData = async () => {
    setLoading(true);
    
    // Load GitHub accounts from database
    const accounts = await db.accounts.getByPlatform('github');
    
    if (accounts.length > 0) {
      // Use first GitHub account
      const githubAccount = accounts[0];
      setToken(githubAccount.accessToken || null);
      
      // Load items from database
      const allItems = await db.github.getByAccount(githubAccount.id);
      
      // Separate into types
      const issuesData = allItems.filter(item => item.type === 'issue').map(item => ({
        id: parseInt(item.id.split('_')[1] || '0'),
        number: parseInt(item.id.split('_')[1] || '0'),
        title: item.title,
        body: item.body,
        state: item.state as 'open' | 'closed',
        created_at: item.createdAt,
        updated_at: item.updatedAt,
        user: { login: item.author, avatar_url: '' },
        labels: item.labels.map(l => ({ name: l, color: '' })),
        comments: item.commentsCount,
        html_url: item.url
      }));
      setIssues(issuesData as any);
      
      const prsData = allItems.filter(item => item.type === 'pr').map(item => ({
        id: parseInt(item.id.split('_')[1] || '0'),
        number: parseInt(item.id.split('_')[1] || '0'),
        title: item.title,
        body: item.body,
        state: item.state as 'open' | 'closed' | 'merged',
        created_at: item.createdAt,
        updated_at: item.updatedAt,
        user: { login: item.author, avatar_url: '' },
        labels: item.labels.map(l => ({ name: l, color: '' })),
        html_url: item.url,
        draft: false
      }));
      setPRs(prsData as any);
      
      console.log('📛 Loaded', issuesData.length, 'issues and', prsData.length, 'PRs from database');
      
      // Fetch fresh data from API if token exists
      if (githubAccount.accessToken) {
        await fetchGitHubData(githubAccount.accessToken, githubAccount.id);
      }
    } else {
      // Check for legacy token in storage
      const savedKeys = await storage.get('nexus_keys_github') as Record<string, string> | null;
      const githubToken = savedKeys?.['Personal Access Token'];
      
      if (githubToken) {
        setToken(githubToken);
        // Create account and fetch data
        const newAccount = {
          id: `github_${Date.now()}`,
          name: 'GitHub Account',
          email: 'github@user.com',
          platform: 'github' as const,
          category: 'development' as const,
          accessToken: githubToken,
          isConnected: true
        };
        await db.accounts.upsert(newAccount);
        await fetchGitHubData(githubToken, newAccount.id);
      }
    }
    
    setLoading(false);
  };

  const fetchGitHubData = async (accessToken: string, accountId: string) => {
    try {
      // Fetch repos
      const reposResponse = await fetch('https://api.github.com/user/repos?sort=updated&per_page=20', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (reposResponse.ok) {
        const reposData = await reposResponse.json();
        setRepos(reposData);
      }

      // Fetch issues assigned to user
      const issuesResponse = await fetch('https://api.github.com/issues?filter=assigned&state=open&per_page=30', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (issuesResponse.ok) {
        const issuesData = await issuesResponse.json();
        setIssues(issuesData);
        
        // Save issues to database
        const issuesToSave = issuesData.map((issue: any) => ({
          id: `issue_${issue.number}_${issue.id}`,
          accountId: accountId,
          type: 'issue' as const,
          title: issue.title,
          url: issue.html_url,
          repository: issue.repository_url?.split('/').slice(-2).join('/') || 'unknown',
          author: issue.user?.login || 'unknown',
          state: issue.state,
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
          body: issue.body,
          labels: issue.labels?.map((l: any) => l.name) || [],
          commentsCount: issue.comments || 0,
          isRead: false
        }));
        await db.github.bulkUpsert(issuesToSave);
      }

      // Fetch PRs created by user
      const prsResponse = await fetch('https://api.github.com/search/issues?q=is:pr+author:@me+is:open&per_page=30', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (prsResponse.ok) {
        const prsData = await prsResponse.json();
        setPRs(prsData.items || []);
        
        // Save PRs to database
        const prsToSave = (prsData.items || []).map((pr: any) => ({
          id: `pr_${pr.number}_${pr.id}`,
          accountId: accountId,
          type: 'pr' as const,
          title: pr.title,
          url: pr.html_url,
          repository: pr.repository_url?.split('/').slice(-2).join('/') || 'unknown',
          author: pr.user?.login || 'unknown',
          state: pr.state,
          createdAt: pr.created_at,
          updatedAt: pr.updated_at,
          body: pr.body,
          labels: pr.labels?.map((l: any) => l.name) || [],
          commentsCount: pr.comments || 0,
          isRead: false
        }));
        await db.github.bulkUpsert(prsToSave);
      }

      showToast('GitHub data synced!');
    } catch (error) {
      console.error('Failed to fetch GitHub data:', error);
      showToast('Failed to fetch GitHub data');
    }
  };

  const saveToken = async () => {
    if (!tokenInput.trim()) return;
    
    // Save to storage for backward compatibility
    const existingKeys = await storage.get('nexus_keys_github') as Record<string, string> || {};
    await storage.set('nexus_keys_github', { ...existingKeys, 'Personal Access Token': tokenInput });
    setToken(tokenInput);
    
    // Create GitHub account in database
    const newAccount = {
      id: `github_${Date.now()}`,
      name: 'GitHub Account',
      email: 'github@user.com',
      platform: 'github' as const,
      category: 'development' as const,
      accessToken: tokenInput,
      isConnected: true
    };
    await db.accounts.upsert(newAccount);
    
    setShowTokenInput(false);
    await fetchGitHubData(tokenInput, newAccount.id);
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const analyzeIssue = async (issue: GitHubIssue) => {
    setAnalyzing(true);
    try {
      const prompt = `Analyze this GitHub issue and provide insights:

Title: ${issue.title}
Labels: ${issue.labels.map(l => l.name).join(', ') || 'None'}
Description: ${issue.body || 'No description'}

Provide:
1. Issue Summary (2-3 sentences)
2. Severity assessment (critical/high/medium/low)
3. Root cause hypothesis
4. Suggested approach to fix
5. Estimated complexity (simple/moderate/complex)
6. Any questions to ask the reporter

Be concise and technical.`;

      const response = await callAI(prompt);
      const updatedIssue = { ...issue, aiAnalysis: response };
      setSelectedItem(updatedIssue);
      setIssues(prev => prev.map(i => i.id === issue.id ? updatedIssue : i));
      showToast('Issue analyzed!');
    } catch (error) {
      showToast('Failed to analyze issue');
      console.error(error);
    }
    setAnalyzing(false);
  };

  const generateFix = async (issue: GitHubIssue) => {
    setAnalyzing(true);
    try {
      const prompt = `Generate a code fix suggestion for this GitHub issue:

Title: ${issue.title}
Labels: ${issue.labels.map(l => l.name).join(', ') || 'None'}
Description: ${issue.body || 'No description'}

Provide:
1. Step-by-step fix approach
2. Code changes needed (pseudo-code or general structure)
3. Files likely to be modified
4. Test cases to add
5. PR description template

Be practical and actionable.`;

      const response = await callAI(prompt);
      const updatedIssue = { ...issue, aiSuggestedFix: response };
      setSelectedItem(updatedIssue);
      setIssues(prev => prev.map(i => i.id === issue.id ? updatedIssue : i));
      showToast('Fix suggestion generated!');
    } catch (error) {
      showToast('Failed to generate fix');
      console.error(error);
    }
    setAnalyzing(false);
  };

  const analyzePR = async (pr: GitHubPR) => {
    setAnalyzing(true);
    try {
      const prompt = `Review this Pull Request and provide insights:

Title: ${pr.title}
Labels: ${pr.labels.map(l => l.name).join(', ') || 'None'}
Description: ${pr.body || 'No description'}
Draft: ${pr.draft ? 'Yes' : 'No'}

Provide:
1. PR Summary (what it does)
2. Potential issues or concerns
3. Review checklist items
4. Suggested improvements
5. Merge readiness assessment

Be thorough but concise.`;

      const response = await callAI(prompt);
      const updatedPR = { ...pr, aiReviewSummary: response };
      setSelectedItem(updatedPR);
      setPRs(prev => prev.map(p => p.id === pr.id ? updatedPR : p));
      showToast('PR analyzed!');
    } catch (error) {
      showToast('Failed to analyze PR');
      console.error(error);
    }
    setAnalyzing(false);
  };

  const copyToClipboard = async (text: string) => {
    if (globalThis.electronAPI?.clipboard) {
      await globalThis.electronAPI.clipboard.writeText(text);
      showToast('Copied to clipboard!');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get unique repo names from issues and PRs for filtering
  const getRepoFromUrl = (url: string) => {
    const match = url.match(/repos\/([^\/]+\/[^\/]+)/);
    return match ? match[1] : null;
  };

  const allRepoNames = [...new Set([
    ...issues.map(i => getRepoFromUrl(i.html_url)).filter(Boolean),
    ...prs.map(p => getRepoFromUrl(p.html_url)).filter(Boolean)
  ])] as string[];

  const filteredIssues = selectedRepos.length > 0 
    ? issues.filter(i => selectedRepos.some(r => i.html_url.includes(r)))
    : issues;

  const filteredPRs = selectedRepos.length > 0
    ? prs.filter(p => selectedRepos.some(r => p.html_url.includes(r)))
    : prs;

  const toggleRepoFilter = (repoName: string) => {
    if (selectedRepos.includes(repoName)) {
      setSelectedRepos(selectedRepos.filter(r => r !== repoName));
    } else {
      setSelectedRepos([...selectedRepos, repoName]);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/30">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">Loading GitHub data...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/30 p-8">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <CodeBracketIcon className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-3">Connect GitHub</h2>
          <p className="text-slate-500 mb-6">Add your GitHub Personal Access Token to sync issues, PRs, and get AI-powered insights.</p>
          
          {showTokenInput ? (
            <div className="space-y-4">
              <input
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setShowTokenInput(false)}
                  className="px-4 py-2 text-slate-500 font-bold hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={saveToken}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
                >
                  Connect
                </button>
              </div>
              <p className="text-xs text-slate-400">
                <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                  Generate a token
                </a> with repo and user scopes
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => setShowTokenInput(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
              >
                <CodeBracketIcon className="w-5 h-5" />
                Add GitHub Token
              </button>
              <p className="text-xs text-slate-400">
                Or connect via <a href="#/accounts" className="text-indigo-600 hover:underline">Connections page</a>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-gradient-to-br from-slate-50 to-indigo-50/30 overflow-hidden">
      {/* Toast */}
      {toast && (
        <div className="fixed top-24 right-8 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-right">
          {toast}
        </div>
      )}

      {/* Main List */}
      <div className={`${selectedItem ? 'w-2/5' : 'w-full'} flex flex-col border-r border-slate-100 bg-white transition-all`}>
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg">
                <CodeBracketIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900">GitHub Intelligence</h1>
                <p className="text-xs text-slate-400">{issues.length} issues · {prs.length} PRs · {repos.length} repos</p>
              </div>
            </div>
            <button
              onClick={() => fetchGitHubData(token)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Sync
            </button>
          </div>

          {/* Tabs */}
          <div className="flex bg-slate-100 rounded-xl p-1">
            {(['issues', 'prs', 'repos'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
                  activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab === 'prs' ? 'Pull Requests' : tab}
              </button>
            ))}
          </div>
          
          {/* Repo Filter */}
          {allRepoNames.length > 1 && activeTab !== 'repos' && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 mr-2">
                <FunnelIcon className="w-4 h-4 text-slate-300" />
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Filter Repos</span>
              </div>
              <button
                onClick={() => setSelectedRepos([])}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                  selectedRepos.length === 0
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100'
                }`}
              >
                All
              </button>
              {allRepoNames.slice(0, 6).map(repo => (
                <button
                  key={repo}
                  onClick={() => toggleRepoFilter(repo)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all truncate max-w-[150px] ${
                    selectedRepos.includes(repo)
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100'
                  }`}
                  title={repo}
                >
                  {repo.split('/')[1]}
                </button>
              ))}
              {selectedRepos.length > 0 && (
                <span className="text-[10px] text-slate-400">
                  {selectedRepos.length} selected
                </span>
              )}
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'issues' && filteredIssues.map(issue => (
            <div
              key={issue.id}
              onClick={() => setSelectedItem(issue)}
              className={`p-5 border-b border-slate-50 cursor-pointer transition-all hover:bg-slate-50 ${
                selectedItem?.id === issue.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-1 p-1.5 rounded-lg ${issue.state === 'open' ? 'bg-emerald-100' : 'bg-purple-100'}`}>
                  {issue.state === 'open' ? (
                    <ExclamationTriangleIcon className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <CheckCircleIcon className="w-4 h-4 text-purple-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-900 truncate">{issue.title}</span>
                    <span className="text-xs text-slate-400">#{issue.number}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{formatDate(issue.created_at)}</span>
                    {issue.comments > 0 && (
                      <span className="flex items-center gap-1">
                        <ChatBubbleLeftIcon className="w-3 h-3" />
                        {issue.comments}
                      </span>
                    )}
                  </div>
                  {issue.labels.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {issue.labels.slice(0, 3).map(label => (
                        <span
                          key={label.name}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-full"
                          style={{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }}
                        >
                          {label.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRightIcon className="w-4 h-4 text-slate-300 shrink-0" />
              </div>
            </div>
          ))}

          {activeTab === 'prs' && filteredPRs.map(pr => (
            <div
              key={pr.id}
              onClick={() => setSelectedItem(pr)}
              className={`p-5 border-b border-slate-50 cursor-pointer transition-all hover:bg-slate-50 ${
                selectedItem?.id === pr.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-1 p-1.5 rounded-lg ${pr.draft ? 'bg-slate-100' : 'bg-emerald-100'}`}>
                  <CodeBracketIcon className={`w-4 h-4 ${pr.draft ? 'text-slate-500' : 'text-emerald-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-900 truncate">{pr.title}</span>
                    <span className="text-xs text-slate-400">#{pr.number}</span>
                    {pr.draft && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">DRAFT</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{formatDate(pr.created_at)}</span>
                    <span className="flex items-center gap-1">
                      <UserCircleIcon className="w-3 h-3" />
                      {pr.user.login}
                    </span>
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-slate-300 shrink-0" />
              </div>
            </div>
          ))}

          {activeTab === 'repos' && repos.map(repo => (
            <div
              key={repo.id}
              className="p-5 border-b border-slate-50 hover:bg-slate-50 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-900">{repo.name}</span>
                    {repo.language && (
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{repo.language}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate mb-2">{repo.description || 'No description'}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>⭐ {repo.stargazers_count}</span>
                    <span>🔓 {repo.open_issues_count} issues</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <WatchButton
                    platform="github"
                    itemType="github_repo"
                    itemId={repo.id.toString()}
                    itemName={repo.name}
                    itemMetadata={{
                      owner: repo.owner?.login,
                      fullName: repo.full_name,
                      language: repo.language,
                      stars: repo.stargazers_count,
                      openIssues: repo.open_issues_count,
                      url: repo.html_url
                    }}
                    variant="icon"
                  />
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ArrowTopRightOnSquareIcon className="w-4 h-4 text-slate-400" />
                  </a>
                </div>
              </div>
            </div>
          ))}

          {((activeTab === 'issues' && issues.length === 0) ||
            (activeTab === 'prs' && prs.length === 0) ||
            (activeTab === 'repos' && repos.length === 0)) && (
            <div className="p-12 text-center">
              <p className="text-slate-400">No {activeTab} found</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedItem && (
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setSelectedItem(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-slate-400" />
              </button>
              <div className="flex gap-2">
                {'aiAnalysis' in selectedItem ? (
                  <>
                    <button
                      onClick={() => analyzeIssue(selectedItem as GitHubIssue)}
                      disabled={analyzing}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-xl text-sm font-bold hover:bg-purple-200 disabled:opacity-50"
                    >
                      <SparklesIcon className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
                      Analyze
                    </button>
                    <button
                      onClick={() => generateFix(selectedItem as GitHubIssue)}
                      disabled={analyzing}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <BugAntIcon className="w-4 h-4" />
                      AI Fix
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => analyzePR(selectedItem as GitHubPR)}
                    disabled={analyzing}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <SparklesIcon className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
                    AI Review
                  </button>
                )}
              </div>
            </div>

            <h2 className="text-xl font-black text-slate-900 mb-2">{selectedItem.title}</h2>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span>#{selectedItem.number}</span>
              <span>•</span>
              <span>{formatDate(selectedItem.created_at)}</span>
              <span>•</span>
              <a
                href={selectedItem.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
              >
                View on GitHub <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Labels */}
          {selectedItem.labels && selectedItem.labels.length > 0 && (
            <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap gap-2">
              {selectedItem.labels.map(label => (
                <span
                  key={label.name}
                  className="px-3 py-1 text-xs font-bold rounded-full"
                  style={{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {selectedItem.body && (
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wide mb-3">Description</h3>
                <div className="prose prose-slate prose-sm max-w-none">
                  <p className="text-slate-600 whitespace-pre-wrap">{selectedItem.body}</p>
                </div>
              </div>
            )}

            {/* AI Analysis */}
            {'aiAnalysis' in selectedItem && selectedItem.aiAnalysis && (
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-black text-purple-600 uppercase tracking-wide">AI Analysis</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(selectedItem.aiAnalysis!)}
                    className="text-xs text-purple-600 font-bold hover:text-purple-700"
                  >
                    <DocumentDuplicateIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                  <p className="text-sm text-purple-900 whitespace-pre-wrap">{selectedItem.aiAnalysis}</p>
                </div>
              </div>
            )}

            {/* AI Suggested Fix */}
            {'aiSuggestedFix' in selectedItem && selectedItem.aiSuggestedFix && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BugAntIcon className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-black text-emerald-600 uppercase tracking-wide">Suggested Fix</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(selectedItem.aiSuggestedFix!)}
                    className="text-xs text-emerald-600 font-bold hover:text-emerald-700"
                  >
                    <DocumentDuplicateIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <MarkdownRenderer content={selectedItem.aiSuggestedFix} variant="emerald" />
                </div>
              </div>
            )}

            {/* AI Review Summary for PRs */}
            {'aiReviewSummary' in selectedItem && selectedItem.aiReviewSummary && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-black text-indigo-600 uppercase tracking-wide">AI Review</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(selectedItem.aiReviewSummary!)}
                    className="text-xs text-indigo-600 font-bold hover:text-indigo-700"
                  >
                    <DocumentDuplicateIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <MarkdownRenderer content={selectedItem.aiReviewSummary} variant="indigo" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GitHubPage;
