'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { useWatchParty } from '@/hooks/useWatchParty';
import { VideoPlayer } from '@/components/theater/VideoPlayer';
import { VideoSourceSelector } from '@/components/theater/VideoSourceSelector';
import { MicControl } from '@/components/theater/MicControl';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ParticipantList } from '@/components/chat/ParticipantList';
import { VideoState } from '@/types';
import { MessageSquare, Users, ArrowLeft, Film, X } from 'lucide-react';

export default function RoomContent() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;

  const {
    socket,
    isConnected,
    room,
    participant,
    participants,
    chatMessages,
    error,
    leaveRoom,
    sendVideoState,
    sendChatMessage,
    sendMuteStatus,
    sendVideoStatus,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    sendPeerReady,
  } = useSocket();

  const isHost = participant?.isHost || false;

  const {
    peerStreams,
    isMuted,
    micReady,
    toggleMute,
  } = useWatchParty({
    socket,
    participant,
    participants,
    isHost,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    sendPeerReady,
    sendMuteStatus,
  });

  const [videoSrc, setVideoSrc] = useState<string>('');
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSourceSelector, setShowSourceSelector] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isConnected) return;
    if (!room || !participant) {
      router.push('/');
    }
  }, [isConnected, room, participant, router]);

  useEffect(() => {
    if (room?.videoState.videoSrc) {
      setVideoSrc(room.videoState.videoSrc);
      setShowSourceSelector(false);
    }
  }, [room?.videoState.videoSrc]);

  const handleVideoStateChange = useCallback(
    (state: Partial<VideoState>) => {
      sendVideoState(state);
    },
    [sendVideoState]
  );

  const handleSelectVideoSource = (src: string) => {
    setVideoSrc(src);
    setShowSourceSelector(false);
    sendVideoState({ videoSrc: src });
  };

  const handleChangeVideo = () => {
    setShowSourceSelector(true);
  };

  const handleRemoveVideo = () => {
    setVideoSrc('');
    setShowSourceSelector(false);
    sendVideoState({ videoSrc: '', isPlaying: false, currentTime: 0 });
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    router.push('/');
  };

  if (!room || !participant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cinema-950">
        <div className="text-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-neon-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm sm:text-base">Joining room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-cinema-950">
      <header className="border-b border-cinema-800 bg-cinema-950/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={handleLeaveRoom}
              className="p-1.5 sm:p-2 hover:bg-cinema-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            </button>
            <div>
              <h1 className="text-sm sm:text-lg font-semibold text-white">Watch Party</h1>
              <p className="text-[10px] sm:text-xs text-gray-500">Room: {room.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {isHost && videoSrc && !showSourceSelector && (
              <div className="flex items-center gap-1 sm:gap-2 mr-1 sm:mr-2">
                <button
                  onClick={handleChangeVideo}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-cinema-800 hover:bg-cinema-700 text-gray-300 rounded-lg transition-colors text-xs sm:text-sm"
                >
                  <Film className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Change</span>
                </button>
                <button
                  onClick={handleRemoveVideo}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-xs sm:text-sm"
                >
                  <X className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Stop</span>
                </button>
              </div>
            )}
            <button
              onClick={() => { setShowParticipants(!showParticipants); if (!showParticipants) setShowChat(false); }}
              className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                showParticipants ? 'bg-neon-blue text-white' : 'bg-cinema-800 text-gray-400 hover:bg-cinema-700'
              }`}
            >
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={() => { setShowChat(!showChat); if (!showChat) setShowParticipants(false); }}
              className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                showChat ? 'bg-neon-blue text-white' : 'bg-cinema-800 text-gray-400 hover:bg-cinema-700'
              }`}
            >
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row relative">
        <div className={`flex-1 p-2 sm:p-4 transition-all duration-300 ${showChat && !showParticipants ? 'lg:mr-80' : ''}`}>
          <div className="max-w-6xl mx-auto">
            {isHost && showSourceSelector && (
              <div className="mb-4 sm:mb-6">
                <VideoSourceSelector onSelectSource={handleSelectVideoSource} />
              </div>
            )}

            {isHost && !videoSrc && !showSourceSelector && (
              <div className="mb-4 sm:mb-6">
                <VideoSourceSelector onSelectSource={handleSelectVideoSource} />
              </div>
            )}

            <div ref={videoContainerRef}>
              {videoSrc ? (
                <VideoPlayer
                  videoState={room.videoState}
                  isHost={isHost}
                  peerStreams={peerStreams.map((ps) => ps.stream)}
                  onVideoStateChange={handleVideoStateChange}
                />
              ) : !showSourceSelector ? (
                <div className="aspect-video bg-cinema-900 rounded-lg flex items-center justify-center">
                  <div className="text-center px-4">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-cinema-800 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-400 text-sm sm:text-base">
                      {isHost ? 'Select a video source to start' : 'Waiting for host to start the video...'}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {showParticipants && (
              <div className="mt-4 p-3 sm:p-4 bg-cinema-900 rounded-lg border border-cinema-800">
                <ParticipantList participants={participants} currentUserId={participant.id} />
              </div>
            )}
          </div>
        </div>

        <ChatSidebar
          messages={chatMessages}
          onSendMessage={sendChatMessage}
          isOpen={showChat}
          onToggle={() => setShowChat(!showChat)}
        />
      </main>

      <MicControl
        isMuted={isMuted}
        isHost={isHost}
        roomId={room.id}
        participantCount={participants.length}
        onToggleMute={toggleMute}
        onLeaveRoom={handleLeaveRoom}
      />

      {peerStreams.map((ps) => (
        <audio
          key={ps.peerId}
          ref={(el) => { if (el) el.srcObject = ps.stream; }}
          autoPlay
          playsInline
        />
      ))}
    </div>
  );
}
