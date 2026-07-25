export interface Participant {
  id: string;
  displayName: string;
  isHost: boolean;
  isMuted: boolean;
  hasVideo: boolean;
  joinedAt: Date;
}

export interface Room {
  id: string;
  hostId: string;
  participants: Participant[];
  videoState: VideoState;
  createdAt: Date;
  emptySince?: number;
}

export interface VideoState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  videoSrc: string;
  lastUpdate: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  type: 'message' | 'system';
}
