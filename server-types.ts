export interface Participant {
  id: string;           // socket.id — changes on reconnect
  userId: string;       // persistent UUID — never changes
  displayName: string;
  isHost: boolean;
  isMuted: boolean;
  hasVideo: boolean;
  disconnected: boolean;
  joinedAt: Date;
}

export interface Room {
  id: string;
  hostId: string;
  participants: Participant[];
  videoState: VideoState;
  createdAt: Date;
  emptySince?: number;
  expiresAt?: number;
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
