import { Participant, Room, VideoState, ChatMessage } from './index';

export interface ServerToClientEvents {
  'room-created': (data: { roomId: string; participant: Participant }) => void;
  'room-joined': (data: {
    room: Room;
    participant: Participant;
    participants: Participant[];
  }) => void;
  'room-error': (error: { message: string }) => void;
  'participant-joined': (participant: Participant) => void;
  'participant-left': (participantId: string) => void;
  'participant-updated': (participant: Participant) => void;
  'video-state-updated': (state: VideoState) => void;
  'chat-message-received': (message: ChatMessage) => void;
  'offer-received': (data: {
    peerId: string;
    offer: RTCSessionDescriptionInit;
  }) => void;
  'answer-received': (data: {
    peerId: string;
    answer: RTCSessionDescriptionInit;
  }) => void;
  'ice-candidate-received': (data: {
    peerId: string;
    candidate: RTCIceCandidateInit;
  }) => void;
  'peer-ready-received': (peerId: string) => void;
  'error': (error: { message: string }) => void;
}

export interface ClientToServerEvents {
  'create-room': (data: { displayName: string }) => void;
  'join-room': (data: { roomId: string; displayName: string }) => void;
  'leave-room': () => void;
  'video-state-change': (state: Partial<VideoState>) => void;
  'chat-message': (content: string) => void;
  'mute-status': (isMuted: boolean) => void;
  'video-status': (hasVideo: boolean) => void;
  'offer': (data: {
    peerId: string;
    offer: RTCSessionDescriptionInit;
  }) => void;
  'answer': (data: {
    peerId: string;
    answer: RTCSessionDescriptionInit;
  }) => void;
  'ice-candidate': (data: {
    peerId: string;
    candidate: RTCIceCandidateInit;
  }) => void;
  'peer-ready': (peerId: string) => void;
}
