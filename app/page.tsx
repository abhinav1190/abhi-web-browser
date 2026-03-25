'use client';

import { useState, useRef, FormEvent, useEffect, useCallback } from 'react';

const QUICK_LINKS = [
  { label: 'Google', url: 'https://google.com', icon: '🔍' },
  { label: 'GitHub', url: 'https://github.com', icon: '🐙' },
  { label: 'Wikipedia', url: 'https://wikipedia.org', icon: '📖' },
  { label: 'Hacker News', url: 'https://news.ycombinator.com', icon: '🟠' },
  { label: 'Reddit', url: 'https://old.reddit.com', icon: '👾' },
  { label: 'YouTube', url: 'https://youtube.com', icon: '▶️' },
];

export default function Home() {
  const [inputUrl, setInputUrl] = useState('');
  const [displayUrl, setDisplayUrl] = useState('');
  const [iframeSrc, setIframeSrc] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const buildProxySrc = (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`;

  const navigate = useCallback((raw: string) => {
    let url = raw.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    setDisplayUrl(url);
    setInputUrl(url);
    setIsLoading(true);
    setIframeSrc(buildProxySrc(url));
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    navigate(inputUrl);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    // Sync URL bar with actual iframe src
    try {
      const src = iframeRef.current?.src ?? '';
      const match = src.match(/[?&]url=([^&]+)/);
      if (match) {
        const decoded = decodeURIComponent(match[1]);
        setDisplayUrl(decoded);
        if (!isInputFocused) setInputUrl(decoded);
      }
    } catch {
      // cross-origin guard – ignore
    }
  };

  const handleRefresh = () => {
    if (displayUrl) {
      setIsLoading(true);
      setIframeSrc(buildProxySrc(displayUrl) + '&_t=' + Date.now());
    }
  };

  // Listen for navigation messages from proxied page
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'PROXY_NAVIGATE' && e.data.url) {
        navigate(e.data.url);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [navigate]);

  // Keyboard shortcut: Ctrl+L / Cmd+L to focus address bar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#f0f2f5] dark:bg-[#0d0d0f] select-none">

      {/* ── Browser Chrome ────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white dark:bg-[#1c1c1e] border-b border-gray-200 dark:border-[#2c2c2e] shadow-sm">

        {/* Title bar */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-2 border-b border-gray-100 dark:border-[#2c2c2e]">
          {/* macOS-style dots */}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57] hover:brightness-90 cursor-pointer" title="Close" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e] hover:brightness-90 cursor-pointer" title="Minimize" />
            <span className="w-3 h-3 rounded-full bg-[#28c840] hover:brightness-90 cursor-pointer" title="Maximize" />
          </div>
          <span className="flex-1 text-center text-xs font-medium text-gray-400 dark:text-gray-500 select-none truncate">
            {displayUrl || 'New Tab'}
          </span>
        </div>

        {/* Navigation + Address bar */}
        <div className="flex items-center gap-2 px-3 py-2">

          {/* Back */}
          <button
            onClick={() => iframeRef.current?.contentWindow?.history.back()}
            disabled={!iframeSrc}
            className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2c2c2e] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg"
            title="Back (Alt+Left)"
          >
            ‹
          </button>

          {/* Forward */}
          <button
            onClick={() => iframeRef.current?.contentWindow?.history.forward()}
            disabled={!iframeSrc}
            className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2c2c2e] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg"
            title="Forward (Alt+Right)"
          >
            ›
          </button>

          {/* Refresh / Stop */}
          <button
            onClick={handleRefresh}
            disabled={!iframeSrc}
            className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2c2c2e] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Refresh (Ctrl+R)"
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M1 4v6h6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3.51 15a9 9 0 1 0 .49-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          {/* Address bar */}
          <form onSubmit={handleSubmit} className="flex-1 min-w-0">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-150 ${
              isInputFocused
                ? 'bg-white dark:bg-[#2c2c2e] ring-2 ring-blue-500/60 shadow-md'
                : 'bg-gray-100 dark:bg-[#2c2c2e] hover:bg-gray-200 dark:hover:bg-[#3a3a3c]'
            }`}>
              {/* Protocol lock / globe */}
              <span className="flex-shrink-0 text-gray-400 dark:text-gray-500">
                {isLoading ? (
                  <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                ) : displayUrl.startsWith('https://') ? (
                  <svg className="w-3.5 h-3.5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" strokeLinecap="round" />
                  </svg>
                )}
              </span>

              <input
                ref={inputRef}
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onFocus={() => { setIsInputFocused(true); inputRef.current?.select(); }}
                onBlur={() => setIsInputFocused(false)}
                placeholder="Search or enter URL  (e.g. github.com)"
                className="flex-1 min-w-0 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
                autoComplete="off"
                spellCheck={false}
              />

              {inputUrl && (
                <button
                  type="button"
                  onClick={() => { setInputUrl(''); inputRef.current?.focus(); }}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          </form>

          {/* Go button */}
          <button
            onClick={() => navigate(inputUrl)}
            disabled={!inputUrl.trim()}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors shadow-sm"
          >
            Go
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative">
        {/* Welcome / New-tab screen */}
        {!iframeSrc && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 bg-gradient-to-br from-[#f0f4ff] via-[#f8f0ff] to-[#fff0f6] dark:from-[#0d0d1a] dark:via-[#0d0a1a] dark:to-[#1a0d0d] overflow-auto py-12 px-4">

            {/* Hero */}
            <div className="text-center space-y-3">
              <div className="text-6xl">🌐</div>
              <h1 className="text-4xl font-bold tracking-tight text-gray-800 dark:text-white">
                Abhi<span className="text-blue-500">Proxy</span> Browser
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-base max-w-sm mx-auto">
                Browse any URL through our server-side proxy — no restrictions, no blocks.
              </p>
            </div>

            {/* Search bar (big) */}
            <form
              onSubmit={handleSubmit}
              className="w-full max-w-xl flex items-center gap-3 bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-xl border border-gray-200 dark:border-[#2c2c2e] px-5 py-3"
            >
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Enter URL to browse…  e.g. google.com"
                className="flex-1 bg-transparent text-base text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
              <button
                type="submit"
                disabled={!inputUrl.trim()}
                className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white font-semibold text-sm transition-colors"
              >
                Browse
              </button>
            </form>

            {/* Quick links */}
            <div className="w-full max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 text-center mb-4">
                Quick Access
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {QUICK_LINKS.map(({ label, url, icon }) => (
                  <button
                    key={url}
                    onClick={() => navigate(url)}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-[#2c2c2e] hover:border-blue-400 hover:shadow-md transition-all group"
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">{icon}</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer note */}
            <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
              All requests are proxied server-side via Next.js API routes &nbsp;·&nbsp; Press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-[#2c2c2e] rounded text-gray-500 border border-gray-300 dark:border-[#3a3a3c]">Ctrl+L</kbd> to focus address bar
            </p>
          </div>
        )}

        {/* Iframe */}
        {iframeSrc && (
          <>
            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute top-0 left-0 right-0 h-0.5 z-10 overflow-hidden">
                <div className="h-full bg-blue-500 animate-[loading_1.5s_ease-in-out_infinite]"
                  style={{ width: '60%', animation: 'progress 1.5s ease-in-out infinite' }} />
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              onLoad={handleIframeLoad}
              className="w-full h-full border-0 block"
              title="Proxied Content"
              allow="forms"
            />
          </>
        )}
      </div>
    </div>
  );
}


