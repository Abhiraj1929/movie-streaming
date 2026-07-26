'use client';

import { useEffect, useRef } from 'react';

interface PeerAudioProps {
  peerId: string;
  stream: MediaStream;
}

export default function PeerAudio({ peerId, stream }: PeerAudioProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    el.srcObject = stream;
    el.play().catch(() => {});

    return () => {
      el.srcObject = null;
    };
  }, [peerId, stream]);

  return <audio ref={audioRef} autoPlay playsInline />;
}
