
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../services/database';
import { callAI } from '../services/geminiService';
import resendConnector from '../services/connectors/resendConnector';
import storage from '../services/electronStore';
import { activityLogger } from '../services/activityLogger';
import { Account, Folder, EmailTag } from '../types';
import AccountFilter, { BrandIcon } from '../components/AccountFilter';
import WatchButton from '../components/WatchButton';
import {
  EnvelopeIcon,
  EnvelopeOpenIcon,
  StarIcon,
  TrashIcon,
  ArrowUturnLeftIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  XMarkIcon,
  DocumentDuplicateIcon,
  TagIcon,
  FolderIcon,
  PlusIcon,
  EyeSlashIcon
} from '@heroicons/react/24/solid';
import { LinkIcon } from '@heroicons/react/24/outline';
import MarkdownRenderer from '../components/MarkdownRenderer';

interface Email {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  labels?: string[];
  body?: string;
  importance?: 'high' | 'medium' | 'low';
  aiSummary?: string;
  suggestedReply?: string;
  accountId?: string;
  platform?: string;
  tags?: EmailTag[];
}

// Tag configurations
const EMAIL_TAGS: { id: EmailTag; label: string; color: string }[] = [
  { id: 'work', label: 'Work', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'personal', label: 'Personal', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'important', label: 'Important', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { id: 'newsletter', label: 'Newsletter', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'social', label: 'Social', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { id: 'promotions', label: 'Promotions', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'updates', label: 'Updates', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { id: 'finance', label: 'Finance', color: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'travel', label: 'Travel', color: 'bg-orange-100 text-orange-700 border-orange-200' },
];

const EmailsPage: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [resendSentEmails, setResendSentEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'important'>('all');
  const [emailViewMode, setEmailViewMode] = useState<'inbox' | 'sent'>('inbox');
  const [searchTerm, setSearchTerm] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingReply, setGeneratingReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTagFilter, setSelectedTagFilter] = useState<EmailTag | null>(null);
  const [showIgnoredAccounts, setShowIgnoredAccounts] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState<string | null>(null);
  const [ignoredSenders, setIgnoredSenders] = useState<string[]>([]);
  const [showIgnoredSenders, setShowIgnoredSenders] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [emailsPerPage] = useState(20);

  useEffect(() => {
    loadEmails();
    loadFolders();
    loadResendEmails();
    loadIgnoredSenders();
  }, []);

  // Reload Resend emails when view mode changes
  useEffect(() => {
    loadResendEmails();
  }, [emailViewMode]);

  const loadIgnoredSenders = async () => {
    const senders = await storage.ignoredSenders.getAll();
    setIgnoredSenders(senders);
  };

  const loadFolders = async () => {
    const dbFolders = await db.folders.getAll();
    setFolders(dbFolders);
  };

  const loadResendEmails = async () => {
    try {
      if (emailViewMode === 'inbox') {
        // Load received emails from Resend
        console.log('📧 Loading Resend received emails...');
        const receivedEmails = await resendConnector.getReceivedEmails(100);
        console.log('📧 Received emails data:', receivedEmails);
        
        const transformedReceived: Email[] = (receivedEmails || []).map((e: any) => ({
          id: `resend_rx_${e.id}`,
          from: e.from || 'Unknown Sender',
          subject: e.subject || '(No Subject)',
          snippet: e.text?.substring(0, 200) || e.html?.replace(/<[^>]*>/g, '').substring(0, 200) || '',
          date: e.created_at,
          isUnread: true,
          labels: ['received'],
          body: e.html || e.text,
          platform: 'resend',
          tags: []
        }));
        setResendSentEmails(transformedReceived);
        console.log('📧 Loaded', transformedReceived.length, 'Resend received emails');
      } else {
        // Load sent emails from Resend API
        console.log('📧 Loading Resend sent emails...');
        const sentEmails = await resendConnector.getSentEmails();
        console.log('📧 Sent emails data:', sentEmails);
        
        const transformedSent: Email[] = sentEmails.map(e => ({
          id: `resend_${e.id}`,
          from: e.from,
          subject: e.subject,
          snippet: e.html?.replace(/<[^>]*>/g, '').substring(0, 200) || e.text?.substring(0, 200) || '',
          date: e.created_at,
          isUnread: false,
          labels: ['sent', e.last_event || 'pending'],
          platform: 'resend',
          tags: []
        }));
        setResendSentEmails(transformedSent);
        console.log('📧 Loaded', transformedSent.length, 'Resend sent emails');
      }
    } catch (error) {
      console.error('❌ Failed to load Resend emails:', error);
      setResendSentEmails([]);
    }
  };

  const loadEmails = async () => {
    setLoading(true);
    
    // Load connected accounts from database (only email-capable ones)
    const connectedAccounts = await db.accounts.getAll();
    const emailAccounts = connectedAccounts.filter(a => 
      ['google', 'outlook', 'smtp'].includes(a.platform)
    );
    setAccounts(emailAccounts);
    setIsConnected(emailAccounts.length > 0);
    
    // Only select non-ignored accounts by default
    setSelectedAccountIds(emailAccounts.filter(a => !a.ignored).map(a => a.id));
    
    // Load all emails from database
    const allEmails = await db.emails.getAll();
    
    // Transform to component format
    const transformedEmails: Email[] = allEmails.map(e => ({
      id: e.id,
      from: e.sender,
      subject: e.subject,
      snippet: e.preview,
      date: e.timestamp,
      isUnread: !e.isRead,
      labels: e.labels,
      aiSummary: e.aiSummary,
      importance: e.aiPriority === 3 ? 'high' : e.aiPriority === 2 ? 'medium' : e.aiPriority === 1 ? 'low' : undefined,
      suggestedReply: e.aiSuggestedReply,
      accountId: e.accountId,
      platform: emailAccounts.find(a => a.id === e.accountId)?.platform,
      tags: e.tags as EmailTag[]
    }));
    
    setEmails(transformedEmails);
    console.log('📛 Loaded', transformedEmails.length, 'emails from database');
    
    // Auto-analyze emails that don't have AI analysis yet
    autoAnalyzeEmails(transformedEmails);
    setLoading(false);
  };

  const autoAnalyzeEmails = async (emailList: Email[]) => {
    // Get current ignored senders list
    const currentIgnoredSenders = await storage.ignoredSenders.getAll();
    
    // Find emails without AI analysis, excluding ignored senders (limit to first 5 to avoid rate limits)
    const unanalyzedEmails = emailList
      .filter(e => !e.aiSummary)
      .filter(e => !isEmailFromIgnoredSender(e.from, currentIgnoredSenders))
      .slice(0, 5);
    
    if (unanalyzedEmails.length === 0) return;
    
    setAnalyzing(true);
    showToast(`Analyzing ${unanalyzedEmails.length} emails...`);
    
    const updatedEmails = [...emailList];
    
    for (const email of unanalyzedEmails) {
      try {
        const prompt = `Quickly analyze this email. Return JSON only:
{"summary": "1-2 sentence summary", "importance": "high|medium|low", "tags": ["tag1", "tag2"]}

From: ${email.from}
Subject: ${email.subject}
Content: ${email.snippet || '(No content)'}`;

        const response = await callAI(prompt);
        const analysis = JSON.parse(response.replace(/```json\n?|```/g, '').trim());
        
        const idx = updatedEmails.findIndex(e => e.id === email.id);
        if (idx !== -1) {
          updatedEmails[idx] = {
            ...updatedEmails[idx],
            aiSummary: analysis.summary,
            importance: analysis.importance,
            tags: analysis.tags || []
          };
          
          // Save to database
          await db.emails.update(email.id, {
            aiSummary: analysis.summary,
            aiPriority: analysis.importance === 'high' ? 3 : analysis.importance === 'medium' ? 2 : 1,
            tags: analysis.tags || []
          });
        }
      } catch (err) {
        console.error('Failed to analyze email:', email.subject, err);
      }
    }
    
    setEmails(updatedEmails);
    setAnalyzing(false);
    showToast('Emails analyzed!');
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const analyzeEmail = async (email: Email) => {
    setAnalyzing(true);
    try {
      const prompt = `Analyze this email and provide:
1. A brief summary (2-3 sentences)
2. Importance level (high/medium/low) and why
3. Key action items if any
4. Suggested response tone
5. Descriptive tags (2-4 tags)

From: ${email.from}
Subject: ${email.subject}
Content: ${email.snippet || email.body || '(No content)'}

Respond in JSON format:
{
  "summary": "...",
  "importance": "high|medium|low",
  "importanceReason": "...",
  "actionItems": ["..."],
  "suggestedTone": "...",
  "tags": ["..."]
}`;

      const response = await callAI(prompt);
      try {
        const analysis = JSON.parse(response.replace(/```json\n?|```/g, '').trim());
        const updatedEmail = {
          ...email,
          aiSummary: analysis.summary,
          importance: analysis.importance,
          tags: analysis.tags || []
        };
        setSelectedEmail(updatedEmail);
        setEmails(prev => prev.map(e => e.id === email.id ? updatedEmail : e));
        
        // Save to database
        await db.emails.update(email.id, {
          aiSummary: analysis.summary,
          aiPriority: analysis.importance === 'high' ? 3 : analysis.importance === 'medium' ? 2 : 1,
          tags: analysis.tags || []
        });
        
        showToast('Email analyzed successfully!');
      } catch {
        showToast('Analysis complete - ' + response.substring(0, 100));
      }
    } catch (error) {
      showToast('Failed to analyze email');
      console.error(error);
    }
    setAnalyzing(false);
  };

  const generateReply = async (email: Email) => {
    setGeneratingReply(true);
    setShowReplyBox(true);
    try {
      const prompt = `Generate a professional, friendly reply to this email. Keep it concise and actionable.

From: ${email.from}
Subject: ${email.subject}
Content: ${email.snippet || email.body || '(No content)'}

Write ONLY the reply body text, no subject line or greeting signature. The reply should:
- Acknowledge the sender's points
- Be professional but warm
- Include any necessary next steps
- Be 2-4 sentences max`;

      const response = await callAI(prompt);
      setReplyText(response);
      const updatedEmail = { ...email, suggestedReply: response };
      setSelectedEmail(updatedEmail);
      
      // Save suggested reply to database
      await db.emails.update(email.id, {
        aiSuggestedReply: response
      });
      
      showToast('Reply generated!');
    } catch (error) {
      showToast('Failed to generate reply');
      console.error(error);
    }
    setGeneratingReply(false);
  };

  const analyzeAllEmails = async () => {
    setAnalyzing(true);
    showToast('Analyzing all emails with AI...');
    
    try {
      const emailSummaries = emails.slice(0, 20).map(e => ({
        id: e.id,
        from: e.from,
        subject: e.subject,
        snippet: e.snippet?.substring(0, 200)
      }));

      const prompt = `Analyze these emails and categorize by importance and add descriptive tags. Return JSON array:
${JSON.stringify(emailSummaries)}

Return format:
[{ "id": "...", "importance": "high|medium|low", "reason": "...", "tags": ["tag1", "tag2"] }]`;

      const response = await callAI(prompt);
      try {
        const analyses = JSON.parse(response.replace(/```json\n?|```/g, '').trim());
        setEmails(prev => prev.map(email => {
          const analysis = analyses.find((a: any) => a.id === email.id);
          if (analysis) {
            // Update database too
            db.emails.update(email.id, {
              aiPriority: analysis.importance === 'high' ? 3 : analysis.importance === 'medium' ? 2 : 1,
              tags: analysis.tags || []
            });
            return { 
              ...email, 
              importance: analysis.importance,
              tags: analysis.tags || []
            };
          }
          return email;
        }));
        showToast(`Analyzed ${analyses.length} emails!`);
      } catch {
        showToast('Bulk analysis complete');
      }
    } catch (error) {
      showToast('Failed to analyze emails');
    }
    setAnalyzing(false);
  };

  const copyToClipboard = async (text: string) => {
    if (globalThis.electronAPI?.clipboard) {
      await globalThis.electronAPI.clipboard.writeText(text);
      showToast('Copied to clipboard!');
    }
  };

  const toggleEmailTag = async (emailId: string, tag: EmailTag) => {
    const updatedEmails = emails.map(email => {
      if (email.id === emailId) {
        const currentTags = email.tags || [];
        const newTags = currentTags.includes(tag)
          ? currentTags.filter(t => t !== tag)
          : [...currentTags, tag];
        return { ...email, tags: newTags };
      }
      return email;
    });
    setEmails(updatedEmails);
    
    // Save to database
    const email = updatedEmails.find(e => e.id === emailId);
    if (email) {
      await db.emails.update(emailId, {
        tags: email.tags || []
      });
      
      // Log activity for important actions
      if (email.accountId && (tag === 'starred' || tag === 'important' || tag === 'archived')) {
        const account = accounts.find(a => a.id === email.accountId);
        const platform = account?.platform || email.platform || 'gmail';
        const actionType = tag === 'archived' ? 'archive' : 'star';
        
        await activityLogger.logEmail(
          actionType as 'star' | 'archive',
          platform,
          emailId,
          {
            subject: email.subject,
            sender: email.from
          }
        );
      }
    }
    
    // Update selected email if it's the same
    if (selectedEmail?.id === emailId) {
      const updated = updatedEmails.find(e => e.id === emailId);
      if (updated) setSelectedEmail(updated);
    }
    setShowTagMenu(null);
  };

  // Helper to check if email is from an ignored sender
  const isEmailFromIgnoredSender = (from: string, sendersList: string[]): boolean => {
    const emailLower = from.toLowerCase();
    return sendersList.some(ignored => emailLower.includes(ignored));
  };

  // Handler to add sender to ignored list
  const handleIgnoreSender = async (senderEmail: string) => {
    // Extract email from "Name <email@domain.com>" format if needed
    const emailMatch = senderEmail.match(/<([^>]+)>/);
    const email = emailMatch ? emailMatch[1] : senderEmail;
    
    await storage.ignoredSenders.add(email);
    await loadIgnoredSenders();
    showToast(`Sender "${email}" will be ignored`);
    
    // Close the selected email if it's from this sender
    if (selectedEmail && selectedEmail.from.toLowerCase().includes(email.toLowerCase())) {
      setSelectedEmail(null);
    }
  };

  // Handler to remove sender from ignored list
  const handleUnignoreSender = async (senderEmail: string) => {
    await storage.ignoredSenders.remove(senderEmail);
    await loadIgnoredSenders();
    showToast(`Sender "${senderEmail}" removed from ignored list`);
  };

  const getTagColor = (tag: EmailTag) => {
    return EMAIL_TAGS.find(t => t.id === tag)?.color || 'bg-slate-100 text-slate-600';
  };

  // Combine database emails with Resend emails based on view mode and SORT by date
  const allEmails = useMemo(() => {
    const combined = emailViewMode === 'sent' 
      ? resendSentEmails 
      : [...emails, ...resendSentEmails];
      
    // Sort combined list by date descending (most recent first)
    return [...combined].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [emails, resendSentEmails, emailViewMode]);

  const filteredEmails = allEmails.filter(email => {
    // Filter out ignored senders (unless showing ignored)
    if (emailViewMode === 'inbox' && !showIgnoredSenders) {
      if (isEmailFromIgnoredSender(email.from, ignoredSenders)) return false;
    }
    // Account filter - check if email's account is in selected accounts (only for inbox)
    if (emailViewMode === 'inbox') {
      const emailAccountId = email.accountId || '';
      if (selectedAccountIds.length > 0 && selectedAccountIds.length < accounts.filter(a => !a.ignored || showIgnoredAccounts).length) {
        if (!selectedAccountIds.includes(emailAccountId)) return false;
      }
      
      // Check if email's account is ignored (and we're not showing ignored)
      if (!showIgnoredAccounts) {
        const emailAccount = accounts.find(a => a.id === emailAccountId);
        if (emailAccount?.ignored) return false;
      }
    }
    
    // Tag filter
    if (selectedTagFilter && (!email.tags || !email.tags.includes(selectedTagFilter))) return false;
    
    // Status filter (only for inbox)
    if (emailViewMode === 'inbox') {
      if (filter === 'unread' && !email.isUnread) return false;
      if (filter === 'important' && email.importance !== 'high') return false;
    }
    
    // Search filter
    if (searchTerm && !email.subject.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !email.from.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredEmails.length / emailsPerPage);
  const startIndex = (currentPage - 1) * emailsPerPage;
  const endIndex = startIndex + emailsPerPage;
  const paginatedEmails = filteredEmails.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchTerm, selectedTagFilter, emailViewMode, selectedAccountIds, showIgnoredSenders]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setSelectedEmail(null); // Close detail panel when changing pages
    }
  };

  const getImportanceColor = (importance?: string) => {
    switch (importance) {
      case 'high': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/30">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">Loading emails...</p>
        </div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/30 p-8">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <EnvelopeIcon className="w-12 h-12 text-indigo-600" />
          </div>
          {isConnected ? (
            <>
              <h2 className="text-2xl font-black text-slate-900 mb-3">No Emails Found</h2>
              <p className="text-slate-500 mb-6">Your inbox is empty or emails haven't synced yet. Try syncing from the Connections page.</p>
              <a href="#/accounts" className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors">
                <EnvelopeIcon className="w-5 h-5" />
                Sync Emails
              </a>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-black text-slate-900 mb-3">Connect Your Email</h2>
              <p className="text-slate-500 mb-6">Connect your Google account to sync and analyze your emails with AI.</p>
              <a href="#/accounts" className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors">
                <LinkIcon className="w-5 h-5" />
                Connect Account
              </a>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-gradient-to-br from-slate-50 to-indigo-50/30 overflow-hidden h-full">
      {/* Toast */}
      {toast && (
        <div className="fixed top-24 right-8 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-right">
          {toast}
        </div>
      )}

      {/* Email List */}
      <div className={`${selectedEmail ? 'w-2/5' : 'w-full'} flex flex-col border-r border-slate-100 bg-white transition-all h-full overflow-hidden`}>
        {/* Header */}
        <div className="p-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <EnvelopeIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900">Email Intelligence</h1>
                <p className="text-xs text-slate-400">
                  {emailViewMode === 'inbox' 
                    ? `${filteredEmails.length} emails · Page ${currentPage} of ${totalPages || 1}`
                    : `${filteredEmails.length} sent via Resend`
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Inbox/Sent Toggle */}
              <div className="flex bg-slate-100 rounded-xl p-1">
                <button
                  onClick={() => setEmailViewMode('inbox')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    emailViewMode === 'inbox' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <EnvelopeIcon className="w-4 h-4" />
                  Inbox
                </button>
                <button
                  onClick={() => setEmailViewMode('sent')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    emailViewMode === 'sent' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                  Sent ({resendSentEmails.length})
                </button>
              </div>
              {emailViewMode === 'inbox' && (
                <button
                  onClick={analyzeAllEmails}
                  disabled={analyzing}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all"
                >
                  <SparklesIcon className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
                  {analyzing ? 'Analyzing...' : 'AI Analyze All'}
                </button>
              )}
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="text"
                placeholder="Search emails..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div className="flex bg-slate-100 rounded-xl p-1">
              {(['all', 'unread', 'important'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold capitalize transition-all ${
                    filter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          
          {/* Tag Filter */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex items-center gap-2 mr-2">
              <TagIcon className="w-4 h-4 text-slate-300" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Tags</span>
            </div>
            <button
              onClick={() => setSelectedTagFilter(null)}
              className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                !selectedTagFilter 
                  ? 'bg-slate-800 text-white' 
                  : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100'
              }`}
            >
              All Tags
            </button>
            {EMAIL_TAGS.map(tag => {
              const count = emails.filter(e => e.tags?.includes(tag.id)).length;
              return (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTagFilter(selectedTagFilter === tag.id ? null : tag.id)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 border ${
                    selectedTagFilter === tag.id
                      ? tag.color
                      : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'
                  }`}
                >
                  {tag.label}
                  {count > 0 && <span className="opacity-70">({count})</span>}
                </button>
              );
            })}
          </div>
          
          {/* Account Filter - only show for inbox */}
          {emailViewMode === 'inbox' && accounts.length > 0 && (
            <AccountFilter
              accounts={accounts}
              selectedAccountIds={selectedAccountIds}
              onFilterChange={setSelectedAccountIds}
              folders={folders}
              selectedFolderId={selectedFolderId}
              onFolderSelect={setSelectedFolderId}
              showFolders={folders.length > 0}
              showIgnored={showIgnoredAccounts}
              onToggleIgnored={() => setShowIgnoredAccounts(!showIgnoredAccounts)}
              compact
            />
          )}
          
          {/* Ignored Senders Toggle */}
          {emailViewMode === 'inbox' && ignoredSenders.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => setShowIgnoredSenders(!showIgnoredSenders)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  showIgnoredSenders 
                    ? 'bg-rose-100 text-rose-600 border border-rose-200' 
                    : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100'
                }`}
              >
                <EyeSlashIcon className="w-3.5 h-3.5" />
                {showIgnoredSenders ? 'Hiding Ignored Senders' : 'Show Ignored Senders'}
                <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full text-[10px]">
                  {ignoredSenders.length}
                </span>
              </button>
              <a 
                href="#/settings" 
                className="text-xs text-indigo-600 font-medium hover:underline"
              >
                Manage List
              </a>
            </div>
          )}
        </div>

        {/* Email List */}
        <div className="flex-1 overflow-y-auto">
          {paginatedEmails.map(email => (
            <div
              key={email.id}
              onClick={async () => {
                setSelectedEmail(email);
                
                // Log email read activity
                if (email.id && email.accountId) {
                  const account = accounts.find(a => a.id === email.accountId);
                  const platform = account?.platform || email.platform || 'gmail';
                  
                  await activityLogger.logEmail(
                    'read',
                    platform,
                    email.id,
                    {
                      subject: email.subject,
                      sender: email.from,
                      topics: email.tags || []
                    }
                  );
                }
                
                // Mark as read in database
                if (email.isUnread && email.id) {
                  await db.emails.update(email.id, { isRead: true });
                  setEmails(prev => prev.map(e => 
                    e.id === email.id ? { ...e, isUnread: false } : e
                  ));
                }
              }}
              className={`p-5 border-b border-slate-50 cursor-pointer transition-all hover:bg-slate-50 ${
                selectedEmail?.id === email.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''
              } ${email.isUnread ? 'bg-white' : 'bg-slate-50/50'}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
                  emailViewMode === 'sent' 
                    ? (email.labels?.includes('delivered') ? 'bg-emerald-500' : email.labels?.includes('bounced') ? 'bg-rose-500' : 'bg-amber-500')
                    : (email.isUnread ? 'bg-indigo-600' : 'bg-transparent')
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm truncate ${email.isUnread ? 'font-black text-slate-900' : 'font-medium text-slate-600'}`}>
                      {emailViewMode === 'sent' 
                        ? `To: ${email.from}` 
                        : (email.from?.split('<')[0]?.trim() || email.from)
                      }
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold shrink-0 ml-2">
                      {new Date(email.date).toLocaleDateString()}
                    </span>
                  </div>
                  <p className={`text-sm truncate mb-1 ${email.isUnread ? 'font-bold text-slate-800' : 'text-slate-600'}`}>
                    {email.subject || '(No Subject)'}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{email.snippet}</p>
                  
                  {/* Tags and badges row */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {/* Status badge for sent emails */}
                    {emailViewMode === 'sent' && email.labels && (
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${
                        email.labels.includes('delivered') ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                        email.labels.includes('opened') ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        email.labels.includes('clicked') ? 'bg-purple-100 text-purple-700 border-purple-200' :
                        email.labels.includes('bounced') ? 'bg-rose-100 text-rose-700 border-rose-200' :
                        'bg-amber-100 text-amber-700 border-amber-200'
                      }`}>
                        {email.labels.find(l => ['delivered', 'opened', 'clicked', 'bounced', 'sent', 'pending'].includes(l)) || 'sent'}
                      </span>
                    )}
                    {emailViewMode === 'inbox' && email.importance && (
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${getImportanceColor(email.importance)}`}>
                        {email.importance}
                      </span>
                    )}
                    {email.tags?.map(tag => (
                      <span key={tag} className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${getTagColor(tag)}`}>
                        {EMAIL_TAGS.find(t => t.id === tag)?.label || tag}
                      </span>
                    ))}
                    {emailViewMode === 'sent' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full">
                        <PaperAirplaneIcon className="w-3 h-3" />
                        Resend
                      </span>
                    )}
                    {emailViewMode === 'inbox' && email.platform && accounts.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full" title={accounts.find(a => a.id === email.accountId)?.name || ''}>
                        <BrandIcon platform={email.platform} className="w-3 h-3" />
                        {accounts.find(a => a.id === email.accountId)?.email || accounts.find(a => a.id === email.accountId)?.name || email.platform}
                      </span>
                    )}
                    
                    {/* Show unignore button for ignored senders */}
                    {emailViewMode === 'inbox' && showIgnoredSenders && isEmailFromIgnoredSender(email.from, ignoredSenders) && (
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          const emailMatch = email.from.match(/<([^>]+)>/);
                          const extractedEmail = emailMatch ? emailMatch[1] : email.from;
                          handleUnignoreSender(extractedEmail.toLowerCase().trim());
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-full hover:bg-rose-100 transition-colors"
                        title="Remove from ignored list"
                      >
                        <EyeSlashIcon className="w-3 h-3" />
                        Ignored
                      </button>
                    )}
                    
                    {/* Quick tag button - only for inbox */}
                    {emailViewMode === 'inbox' && (
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowTagMenu(showTagMenu === email.id ? null : email.id); }}
                          className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                          title="Add tag"
                        >
                          <TagIcon className="w-3 h-3 text-slate-400" />
                        </button>
                        
                        {showTagMenu === email.id && (
                          <div 
                            className="absolute left-0 top-6 z-50 bg-white rounded-xl shadow-xl border border-slate-100 p-2 min-w-[140px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className="text-[9px] font-black text-slate-400 uppercase px-2 mb-1">Add Tag</p>
                            {EMAIL_TAGS.map(tag => (
                              <button
                                key={tag.id}
                                onClick={() => toggleEmailTag(email.id, tag.id)}
                                className={`w-full text-left px-2 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                                  email.tags?.includes(tag.id) 
                                    ? tag.color 
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {email.tags?.includes(tag.id) && <CheckCircleIcon className="w-3 h-3" />}
                                {tag.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-slate-300 shrink-0" />
              </div>
            </div>
          ))}
          
          {filteredEmails.length === 0 && (emailViewMode === 'inbox' ? emails.length > 0 : resendSentEmails.length === 0) && (
            <div className="p-8 text-center">
              {emailViewMode === 'sent' ? (
                <>
                  <PaperAirplaneIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No sent emails yet</p>
                  <p className="text-xs text-slate-400 mt-1">Send emails via the Campaigns page</p>
                  <a 
                    href="#/resend" 
                    className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
                  >
                    <PaperAirplaneIcon className="w-4 h-4" />
                    Go to Campaigns
                  </a>
                </>
              ) : (
                <>
                  <EyeSlashIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No emails match your filters</p>
                  <p className="text-xs text-slate-400 mt-1">Try adjusting your account or tag filters</p>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm flex items-center justify-between shrink-0">
            <div className="text-xs text-slate-500">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredEmails.length)} of {filteredEmails.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="Previous page"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              
              {/* Page numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                        currentPage === pageNum 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="Next page"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Email Detail - Fixed right panel */}
      {selectedEmail && (
        <div className="w-3/5 flex flex-col bg-white overflow-hidden sticky top-0 h-full">
          {/* Detail Header */}
          <div className="p-6 border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => { setSelectedEmail(null); setShowReplyBox(false); }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-slate-400" />
              </button>
              <div className="flex gap-2">
                <WatchButton
                  platform="email"
                  itemType="email_address"
                  itemId={selectedEmail.from.toLowerCase().trim().match(/<([^>]+)>/)?.[1] || selectedEmail.from.toLowerCase().trim()}
                  itemName={selectedEmail.from.split('<')[0].trim() || selectedEmail.from}
                  itemMetadata={{ subject: selectedEmail.subject, accountId: selectedEmail.accountId }}
                />
                <button
                  onClick={() => handleIgnoreSender(selectedEmail.from)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
                  title="Ignore emails from this sender"
                >
                  <EyeSlashIcon className="w-4 h-4" />
                  Ignore Sender
                </button>
                <button
                  onClick={() => analyzeEmail(selectedEmail)}
                  disabled={analyzing}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-xl text-sm font-bold hover:bg-purple-200 disabled:opacity-50 transition-all"
                >
                  <SparklesIcon className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
                  {analyzing ? 'Analyzing...' : 'Analyze'}
                </button>
                <button
                  onClick={() => generateReply(selectedEmail)}
                  disabled={generatingReply}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all"
                >
                  <ArrowUturnLeftIcon className={`w-4 h-4 ${generatingReply ? 'animate-spin' : ''}`} />
                  {generatingReply ? 'Generating...' : 'AI Reply'}
                </button>
              </div>
            </div>

            <h2 className="text-xl font-black text-slate-900 mb-2">{selectedEmail.subject || '(No Subject)'}</h2>
            <div className="flex items-center gap-4 text-sm text-slate-500 mb-3">
              <span className="font-bold">{selectedEmail.from}</span>
              <span>•</span>
              <span>{new Date(selectedEmail.date).toLocaleString()}</span>
              {selectedEmail.importance && (
                <>
                  <span>•</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${getImportanceColor(selectedEmail.importance)}`}>
                    {selectedEmail.importance} priority
                  </span>
                </>
              )}
            </div>
            
            {/* Tags in detail view */}
            <div className="flex flex-wrap items-center gap-2">
              {selectedEmail.tags?.map(tag => (
                <span 
                  key={tag} 
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full border cursor-pointer hover:opacity-80 ${getTagColor(tag)}`}
                  onClick={() => toggleEmailTag(selectedEmail.id, tag)}
                  title="Click to remove tag"
                >
                  {EMAIL_TAGS.find(t => t.id === tag)?.label || tag}
                  <XMarkIcon className="w-3 h-3 inline ml-1" />
                </span>
              ))}
              <div className="relative">
                <button
                  onClick={() => setShowTagMenu(showTagMenu === 'detail' ? null : 'detail')}
                  className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors flex items-center gap-1"
                >
                  <PlusIcon className="w-3 h-3" />
                  Add Tag
                </button>
                {showTagMenu === 'detail' && (
                  <div className="absolute left-0 top-7 z-50 bg-white rounded-xl shadow-xl border border-slate-100 p-2 min-w-[140px]">
                    {EMAIL_TAGS.filter(t => !selectedEmail.tags?.includes(t.id)).map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => toggleEmailTag(selectedEmail.id, tag.id)}
                        className="w-full text-left px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        {tag.label}
                      </button>
                    ))}
                    {selectedEmail.tags?.length === EMAIL_TAGS.length && (
                      <p className="text-xs text-slate-400 px-2 py-1">All tags added</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto">
            {/* AI Summary */}
            {selectedEmail.aiSummary && (
              <div className="mx-6 mt-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-100">
                <div className="flex items-center gap-2 mb-2">
                  <SparklesIcon className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-black text-purple-600 uppercase tracking-wide">AI Summary</span>
                </div>
                <MarkdownRenderer content={selectedEmail.aiSummary} variant="purple" />
              </div>
            )}

            {/* Email Body */}
            <div className="p-6">
              <div className="prose prose-slate max-w-none">
                <p className="text-slate-600 whitespace-pre-wrap">{selectedEmail.snippet || selectedEmail.body || '(No content available)'}</p>
              </div>
            </div>
          </div>

          {/* Reply Box */}
          {showReplyBox && (
            <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wide">AI Generated Reply</span>
                <button
                  onClick={() => copyToClipboard(replyText)}
                  className="flex items-center gap-1 text-xs text-indigo-600 font-bold hover:text-indigo-700"
                >
                  <DocumentDuplicateIcon className="w-4 h-4" />
                  Copy
                </button>
              </div>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="AI-generated reply will appear here..."
                className="w-full h-32 p-4 bg-white border border-slate-200 rounded-xl text-sm resize-none outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => setShowReplyBox(false)}
                  className="px-4 py-2 text-slate-500 text-sm font-bold hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { copyToClipboard(replyText); showToast('Reply copied! Paste in Gmail to send.'); }}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700"
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                  Copy to Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmailsPage;
