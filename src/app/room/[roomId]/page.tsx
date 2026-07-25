'use client';

import dynamic from 'next/dynamic';

const RoomContent = dynamic(() => import('@/components/RoomContent'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-cinema-950">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-neon-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Joining room...</p>
      </div>
    </div>
  ),
});

export default function RoomPage() {
  return <RoomContent />;
}
