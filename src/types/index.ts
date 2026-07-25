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

export interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

export interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate' | 'peer-ready';
  peerId: string;
  data?: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

export type RoomMode = 'lobby' | 'watching';
