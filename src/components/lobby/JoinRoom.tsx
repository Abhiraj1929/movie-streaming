'use client';

import { useState } from 'react';
import { LogIn } from 'lucide-react';

interface JoinRoomProps {
  onJoinRoom: (roomId: string, displayName: string) => void;
  isConnected: boolean;
}

export function JoinRoom({ onJoinRoom, isConnected }: JoinRoomProps) {
  const [displayName, setDisplayName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (displayName.trim() && roomId.trim() && isConnected) {
      setIsLoading(true);
      onJoinRoom(roomId.trim().toUpperCase(), displayName.trim());
      setTimeout(() => setIsLoading(false), 5000);
    }
  };

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="join-name"
            className="block text-sm font-medium text-gray-300"
          >
            Your Display Name
          </label>
          <input
            id="join-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            className="w-full px-4 py-3 bg-cinema-800 border border-cinema-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-purple focus:border-transparent transition-all"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="room-code"
            className="block text-sm font-medium text-gray-300"
          >
            Room Code
          </label>
          <input
            id="room-code"
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            placeholder="Enter 6-digit room code"
            maxLength={6}
            className="w-full px-4 py-3 bg-cinema-800 border border-cinema-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-purple focus:border-transparent transition-all uppercase tracking-widest font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={!displayName.trim() || !roomId.trim() || isLoading || !isConnected}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-neon-purple to-neon-pink text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <LogIn className="w-5 h-5" />
              Join Watch Party
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
