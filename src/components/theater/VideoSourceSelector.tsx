'use client';

import { useState, useRef } from 'react';
import { Film, Link, Upload, Play, AlertCircle } from 'lucide-react';

interface VideoSourceSelectorProps {
  onSelectSource: (src: string) => void;
}

export function VideoSourceSelector({ onSelectSource }: VideoSourceSelectorProps) {
  const [mode, setMode] = useState<'url' | 'file'>('url');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setError('');
    onSelectSource(trimmed);
  };

  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size is 50MB.`);
      return;
    }
    setIsConverting(true);
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      setIsConverting(false);
      onSelectSource(reader.result as string);
    };
    reader.onerror = () => {
      setIsConverting(false);
      setError('Failed to read file');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-cinema-800 rounded-xl border border-cinema-600">
      <div className="text-center mb-6">
        <Film className="w-12 h-12 mx-auto text-neon-blue mb-3" />
        <h3 className="text-xl font-semibold text-white">Select Video Source</h3>
        <p className="text-gray-400 text-sm mt-1">
          Choose a video file or enter a URL to start the watch party
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('url')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-colors ${
            mode === 'url'
              ? 'bg-neon-blue text-white'
              : 'bg-cinema-700 text-gray-400 hover:bg-cinema-600'
          }`}
        >
          <Link className="w-4 h-4" />
          Video URL
        </button>
        <button
          onClick={() => setMode('file')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-colors ${
            mode === 'file'
              ? 'bg-neon-blue text-white'
              : 'bg-cinema-700 text-gray-400 hover:bg-cinema-600'
          }`}
        >
          <Upload className="w-4 h-4" />
          Local File
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {mode === 'url' ? (
        <form onSubmit={handleUrlSubmit} className="space-y-4">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="YouTube link or direct video URL"
            className="w-full px-4 py-3 bg-cinema-900 border border-cinema-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-blue focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!url.trim()}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-neon-blue to-neon-purple text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Play className="w-5 h-5" />
            Load Video
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/ogg,video/quicktime"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isConverting}
            className="w-full py-12 border-2 border-dashed border-cinema-600 rounded-lg text-gray-400 hover:border-neon-blue hover:text-neon-blue transition-colors flex flex-col items-center gap-3 disabled:opacity-50"
          >
            {isConverting ? (
              <>
                <div className="w-10 h-10 border-4 border-neon-blue border-t-transparent rounded-full animate-spin" />
                <span>Converting video...</span>
                <span className="text-xs text-gray-500">This may take a moment for large files</span>
              </>
            ) : (
              <>
                <Upload className="w-10 h-10" />
                <span>Click to select a video file</span>
                <span className="text-xs text-gray-500">MP4, WebM, OGG supported</span>
              </>
            )}
          </button>
        </div>
      )}

      <div className="mt-6 p-4 bg-cinema-900 rounded-lg space-y-2">
        <h4 className="text-sm font-medium text-gray-300">What works</h4>
        <ul className="text-xs text-gray-500 space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-green-500">&#10003;</span>
            <span><strong className="text-gray-300">YouTube</strong> — paste any youtube.com or youtu.be link</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500">&#10003;</span>
            <span><strong className="text-gray-300">Direct MP4/WebM URL</strong> — must be a direct link ending in .mp4 or .webm</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500">&#10003;</span>
            <span><strong className="text-gray-300">Local file</strong> — pick a video from your computer</span>
          </li>
        </ul>
        <h4 className="text-sm font-medium text-gray-300 pt-2">What does NOT work</h4>
        <ul className="text-xs text-gray-500 space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-red-500">&#10007;</span>
            <span>Netflix, Disney+, Amazon Prime (DRM protected)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-500">&#10007;</span>
            <span>Embed URLs (youtube.com/embed/...)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-500">&#10007;</span>
            <span>Non-direct links (a webpage URL, not a video file URL)</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
