'use client';

import React, { useState } from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  RotateCw,
  ExternalLink,
  Shield,
  Maximize2,
} from 'lucide-react';

interface LivePreviewPanelProps {
  projectId: string;
  previewUrl?: string;
  isRunning: boolean;
}

export default function LivePreviewPanel({
  projectId,
  previewUrl,
  isRunning,
}: LivePreviewPanelProps) {
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [refreshKey, setRefreshKey] = useState(0);

  const targetUrl = previewUrl || `/api/v1/preview/${projectId}`;

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  const getFrameWidth = () => {
    switch (viewport) {
      case 'mobile':
        return 'w-[375px]';
      case 'tablet':
        return 'w-[768px]';
      default:
        return 'w-full';
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Top Preview Control Bar */}
      <div className="h-10 px-4 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-xs select-none">
        {/* Left: URL & Refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            title="Refresh Sandbox Preview"
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-400 max-w-sm truncate">
            <span className="text-zinc-200 font-bold">https://</span>
            <span className="text-zinc-300">sandbox-{projectId.slice(0, 8)}.shipshape.run</span>
          </div>
        </div>

        {/* Center: Viewport Switcher */}
        <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
          <button
            onClick={() => setViewport('desktop')}
            className={`p-1 rounded transition ${
              viewport === 'desktop' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Desktop 100%"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewport('tablet')}
            className={`p-1 rounded transition ${
              viewport === 'tablet' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Tablet (768px)"
          >
            <Tablet className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewport('mobile')}
            className={`p-1 rounded transition ${
              viewport === 'mobile' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Mobile (375px)"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Security & Fullscreen */}
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="hidden sm:flex items-center gap-1 text-[11px] text-zinc-400">
            <Shield className="w-3 h-3 text-zinc-300" />
            <span>Isolated Origin</span>
          </span>
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new window"
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Frame Container */}
      <div className="flex-1 bg-zinc-950/80 p-4 flex items-center justify-center overflow-auto">
        <div
          className={`h-full transition-all duration-300 rounded-xl overflow-hidden shadow-2xl border border-zinc-800 bg-black ${getFrameWidth()}`}
        >
          <iframe
            key={refreshKey}
            src={targetUrl}
            title="Shipshape Isolated Application Preview"
            sandbox="allow-scripts allow-forms allow-same-origin allow-modals"
            className="w-full h-full border-0 bg-zinc-950"
          />
        </div>
      </div>
    </div>
  );
}
