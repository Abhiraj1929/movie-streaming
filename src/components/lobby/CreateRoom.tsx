'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';

interface CreateRoomProps {
  onCreateRoom: (displayName: string) => void;
  isConnected: boolean;
  actionLabel?: string;
}

export function CreateRoom({ onCreateRoom, isConnected, actionLabel }: CreateRoomProps) {
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (displayName.trim() && isConnected) {
      setIsLoading(true);
      onCreateRoom(displayName.trim());
      setTimeout(() => setIsLoading(false), 30000);
    }
  };

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="create-name"
            className="block text-sm font-medium text-gray-300"
          >
            Your Display Name
          </label>
          <input
            id="create-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            className="w-full px-4 py-3 bg-cinema-800 border border-cinema-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-blue focus:border-transparent transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={!displayName.trim() || isLoading || !isConnected}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-neon-blue to-neon-purple text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              {actionLabel || 'Create Watch Party'}
            </>
          )}
        </button>
        {!isConnected && (
          <p className="text-sm text-yellow-500 text-center">
            Connecting to server...
          </p>
        )}
      </form>
    </div>
  );
}
