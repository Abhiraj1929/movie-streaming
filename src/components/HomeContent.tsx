'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreateRoom } from '@/components/lobby/CreateRoom';
import { JoinRoom } from '@/components/lobby/JoinRoom';
import { useSocket } from '@/hooks/useSocket';
import { Film, Tv, Sparkles, Users, Shield, Zap } from 'lucide-react';

export default function HomeContent() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const {
    isConnected,
    room,
    participant,
    error,
    createRoom,
    joinRoom,
    clearError,
  } = useSocket();

  useEffect(() => {
    if (room && participant) {
      router.push(`/room/${room.id}`);
    }
  }, [room, participant, router]);

  const handleCreateRoom = (displayName: string) => {
    createRoom(displayName);
  };

  const handleJoinRoom = (roomId: string, displayName: string) => {
    joinRoom(roomId, displayName);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-cinema-800 bg-cinema-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-neon-blue to-neon-purple rounded-lg flex items-center justify-center">
              <Film className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-bold text-white">Watch Party</h1>
              <p className="text-[10px] sm:text-xs text-gray-500">Watch together, anywhere</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs sm:text-sm text-gray-400">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-4xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
              Watch Together in{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple">
                Perfect Sync
              </span>
            </h2>
            <p className="text-gray-400 text-sm sm:text-lg max-w-2xl mx-auto">
              Create a private watch party and enjoy movies with friends.
              Real-time video streaming, voice chat, and text messaging.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 sm:gap-8 items-start">
            <div className="bg-cinema-900 rounded-2xl p-4 sm:p-6 border border-cinema-800">
              <div className="flex gap-2 mb-4 sm:mb-6">
                <button
                  onClick={() => { setActiveTab('create'); clearError(); }}
                  className={`flex-1 py-2 px-3 sm:px-4 rounded-lg font-medium text-sm sm:text-base transition-colors ${
                    activeTab === 'create' ? 'bg-neon-blue text-white' : 'bg-cinema-800 text-gray-400 hover:bg-cinema-700'
                  }`}
                >
                  Create Party
                </button>
                <button
                  onClick={() => { setActiveTab('join'); clearError(); }}
                  className={`flex-1 py-2 px-3 sm:px-4 rounded-lg font-medium text-sm sm:text-base transition-colors ${
                    activeTab === 'join' ? 'bg-neon-purple text-white' : 'bg-cinema-800 text-gray-400 hover:bg-cinema-700'
                  }`}
                >
                  Join Party
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs sm:text-sm">
                  {error}
                </div>
              )}

              {activeTab === 'create' ? (
                <CreateRoom onCreateRoom={handleCreateRoom} isConnected={isConnected} />
              ) : (
                <JoinRoom onJoinRoom={handleJoinRoom} isConnected={isConnected} />
              )}
            </div>

            <div className="space-y-4 sm:space-y-6">
              <div className="bg-cinema-900 rounded-2xl p-4 sm:p-6 border border-cinema-800">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-neon-blue" />
                  Features
                </h3>
                <ul className="space-y-2 sm:space-y-3">
                  <li className="flex items-start gap-2 sm:gap-3">
                    <Tv className="w-4 h-4 sm:w-5 sm:h-5 text-neon-green mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium text-sm">Zero-Lag Streaming</p>
                      <p className="text-xs text-gray-500">Direct P2P video sharing, no cloud upload</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2 sm:gap-3">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-neon-purple mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium text-sm">Voice Chat</p>
                      <p className="text-xs text-gray-500">Talk with friends while watching</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2 sm:gap-3">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-neon-pink mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium text-sm">Real-time Sync</p>
                      <p className="text-xs text-gray-500">Play, pause, and seek in perfect sync</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2 sm:gap-3">
                    <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium text-sm">Private Rooms</p>
                      <p className="text-xs text-gray-500">Invite-only with 6-character room codes</p>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-neon-blue/10 to-neon-purple/10 rounded-2xl p-4 sm:p-6 border border-neon-blue/20">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2">How it works</h3>
                <ol className="space-y-2 text-xs sm:text-sm text-gray-400">
                  <li className="flex gap-2 sm:gap-3">
                    <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-neon-blue/20 text-neon-blue flex items-center justify-center text-[10px] sm:text-xs font-bold flex-shrink-0">1</span>
                    <span>Create or join a watch party room</span>
                  </li>
                  <li className="flex gap-2 sm:gap-3">
                    <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-neon-blue/20 text-neon-blue flex items-center justify-center text-[10px] sm:text-xs font-bold flex-shrink-0">2</span>
                    <span>Host selects a video file or URL</span>
                  </li>
                  <li className="flex gap-2 sm:gap-3">
                    <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-neon-blue/20 text-neon-blue flex items-center justify-center text-[10px] sm:text-xs font-bold flex-shrink-0">3</span>
                    <span>Everyone watches in perfect sync</span>
                  </li>
                  <li className="flex gap-2 sm:gap-3">
                    <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-neon-blue/20 text-neon-blue flex items-center justify-center text-[10px] sm:text-xs font-bold flex-shrink-0">4</span>
                    <span>Chat and voice call while watching</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-cinema-800 py-3 sm:py-4">
        <div className="container mx-auto px-4 text-center text-xs sm:text-sm text-gray-500">
          Built with Next.js, WebRTC, and Socket.io
        </div>
      </footer>
    </div>
  );
}
