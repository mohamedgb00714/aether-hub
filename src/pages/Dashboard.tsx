import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CalendarEvent, Account, WhatsAppChat, WhatsAppMessage } from '../types';
import { prioritizeNotifications, getTopicNews, NewsSummaryResponse, getEventBriefing, summarizeNotifications, summarizeCalendar } from '../services/geminiService';
import { db, GithubItem } from '../services/database';
import storage from '../services/electronStore';
import { syncAllAccounts } from '../services/autoSync';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import AccountFilter, { BrandIcon, getAccountBrandColor } from '../components/AccountFilter';
import {
  QuickStatsBar,
  GitHubWidget,
  MessagingWidget,
  AIBriefingCard,
  SyncStatusFooter,
} from '../components/dashboard';
import ActionsWidget from '../components/dashboard/ActionsWidget';
import { 
  EnvelopeIcon, 
  CalendarIcon,
  Squares2X2Icon,
  MagnifyingGlassIcon,
  XMarkIcon,
  MapPinIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  UserGroupIcon,
  GlobeAltIcon,
  PlusCircleIcon,
  ArrowTopRightOnSquareIcon,
  SparklesIcon,
  ClockIcon,
  PaperClipIcon,
  ChatBubbleLeftRightIcon,
  VideoCameraIcon,
  BellAlertIcon,
  ArrowUturnLeftIcon,
  PaperAirplaneIcon,
  CodeBracketIcon,
  InboxIcon,
  StarIcon,
} from '@heroicons/react/24/solid';

type DashboardView = 'overview' | 'inbox' | 'calendar' | 'activity';

// Extended email type for dashboard display with importance fields
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

