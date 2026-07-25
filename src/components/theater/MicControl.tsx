'use client';

import { Mic, MicOff, LogOut, Copy, Users } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';
import { useState } from 'react';

interface MicControlProps {
  isMuted: boolean;
  isHost: boolean;
  roomId: string;
  participantCount: number;
  onToggleMute: () => void;
  onLeaveRoom: () => void;
}

export function MicControl({
  isMuted,
  isHost,
  roomId,
  participantCount,
  onToggleMute,
  onLeaveRoom,
}: MicControlProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyRoomId = async () => {
    await copyToClipboard(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-cinema-900/95 backdrop-blur-sm border border-cinema-700 rounded-full shadow-2xl">
        <button
          onClick={onToggleMute}
          className={`p-2 sm:p-3 rounded-full transition-all ${
            isMuted
              ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
              : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
          }`}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>

        <div className="w-px h-6 sm:h-8 bg-cinema-700" />

        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3">
          <Users className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
          <span className="text-xs sm:text-sm text-gray-300">{participantCount}</span>
        </div>

        <button
          onClick={handleCopyRoomId}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-cinema-800 hover:bg-cinema-700 rounded-lg transition-colors"
          title="Copy room code"
        >
          <span className="text-[10px] sm:text-xs text-gray-400 hidden sm:inline">Room:</span>
          <span className="text-xs sm:text-sm font-mono text-white">{roomId}</span>
          {copied ? (
            <span className="text-[10px] sm:text-xs text-green-500">Copied!</span>
          ) : (
            <Copy className="w-3 h-3 text-gray-400" />
          )}
        </button>

        <div className="w-px h-6 sm:h-8 bg-cinema-700" />

        <button
          onClick={onLeaveRoom}
          className="p-2 sm:p-3 bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded-full transition-all"
          title="Leave room"
        >
          <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </div>
  );
}
