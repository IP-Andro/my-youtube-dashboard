import { NextResponse } from 'next/server';
import {
  getAuthenticatedYouTubeClient,
  fetchLikedVideos,
  fetchSubscriptionUploads,
} from '@/lib/youtube';
import {
  upsertVideo,
  pruneOldVideos,
  setSyncMetadata,
} from '@/lib/db';
import { classifyBatchOfUncategorized } from '@/lib/categorizer';

export async function POST() {
  try {
    const youtube = await getAuthenticatedYouTubeClient();
    if (!youtube) {
      return NextResponse.json(
        {
          error: 'Not authenticated with YouTube',
          needs_auth: true,
        },
        { status: 401 }
      );
    }

    // 1. Ingest Liked Videos
    let likesCount = 0;
    try {
      const likedVideos = await fetchLikedVideos(youtube, 50);
      for (const video of likedVideos) {
        upsertVideo(video);
      }
      likesCount = likedVideos.length;
    } catch (err) {
      console.error('Error fetching liked videos:', err);
    }

    // 2. Ingest Subscribed Channel Uploads
    let subsCount = 0;
    try {
      const subVideos = await fetchSubscriptionUploads(youtube, 20, 5);
      for (const video of subVideos) {
        upsertVideo(video);
      }
      subsCount = subVideos.length;
    } catch (err) {
      console.error('Error fetching subscription uploads:', err);
    }

    // 3. Classify unclassified videos with Gemini (in batches)
    let classifiedCount = 0;
    for (let i = 0; i < 3; i++) {
      const count = await classifyBatchOfUncategorized(20);
      classifiedCount += count;
      if (count === 0) break;
    }

    // 4. Prune videos older than 15 days
    const prunedCount = pruneOldVideos(15);

    // 5. Update sync metadata
    const nowIso = new Date().toISOString();
    setSyncMetadata('last_synced_at', nowIso);

    return NextResponse.json({
      success: true,
      likes_synced: likesCount,
      subscriptions_synced: subsCount,
      classified: classifiedCount,
      pruned: prunedCount,
      last_synced_at: nowIso,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
