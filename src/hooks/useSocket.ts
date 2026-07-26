'use client';

import { useEffect, useCallback, useState } from 'react';
import { Participant, Room, VideoState, ChatMessage } from '@/types';

let socket: any = null;
let _setRoom: any = null;
let _setParticipant: any = null;
let _setParticipants: any = null;
let _setChatMessages: any = null;
let _setError: any = null;
let _setIsConnected: any = null;

let _cachedRoomData: { room: Room; participant: Participant; participants: Participant[] } | null = null;
let _cachedChatMessages: ChatMessage[] = [];

function setCachedRoomData(room: Room, participant: Participant, participants: Participant[]) {
  _cachedRoomData = { room, participant, participants };
  saveRoomToStorage(room, participant, participants);
}

function clearCachedRoomData() {
  _cachedRoomData = null;
  _cachedChatMessages = [];
  clearRoomStorage();
}

function saveRoomToStorage(room: Room, participant: Participant, participants: Participant[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem('wp_room', JSON.stringify(room));
    sessionStorage.setItem('wp_participant', JSON.stringify(participant));
    sessionStorage.setItem('wp_participants', JSON.stringify(participants));
  } catch {}
}

function loadRoomFromStorage() {
  if (_cachedRoomData) return _cachedRoomData;
  if (typeof window === 'undefined') return null;
  try {
    const room = sessionStorage.getItem('wp_room');
    const participant = sessionStorage.getItem('wp_participant');
    const participants = sessionStorage.getItem('wp_participants');
    if (room && participant) {
      return {
        room: JSON.parse(room),
        participant: JSON.parse(participant),
        participants: participants ? JSON.parse(participants) : [],
      };
    }
  } catch {}
  return null;
}

function clearRoomStorage() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem('wp_room');
    sessionStorage.removeItem('wp_participant');
    sessionStorage.removeItem('wp_participants');
  } catch {}
}

