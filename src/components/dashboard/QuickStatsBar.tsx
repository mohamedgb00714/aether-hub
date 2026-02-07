import React from 'react';
import {
  EnvelopeIcon,
  CalendarIcon,
  ChatBubbleLeftRightIcon,
  CodeBracketIcon,
  ExclamationCircleIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/solid';

interface QuickStats {
  unreadEmails: number;
  importantEmailsCount?: number;
  todayMeetings: number;
  unreadMessages: number;
  openPRs: number;
  openIssues: number;
}

interface QuickStatsBarProps {
  stats: QuickStats;
  loading?: boolean;
  onStatClick?: (stat: string) => void;
}

const QuickStatsBar: React.FC<QuickStatsBarProps> = ({ stats, loading, onStatClick }) => {
  const statItems = [
    {
      id: 'emails',
      label: 'Important',
      sublabel: 'Emails',
      value: stats.importantEmailsCount ?? stats.unreadEmails,
      icon: EnvelopeIcon,
      gradient: 'from-rose-500 to-pink-600',
      bgGlow: 'bg-rose-500/20',
      hasActivity: stats.unreadEmails > 0,
    },
    {
      id: 'meetings',
      label: 'Today',
      sublabel: 'Meetings',
      value: stats.todayMeetings,
      icon: CalendarIcon,
      gradient: 'from-indigo-500 to-purple-600',
      bgGlow: 'bg-indigo-500/20',
      hasActivity: stats.todayMeetings > 0,
    },
    {
      id: 'messages',
      label: 'Unread',
      sublabel: 'Messages',
      value: stats.unreadMessages,
      icon: ChatBubbleLeftRightIcon,
      gradient: 'from-emerald-500 to-teal-600',
      bgGlow: 'bg-emerald-500/20',
      hasActivity: stats.unreadMessages > 0,
    },
    {
      id: 'prs',
      label: 'Open',
      sublabel: 'Pull Requests',
      value: stats.openPRs,
      icon: CodeBracketIcon,
      gradient: 'from-violet-500 to-purple-600',
      bgGlow: 'bg-violet-500/20',
      hasActivity: stats.openPRs > 0,
    },
    {
      id: 'issues',
      label: 'Open',
      sublabel: 'Issues',
      value: stats.openIssues,
      icon: ExclamationCircleIcon,
      gradient: 'from-amber-500 to-orange-600',
      bgGlow: 'bg-amber-500/20',
      hasActivity: stats.openIssues > 5,
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5].map((key) => (
          <div 
            key={key}
            className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-slate-100/50 overflow-hidden"
          >
            <div className="animate-pulse">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="h-8 w-12 bg-slate-200 rounded-lg" />
                  <div className="h-3 w-16 bg-slate-100 rounded" />
                </div>
                <div className="w-10 h-10 bg-slate-100 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
      {statItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onStatClick?.(item.id)}
          className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-slate-100/50 hover:border-slate-200 hover:shadow-lg hover:shadow-slate-100/50 transition-all duration-300 group text-left overflow-hidden"
        >
          {/* Background glow effect */}
          <div className={`absolute -top-8 -right-8 w-24 h-24 ${item.bgGlow} rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
          
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-slate-900 tracking-tight">
                  {item.value}
                </span>
                {item.hasActivity && (
                  <ArrowTrendingUpIcon className="w-4 h-4 text-rose-500 animate-pulse" />
                )}
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                {item.label}
              </p>
              <p className="text-[9px] font-medium text-slate-300 uppercase tracking-wider">
                {item.sublabel}
              </p>
            </div>
            
            <div className={`w-10 h-10 bg-gradient-to-br ${item.gradient} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
              <item.icon className="w-5 h-5 text-white" />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default QuickStatsBar;
