'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Participant } from '@/types';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface PeerStream {
  peerId: string;
  stream: MediaStream;
  displayName: string;
}

interface UseWatchPartyProps {
  socket: any;
  participant: Participant | null;
  participants: Participant[];
  isHost: boolean;
  sendOffer: (peerId: string, offer: RTCSessionDescriptionInit) => void;
  sendAnswer: (peerId: string, answer: RTCSessionDescriptionInit) => void;
  sendIceCandidate: (peerId: string, candidate: RTCIceCandidateInit) => void;
  sendPeerReady: (peerId: string) => void;
  sendMuteStatus: (isMuted: boolean) => void;
}

export function useWatchParty({
  socket,
  participant,
  participants,
  isHost,
  sendOffer,
  sendAnswer,
  sendIceCandidate,
  sendPeerReady,
  sendMuteStatus,
}: UseWatchPartyProps) {
  const [peerStreams, setPeerStreams] = useState<PeerStream[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [micReady, setMicReady] = useState(false);

  const pcs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingOps = useRef<Map<string, boolean>>(new Map());
  const micStreamRef = useRef<MediaStream | null>(null);
  const participantsRef = useRef(participants);
  participantsRef.current = participants;

  function getOrCreatePC(peerId: string): RTCPeerConnection {
    const existing = pcs.current.get(peerId);
    if (existing && existing.signalingState !== 'closed') return existing;

    if (existing) {
      existing.close();
      pcs.current.delete(peerId);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        try { sendIceCandidate(peerId, e.candidate.toJSON()); } catch {}
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (!stream) return;
      const info = participantsRef.current.find((p) => p.id === peerId);
      setPeerStreams((prev) => {
        const idx = prev.findIndex((p) => p.peerId === peerId);
        const item = { peerId, stream, displayName: info?.displayName || 'Unknown' };
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = item;
          return next;
        }
        return [...prev, item];
      });
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'failed' || state === 'closed' || state === 'disconnected') {
        try { pc.close(); } catch {}
        pcs.current.delete(peerId);
        pendingOps.current.delete(peerId);
        setPeerStreams((prev) => prev.filter((p) => p.peerId !== peerId));
      }
    };

    pcs.current.set(peerId, pc);

    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((track) => {
        try { pc.addTrack(track, micStreamRef.current!); } catch {}
      });
    }

    return pc;
  }

  useEffect(() => {
    let destroyed = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
        if (destroyed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        micStreamRef.current = stream;
        setMicReady(true);

        pcs.current.forEach((pc) => {
          stream.getAudioTracks().forEach((track) => {
            try {
              const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
              if (sender) sender.replaceTrack(track);
              else pc.addTrack(track, stream);
            } catch {}
          });
        });
      } catch (err) {
        console.error('[MIC] getUserMedia failed:', err);
      }
    })();

    return () => {
      destroyed = true;
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    async function onOffer({ peerId, offer }: { peerId: string; offer: RTCSessionDescriptionInit }) {
      if (!socket || peerId === socket.id) return;
      if (pendingOps.current.get(peerId)) return;
      pendingOps.current.set(peerId, true);
      try {
        const pc = getOrCreatePC(peerId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendAnswer(peerId, answer);
      } catch (err) {
        console.error('[WebRTC] onOffer error:', err);
      } finally {
        pendingOps.current.delete(peerId);
      }
    }

    async function onAnswer({ peerId, answer }: { peerId: string; answer: RTCSessionDescriptionInit }) {
      if (pendingOps.current.get(peerId)) return;
      pendingOps.current.set(peerId, true);
      try {
        const pc = pcs.current.get(peerId);
        if (pc && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      } catch (err) {
        console.error('[WebRTC] onAnswer error:', err);
      } finally {
        pendingOps.current.delete(peerId);
      }
    }

    async function onIceCandidate({ peerId, candidate }: { peerId: string; candidate: RTCIceCandidateInit }) {
      try {
        const pc = pcs.current.get(peerId);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {}
    }

    async function onPeerReady(peerId: string) {
      if (!socket) return;
      if (peerId === socket.id) return;
      if (pcs.current.has(peerId) || pendingOps.current.get(peerId)) return;
      pendingOps.current.set(peerId, true);
      try {
        const pc = getOrCreatePC(peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendOffer(peerId, offer);
      } catch (err) {
        console.error('[WebRTC] onPeerReady error:', err);
      } finally {
        pendingOps.current.delete(peerId);
      }
    }

    socket.on('offer-received', onOffer);
    socket.on('answer-received', onAnswer);
    socket.on('ice-candidate-received', onIceCandidate);
    socket.on('peer-ready-received', onPeerReady);

    return () => {
      socket.off('offer-received', onOffer);
      socket.off('answer-received', onAnswer);
      socket.off('ice-candidate-received', onIceCandidate);
      socket.off('peer-ready-received', onPeerReady);
    };
  }, [socket, sendOffer, sendAnswer, sendIceCandidate]);

  useEffect(() => {
    if (!socket || !participant) return;

    participants.forEach((p) => {
      if (p.id !== participant.id && !pcs.current.has(p.id)) {
        sendPeerReady(p.id);
      }
    });
  }, [participants, socket, participant, sendPeerReady]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (micStreamRef.current) {
        micStreamRef.current.getAudioTracks().forEach((t) => {
          t.enabled = !next;
        });
      }
      sendMuteStatus(next);
      return next;
    });
  }, [sendMuteStatus]);

  useEffect(() => {
    return () => {
      pcs.current.forEach((pc) => {
        try { pc.close(); } catch {}
      });
      pcs.current.clear();
      pendingOps.current.clear();
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    peerStreams,
    isMuted,
    micReady,
    toggleMute,
  };
}
