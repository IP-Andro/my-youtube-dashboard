'use client';

import React from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, LogIn, LogOut } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function YoutubeIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

interface HeaderProps {
  feedType: 'likes' | 'subscriptions' | 'all';
  onFeedTypeChange: (type: 'likes' | 'subscriptions' | 'all') => void;
  onSync: () => void;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  isAuthenticated: boolean;
  isConfigured: { google: boolean; gemini: boolean };
}

export function Header({
  feedType,
  onFeedTypeChange,
  onSync,
  isSyncing,
  lastSyncedAt,
  isAuthenticated,
  isConfigured,
}: HeaderProps) {
  const formatSyncTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never synced';
    try {
      return `Last synced ${formatDistanceToNow(new Date(timestamp), { addSuffix: true })}`;
    } catch {
      return 'Recently synced';
    }
  };

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4">
          {/* Logo & Status */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-600 text-white shadow-sm">
              <YoutubeIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  YouTube Topic Dashboard
                </h1>
                {isAuthenticated ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    <AlertCircle className="w-3 h-3" /> Not Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatSyncTime(lastSyncedAt)} • 15-day rolling retention
              </p>
            </div>
          </div>

          {/* Controls: Feed Toggle & Sync Button */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Feed Toggle */}
            <div className="inline-flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => onFeedTypeChange('likes')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  feedType === 'likes'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Liked Videos
              </button>
              <button
                type="button"
                onClick={() => onFeedTypeChange('subscriptions')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  feedType === 'subscriptions'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Subscriptions
              </button>
              <button
                type="button"
                onClick={() => onFeedTypeChange('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  feedType === 'all'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                All Feeds
              </button>
            </div>

            {/* Sync Now Button */}
            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing || !isAuthenticated}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-all ${
                isSyncing || !isAuthenticated
                  ? 'bg-zinc-400 dark:bg-zinc-700 cursor-not-allowed opacity-75'
                  : 'bg-red-600 hover:bg-red-700 active:scale-95'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>

            {/* Auth Button */}
            {isAuthenticated ? (
              <a
                href="/api/auth/logout"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                title="Disconnect Google Account"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </a>
            ) : (
              <a
                href="/api/auth/login"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Connect YouTube</span>
              </a>
            )}
          </div>
        </div>

        {/* Warning banner if credentials missing */}
        {!isConfigured.google && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
            <span>
              <strong>Setup required:</strong> Add <code>GOOGLE_CLIENT_ID</code> and{' '}
              <code>GOOGLE_CLIENT_SECRET</code> to <code>.env.local</code> to enable YouTube syncing.
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
