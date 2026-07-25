'use client';

import { useEffect, useRef } from 'react';
import { ChatMessage } from '@/types';
import { format } from 'date-fns';
import { MessageSquare, X } from 'lucide-react';

interface ChatSidebarProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function ChatSidebar({
  messages,
  onSendMessage,
  isOpen,
  onToggle,
}: ChatSidebarProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = inputRef.current;
    if (input && input.value.trim()) {
      onSendMessage(input.value.trim());
      input.value = '';
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onToggle}
        />
      )}
      <div
        className={`fixed right-0 top-0 h-full bg-cinema-900 border-l border-cinema-700 transition-all duration-300 z-40 ${
          isOpen ? 'w-full sm:w-80' : 'w-0'
        }`}
      >
        <div className="flex flex-col h-full w-full sm:w-80">
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-cinema-700">
            <h3 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
              Chat
            </h3>
            <button
              onClick={onToggle}
              className="p-2 hover:bg-cinema-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-gray-500 text-sm text-center mt-8">No messages yet</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="flex flex-col">
                {msg.type === 'system' ? (
                  <div className="text-center py-1.5">
                    <span className="text-[11px] sm:text-xs text-gray-500 bg-cinema-800 px-3 py-1 rounded-full">
                      {msg.content}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs sm:text-sm font-medium text-neon-blue">
                        {msg.senderName}
                      </span>
                      <span className="text-[10px] sm:text-xs text-gray-500">
                        {format(new Date(msg.timestamp), 'HH:mm')}
                      </span>
                    </div>
                    <p className="text-gray-300 text-xs sm:text-sm mt-0.5 break-words">{msg.content}</p>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-3 sm:p-4 border-t border-cinema-700"
          >
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a message..."
                className="flex-1 px-3 sm:px-4 py-2 bg-cinema-800 border border-cinema-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-blue focus:border-transparent text-sm"
              />
              <button
                type="submit"
                className="px-3 sm:px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-neon-blue/80 transition-colors text-sm"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
