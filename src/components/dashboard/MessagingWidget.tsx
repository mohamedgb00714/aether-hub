import React from 'react';
import {
  ChatBubbleLeftRightIcon,
  ArrowTopRightOnSquareIcon,
  UserGroupIcon,
} from '@heroicons/react/24/solid';
import { WhatsAppChat, WhatsAppMessage } from '../../types';
import { BrandIcon } from '../AccountFilter';

interface SlackMessage {
  id: string;
  channel: string;
  sender: string;
  message: string;
  timestamp: number;
  isUnread: boolean;
}

interface MessagingWidgetProps {
  whatsappChats: WhatsAppChat[];
  whatsappMessages: WhatsAppMessage[];
  slackMessages?: SlackMessage[];
  whatsappConnected: boolean;
  slackConnected: boolean;
  loading?: boolean;
  onOpenWhatsApp?: () => void;
  onOpenSlack?: () => void;
  onChatClick?: (chatId: string) => void;
}

const MessagingWidget: React.FC<MessagingWidgetProps> = ({
  whatsappChats,
  whatsappMessages,
  slackMessages = [],
  whatsappConnected,
  slackConnected,
  loading,
  onOpenWhatsApp,
  onOpenSlack,
  onChatClick,
}) => {
  const totalUnread = whatsappChats.reduce((acc, chat) => acc + chat.unreadCount, 0);
  const unreadSlack = slackMessages.filter((m) => m.isUnread).length;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-8 py-6 flex items-center gap-4 border-b border-slate-50">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
            <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Messages</h2>
        </div>
        <div className="p-6 space-y-4">
          {['msg-sk-1', 'msg-sk-2', 'msg-sk-3'].map((key) => (
            <div key={key} className="animate-pulse flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
              <div className="w-12 h-12 bg-slate-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-1/2" />
                <div className="h-3 bg-slate-200 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasNoContent = !whatsappConnected && !slackConnected;

  if (hasNoContent) {
    return (
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-8 py-6 flex items-center gap-4 border-b border-slate-50">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
            <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Messages</h2>
        </div>
        <div className="p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ChatBubbleLeftRightIcon className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-sm text-slate-500 font-medium">No messaging accounts connected</p>
          <p className="text-xs text-slate-400 mt-1">Connect WhatsApp or Slack to see your messages</p>
        </div>
      </div>
    );
  }

  // Get top chats sorted by timestamp
  const topChats = [...whatsappChats]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-8 py-6 flex items-center justify-between border-b border-slate-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
            <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Messages</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {totalUnread + unreadSlack} unread
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {whatsappConnected && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full">
              <BrandIcon platform="whatsapp" className="w-4 h-4" />
              <span className="text-[10px] font-bold text-emerald-700">
                {totalUnread}
              </span>
            </div>
          )}
          {slackConnected && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 rounded-full">
              <BrandIcon platform="slack" className="w-4 h-4" />
              <span className="text-[10px] font-bold text-purple-700">
                {unreadSlack}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="divide-y divide-slate-50">
        {/* WhatsApp Chats */}
        {whatsappConnected && topChats.length > 0 && (
          <div className="p-4">
            <div className="flex items-center justify-between px-4 mb-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                WhatsApp
              </p>
              <button
                onClick={onOpenWhatsApp}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                Open <ArrowTopRightOnSquareIcon className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              {topChats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => onChatClick?.(chat.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all group text-left ${
                    chat.unreadCount > 0
                      ? 'bg-emerald-50/50 hover:bg-emerald-100/50 border-l-4 border-emerald-400'
                      : 'bg-slate-50/50 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {chat.isGroup ? (
                      <UserGroupIcon className="w-6 h-6" />
                    ) : (
                      chat.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-900 truncate group-hover:text-emerald-600 transition-colors">
                        {chat.name}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        {formatTime(chat.timestamp)}
                      </span>
                    </div>
                    {chat.lastMessage && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {chat.lastMessage.fromMe && <span className="text-slate-400">You: </span>}
                        {chat.lastMessage.body}
                      </p>
                    )}
                  </div>
                  {chat.unreadCount > 0 && (
                    <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center">
                      {chat.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Slack Messages */}
        {slackConnected && slackMessages.length > 0 && (
          <div className="p-4">
            <div className="flex items-center justify-between px-4 mb-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Slack
              </p>
              <button
                onClick={onOpenSlack}
                className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                Open <ArrowTopRightOnSquareIcon className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              {slackMessages.slice(0, 3).map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all group ${
                    msg.isUnread
                      ? 'bg-purple-50/50 hover:bg-purple-100/50 border-l-4 border-purple-400'
                      : 'bg-slate-50/50 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center">
                    <BrandIcon platform="slack" className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">#{msg.channel}</p>
                      <span className="text-[10px] text-slate-400">{msg.sender}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{msg.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagingWidget;
