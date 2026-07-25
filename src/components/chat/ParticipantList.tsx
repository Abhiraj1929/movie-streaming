'use client';

import { Participant } from '@/types';
import { Users, Crown, Mic, MicOff, WifiOff } from 'lucide-react';

interface ParticipantListProps {
  participants: Participant[];
  currentUserId: string;
}

export function ParticipantList({ participants, currentUserId }: ParticipantListProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
        <Users className="w-4 h-4" />
        Participants ({participants.length}/6)
      </h4>
      <div className="space-y-2">
        {participants.map((p) => (
          <div
            key={p.userId}
            className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
              p.id === currentUserId ? 'bg-cinema-700' : 'bg-cinema-800'
            } ${p.disconnected ? 'opacity-60' : ''}`}
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center text-white text-sm font-medium">
                {p.displayName.charAt(0).toUpperCase()}
              </div>
              {p.isHost && (
                <Crown className="absolute -top-1 -right-1 w-4 h-4 text-yellow-500" />
              )}
              {p.disconnected && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                  <WifiOff className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">
                {p.displayName}
                {p.id === currentUserId && (
                  <span className="text-gray-500 ml-1">(You)</span>
                )}
              </p>
              <p className="text-xs text-gray-500">
                {p.disconnected ? (
                  <span className="text-yellow-400 flex items-center gap-1">
                    <WifiOff className="w-3 h-3" />
                    Reconnecting...
                  </span>
                ) : (
                  p.isHost ? 'Host' : 'Viewer'
                )}
              </p>
            </div>
            {p.isMuted ? (
              <MicOff className="w-4 h-4 text-red-500" />
            ) : (
              <Mic className="w-4 h-4 text-green-500" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
