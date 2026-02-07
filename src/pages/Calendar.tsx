
import React, { useState, useEffect } from 'react';
import { db } from '../services/database';
import storage from '../services/electronStore';
import { activityLogger } from '../services/activityLogger';
import { callAI } from '../services/geminiService';
import { Account } from '../types';
import AccountFilter from '../components/AccountFilter';
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  UserGroupIcon,
  SparklesIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  DocumentDuplicateIcon,
  BellAlertIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/solid';
import { LinkIcon } from '@heroicons/react/24/outline';
import MarkdownRenderer from '../components/MarkdownRenderer';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  attendees?: { email: string; responseStatus?: string }[];
  htmlLink?: string;
  aiPrepNotes?: string;
  conflicts?: string[];
  accountId?: string;
  platform?: string;
}

const CalendarPage: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [analyzing, setAnalyzing] = useState(false);
  const [prepNotes, setPrepNotes] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [dailyBriefing, setDailyBriefing] = useState<string | null>(null);
  const [generatingBriefing, setGeneratingBriefing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    
    // Load connected accounts from database (only calendar-capable ones)
    const connectedAccounts = await db.accounts.getAll();
    const calendarAccounts = connectedAccounts.filter(a => 
      ['google', 'outlook'].includes(a.platform)
    );
    setAccounts(calendarAccounts);
    setIsConnected(calendarAccounts.length > 0);
    setSelectedAccountIds(calendarAccounts.map(a => a.id));
    
    // Load events from database
    const allEvents = await db.events.getAll();
    
    // Transform to component format
    const transformedEvents: CalendarEvent[] = allEvents.map(e => ({
      id: e.id,
      summary: e.title,
      description: e.description,
      start: { dateTime: e.startTime },
      end: { dateTime: e.endTime },
      location: e.location,
      attendees: (e.attendees || []).map(email => ({ email })),
      htmlLink: e.eventLink,
      aiPrepNotes: e.aiBriefing,
      accountId: e.accountId,
      platform: calendarAccounts.find(a => a.id === e.accountId)?.platform
    }));
    
    // Check for conflicts
    const eventsWithConflicts = detectConflicts(transformedEvents);
    setEvents(eventsWithConflicts);
    console.log('📛 Loaded', eventsWithConflicts.length, 'events from database');
    setLoading(false);
  };

  const detectConflicts = (events: CalendarEvent[]): CalendarEvent[] => {
    return events.map(event => {
      const eventStart = new Date(event.start?.dateTime || event.start?.date || '');
      const eventEnd = new Date(event.end?.dateTime || event.end?.date || '');
      
      const conflicts = events
        .filter(other => other.id !== event.id)
        .filter(other => {
          const otherStart = new Date(other.start?.dateTime || other.start?.date || '');
          const otherEnd = new Date(other.end?.dateTime || other.end?.date || '');
          return (eventStart < otherEnd && eventEnd > otherStart);
        })
        .map(other => other.summary);
      
      return { ...event, conflicts };
    });
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const generateDailyBriefing = async () => {
    setGeneratingBriefing(true);
    try {
      const todayEvents = events.filter(e => {
        const eventDate = new Date(e.start?.dateTime || e.start?.date || '');
        return eventDate.toDateString() === selectedDate.toDateString();
      });

      const prompt = `Create a brief, actionable daily briefing for these calendar events:

${todayEvents.map(e => `- ${e.summary} at ${formatTime(e.start?.dateTime || e.start?.date)} ${e.location ? `(${e.location})` : ''} ${e.attendees?.length ? `with ${e.attendees.length} attendees` : ''}`).join('\n')}

Provide:
1. Quick overview of the day (1 sentence)
2. Key preparation items for each meeting
3. Any potential conflicts or tight transitions
4. Suggested focus blocks between meetings

Keep it concise and actionable.`;

      const response = await callAI(prompt);
      setDailyBriefing(response);
      showToast('Daily briefing generated!');
    } catch (error) {
      showToast('Failed to generate briefing');
      console.error(error);
    }
    setGeneratingBriefing(false);
  };

  const generatePrepNotes = async (event: CalendarEvent) => {
    setAnalyzing(true);
    try {
      const prompt = `Generate meeting preparation notes for this event:

Meeting: ${event.summary}
Time: ${formatTime(event.start?.dateTime || event.start?.date)} - ${formatTime(event.end?.dateTime || event.end?.date)}
Location: ${event.location || 'Not specified'}
Description: ${event.description || 'None'}
Attendees: ${event.attendees?.map(a => a.email).join(', ') || 'None listed'}

Provide:
1. Meeting purpose/objective (best guess from title)
2. 3-5 key talking points or questions to prepare
3. Any documents/info to have ready
4. Suggested agenda structure
5. Post-meeting action items template

Be concise and practical.`;

      const response = await callAI(prompt);
      setPrepNotes(response);
      const updatedEvent = { ...event, aiPrepNotes: response };
      setSelectedEvent(updatedEvent);
      setEvents(prev => prev.map(e => e.id === event.id ? updatedEvent : e));
      showToast('Prep notes generated!');
    } catch (error) {
      showToast('Failed to generate prep notes');
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

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(e => {
      // Account filter
      if (selectedAccountIds.length > 0 && selectedAccountIds.length < accounts.length) {
        if (!selectedAccountIds.includes(e.accountId || '')) return false;
      }
      const eventDate = new Date(e.start?.dateTime || e.start?.date || '');
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const getWeekDates = () => {
    const dates = [];
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setSelectedDate(newDate);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/30">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">Loading calendar...</p>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/30 p-8">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CalendarDaysIcon className="w-12 h-12 text-indigo-600" />
          </div>
          {isConnected ? (
            <>
              <h2 className="text-2xl font-black text-slate-900 mb-3">No Upcoming Events</h2>
              <p className="text-slate-500 mb-6">Your calendar is empty or events haven't synced yet. Try syncing from the Connections page.</p>
              <a href="#/accounts" className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors">
                <CalendarDaysIcon className="w-5 h-5" />
                Sync Calendar
              </a>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-black text-slate-900 mb-3">Connect Your Calendar</h2>
              <p className="text-slate-500 mb-6">Connect your Google account to sync and manage your calendar with AI assistance.</p>
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
    <div className="flex-1 flex bg-gradient-to-br from-slate-50 to-indigo-50/30 overflow-hidden">
      {/* Toast */}
      {toast && (
        <div className="fixed top-24 right-8 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-right">
          {toast}
        </div>
      )}

      {/* Main Calendar Area */}
      <div className={`${selectedEvent ? 'w-3/5' : 'w-full'} flex flex-col bg-white transition-all`}>
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                <CalendarDaysIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900">Calendar Intelligence</h1>
                <p className="text-xs text-slate-400">{events.length} upcoming events</p>
              </div>
            </div>
            <button
              onClick={generateDailyBriefing}
              disabled={generatingBriefing}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all"
            >
              <SparklesIcon className={`w-4 h-4 ${generatingBriefing ? 'animate-spin' : ''}`} />
              {generatingBriefing ? 'Generating...' : 'Daily Briefing'}
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateWeek(-1)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeftIcon className="w-5 h-5 text-slate-400" />
              </button>
              <h2 className="text-lg font-bold text-slate-900 min-w-[200px] text-center">
                {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={() => navigateWeek(1)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronRightIcon className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <button
              onClick={() => setSelectedDate(new Date())}
              className="px-4 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              Today
            </button>
          </div>
          
          {/* Account Filter */}
          {accounts.length > 1 && (
            <div className="mt-4">
              <AccountFilter
                accounts={accounts}
                selectedAccountIds={selectedAccountIds}
                onFilterChange={setSelectedAccountIds}
                compact
              />
            </div>
          )}
        </div>

        {/* Daily Briefing Panel */}
        {dailyBriefing && (
          <div className="mx-6 mt-4 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-black text-emerald-700 uppercase tracking-wide">AI Daily Briefing</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(dailyBriefing)}
                  className="p-1.5 hover:bg-emerald-100 rounded-lg transition-colors"
                >
                  <DocumentDuplicateIcon className="w-4 h-4 text-emerald-600" />
                </button>
                <button
                  onClick={() => setDailyBriefing(null)}
                  className="p-1.5 hover:bg-emerald-100 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-4 h-4 text-emerald-600" />
                </button>
              </div>
            </div>
            <p className="text-sm text-emerald-900 whitespace-pre-wrap">{dailyBriefing}</p>
          </div>
        )}

        {/* Week View */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-7 gap-3">
            {getWeekDates().map((date, idx) => {
              const dayEvents = getEventsForDate(date);
              const isToday = date.toDateString() === new Date().toDateString();
              const isSelected = date.toDateString() === selectedDate.toDateString();
              
              return (
                <div 
                  key={idx}
                  onClick={() => setSelectedDate(date)}
                  className={`min-h-[300px] rounded-2xl p-3 cursor-pointer transition-all ${
                    isToday ? 'bg-indigo-50 border-2 border-indigo-200' :
                    isSelected ? 'bg-slate-100 border-2 border-slate-300' :
                    'bg-slate-50 hover:bg-slate-100 border-2 border-transparent'
                  }`}
                >
                  <div className="text-center mb-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </p>
                    <p className={`text-lg font-black ${isToday ? 'text-indigo-600' : 'text-slate-900'}`}>
                      {date.getDate()}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {dayEvents.slice(0, 4).map(event => (
                      <div
                        key={event.id}
                        onClick={async (e) => { 
                          e.stopPropagation(); 
                          setSelectedEvent(event);
                          
                          // Log event attendance/view activity
                          if (event.id && event.accountId) {
                            const account = accounts.find(a => a.id === event.accountId);
                            const platform = account?.platform || 'calendar';
                            
                            await activityLogger.logCalendar(
                              'attend',
                              platform,
                              event.id,
                              {
                                title: event.summary,
                                attendees: event.attendees?.map(a => a.email) || [],
                                topics: event.description ? [event.description.substring(0, 50)] : [],
                                location: event.location
                              }
                            );
                          }
                        }}
                        className={`p-2 rounded-lg text-xs cursor-pointer transition-all hover:scale-105 ${
                          event.conflicts?.length ? 'bg-rose-100 border border-rose-200' : 'bg-white border border-slate-100 shadow-sm'
                        }`}
                      >
                        <p className="font-bold text-slate-900 truncate">{event.summary}</p>
                        <p className="text-slate-500">{formatTime(event.start?.dateTime || event.start?.date)}</p>
                        {event.conflicts?.length ? (
                          <div className="flex items-center gap-1 mt-1 text-rose-600">
                            <ExclamationTriangleIcon className="w-3 h-3" />
                            <span className="text-[10px] font-bold">Conflict</span>
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {dayEvents.length > 4 && (
                      <p className="text-[10px] text-slate-400 font-bold text-center">+{dayEvents.length - 4} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Event Detail Sidebar */}
      {selectedEvent && (
        <div className="w-2/5 flex flex-col bg-white border-l border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-slate-400" />
              </button>
              <button
                onClick={() => generatePrepNotes(selectedEvent)}
                disabled={analyzing}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all"
              >
                <SparklesIcon className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
                {analyzing ? 'Generating...' : 'AI Prep Notes'}
              </button>
            </div>

            <h2 className="text-xl font-black text-slate-900 mb-2">{selectedEvent.summary}</h2>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <ClockIcon className="w-4 h-4" />
                <span>{formatDate(selectedEvent.start?.dateTime || selectedEvent.start?.date)} • {formatTime(selectedEvent.start?.dateTime || selectedEvent.start?.date)} - {formatTime(selectedEvent.end?.dateTime || selectedEvent.end?.date)}</span>
              </div>
              {selectedEvent.location && (
                <div className="flex items-center gap-2 text-slate-500">
                  <MapPinIcon className="w-4 h-4" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}
              {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                <div className="flex items-center gap-2 text-slate-500">
                  <UserGroupIcon className="w-4 h-4" />
                  <span>{selectedEvent.attendees.length} attendees</span>
                </div>
              )}
            </div>

            {selectedEvent.conflicts && selectedEvent.conflicts.length > 0 && (
              <div className="mt-4 p-3 bg-rose-50 rounded-xl border border-rose-100">
                <div className="flex items-center gap-2 text-rose-700 text-sm font-bold mb-1">
                  <ExclamationTriangleIcon className="w-4 h-4" />
                  Schedule Conflict
                </div>
                <p className="text-xs text-rose-600">
                  Overlaps with: {selectedEvent.conflicts.join(', ')}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          {selectedEvent.description && (
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wide mb-2">Description</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedEvent.description}</p>
            </div>
          )}

          {/* Attendees */}
          {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wide mb-3">Attendees</h3>
              <div className="space-y-2">
                {selectedEvent.attendees.map((attendee, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-xs font-bold text-indigo-600">{attendee.email.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{attendee.email}</p>
                    </div>
                    {attendee.responseStatus === 'accepted' && (
                      <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Prep Notes */}
          {(selectedEvent.aiPrepNotes || prepNotes) && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black text-emerald-600 uppercase tracking-wide">AI Prep Notes</span>
                </div>
                <button
                  onClick={() => copyToClipboard(selectedEvent.aiPrepNotes || prepNotes)}
                  className="flex items-center gap-1 text-xs text-emerald-600 font-bold hover:text-emerald-700"
                >
                  <DocumentDuplicateIcon className="w-4 h-4" />
                  Copy
                </button>
              </div>
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100">
                <MarkdownRenderer content={selectedEvent.aiPrepNotes || prepNotes} variant="emerald" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
