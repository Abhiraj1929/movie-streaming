'use client';

import { useRef, useEffect, useState } from 'react';
import { VideoState } from '@/types';

interface VideoPlayerProps {
  videoState: VideoState;
  isHost: boolean;
  peerStreams: MediaStream[];
  onVideoStateChange: (state: Partial<VideoState>) => void;
}

function getYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov|mkv)(\?.*)?$/i.test(url) || url.startsWith('blob:') || url.startsWith('data:video');
}

export function VideoPlayer({
  videoState,
  isHost,
  peerStreams,
  onVideoStateChange,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSeekingRef = useRef(false);
  const syncingRef = useRef(false);
  const lastSyncRef = useRef(0);
  const callbacksRef = useRef({ onVideoStateChange });
  callbacksRef.current = { onVideoStateChange };

  const videoSrc = videoState.videoSrc || '';
  const ytId = getYouTubeId(videoSrc);
  const isYouTube = !!ytId;
  const isDirect = !isYouTube && isDirectVideoUrl(videoSrc);

  useEffect(() => {
    if (!isDirect || !videoRef.current) return;
    const video = videoRef.current;
    setLoadError(false);
    video.src = videoSrc;
    video.load();
  }, [videoSrc, isDirect]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isDirect) return;

    const emit = (state: Partial<VideoState>) => {
      callbacksRef.current.onVideoStateChange(state);
    };

    const throttledTimeUpdate = () => {
      const now = Date.now();
      if (now - lastSyncRef.current > 1000) {
        lastSyncRef.current = now;
        emit({ currentTime: video.currentTime });
      }
    };

    const onPlay = () => {
      setIsPlaying(true);
      if (isHost) emit({ isPlaying: true, currentTime: video.currentTime });
    };

    const onPause = () => {
      setIsPlaying(false);
      if (isHost) emit({ isPlaying: false, currentTime: video.currentTime });
    };

    const onSeeked = () => {
      setCurrentTime(video.currentTime);
      if (isHost) emit({ currentTime: video.currentTime });
    };

    const onLoadedMetadata = () => {
      setDuration(video.duration);
      setLoadError(false);
      if (isHost) emit({ duration: video.duration, currentTime: 0 });
    };

    const onError = () => {
      setLoadError(true);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', throttledTimeUpdate);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', throttledTimeUpdate);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
    };
  }, [isHost, isDirect]);

  useEffect(() => {
    if (isHost || !isDirect || !videoRef.current) return;
    const video = videoRef.current;

    syncingRef.current = true;

    if (videoState.isPlaying && video.paused) {
      video.play().catch(() => {}).finally(() => { syncingRef.current = false; });
    } else if (!videoState.isPlaying && !video.paused) {
      video.pause();
      syncingRef.current = false;
    } else {
      syncingRef.current = false;
    }

    const diff = Math.abs(video.currentTime - videoState.currentTime);
    if (diff > 1) {
      video.currentTime = videoState.currentTime;
      setCurrentTime(videoState.currentTime);
    }
  }, [isHost, videoState.isPlaying, videoState.currentTime, isDirect]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video || !isHost || !isDirect) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const handleSeekStart = () => { isSeekingRef.current = true; };
  const handleSeekInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTime(parseFloat(e.target.value));
  };
  const handleSeekEnd = (e: React.MouseEvent<HTMLInputElement>) => {
    isSeekingRef.current = false;
    const video = videoRef.current;
    if (!video || !isHost || !isDirect) return;
    const val = parseFloat((e.target as HTMLInputElement).value);
    video.currentTime = val;
    setCurrentTime(val);
    onVideoStateChange({ currentTime: val });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const vol = parseFloat(e.target.value);
    videoRef.current.volume = vol;
    setVolume(vol);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current.requestFullscreen();
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {isYouTube ? (
        <iframe
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : isDirect ? (
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
          onClick={togglePlayPause}
        />
      ) : videoSrc ? (
        <div className="w-full h-full flex items-center justify-center bg-cinema-900">
          <div className="text-center p-8">
            <p className="text-red-400 text-lg mb-2">Unsupported video source</p>
            <p className="text-gray-500 text-sm">Use a direct video URL (MP4, WebM) or a YouTube link</p>
          </div>
        </div>
      ) : null}

      {loadError && isDirect && (
        <div className="absolute inset-0 flex items-center justify-center bg-cinema-900/90">
          <div className="text-center p-8">
            <p className="text-red-400 text-lg mb-2">Failed to load video</p>
            <p className="text-gray-500 text-sm">Try a direct .mp4 or .webm link, or upload a local file.</p>
          </div>
        </div>
      )}

      {isDirect && !isYouTube && (
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 sm:p-4 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={togglePlayPause}
              disabled={!isHost}
              className="p-1.5 sm:p-2 hover:bg-white/20 rounded-full transition-colors disabled:opacity-50"
            >
              {isPlaying ? (
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <div className="flex-1">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onMouseDown={handleSeekStart}
                onTouchStart={handleSeekStart}
                onChange={handleSeekInput}
                onMouseUp={handleSeekEnd}
                onTouchEnd={() => { isSeekingRef.current = false; const video = videoRef.current; if (video && isHost && isDirect) { setCurrentTime(video.currentTime); onVideoStateChange({ currentTime: video.currentTime }); } }}
                disabled={!isHost}
                className="w-full h-1 bg-cinema-600 rounded-lg appearance-none cursor-pointer accent-neon-blue disabled:opacity-50"
              />
            </div>

            <span className="text-white text-[11px] sm:text-sm font-mono min-w-[70px] sm:min-w-[100px] text-center">
              {fmt(currentTime)} / {fmt(duration)}
            </span>

            <div className="hidden sm:flex items-center gap-2">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-cinema-600 rounded-lg appearance-none cursor-pointer accent-neon-blue"
              />
            </div>

            <button onClick={toggleFullscreen} className="p-1.5 sm:p-2 hover:bg-white/20 rounded-full transition-colors">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {!isHost && !isYouTube && (
        <div className="absolute top-4 left-4 px-3 py-1 bg-cinema-800/80 rounded-full text-xs text-gray-300">
          Watching as viewer
        </div>
      )}

      {isYouTube && (
        <div className="absolute top-4 left-4 px-3 py-1 bg-cinema-800/80 rounded-full text-xs text-gray-300">
          YouTube - open same link on all devices to sync
        </div>
      )}
    </div>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
