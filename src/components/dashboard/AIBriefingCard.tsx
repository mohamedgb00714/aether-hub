import React, { useState, useMemo } from 'react';
import {
  SparklesIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowPathIcon,
  BoltIcon,
  ClockIcon,
} from '@heroicons/react/24/solid';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface AIBriefingCardProps {
  emailSummary?: string;
  calendarSummary?: string;
  loading?: boolean;
  onRefresh?: () => void;
  lastUpdated?: Date;
}

const AIBriefingCard: React.FC<AIBriefingCardProps> = ({
  emailSummary,
  calendarSummary,
  loading,
  onRefresh,
  lastUpdated,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const currentTime = useMemo(() => {
    return new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }, []);

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  const renderHtml = (markdown: string) => {
    return DOMPurify.sanitize(marked.parse(markdown) as string);
  };

  const combinedSummary = useMemo(() => {
    if (!emailSummary && !calendarSummary) {
      return null;
    }

    const parts: string[] = [];
    if (calendarSummary) {
      parts.push(calendarSummary);
    }
    if (emailSummary) {
      parts.push(emailSummary);
    }
    return parts.join('\n\n');
  }, [emailSummary, calendarSummary]);

  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-2xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djZoLTZ2LTZoNnptMC0xMHY2aC02di02aDZ6bTAtMTB2NmgtNnYtNmg2em0xMCAxMHY2aC02di02aDZ6bS0xMCAwdjZoLTZ2LTZoNnptMTAgMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center animate-pulse">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <div className="space-y-1">
              <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
              <div className="h-3 w-24 bg-white/5 rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-2 mt-6">
            <div className="h-4 bg-white/10 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-white/10 rounded animate-pulse w-full" />
            <div className="h-4 bg-white/10 rounded animate-pulse w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-2xl">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djZoLTZ2LTZoNnptMC0xMHY2aC02di02aDZ6bTAtMTB2NmgtNnYtNmg2em0xMCAxMHY2aC02di02aDZ6bS0xMCAwdjZoLTZ2LTZoNnptMTAgMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />

      {/* Header */}
      <div className="relative z-10 p-6 pb-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <SparklesIcon className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                <BoltIcon className="w-2 h-2 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">{greeting}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-slate-400">{formattedDate}</span>
                <span className="text-slate-600">•</span>
                <span className="text-sm text-indigo-400 font-medium">{currentTime}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="w-9 h-9 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                title="Refresh briefing"
              >
                <ArrowPathIcon className="w-4 h-4 text-slate-400" />
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-9 h-9 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronUpIcon className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="relative z-10 p-6 pt-4">
          {combinedSummary ? (
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
              <div
                className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed
                  prose-headings:text-white prose-headings:font-bold
                  prose-strong:text-white prose-strong:font-semibold
                  prose-ul:my-2 prose-li:my-0.5
                  prose-p:my-2"
                dangerouslySetInnerHTML={{ __html: renderHtml(combinedSummary) }}
              />
            </div>
          ) : (
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 text-center">
              <SparklesIcon className="w-10 h-10 text-indigo-500/50 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">
                Your AI briefing will appear here once you have synced emails and calendar events.
              </p>
            </div>
          )}

          {lastUpdated && (
            <div className="flex items-center justify-center gap-1.5 mt-4 text-slate-500">
              <ClockIcon className="w-3 h-3" />
              <p className="text-[10px] font-medium">
                Updated {lastUpdated.toLocaleTimeString()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Collapsed state */}
      {!isExpanded && (
        <div className="relative z-10 px-6 py-4">
          <p className="text-sm text-slate-500 italic">
            Tap to expand your daily AI briefing...
          </p>
        </div>
      )}
    </div>
  );
};

export default AIBriefingCard;