const Dashboard: React.FC = () => {
  // Core data state
  const [emails, setEmails] = useState<DashboardEmail[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [githubItems, setGithubItems] = useState<GithubItem[]>([]);
  const [whatsappChats, setWhatsappChats] = useState<WhatsAppChat[]>([]);
  const [whatsappMessages, setWhatsappMessages] = useState<WhatsAppMessage[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<DashboardView>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<DashboardEmail | null>(null);
  const [replyText, setReplyText] = useState('');
  
  // Pagination state for important emails
  const [emailPage, setEmailPage] = useState(1);
  const EMAILS_PER_PAGE = 5;

  // AI Briefing state
  const [emailSummary, setEmailSummary] = useState<string>('');
  const [calendarSummary, setCalendarSummary] = useState<string>('');
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingLastUpdated, setBriefingLastUpdated] = useState<Date | undefined>();

  // Sync state
  const [lastSyncTime, setLastSyncTime] = useState<Date | undefined>();
  const [nextSyncTime, setNextSyncTime] = useState<Date | undefined>();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | undefined>();

  // WhatsApp connection state
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);

  // News Grounding State
  const [newsTopics, setNewsTopics] = useState<string[]>(['AI Technology', 'Stock Market', 'Cybersecurity']);
  const [newsSummary, setNewsSummary] = useState<NewsSummaryResponse | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [isEditingTopics, setIsEditingTopics] = useState(false);
  const [topicInput, setTopicInput] = useState('');

  // Event Detail Modal State
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventBriefing, setEventBriefing] = useState<string>('');
  const [eventBriefingLoading, setEventBriefingLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Quick stats computed values
  const quickStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayEvents = events.filter(ev => {
      const eventDate = new Date(ev.startTime);
      return eventDate >= today && eventDate < tomorrow;
    });

    // Count important emails (isImportant flag or high priority)
    const importantEmailsCount = emails.filter(e => e.isImportant === true || e.aiPriority === 3).length;
    const unreadImportantEmails = emails.filter(e => (e.isImportant === true || e.aiPriority === 3) && !e.read).length;
    const openPRs = githubItems.filter(i => i.type === 'pr' && i.state === 'open').length;
    const openIssues = githubItems.filter(i => i.type === 'issue' && i.state === 'open').length;
    const unreadMessages = whatsappChats.reduce((acc, chat) => acc + chat.unreadCount, 0);

    return {
      unreadEmails: unreadImportantEmails,
      importantEmailsCount,
      todayMeetings: todayEvents.length,
      unreadMessages,
      openPRs,
      openIssues,
    };
  }, [emails, events, githubItems, whatsappChats]);

  // Load saved preferences and data
  useEffect(() => {
    const loadPreferences = async () => {
      const savedView = await storage.get('dashboard_view');
      const savedFilters = await storage.get('dashboard_filters');
      const savedLastSync = await storage.get('dashboard_last_sync');
      
      if (savedView) setView(savedView);
      if (savedFilters && Array.isArray(savedFilters)) setSelectedAccountIds(savedFilters);
      if (savedLastSync) setLastSyncTime(new Date(savedLastSync));
      
      // Load connected accounts from database
      const connectedAccounts = await db.accounts.getAll();
      if (connectedAccounts && connectedAccounts.length > 0) {
        setAccounts(connectedAccounts);
        setSelectedAccountIds(connectedAccounts.map(a => a.id));
        
        // Check for specific platform connections
        setSlackConnected(connectedAccounts.some(a => a.platform === 'slack' && a.isConnected));
      }

      // Load GitHub items
      const allGithubItems = await db.github.getAll();
      setGithubItems(allGithubItems);

      // Check WhatsApp connection
      if (window.electronAPI?.whatsapp) {
        const isReady = await window.electronAPI.whatsapp.isReady();
        setWhatsappConnected(isReady);
        
        if (isReady) {
          const chats = await window.electronAPI.whatsapp.getChats(10);
          setWhatsappChats(chats);
          const messages = await window.electronAPI.whatsapp.getRecentMessages(20);
          setWhatsappMessages(messages);
        }
      }

      // Set next sync time (5 minutes from now or from last sync)
      const nextSync = new Date();
      nextSync.setMinutes(nextSync.getMinutes() + 5);
      setNextSyncTime(nextSync);
    };
    loadPreferences();
  }, []);

  // Process emails and events
  useEffect(() => {
    const processData = async () => {
      setLoading(true);
      
      // Load emails from database
      const allEmails = await db.emails.getAll();
      
      // Transform database emails to notification format
      const emailsToProcess: any[] = allEmails.map((email) => {
        const account = accounts.find(a => a.id === email.accountId);
        const platform = account?.platform || 'google';
        
        return {
          id: email.id,
          accountId: email.accountId,
          platform: platform,
          sender: email.sender,
          subject: email.subject,
          excerpt: email.preview,
          timestamp: new Date(email.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          read: email.isRead,
          topic: 'Email',
          type: 'email',
          category: email.aiCategory || 'Inbox',
          isImportant: email.isImportant,
          aiPriority: email.aiPriority
        };
      });
      
      // Load calendar events from database
      const allEvents = await db.events.getAll();
      
      // Transform database events to display format
      const transformedEvents = allEvents.map((evt) => {
        const account = accounts.find(a => a.id === evt.accountId);
        const startDate = new Date(evt.startTime);
        const endDate = new Date(evt.endTime);
        
        return {
          id: evt.id,
          accountId: evt.accountId,
          platform: account?.platform || 'google' as const,
          title: evt.title,
          startTime: startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          endTime: endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          location: evt.location || evt.eventLink || '',
          attendees: evt.attendees || [],
          description: evt.description || '',
          relatedItems: []
        };
      });
      
      setEvents(transformedEvents);
      
      const prioritized = await prioritizeNotifications(emailsToProcess);
      setEmails(prioritized);
      setLoading(false);
    };
    
    if (accounts.length > 0) {
      processData();
    }
  }, [accounts]);

  // Fetch news
  useEffect(() => {
    fetchNews();
  }, [newsTopics]);

  // Generate AI briefing
  const generateBriefing = useCallback(async () => {
    if (emails.length === 0 && events.length === 0) return;
    
    setBriefingLoading(true);
    try {
      const [emailSum, calSum] = await Promise.all([
        emails.length > 0 ? summarizeNotifications(emails) : Promise.resolve(''),
        events.length > 0 ? summarizeCalendar(events) : Promise.resolve('')
      ]);
      
      setEmailSummary(emailSum);
      setCalendarSummary(calSum);
      setBriefingLastUpdated(new Date());
    } catch (error) {
      console.error('Error generating briefing:', error);
    }
    setBriefingLoading(false);
  }, [emails, events]);

  // Generate briefing when data is loaded
  useEffect(() => {
    if (!loading && (emails.length > 0 || events.length > 0)) {
      generateBriefing();
    }
  }, [loading, emails.length, events.length]);

  const fetchNews = async () => {
    if (newsTopics.length === 0) return;
    setNewsLoading(true);
    const result = await getTopicNews(newsTopics);
    setNewsSummary(result);
    setNewsLoading(false);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncError(undefined);
    
    try {
      const result = await syncAllAccounts();
      if (result.success) {
        setLastSyncTime(new Date());
        await storage.set('dashboard_last_sync', new Date().toISOString());
        
        // Reload data
        const allGithubItems = await db.github.getAll();
        setGithubItems(allGithubItems);
        
        // Update next sync time
        const nextSync = new Date();
        nextSync.setMinutes(nextSync.getMinutes() + 5);
        setNextSyncTime(nextSync);
        
        showToast(`Synced ${result.synced.length} accounts successfully!`);
      }
    } catch (error: any) {
      setSyncError(error.message || 'Sync failed');
    }
    
    setIsSyncing(false);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleLaunchZoom = () => {
    if (selectedEvent?.location?.toLowerCase().includes('zoom')) {
      showToast("Launching Zoom Workspace...");
      window.open('https://zoom.us', '_blank');
    } else {
      showToast("No video link found for this event.");
    }
  };

  const handleReschedule = () => {
    showToast("Opening calendar coordination engine...");
  };

  const handleCopyBriefing = async () => {
    if (!eventBriefing) return;
    
    try {
      if (window.electronAPI?.clipboard) {
        await window.electronAPI.clipboard.writeText(eventBriefing);
      } else {
        await navigator.clipboard.writeText(eventBriefing);
      }
      showToast("Briefing copied to clipboard!");
    } catch (error) {
      showToast("Failed to copy briefing");
    }
  };

  const handleShareBriefing = async () => {
    if (!selectedEvent) return;
    const subject = `Meeting Briefing: ${selectedEvent.title}`;
    const body = `Meeting: ${selectedEvent.title}\nTime: ${selectedEvent.startTime} - ${selectedEvent.endTime}\n\n${eventBriefing}`;
    
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
    showToast("Opening email client...");
  };

  const handleEmailClick = (email: DashboardEmail) => {
    setSelectedEmail(email);
    setReplyText('');
  };

  const handleSendReply = () => {
    if (!selectedEmail || !replyText.trim()) return;
    
    const subject = `Re: ${selectedEmail.subject}`;
    const body = replyText;
    const mailto = `mailto:${selectedEmail.sender}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    window.open(mailto, '_blank');
    showToast('Opening email client...');
    setSelectedEmail(null);
    setReplyText('');
  };

  const addTopic = () => {
    if (topicInput.trim() && !newsTopics.includes(topicInput.trim())) {
      setNewsTopics([...newsTopics, topicInput.trim()]);
      setTopicInput('');
    }
  };

  const removeTopic = (topic: string) => {
    setNewsTopics(newsTopics.filter(t => t !== topic));
  };

  const handleEventClick = async (event: CalendarEvent) => {
    setSelectedEvent(event);
    setEventBriefingLoading(true);
    const briefing = await getEventBriefing(event);
    setEventBriefing(briefing);
    setEventBriefingLoading(false);
  };

  const closeEventDetail = () => {
    setSelectedEvent(null);
    setEventBriefing('');
  };

  const handleGitHubItemClick = (item: GithubItem) => {
    window.open(item.url, '_blank');
  };

  // Filtered data - only important emails (isImportant flag or high priority)
  const importantEmails = emails.filter(e => 
    (e.isImportant === true || e.aiPriority === 3) &&
    (selectedAccountIds.length === 0 || selectedAccountIds.includes(e.accountId)) &&
    (e.sender.toLowerCase().includes(searchTerm.toLowerCase()) || 
     e.subject.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // Pagination calculations
  const totalEmailPages = Math.ceil(importantEmails.length / EMAILS_PER_PAGE);
  const paginatedEmails = importantEmails.slice(
    (emailPage - 1) * EMAILS_PER_PAGE,
    emailPage * EMAILS_PER_PAGE
  );
  
  // Reset page when filters change
  useEffect(() => {
    setEmailPage(1);
  }, [selectedAccountIds, searchTerm]);

  const filteredEvents = events.filter(ev => 
    (selectedAccountIds.length === 0 || selectedAccountIds.includes(ev.accountId)) &&
    ev.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || 'Unknown';

  const renderedNewsHtml = useMemo(() => {
    if (!newsSummary?.text) return '';
    return DOMPurify.sanitize(marked.parse(newsSummary.text) as string);
  }, [newsSummary]);

  const renderedBriefingHtml = useMemo(() => {
    if (!eventBriefing) return '';
    return DOMPurify.sanitize(marked.parse(eventBriefing) as string);
  }, [eventBriefing]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-5 animate-in fade-in duration-700 relative pb-6 px-10 pt-6">
      {/* Toast Feedback */}
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300">
          <BellAlertIcon className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-semibold">{toast}</span>
        </div>
      )}

      {/* Modern Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: View Toggle Pills */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 backdrop-blur-sm rounded-2xl border border-slate-200/50">
          {[
            { id: 'overview', label: 'Overview', icon: Squares2X2Icon },
            { id: 'inbox', label: 'Important', icon: StarIcon, count: quickStats.importantEmailsCount },
            { id: 'calendar', label: 'Calendar', icon: CalendarIcon, count: quickStats.todayMeetings },
            { id: 'activity', label: 'Activity', icon: CodeBracketIcon, count: quickStats.openPRs },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={async () => {
                setView(tab.id as DashboardView);
                await storage.set('dashboard_view', tab.id);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                view === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  view === tab.id 
                    ? 'bg-indigo-100 text-indigo-700' 
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        
        {/* Right: Search + Account Filter */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search everything..." 
              className="w-full lg:w-[240px] bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl py-2.5 pl-10 pr-4 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 outline-none transition-all"
            />
          </div>
          
          {/* Account Filter - Compact */}
          <div className="hidden lg:block">
            <AccountFilter
              accounts={accounts}
              selectedAccountIds={selectedAccountIds}
              onFilterChange={async (newFilters) => {
                setSelectedAccountIds(newFilters);
                await storage.set('dashboard_filters', newFilters);
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Dashboard Content */}
      {view === 'overview' && (
        <div className="space-y-5">
          {/* Top Row: AI Briefing + Quick Stats */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* AI Briefing Card - Takes 2 columns */}
            <div className="xl:col-span-2">
              <AIBriefingCard
                emailSummary={emailSummary}
                calendarSummary={calendarSummary}
                loading={briefingLoading}
                onRefresh={generateBriefing}
                lastUpdated={briefingLastUpdated}
              />
            </div>
            
            {/* Quick Stats - Vertical Stack on XL */}
            <div className="xl:col-span-1">
              <QuickStatsBar stats={quickStats} loading={loading} />
            </div>
          </div>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Agenda Card - Takes 7 columns */}
            <div className="lg:col-span-7 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden">
              <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <CalendarIcon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Today's Agenda</h2>
                    <p className="text-[11px] text-slate-400">
                      {quickStats.todayMeetings} meetings scheduled
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setView('calendar')}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                >
                  View all
                  <ChevronRightIcon className="w-3 h-3" />
                </button>
              </div>
              
              <div className="p-3 max-h-[320px] overflow-y-auto">
                {filteredEvents.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <CalendarIcon className="w-7 h-7 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium">No events today</p>
                    <p className="text-xs text-slate-400 mt-1">Enjoy your free time!</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredEvents.slice(0, 5).map((ev, index) => (
                      <div 
                        key={ev.id} 
                        onClick={() => handleEventClick(ev)}
                        className="px-4 py-3 hover:bg-slate-50/80 rounded-xl transition-all group flex items-center gap-4 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-1 h-10 rounded-full ${index === 0 ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                          <div className="min-w-[50px]">
                            <p className="text-sm font-bold text-slate-900">{ev.startTime}</p>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-800 text-sm truncate group-hover:text-indigo-600 transition-colors">{ev.title}</h3>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                            {ev.location && (
                              <span className="flex items-center gap-1 truncate">
                                <MapPinIcon className="w-3 h-3 flex-shrink-0" /> {ev.location}
                              </span>
                            )}
                            {ev.attendees.length > 0 && (
                              <span className="flex items-center gap-1">
                                <UserGroupIcon className="w-3 h-3" /> {ev.attendees.length}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRightIcon className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* GitHub Widget - Takes 5 columns */}
            <div className="lg:col-span-5">
              <GitHubWidget
                items={githubItems}
                loading={loading}
                onViewItem={handleGitHubItemClick}
                onMarkAsRead={async (id) => {
                  await db.github.markAsRead(id);
                  setGithubItems(prev => prev.map(i => i.id === id ? { ...i, isRead: true } : i));
                }}
              />
            </div>

            {/* Important Emails Card - Takes 7 columns */}
            <div className="lg:col-span-7 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden">
              <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <StarIcon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Important Emails</h2>
                    <p className="text-[11px] text-slate-400">
                      {importantEmails.length} important • {quickStats.unreadEmails} unread
                    </p>
                  </div>
                </div>
                {/* Pagination Controls */}
                <div className="flex items-center gap-2">
                  {totalEmailPages > 1 && (
                    <>
                      <button
                        onClick={() => setEmailPage(p => Math.max(1, p - 1))}
                        disabled={emailPage === 1}
                        title="Previous page"
                        className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronLeftIcon className="w-4 h-4 text-slate-400" />
                      </button>
                      <span className="text-xs font-medium text-slate-500 min-w-[40px] text-center">
                        {emailPage}/{totalEmailPages}
                      </span>
                      <button
                        onClick={() => setEmailPage(p => Math.min(totalEmailPages, p + 1))}
                        disabled={emailPage === totalEmailPages}
                        title="Next page"
                        className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronRightIcon className="w-4 h-4 text-slate-400" />
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => setView('inbox')}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 ml-2 transition-colors"
                  >
                    View all
                    <ChevronRightIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>
              
              <div className="p-3 max-h-[320px] overflow-y-auto">
                {importantEmails.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <StarIcon className="w-7 h-7 text-amber-300" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium">No important emails</p>
                    <p className="text-xs text-slate-400 mt-1">Priority messages will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {paginatedEmails.map(email => (
                      <div 
                        key={email.id} 
                        className={`px-4 py-3 flex items-center gap-3 hover:bg-slate-50/80 rounded-xl transition-all group cursor-pointer ${email.read ? 'opacity-50' : ''}`}
                        onClick={() => handleEmailClick(email)}
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <BrandIcon platform={email.platform} className="w-5 h-5" />
                          </div>
                          {!email.read && (
                            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-white"></div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-800 truncate">{email.sender}</span>
                            <span className="text-[10px] text-slate-400 flex-shrink-0">{email.timestamp}</span>
                          </div>
                          <h4 className="text-sm text-slate-600 truncate group-hover:text-indigo-600 transition-colors">{email.subject}</h4>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Actions Widget - Takes 5 columns */}
            <div className="lg:col-span-5">
              <ActionsWidget />
            </div>

            {/* Messaging Widget - Full Width */}
            <div className="lg:col-span-12">
              <MessagingWidget
                whatsappChats={whatsappChats}
                whatsappMessages={whatsappMessages}
                slackMessages={[]}
                whatsappConnected={whatsappConnected}
                slackConnected={slackConnected}
                loading={loading}
                onOpenWhatsApp={() => window.location.hash = '#/chat'}
                onChatClick={(chatId) => {
                  window.location.hash = '#/chat';
                }}
              />
            </div>
          </div>

          {/* Intelligence Feed - Compact Card */}
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
                <button 
                  onClick={() => setIsEditingTopics(!isEditingTopics)}
                  title="Edit topics"
                  className="w-8 h-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center transition-all"
                >
                  <PlusCircleIcon className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {isEditingTopics && (
                <div className="mb-5 space-y-3 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={topicInput}
                      onChange={(e) => setTopicInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addTopic()}
                      placeholder="Add topic..." 
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all placeholder:text-slate-600"
                    />
                    <button onClick={addTopic} className="bg-indigo-600 hover:bg-indigo-500 px-4 rounded-xl text-xs font-semibold transition-all">Add</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {newsTopics.map(t => (
                      <span key={t} className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-[10px] font-medium text-slate-300 flex items-center gap-1.5">
                        {t}
                        <button onClick={() => removeTopic(t)} title="Remove topic" className="hover:text-rose-400 transition-colors"><XMarkIcon className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {newsLoading ? (
                <div className="py-8 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin mb-3"></div>
                  <p className="text-[11px] text-slate-500 font-medium">Loading news...</p>
                </div>
              ) : newsSummary ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed">
                    <div dangerouslySetInnerHTML={{ __html: renderedNewsHtml }} />
                  </div>
                  
                  {newsSummary.sources.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Sources</h4>
                      <div className="space-y-1.5">
                        {newsSummary.sources.slice(0, 4).map((s, idx) => (
                          <a 
                            key={idx} 
                            href={s.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/5 hover:border-indigo-500/30 hover:bg-white/[0.07] transition-all group"
                          >
                            <span className="text-xs text-slate-400 truncate mr-2 group-hover:text-slate-300">{s.title}</span>
                            <ArrowTopRightOnSquareIcon className="w-3 h-3 text-slate-600 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <SparklesIcon className="w-8 h-8 text-indigo-500/40 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Add topics to see news</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inbox View - Important Emails Only */}
      {view === 'inbox' && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden">
          <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <StarIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Important Emails</h2>
                <p className="text-sm text-slate-400">
                  {importantEmails.length} important • {importantEmails.filter(e => !e.read).length} unread
                </p>
              </div>
            </div>
            {/* Pagination Controls */}
            {totalEmailPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEmailPage(p => Math.max(1, p - 1))}
                  disabled={emailPage === 1}
                  title="Previous page"
                  className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeftIcon className="w-5 h-5 text-slate-400" />
                </button>
                <span className="text-sm font-medium text-slate-500 min-w-[80px] text-center">
                  {emailPage} of {totalEmailPages}
                </span>
                <button
                  onClick={() => setEmailPage(p => Math.min(totalEmailPages, p + 1))}
                  disabled={emailPage === totalEmailPages}
                  title="Next page"
                  className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRightIcon className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            )}
          </div>
          
          <div className="divide-y divide-slate-100/50">
            {importantEmails.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <StarIcon className="w-8 h-8 text-amber-300" />
                </div>
                <p className="text-base text-slate-600 font-medium">No important emails</p>
                <p className="text-sm text-slate-400 mt-1">Priority messages will appear here</p>
              </div>
            ) : null}
            {paginatedEmails.map(email => (
              <div 
                key={email.id} 
                className={`px-6 py-4 flex items-center gap-4 hover:bg-slate-50/80 transition-all group cursor-pointer ${email.read ? 'opacity-50' : ''}`}
                onClick={() => handleEmailClick(email)}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <BrandIcon platform={email.platform} className="w-6 h-6" />
                  </div>
                  {!email.read && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white"></div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{email.sender}</span>
                      {email.category && (
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{email.category}</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">{email.timestamp}</span>
                  </div>
                  <h4 className="text-sm text-slate-700 truncate group-hover:text-indigo-600 transition-colors">{email.subject}</h4>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{email.excerpt}</p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEmailClick(email);
                  }}
                  title="Reply"
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg"
                >
                  <ArrowUturnLeftIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar View */}
      {view === 'calendar' && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden">
          <div className="px-6 py-5 flex items-center gap-3 border-b border-slate-100/50">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Your Schedule</h2>
              <p className="text-sm text-slate-400">
                {filteredEvents.length} upcoming events
              </p>
            </div>
          </div>
          
          <div className="divide-y divide-slate-100/50">
            {filteredEvents.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon className="w-8 h-8 text-indigo-300" />
                </div>
                <p className="text-base text-slate-600 font-medium">No events scheduled</p>
                <p className="text-sm text-slate-400 mt-1">Your calendar is clear!</p>
              </div>
            ) : filteredEvents.map((ev, index) => (
              <div 
                key={ev.id} 
                onClick={() => handleEventClick(ev)}
                className="px-6 py-4 hover:bg-slate-50/80 transition-all group flex items-center gap-4 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-1 h-12 rounded-full ${index === 0 ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                  <div className="min-w-[60px]">
                    <p className="text-base font-bold text-slate-900">{ev.startTime}</p>
                    <p className="text-[10px] text-slate-400">to {ev.endTime}</p>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{ev.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                    {ev.location && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPinIcon className="w-3 h-3 flex-shrink-0" /> {ev.location}
                      </span>
                    )}
                    {ev.attendees.length > 0 && (
                      <span className="flex items-center gap-1">
                        <UserGroupIcon className="w-3 h-3" /> {ev.attendees.length} people
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg">
                    <BrandIcon platform={ev.platform} className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium text-slate-500">{getAccountName(ev.accountId)}</span>
                  </div>
                  <ChevronRightIcon className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity View */}
      {view === 'activity' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GitHubWidget
            items={githubItems}
            loading={loading}
            onViewItem={handleGitHubItemClick}
            onMarkAsRead={async (id) => {
              await db.github.markAsRead(id);
              setGithubItems(prev => prev.map(i => i.id === id ? { ...i, isRead: true } : i));
            }}
          />
          
          <MessagingWidget
            whatsappChats={whatsappChats}
            whatsappMessages={whatsappMessages}
            slackMessages={[]}
            whatsappConnected={whatsappConnected}
            slackConnected={slackConnected}
            loading={loading}
            onOpenWhatsApp={() => window.location.hash = '#/chat'}
            onChatClick={(chatId) => {
              window.location.hash = '#/chat';
            }}
          />
        </div>
      )}

      {/* Sync Status Footer */}
      <SyncStatusFooter
        lastSyncTime={lastSyncTime}
        nextSyncTime={nextSyncTime}
        isSyncing={isSyncing}
        syncError={syncError}
        onManualSync={handleManualSync}
        stats={{
          emailsAnswered: 12,
          meetingsAttended: quickStats.todayMeetings,
          averageResponseTime: '2.4h',
        }}
      />

      {/* Event Detail Overlay */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div 
            className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col lg:flex-row max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Column: Event Metadata */}
            <div className="w-full lg:w-[300px] bg-slate-50 px-8 pt-6 pb-8 flex flex-col border-r border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div className={`w-12 h-12 ${getAccountBrandColor(selectedEvent.platform)} rounded-xl flex items-center justify-center text-white shadow-lg`}>
                   <BrandIcon platform={selectedEvent.platform} className="w-6 h-6 brightness-200" />
                </div>
                <button 
                  onClick={closeEventDetail}
                  title="Close"
                  className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight">{selectedEvent.title}</h3>
                <p className="text-sm text-indigo-600 font-bold mt-1">{getAccountName(selectedEvent.accountId)}</p>
              </div>

              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3 text-slate-600">
                  <ClockIcon className="w-5 h-5 text-slate-300" />
                  <span className="text-sm font-medium">{selectedEvent.startTime} — {selectedEvent.endTime}</span>
                </div>
                {selectedEvent.location && (
                  <div className="flex items-center gap-3 text-slate-600">
                    <MapPinIcon className="w-5 h-5 text-slate-300" />
                    <span className="text-sm font-medium">{selectedEvent.location}</span>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Participants ({selectedEvent.attendees.length})</h4>
                  <div className="space-y-2 max-h-[120px] overflow-y-auto">
                    {selectedEvent.attendees.map(person => (
                      <div key={person} className="flex items-center gap-2">
                        <img 
                          src={`https://ui-avatars.com/api/?name=${person}&background=random&size=32`} 
                          className="w-7 h-7 rounded-full shadow-sm" 
                          alt={person} 
                        />
                        <span className="text-xs font-medium text-slate-700 truncate">{person}</span>
                      </div>
                    ))}
                    {selectedEvent.attendees.length === 0 && <p className="text-xs italic text-slate-400">No attendees listed</p>}
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <button 
                  onClick={handleLaunchZoom}
                  className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all"
                >
                  <VideoCameraIcon className="w-5 h-5" />
                  Join Meeting
                </button>
                <button 
                  onClick={handleReschedule}
                  className="w-full bg-white border border-slate-200 text-slate-600 py-2.5 rounded-xl font-medium text-xs hover:bg-slate-100 transition-all"
                >
                  Reschedule
                </button>
              </div>
            </div>

            {/* Right Column: AI Briefing */}
            <div className="flex-1 px-8 lg:px-10 pt-6 pb-8 overflow-y-auto">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 animate-pulse">
                   <SparklesIcon className="w-5 h-5" />
                </div>
                <div>
                   <h2 className="text-base font-black text-slate-900 tracking-tight">Meeting Intelligence</h2>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Powered by Gemini</p>
                </div>
              </div>

              {eventBriefingLoading ? (
                <div className="py-16 flex flex-col items-center justify-center space-y-4">
                   <div className="relative">
                      <div className="w-14 h-14 border-4 border-slate-100 border-t-indigo-500 rounded-full animate-spin"></div>
                      <SparklesIcon className="w-5 h-5 text-indigo-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                   </div>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Generating briefing...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div 
                    className="digest-prose prose-slate prose-sm max-w-none text-slate-700"
                    dangerouslySetInnerHTML={{ __html: renderedBriefingHtml }}
                  />

                  <div className="grid grid-cols-2 gap-3">
                     <button 
                       onClick={handleCopyBriefing}
                       className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3 hover:border-indigo-200 transition-all cursor-pointer group"
                     >
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors shadow-sm">
                           <PaperClipIcon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-900">Copy</span>
                     </button>
                     <button 
                       onClick={handleShareBriefing}
                       className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3 hover:border-indigo-200 transition-all cursor-pointer group"
                     >
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors shadow-sm">
                           <ChatBubbleLeftRightIcon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-900">Share</span>
                     </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Email Reply Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4 lg:p-6">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-900">Reply to Email</h3>
                <p className="text-sm text-slate-500 mt-1">From: {selectedEmail.sender}</p>
                <p className="text-xs text-slate-400">Re: {selectedEmail.subject}</p>
              </div>
              <button onClick={() => setSelectedEmail(null)} title="Close" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <XMarkIcon className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Your Message</label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply here..."
                  rows={6}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                  Send Reply
                </button>
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl font-medium hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