/** Generate a persistent userId on first visit, store in sessionStorage. */
function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let uid = sessionStorage.getItem('wp_userId');
    if (!uid) {
      uid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem('wp_userId', uid);
    }
    return uid;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const saved = loadRoomFromStorage();
  const [room, setRoom] = useState<Room | null>(saved?.room || null);
  const [participant, setParticipant] = useState<Participant | null>(saved?.participant || null);
  const [participants, setParticipants] = useState<Participant[]>(saved?.participants || []);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(_cachedChatMessages);
  const [error, setError] = useState<string | null>(null);

  _setRoom = setRoom;
  _setParticipant = setParticipant;
  _setParticipants = setParticipants;
  _setChatMessages = setChatMessages;
  _setError = setError;
  _setIsConnected = setIsConnected;

  const userId = typeof window !== 'undefined' ? getOrCreateUserId() : '';

  useEffect(() => {
    if (socket) return;

    let importCancelled = false;

    (async () => {
      const { io } = await import('socket.io-client');
      if (importCancelled) return;

      const url = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin;
      console.log('[SOCKET] Connecting to:', url);
      socket = io(url, { transports: ['polling', 'websocket'], upgrade: true });

      socket.on('connect', () => {
        console.log('[SOCKET] Connected:', socket.id, 'userId:', userId);
        _setIsConnected(true);
        _setError(null);
        const saved = loadRoomFromStorage();
        if (saved) {
          // Reconnect: rejoin the room with persistent userId so server can restore us
          socket.emit('join-room', {
            roomId: saved.room.id,
            displayName: saved.participant.displayName,
            userId,
          });
        }
      });

      socket.on('disconnect', () => _setIsConnected(false));

      socket.on('connect_error', (err: any) => {
        console.error('[SOCKET] Connection error:', err.message);
        _setError(`Connection failed: ${err.message}`);
      });

      socket.on('room-created', (data: any) => {
        console.log('[SOCKET] room-created:', data.room.id);
        const r: Room = data.room;
        _setRoom(r);
        _setParticipant(data.participant);
        _setParticipants(data.participants);
        setCachedRoomData(r, data.participant, data.participants);
      });

      socket.on('room-joined', (data: any) => {
        console.log('[SOCKET] room-joined:', data.room.id, 'videoSrc:', data.room.videoState?.videoSrc?.substring(0, 80));
        const r = { ...data.room, participants: data.participants };
        _setRoom(r);
        _setParticipant(data.participant);
        _setParticipants(data.participants);
        setCachedRoomData(r, data.participant, data.participants);
      });

      socket.on('room-error', (data: any) => _setError(data.message));

      socket.on('room-expired', () => {
        console.log('[SOCKET] room-expired');
        _setError('This room\'s paid time has expired');
        clearCachedRoomData();
        _setRoom(null);
        _setParticipant(null);
        _setParticipants([]);
        _setChatMessages([]);
      });

      socket.on('participant-joined', (p: Participant) => {
        _setParticipants((prev: Participant[]) => {
          if (prev.find(pp => pp.userId === p.userId)) return prev;
          const next = [...prev, p];
          _setRoom((r: any) => r ? { ...r, participants: next } : r);
          return next;
        });
      });

      socket.on('participant-left', (userIdLeft: string) => {
        _setParticipants((prev: Participant[]) => {
          const next = prev.filter(p => p.userId !== userIdLeft);
          _setRoom((r: any) => r ? { ...r, participants: next } : r);
          return next;
        });
      });

      socket.on('participant-updated', (p: Participant) => {
        _setParticipants((prev: Participant[]) => prev.map(pp => pp.userId === p.userId ? p : pp));
        _setParticipant((prev: any) => prev?.userId === p.userId ? p : prev);
      });

      socket.on('video-state-updated', (state: VideoState) => {
        console.log('[SOCKET] video-state-updated received:', { videoSrc: state.videoSrc?.substring(0, 80), isPlaying: state.isPlaying });
        _setRoom((prev: any) => prev ? { ...prev, videoState: state } : null);
      });

      socket.on('chat-message-received', (msg: ChatMessage) => {
        console.log('[SOCKET] chat-message-received:', msg.content);
        _cachedChatMessages.push(msg);
        _setChatMessages((prev: ChatMessage[]) => [...prev, msg]);
      });
    })();

    return () => { importCancelled = true; };
  }, [userId]);

  const createRoom = useCallback((displayName: string, purchaseId?: string) => {
    if (!socket?.connected) { _setError('Not connected yet, please wait...'); return; }
    socket.emit('create-room', { userId, displayName, purchaseId });
  }, [userId]);

  const joinRoom = useCallback((roomId: string, displayName: string) => {
    if (!socket?.connected) { _setError('Not connected'); return; }
    socket.emit('join-room', { roomId, displayName, userId });
  }, [userId]);

  const leaveRoom = useCallback(() => {
    socket?.emit('leave-room');
    clearCachedRoomData();
    _setRoom(null);
    _setParticipant(null);
    _setParticipants([]);
    _setChatMessages([]);
  }, []);

  const sendVideoState = useCallback((state: Partial<VideoState>) => {
    console.log('[SOCKET] sendVideoState:', { videoSrc: state.videoSrc?.substring(0, 80), isPlaying: state.isPlaying });
    socket?.emit('video-state-change', state);
  }, []);

  const sendChatMessage = useCallback((message: string) => {
    socket?.emit('chat-message', message);
  }, []);

  const sendMuteStatus = useCallback((isMuted: boolean) => {
    socket?.emit('mute-status', isMuted);
  }, []);

  const sendVideoStatus = useCallback((hasVideo: boolean) => {
    socket?.emit('video-status', hasVideo);
  }, []);

  const sendOffer = useCallback((peerId: string, offer: RTCSessionDescriptionInit) => {
    socket?.emit('offer', { peerId, offer });
  }, []);

  const sendAnswer = useCallback((peerId: string, answer: RTCSessionDescriptionInit) => {
    socket?.emit('answer', { peerId, answer });
  }, []);

  const sendIceCandidate = useCallback((peerId: string, candidate: RTCIceCandidateInit) => {
    socket?.emit('ice-candidate', { peerId, candidate });
  }, []);

  const sendPeerReady = useCallback((peerId: string) => {
    socket?.emit('peer-ready', peerId);
  }, []);

  const clearError = useCallback(() => _setError(null), []);

  return {
    socket, isConnected, room, participant, participants, chatMessages, error,
    createRoom, joinRoom, leaveRoom,
    sendVideoState, sendChatMessage, sendMuteStatus, sendVideoStatus,
    sendOffer, sendAnswer, sendIceCandidate, sendPeerReady, clearError,
  };
}
