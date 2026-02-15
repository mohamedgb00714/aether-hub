import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarEvent, Account, WhatsAppChat } from '../types';
import { prioritizeNotifications, getTopicNews, NewsSummaryResponse, getEventBriefing, summarizeNotifications, summarizeCalendar } from '../services/geminiService';
import { db, GithubItem } from '../services/database';
import storage from '../services/electronStore';
import { syncAllAccounts } from '../services/autoSync';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import AccountFilter, { BrandIcon, getAccountBrandColor } from '../components/AccountFilter';
import {
  EnvelopeIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  MapPinIcon,
  ChevronRightIcon,
  UserGroupIcon,
  GlobeAltIcon,
  ArrowTopRightOnSquareIcon,
  SparklesIcon,
  ClockIcon,
  PaperClipIcon,
  ChatBubbleLeftRightIcon,
  VideoCameraIcon,
  BellAlertIcon,
  PaperAirplaneIcon,
  CodeBracketIcon,
  StarIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  ComputerDesktopIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/solid';

interface DashboardEmail {
  id: string;
  accountId: string;
  platform: string;
  sender: string;
  subject: string;
  excerpt: string;
  timestamp: string;
  read: boolean;
  topic: string;
  type: string;
  category: string;
  isImportant?: boolean;
  aiPriority?: number;
}

interface AutomationInfo {
  id: string;
  name: string;
  status: string;
  last_run: string | null;
}

interface DashboardEvent extends CalendarEvent {
  platform?: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const [emails, setEmails] = useState<DashboardEmail[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [githubItems, setGithubItems] = useState<GithubItem[]>([]);
  const [whatsappChats, setWhatsappChats] = useState<WhatsAppChat[]>([]);
  const [automations, setAutomations] = useState<AutomationInfo[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<DashboardEmail | null>(null);
  const [replyText, setReplyText] = useState('');

  const [emailSummary, setEmailSummary] = useState<string>('');
  const [calendarSummary, setCalendarSummary] = useState<string>('');
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingLastUpdated, setBriefingLastUpdated] = useState<Date | undefined>();
  const [briefingExpanded, setBriefingExpanded] = useState(true);

  const [lastSyncTime, setLastSyncTime] = useState<Date | undefined>();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | undefined>();

  const [whatsappConnected, setWhatsappConnected] = useState(false);

  const [newsTopics] = useState<string[]>(['AI Technology', 'Stock Market', 'Cybersecurity']);
  const [newsSummary, setNewsSummary] = useState<NewsSummaryResponse | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState<DashboardEvent | null>(null);
  const [eventBriefing, setEventBriefing] = useState<string>('');
  const [eventBriefingLoading, setEventBriefingLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }, []);

  const currentTime = useMemo(() => {
    return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }, []);

  const quickStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayEvents = events.filter(ev => {
      const d = new Date(ev.startTime);
      return d >= today && d < tomorrow;
    });
    const importantEmailsCount = emails.filter(e => e.isImportant === true || e.aiPriority === 3).length;
    const unreadImportantEmails = emails.filter(e => (e.isImportant === true || e.aiPriority === 3) && !e.read).length;
    const openPRs = githubItems.filter(i => i.type === 'pr' && i.state === 'open').length;
    const openIssues = githubItems.filter(i => i.type === 'issue' && i.state === 'open').length;
    const unreadMessages = whatsappChats.reduce((acc, chat) => acc + chat.unreadCount, 0);
    const runningAutomations = automations.filter(a => a.status === 'running').length;
    return { unreadEmails: unreadImportantEmails, importantEmailsCount, todayMeetings: todayEvents.length, unreadMessages, openPRs, openIssues, runningAutomations, totalAutomations: automations.length };
  }, [emails, events, githubItems, whatsappChats, automations]);

  useEffect(() => {
    const loadData = async () => {
      const savedFilters = await storage.get('dashboard_filters');
      const savedLastSync = await storage.get('dashboard_last_sync');
      if (savedFilters && Array.isArray(savedFilters)) setSelectedAccountIds(savedFilters);
      if (savedLastSync) setLastSyncTime(new Date(savedLastSync));
      const connectedAccounts = await db.accounts.getAll();
      if (connectedAccounts?.length > 0) {
        setAccounts(connectedAccounts);
        setSelectedAccountIds(connectedAccounts.map(a => a.id));
      }
      const allGithub = await db.github.getAll();
      setGithubItems(allGithub);
      try {
        const result = await window.electronAPI.automation.getAll();
        if (result.success && result.automations) setAutomations(result.automations);
      } catch (_) {}
      if (window.electronAPI?.whatsapp) {
        const isReady = await window.electronAPI.whatsapp.isReady();
        setWhatsappConnected(isReady);
        if (isReady) {
          const chats = await window.electronAPI.whatsapp.getChats(10);
          setWhatsappChats(chats);
        }
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const processData = async () => {
      setLoading(true);
      const allEmails = await db.emails.getAll();
      const emailsToProcess = allEmails.map((email) => {
        const account = accounts.find(a => a.id === email.accountId);
        return {
          id: email.id, accountId: email.accountId, platform: account?.platform || 'google',
          sender: email.sender, subject: email.subject, excerpt: email.preview,
          timestamp: new Date(email.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          read: email.isRead, topic: 'Email', type: 'email',
          category: email.aiCategory || 'Inbox', isImportant: email.isImportant, aiPriority: email.aiPriority,
        };
      });
      const allEvents = await db.events.getAll();
      const transformedEvents = allEvents.map((evt) => {
        const account = accounts.find(a => a.id === evt.accountId);
        return {
          id: evt.id, accountId: evt.accountId,
          title: evt.title,
          startTime: new Date(evt.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          endTime: new Date(evt.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          location: evt.location || evt.eventLink || '', attendees: evt.attendees || [],
          description: evt.description || '', isAllDay: evt.isAllDay || false,
          platform: account?.platform || 'google' as const,
        };
      });
      setEvents(transformedEvents as DashboardEvent[]);
      const prioritized = await prioritizeNotifications(emailsToProcess as any[]);
      setEmails(prioritized as any);
      setLoading(false);
    };
    if (accounts.length > 0) processData();
  }, [accounts]);

  const generateBriefing = useCallback(async () => {
    if (emails.length === 0 && events.length === 0) return;
    setBriefingLoading(true);
    try {
      const [emailSum, calSum] = await Promise.all([
        emails.length > 0 ? summarizeNotifications(emails as any) : Promise.resolve(''),
        events.length > 0 ? summarizeCalendar(events) : Promise.resolve('')
      ]);
      setEmailSummary(emailSum);
      setCalendarSummary(calSum);
      setBriefingLastUpdated(new Date());
    } catch (error) { console.error('Error generating briefing:', error); }
    setBriefingLoading(false);
  }, [emails, events]);

  useEffect(() => {
    if (!loading && (emails.length > 0 || events.length > 0)) generateBriefing();
  }, [loading, emails.length, events.length]);

  useEffect(() => {
    if (newsTopics.length > 0) {
      setNewsLoading(true);
      getTopicNews(newsTopics).then(r => { setNewsSummary(r); setNewsLoading(false); });
    }
  }, [newsTopics]);

  const handleManualSync = async () => {
    setIsSyncing(true); setSyncError(undefined);
    try {
      const result = await syncAllAccounts();
      if (result.success) {
        setLastSyncTime(new Date());
        await storage.set('dashboard_last_sync', new Date().toISOString());
        setGithubItems(await db.github.getAll());
        showToast(`Synced ${result.synced.length} accounts!`);
      }
    } catch (error: any) { setSyncError(error.message || 'Sync failed'); }
    setIsSyncing(false);
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleEventClick = async (event: CalendarEvent) => {
    setSelectedEvent(event); setEventBriefingLoading(true);
    const briefing = await getEventBriefing(event);
    setEventBriefing(briefing); setEventBriefingLoading(false);
  };

  const handleEmailClick = (email: DashboardEmail) => { setSelectedEmail(email); setReplyText(''); };

  const handleSendReply = () => {
    if (!selectedEmail || !replyText.trim()) return;
    window.open(`mailto:${selectedEmail.sender}?subject=${encodeURIComponent(`Re: ${selectedEmail.subject}`)}&body=${encodeURIComponent(replyText)}`, '_blank');
    showToast('Opening email client...'); setSelectedEmail(null); setReplyText('');
  };

  const handleLaunchZoom = () => {
    if (selectedEvent?.location?.toLowerCase().includes('zoom')) { showToast("Launching Zoom..."); window.open('https://zoom.us', '_blank'); }
    else showToast("No video link found.");
  };
  const handleReschedule = () => showToast("Opening calendar...");
  const handleCopyBriefing = async () => {
    if (!eventBriefing) return;
    try { if (window.electronAPI?.clipboard) await window.electronAPI.clipboard.writeText(eventBriefing); else await navigator.clipboard.writeText(eventBriefing); showToast("Copied!"); } catch (_) { showToast("Failed to copy"); }
  };
  const handleShareBriefing = () => {
    if (!selectedEvent) return;
    window.open(`mailto:?subject=${encodeURIComponent(`Meeting Briefing: ${selectedEvent.title}`)}&body=${encodeURIComponent(`Meeting: ${selectedEvent.title}\n${selectedEvent.startTime} - ${selectedEvent.endTime}\n\n${eventBriefing}`)}`, '_blank');
    showToast("Opening email...");
  };
  const handleGitHubItemClick = (item: GithubItem) => window.open(item.url, '_blank');

  const importantEmails = emails.filter(e =>
    (e.isImportant || e.aiPriority === 3) &&
    (selectedAccountIds.length === 0 || selectedAccountIds.includes(e.accountId)) &&
    (e.sender.toLowerCase().includes(searchTerm.toLowerCase()) || e.subject.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const filteredEvents = events.filter(ev =>
    (selectedAccountIds.length === 0 || selectedAccountIds.includes(ev.accountId)) &&
    ev.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || 'Unknown';
  const renderedNewsHtml = useMemo(() => newsSummary?.text ? DOMPurify.sanitize(marked.parse(newsSummary.text) as string) : '', [newsSummary]);
  const renderedBriefingHtml = useMemo(() => eventBriefing ? DOMPurify.sanitize(marked.parse(eventBriefing) as string) : '', [eventBriefing]);
  const combinedBriefing = useMemo(() => [calendarSummary, emailSummary].filter(Boolean).join('\n\n'), [emailSummary, calendarSummary]);

  const statCards = [
    { id: 'emails', label: 'Important Emails', value: quickStats.importantEmailsCount, sub: `${quickStats.unreadEmails} unread`, icon: EnvelopeIcon, gradient: 'from-rose-500 to-pink-600', glow: 'hover:shadow-rose-500/10', link: '/emails' },
    { id: 'meetings', label: "Today's Meetings", value: quickStats.todayMeetings, sub: 'scheduled', icon: CalendarIcon, gradient: 'from-indigo-500 to-blue-600', glow: 'hover:shadow-indigo-500/10', link: '/calendar' },
    { id: 'messages', label: 'Messages', value: quickStats.unreadMessages, sub: 'unread', icon: ChatBubbleLeftRightIcon, gradient: 'from-emerald-500 to-teal-600', glow: 'hover:shadow-emerald-500/10', link: '/whatsapp' },
    { id: 'prs', label: 'Pull Requests', value: quickStats.openPRs, sub: `${quickStats.openIssues} issues`, icon: CodeBracketIcon, gradient: 'from-violet-500 to-purple-600', glow: 'hover:shadow-violet-500/10', link: '/github' },
    { id: 'automations', label: 'Automations', value: quickStats.runningAutomations, sub: `${quickStats.totalAutomations} total`, icon: ComputerDesktopIcon, gradient: 'from-amber-500 to-orange-600', glow: 'hover:shadow-amber-500/10', link: '/automation-results' },
  ];

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-8 px-6 lg:px-10 pt-4">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300">
          <BellAlertIcon className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-semibold">{toast}</span>
        </div>
      )}

      {/* ═══ HERO HEADER ═══ */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <SparklesIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{greeting}</h1>
            <p className="text-sm text-slate-400">{formattedDate} <span className="text-slate-300 mx-1">•</span> <span className="text-indigo-500 font-medium">{currentTime}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search..."
              className="w-48 bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 outline-none transition-all" />
          </div>
          <button onClick={handleManualSync} disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50">
            <ArrowPathIcon className={`w-4 h-4 ${isSyncing ? 'animate-spin text-indigo-500' : ''}`} />
            {isSyncing ? 'Syncing' : 'Sync'}
          </button>
          <div className="hidden lg:block">
            <AccountFilter accounts={accounts} selectedAccountIds={selectedAccountIds}
              onFilterChange={async (newFilters) => { setSelectedAccountIds(newFilters); await storage.set('dashboard_filters', newFilters); }} />
          </div>
        </div>
      </div>

      {/* ═══ STAT CARDS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {statCards.map(card => (
          <Link key={card.id} to={card.link}
            className={`relative group bg-white rounded-2xl p-4 border border-slate-100 hover:border-slate-200 transition-all duration-300 hover:shadow-lg ${card.glow} overflow-hidden`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 bg-gradient-to-br ${card.gradient} rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                <card.icon className="w-4 h-4 text-white" />
              </div>
              <ChevronRightIcon className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight leading-none">
              {loading ? <div className="h-7 w-8 bg-slate-100 rounded animate-pulse" /> : card.value}
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">{card.label}</p>
            <p className="text-[10px] text-slate-300">{card.sub}</p>
          </Link>
        ))}
      </div>

      {/* ═══ AI BRIEFING ═══ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-2xl mb-6">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djZoLTZ2LTZoNnptMC0xMHY2aC02di02aDZ6bTAtMTB2NmgtNnYtNmg2em0xMCAxMHY2aC02di02aDZ6bS0xMCAwdjZoLTZ2LTZoNnptMTAgMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="relative z-10 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <SparklesIcon className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">AI Daily Briefing</h2>
                <p className="text-[11px] text-slate-500">{briefingLastUpdated ? `Updated ${briefingLastUpdated.toLocaleTimeString()}` : 'Generating...'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={generateBriefing} disabled={briefingLoading} className="w-8 h-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center transition-all" title="Refresh">
                <ArrowPathIcon className={`w-3.5 h-3.5 text-slate-400 ${briefingLoading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => setBriefingExpanded(!briefingExpanded)} title="Toggle briefing" className="w-8 h-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center transition-all">
                <ChevronRightIcon className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${briefingExpanded ? 'rotate-90' : ''}`} />
              </button>
            </div>
          </div>
          {briefingExpanded && (
            <div className="animate-in slide-in-from-top-2 duration-300">
              {briefingLoading ? (
                <div className="flex items-center justify-center py-8 gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin" />
                  <p className="text-sm text-slate-500">Generating your briefing...</p>
                </div>
              ) : combinedBriefing ? (
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
                  <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed prose-headings:text-white prose-headings:font-bold prose-strong:text-white prose-ul:my-2 prose-li:my-0.5 prose-p:my-2"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(combinedBriefing) as string) }} />
                </div>
              ) : (
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10 text-center">
                  <SparklesIcon className="w-8 h-8 text-indigo-500/40 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Sync accounts to get AI briefings</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ MAIN BENTO GRID ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">

        {/* TODAY'S AGENDA */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group hover:shadow-md hover:border-slate-200 transition-all duration-300">
          <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
                <CalendarIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Today's Agenda</h2>
                <p className="text-[10px] text-slate-400">{quickStats.todayMeetings} meetings</p>
              </div>
            </div>
            <Link to="/calendar" className="text-xs font-medium text-indigo-500 hover:text-indigo-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              View all <ChevronRightIcon className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-2 max-h-[300px] overflow-y-auto">
            {filteredEvents.length === 0 ? (
              <div className="py-10 text-center">
                <CalendarIcon className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-medium">No events today</p>
                <p className="text-[11px] text-slate-300">Enjoy your free time!</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredEvents.slice(0, 6).map((ev, i) => (
                  <div key={ev.id} onClick={() => handleEventClick(ev)}
                    className="px-4 py-3 hover:bg-indigo-50/50 rounded-xl transition-all group/item flex items-center gap-4 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className={`w-1 h-10 rounded-full ${i === 0 ? 'bg-indigo-500' : i === 1 ? 'bg-purple-400' : 'bg-slate-200'}`} />
                      <p className="text-sm font-bold text-slate-900 min-w-[50px]">{ev.startTime}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 text-sm truncate group-hover/item:text-indigo-600 transition-colors">{ev.title}</h3>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                        {ev.location && <span className="flex items-center gap-1 truncate"><MapPinIcon className="w-3 h-3 flex-shrink-0" /> {ev.location}</span>}
                        {ev.attendees.length > 0 && <span className="flex items-center gap-1"><UserGroupIcon className="w-3 h-3" /> {ev.attendees.length}</span>}
                      </div>
                    </div>
                    <ChevronRightIcon className="w-4 h-4 text-slate-200 group-hover/item:text-indigo-500 transition-all flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* IMPORTANT EMAILS */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group hover:shadow-md hover:border-slate-200 transition-all duration-300">
          <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-sm">
                <StarIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Important Emails</h2>
                <p className="text-[10px] text-slate-400">{importantEmails.length} total • {quickStats.unreadEmails} unread</p>
              </div>
            </div>
            <Link to="/emails" className="text-xs font-medium text-indigo-500 hover:text-indigo-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              View all <ChevronRightIcon className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-2 max-h-[300px] overflow-y-auto">
            {importantEmails.length === 0 ? (
              <div className="py-10 text-center">
                <StarIcon className="w-10 h-10 text-amber-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-medium">No important emails</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {importantEmails.slice(0, 5).map(email => (
                  <div key={email.id} onClick={() => handleEmailClick(email)}
                    className={`px-4 py-3 flex items-center gap-3 hover:bg-amber-50/50 rounded-xl transition-all cursor-pointer group/item ${email.read ? 'opacity-50' : ''}`}>
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover/item:scale-105 transition-transform">
                        <BrandIcon platform={email.platform} className="w-4 h-4" />
                      </div>
                      {!email.read && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-indigo-500 rounded-full border border-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800 truncate">{email.sender}</span>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">{email.timestamp}</span>
                      </div>
                      <h4 className="text-[12px] text-slate-600 truncate group-hover/item:text-indigo-600 transition-colors">{email.subject}</h4>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* GITHUB ACTIVITY */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group hover:shadow-md hover:border-slate-200 transition-all duration-300">
          <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center shadow-sm">
                <CodeBracketIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">GitHub</h2>
                <p className="text-[10px] text-slate-400">{githubItems.filter(i => !i.isRead).length} unread</p>
              </div>
            </div>
            <Link to="/github" className="text-xs font-medium text-indigo-500 hover:text-indigo-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              View all <ChevronRightIcon className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-2 max-h-[300px] overflow-y-auto">
            {githubItems.length === 0 ? (
              <div className="py-10 text-center">
                <CodeBracketIcon className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-medium">No GitHub activity</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {githubItems.slice(0, 5).map(item => (
                  <div key={item.id} onClick={() => handleGitHubItemClick(item)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-all group/item">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.type === 'pr' ? 'bg-purple-100' : 'bg-amber-100'}`}>
                      {item.type === 'pr' ? <CodeBracketIcon className="w-3.5 h-3.5 text-purple-600" /> : <ExclamationCircleIcon className="w-3.5 h-3.5 text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate group-hover/item:text-indigo-600 transition-colors">{item.title}</p>
                      <p className="text-[10px] text-slate-400">{item.repository}</p>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      item.state === 'open' ? 'bg-emerald-100 text-emerald-700' : item.state === 'merged' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                    }`}>{item.state}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MESSAGES */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group hover:shadow-md hover:border-slate-200 transition-all duration-300">
          <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-sm">
                <ChatBubbleLeftRightIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Messages</h2>
                <p className="text-[10px] text-slate-400">{quickStats.unreadMessages} unread</p>
              </div>
            </div>
            <Link to="/whatsapp" className="text-xs font-medium text-indigo-500 hover:text-indigo-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              Open <ChevronRightIcon className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-2 max-h-[300px] overflow-y-auto">
            {!whatsappConnected || whatsappChats.length === 0 ? (
              <div className="py-10 text-center">
                <ChatBubbleLeftRightIcon className="w-10 h-10 text-emerald-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-medium">{whatsappConnected ? 'No recent chats' : 'Not connected'}</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {whatsappChats.slice(0, 5).map(chat => (
                  <div key={chat.id} onClick={() => navigate('/whatsapp')}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-emerald-50/50 rounded-xl cursor-pointer transition-all">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-emerald-700">{chat.name?.[0] || '?'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800 truncate">{chat.name}</span>
                        {chat.unreadCount > 0 && <span className="w-5 h-5 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">{chat.unreadCount}</span>}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{chat.lastMessage?.body || 'No messages'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BROWSER AUTOMATIONS */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group hover:shadow-md hover:border-slate-200 transition-all duration-300">
          <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
                <ComputerDesktopIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Automations</h2>
                <p className="text-[10px] text-slate-400">{quickStats.runningAutomations} running</p>
              </div>
            </div>
            <Link to="/automation-results" className="text-xs font-medium text-indigo-500 hover:text-indigo-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              Results <ChevronRightIcon className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-2 max-h-[300px] overflow-y-auto">
            {automations.length === 0 ? (
              <div className="py-10 text-center">
                <ComputerDesktopIcon className="w-10 h-10 text-violet-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-medium">No automations</p>
                <Link to="/automations" className="text-[11px] text-indigo-500 hover:text-indigo-600 font-medium">Create one →</Link>
              </div>
            ) : (
              <div className="space-y-0.5">
                {automations.slice(0, 5).map(a => (
                  <Link key={a.id} to="/automation-results"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-violet-50/50 rounded-xl transition-all">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      a.status === 'running' ? 'bg-blue-500 animate-pulse' : a.status === 'completed' ? 'bg-emerald-500' : a.status === 'failed' ? 'bg-red-500' : 'bg-slate-300'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{a.name}</p>
                      <p className="text-[10px] text-slate-400">{a.last_run ? new Date(a.last_run).toLocaleDateString() : 'Never run'}</p>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      a.status === 'running' ? 'bg-blue-100 text-blue-700' : a.status === 'completed' ? 'bg-green-100 text-green-700' : a.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                    }`}>{a.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ INTELLIGENCE FEED ═══ */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <GlobeAltIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Intelligence Feed</h3>
                <p className="text-[11px] text-slate-500">Real-time news & insights</p>
              </div>
            </div>
            <Link to="/intelligence" className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Full feed <ChevronRightIcon className="w-3 h-3" />
            </Link>
          </div>
          {newsLoading ? (
            <div className="py-6 flex items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin" />
              <p className="text-[11px] text-slate-500">Loading news...</p>
            </div>
          ) : newsSummary ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderedNewsHtml }} />
              {newsSummary.sources.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Sources</h4>
                  <div className="space-y-1.5">
                    {newsSummary.sources.slice(0, 4).map((s, idx) => (
                      <a key={idx} href={s.uri} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/5 hover:border-indigo-500/30 hover:bg-white/[0.07] transition-all group/src">
                        <span className="text-xs text-slate-400 truncate mr-2 group-hover/src:text-slate-300">{s.title}</span>
                        <ArrowTopRightOnSquareIcon className="w-3 h-3 text-slate-600 group-hover/src:text-indigo-400 flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 text-center">
              <SparklesIcon className="w-8 h-8 text-indigo-500/40 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Add topics in Intelligence Feed for news</p>
            </div>
          )}
        </div>
      </div>

      {/* SYNC STATUS */}
      <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-slate-400">
        {isSyncing ? (
          <><ArrowPathIcon className="w-3.5 h-3.5 animate-spin text-indigo-500" /> <span className="font-medium text-indigo-500">Syncing...</span></>
        ) : syncError ? (
          <><ExclamationCircleIcon className="w-3.5 h-3.5 text-amber-500" /> <span className="text-amber-500">{syncError}</span></>
        ) : lastSyncTime ? (
          <><CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" /> <span>Last synced {lastSyncTime.toLocaleTimeString()}</span></>
        ) : (
          <><ClockIcon className="w-3.5 h-3.5" /> <span>Not synced yet</span></>
        )}
      </div>

      {/* ═══ EVENT DETAIL MODAL ═══ */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setSelectedEvent(null)}>
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col lg:flex-row max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="w-full lg:w-[280px] bg-slate-50 px-6 pt-5 pb-6 flex flex-col border-r border-slate-100">
              <div className="flex items-center justify-between mb-5">
                <div className={`w-10 h-10 ${getAccountBrandColor(selectedEvent.platform)} rounded-xl flex items-center justify-center text-white shadow-lg`}>
                  <BrandIcon platform={selectedEvent.platform} className="w-5 h-5 brightness-200" />
                </div>
                <button onClick={() => setSelectedEvent(null)} title="Close" className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                  <XMarkIcon className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <h3 className="text-lg font-black text-slate-900 leading-tight mb-1">{selectedEvent.title}</h3>
              <p className="text-sm text-indigo-600 font-bold mb-5">{getAccountName(selectedEvent.accountId)}</p>
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-3 text-slate-600"><ClockIcon className="w-4 h-4 text-slate-300" /><span className="text-sm">{selectedEvent.startTime} — {selectedEvent.endTime}</span></div>
                {selectedEvent.location && <div className="flex items-center gap-3 text-slate-600"><MapPinIcon className="w-4 h-4 text-slate-300" /><span className="text-sm truncate">{selectedEvent.location}</span></div>}
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Attendees ({selectedEvent.attendees.length})</p>
                  <div className="space-y-2 max-h-[100px] overflow-y-auto">
                    {selectedEvent.attendees.map(p => (
                      <div key={p} className="flex items-center gap-2">
                        <img src={`https://ui-avatars.com/api/?name=${p}&background=random&size=24`} className="w-6 h-6 rounded-full" alt={p} />
                        <span className="text-xs text-slate-700 truncate">{p}</span>
                      </div>
                    ))}
                    {selectedEvent.attendees.length === 0 && <p className="text-xs italic text-slate-400">No attendees</p>}
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <button onClick={handleLaunchZoom} className="w-full bg-slate-900 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all">
                  <VideoCameraIcon className="w-4 h-4" /> Join Meeting
                </button>
                <button onClick={handleReschedule} className="w-full bg-white border border-slate-200 text-slate-600 py-2 rounded-xl font-medium text-xs hover:bg-slate-100 transition-all">Reschedule</button>
              </div>
            </div>
            <div className="flex-1 px-6 lg:px-8 pt-5 pb-6 overflow-y-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 animate-pulse"><SparklesIcon className="w-4 h-4" /></div>
                <div>
                  <h2 className="text-sm font-black text-slate-900">Meeting Intelligence</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Powered by AI</p>
                </div>
              </div>
              {eventBriefingLoading ? (
                <div className="py-12 flex flex-col items-center space-y-3">
                  <div className="relative"><div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-500 rounded-full animate-spin" /><SparklesIcon className="w-4 h-4 text-indigo-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /></div>
                  <p className="text-xs text-slate-400">Generating briefing...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="digest-prose prose-slate prose-sm max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: renderedBriefingHtml }} />
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleCopyBriefing} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2 hover:border-indigo-200 transition-all group/btn">
                      <PaperClipIcon className="w-4 h-4 text-slate-400 group-hover/btn:text-indigo-500" /><span className="text-xs font-bold text-slate-700">Copy</span>
                    </button>
                    <button onClick={handleShareBriefing} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2 hover:border-indigo-200 transition-all group/btn">
                      <ChatBubbleLeftRightIcon className="w-4 h-4 text-slate-400 group-hover/btn:text-indigo-500" /><span className="text-xs font-bold text-slate-700">Share</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ EMAIL REPLY MODAL ═══ */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={() => setSelectedEmail(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-black text-slate-900">Reply to Email</h3>
                <p className="text-sm text-slate-500 mt-1">From: {selectedEmail.sender}</p>
                <p className="text-xs text-slate-400">Re: {selectedEmail.subject}</p>
              </div>
              <button onClick={() => setSelectedEmail(null)} title="Close" className="p-2 hover:bg-slate-100 rounded-lg"><XMarkIcon className="w-5 h-5 text-slate-400" /></button>
            </div>
            <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Type your reply..." rows={5}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={handleSendReply} disabled={!replyText.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all">
                <PaperAirplaneIcon className="w-4 h-4" /> Send Reply
              </button>
              <button onClick={() => setSelectedEmail(null)} className="px-5 py-3 bg-slate-100 text-slate-500 rounded-xl font-medium hover:bg-slate-200 transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
