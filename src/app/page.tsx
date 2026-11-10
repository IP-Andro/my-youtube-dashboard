'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { CategoryTabs, CategoryWithCount } from '@/components/CategoryTabs';
import { VideoCard, VideoItem } from '@/components/VideoCard';
import { RefreshCw, PlayCircle, LogIn, Key, Sparkles, AlertCircle } from 'lucide-react';

interface AppStatus {
  configured: { google: boolean; gemini: boolean };
  authenticated: boolean;
  last_synced_at: string | null;
}

export default function DashboardPage() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [totalVideos, setTotalVideos] = useState(0);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [feedType, setFeedType] = useState<'likes' | 'subscriptions' | 'all'>('likes');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch status', err);
    }
  }, []);

  // Fetch categories with counts
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
        setTotalVideos(data.total_videos || 0);
      }
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  }, []);

  // Fetch videos based on active feed and category
  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        feedType,
        categoryId: selectedCategory,
        limit: '100',
      });
      const res = await fetch(`/api/videos?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
      }
    } catch (err) {
      console.error('Failed to fetch videos', err);
    } finally {
      setLoading(false);
    }
  }, [feedType, selectedCategory]);

  useEffect(() => {
    fetchStatus();
    fetchCategories();
  }, [fetchStatus, fetchCategories]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Handle Sync Now trigger
  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(
          `Synced: ${data.likes_synced} likes, ${data.subscriptions_synced} uploads. Classified: ${data.classified}. Pruned: ${data.pruned}.`
        );
        await Promise.all([fetchStatus(), fetchCategories(), fetchVideos()]);
      } else {
        setSyncMessage(data.error || 'Sync failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sync request failed';
      setSyncMessage(msg);
    } finally {
      setSyncing(false);
    }
  };

  // Handle Category Override on a card
  const handleCategoryChange = async (videoId: string, categoryId: string) => {
    const res = await fetch('/api/videos/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, categoryId }),
    });

    if (!res.ok) {
      throw new Error('Failed to update category override');
    }

    // Refresh categories count and video listing
    fetchCategories();
  };

  // Handle Add Category
  const handleAddCategory = async (name: string) => {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      await fetchCategories();
    }
  };

  // Handle Delete Category
  const handleDeleteCategory = async (id: string) => {
    const res = await fetch(`/api/categories?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      if (selectedCategory === id) {
        setSelectedCategory('all');
      }
      await fetchCategories();
      await fetchVideos();
    }
  };

  const isConfigured = status?.configured || { google: false, gemini: false };
  const isAuthenticated = status?.authenticated || false;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* Header with Feed toggle, Sync trigger, and Last-synced status */}
      <Header
        feedType={feedType}
        onFeedTypeChange={setFeedType}
        onSync={handleSync}
        isSyncing={syncing}
        lastSyncedAt={status?.last_synced_at || null}
        isAuthenticated={isAuthenticated}
        isConfigured={isConfigured}
      />

      {/* Category Tabs Bar */}
      <CategoryTabs
        categories={categories}
        selectedCategory={selectedCategory}
        totalVideos={totalVideos}
        onSelectCategory={setSelectedCategory}
        onAddCategory={handleAddCategory}
        onDeleteCategory={handleDeleteCategory}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Sync status toast / message banner */}
        {syncMessage && (
          <div className="mb-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs font-medium text-blue-900 dark:text-blue-200 flex items-center justify-between shadow-sm">
            <span>{syncMessage}</span>
            <button
              onClick={() => setSyncMessage(null)}
              className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 font-bold ml-4"
            >
              ×
            </button>
          </div>
        )}

        {/* Unconfigured Setup Guide */}
        {(!isConfigured.google || !isConfigured.gemini) && (
          <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-zinc-900 to-zinc-800 text-white shadow-lg">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-400" /> Getting Started: Configure API Keys
            </h2>
            <p className="mt-2 text-xs text-zinc-300 leading-relaxed max-w-2xl">
              Create a <code>.env.local</code> file in this project root with your credentials:
            </p>
            <div className="mt-4 p-4 rounded-xl bg-black/60 font-mono text-xs text-zinc-200 border border-white/10 overflow-x-auto">
              <p>GOOGLE_CLIENT_ID=&quot;your-google-oauth-client-id&quot;</p>
              <p>GOOGLE_CLIENT_SECRET=&quot;your-google-oauth-client-secret&quot;</p>
              <p>GOOGLE_REDIRECT_URI=&quot;http://localhost:3000/api/auth/callback&quot;</p>
              <p>GEMINI_API_KEY=&quot;your-gemini-api-key&quot;</p>
            </div>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm animate-pulse"
              >
                <div className="aspect-video bg-zinc-200 dark:bg-zinc-800" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
                  <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
                  <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3 pt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : videos.length > 0 ? (
          /* Video Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                categories={categories}
                onCategoryChange={handleCategoryChange}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50">
            <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 flex items-center justify-center mb-4 shadow-sm">
              <PlayCircle className="w-8 h-8" />
            </div>

            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {totalVideos === 0 ? 'No Videos in Dashboard Yet' : 'No Videos Found in This Category'}
            </h3>

            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-md">
              {totalVideos === 0 ? (
                isAuthenticated ? (
                  'Your account is connected. Click "Sync Now" in the header to pull your liked videos and subscriptions.'
                ) : (
                  'Connect your YouTube account to automatically ingest your liked videos and subscription feeds.'
                )
              ) : (
                'Try selecting another category tab or switch between Liked Videos and Subscriptions.'
              )}
            </p>

            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              {totalVideos === 0 && !isAuthenticated && (
                <a
                  href="/api/auth/login"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all"
                >
                  <LogIn className="w-4 h-4" /> Connect YouTube Account
                </a>
              )}

              {isAuthenticated && (
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncing}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 shadow-sm transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
