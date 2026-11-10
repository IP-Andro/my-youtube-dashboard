'use client';

import React, { useState } from 'react';
import { ExternalLink, Heart, Radio, Check, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CategoryWithCount } from './CategoryTabs';

export interface VideoItem {
  id: string;
  title: string;
  channel_title: string;
  description: string;
  thumbnail_url: string;
  published_at: string;
  feed_type: 'likes' | 'subscriptions';
  category_id: string | null;
  category_name?: string;
  is_manual_override: number;
  liked_or_ingested_at: string;
}

interface VideoCardProps {
  video: VideoItem;
  categories: CategoryWithCount[];
  onCategoryChange: (videoId: string, categoryId: string) => Promise<void>;
}

export function VideoCard({ video, categories, onCategoryChange }: VideoCardProps) {
  const [currentCategory, setCurrentCategory] = useState(video.category_id || 'others');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);

  const youtubeUrl = `https://www.youtube.com/watch?v=${video.id}`;

  const formatPublishDate = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  const handleSelectCategory = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const newCategory = e.target.value;
    setCurrentCategory(newCategory);
    setIsUpdating(true);

    try {
      await onCategoryChange(video.id, newCategory);
      setShowSavedFeedback(true);
      setTimeout(() => setShowSavedFeedback(false), 2000);
    } catch (err) {
      console.error('Failed to update category', err);
      // Revert if error
      setCurrentCategory(video.category_id || 'others');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="group relative flex flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm hover:shadow-md transition-all">
      {/* Clickable Card Link for Navigation */}
      <a
        href={youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative aspect-video bg-zinc-100 dark:bg-zinc-800 overflow-hidden"
      >
        {video.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-400">
            No Thumbnail
          </div>
        )}

        {/* Hover overlay with Open indicator */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 text-zinc-900 text-xs font-bold shadow-lg">
            <ExternalLink className="w-3.5 h-3.5" /> Watch on YouTube
          </span>
        </div>

        {/* Feed Source Badge */}
        <div className="absolute top-2 left-2">
          {video.feed_type === 'likes' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-600 text-white shadow-sm">
              <Heart className="w-2.5 h-2.5 fill-current" /> Liked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-600 text-white shadow-sm">
              <Radio className="w-2.5 h-2.5" /> Subscribed
            </span>
          )}
        </div>
      </a>

      {/* Content Container */}
      <div className="flex flex-col flex-1 p-4 justify-between gap-3">
        <div>
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block font-semibold text-sm line-clamp-2 text-zinc-900 dark:text-zinc-100 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title={video.title}
          >
            {video.title}
          </a>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
            {video.channel_title} • {formatPublishDate(video.published_at)}
          </p>
        </div>

        {/* Category Override Controls */}
        <div
          className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {video.is_manual_override ? (
              <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300 font-medium">
                Manual:
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
                <Sparkles className="w-3 h-3" /> AI:
              </span>
            )}
          </div>

          <div className="relative flex items-center">
            <select
              value={currentCategory}
              onChange={handleSelectCategory}
              disabled={isUpdating}
              className="text-xs font-semibold py-1 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {showSavedFeedback && (
              <span className="absolute -top-6 right-0 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 bg-emerald-50 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded shadow">
                <Check className="w-2.5 h-2.5" /> Saved
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
