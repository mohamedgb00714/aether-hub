import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChatBubbleLeftRightIcon, XMarkIcon } from '@heroicons/react/24/solid';
import storage, { STORAGE_KEYS } from '../services/electronStore';
import FloatingChatWindow from './FloatingChatWindow';

const FloatingChatBubble: React.FC = () => {
  const location = useLocation();
  const [assistantName, setAssistantName] = useState('Atlas');
  const [isWindowOpen, setIsWindowOpen] = useState(false);

  useEffect(() => {
    loadAssistantName();
  }, []);

  const loadAssistantName = async () => {
    const name = await storage.get(STORAGE_KEYS.ASSISTANT_NAME);
    if (name) setAssistantName(name);
  };

  // Don't show on Chat page or Communications pages
  const hideOnPaths = ['/chat', '/emails', '/whatsapp', '/telegram', '/discord', '/resend'];
  if (hideOnPaths.includes(location.pathname)) {
    return null;
  }

  return (
    <>
      <FloatingChatWindow 
        isOpen={isWindowOpen} 
        onClose={() => setIsWindowOpen(false)}
        assistantName={assistantName}
      />
      
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsWindowOpen(!isWindowOpen)}
          className={`group relative bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 ${
            isWindowOpen ? 'rotate-0' : ''
          }`}
          title={`Chat with ${assistantName}`}
        >
          {isWindowOpen ? (
            <XMarkIcon className="w-6 h-6" />
          ) : (
            <ChatBubbleLeftRightIcon className="w-6 h-6" />
          )}
          
          {/* Tooltip */}
          {!isWindowOpen && (
            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block">
              <div className="bg-gray-900 text-white text-sm rounded-lg py-2 px-3 whitespace-nowrap shadow-lg">
                Chat with {assistantName}
                <div className="absolute top-full right-4 -mt-1">
                  <div className="border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            </div>
          )}

          {/* Pulse animation */}
          {!isWindowOpen && (
            <span className="absolute inset-0 rounded-full bg-blue-600 opacity-75 animate-ping"></span>
          )}
        </button>
      </div>
    </>
  );
};

export default FloatingChatBubble;
