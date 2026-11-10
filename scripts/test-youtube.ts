import {
  fetchLikedVideos,
  fetchSubscriptionUploads,
  getOAuth2Client,
  getAuthUrl,
} from '../src/lib/youtube';
import type { youtube_v3 } from 'googleapis';

async function testYouTubeHelpers() {
  console.log('Testing YouTube helpers...');

  // Set mock env vars
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/callback';

  const client = getOAuth2Client();
  if (!client) throw new Error('Failed to create OAuth2Client');
  console.log('✓ OAuth2Client instantiated');

  const authUrl = getAuthUrl();
  if (!authUrl.includes('accounts.google.com') || !authUrl.includes('test-client-id')) {
    throw new Error('Invalid Auth URL generated');
  }
  console.log('✓ Google Auth URL generated correctly');

  // Test fetchLikedVideos with mock YouTube API
  const mockYouTubeLikes = {
    videos: {
      list: async () => ({
        data: {
          items: [
            {
              id: 'like-1',
              snippet: {
                title: 'Great Founder Interview',
                channelTitle: 'Startup Pod',
                description: 'An interview about building companies',
                publishedAt: '2026-11-05T10:00:00Z',
                thumbnails: {
                  high: { url: 'https://example.com/high.jpg' },
                },
              },
            },
          ],
        },
      }),
    },
  } as unknown as youtube_v3.Youtube;

  const likedVideos = await fetchLikedVideos(mockYouTubeLikes);
  if (likedVideos.length !== 1 || likedVideos[0].id !== 'like-1' || likedVideos[0].feed_type !== 'likes') {
    throw new Error('fetchLikedVideos returned incorrect payload');
  }
  console.log('✓ fetchLikedVideos successfully parsed and normalized video item');

  // Test fetchSubscriptionUploads with 15-day cutoff
  const now = new Date();
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();

  const mockYouTubeSubs = {
    subscriptions: {
      list: async () => ({
        data: {
          items: [
            {
              snippet: {
                resourceId: {
                  channelId: 'UC1234567890',
                },
              },
            },
          ],
        },
      }),
    },
    playlistItems: {
      list: async () => ({
        data: {
          items: [
            {
              snippet: {
                resourceId: { videoId: 'recent-vid' },
                title: 'Recent Upload',
                channelTitle: 'Cool Channel',
                description: 'Published 10 days ago',
                publishedAt: tenDaysAgo,
                thumbnails: { high: { url: 'https://example.com/sub-thumb.jpg' } },
              },
            },
            {
              snippet: {
                resourceId: { videoId: 'old-vid' },
                title: 'Expired Upload',
                channelTitle: 'Cool Channel',
                description: 'Published 20 days ago',
                publishedAt: twentyDaysAgo,
                thumbnails: { high: { url: 'https://example.com/old.jpg' } },
              },
            },
          ],
        },
      }),
    },
  } as unknown as youtube_v3.Youtube;

  const subVideos = await fetchSubscriptionUploads(mockYouTubeSubs);
  if (subVideos.length !== 1 || subVideos[0].id !== 'recent-vid') {
    throw new Error(`fetchSubscriptionUploads should have filtered out 20-day-old video! Found count: ${subVideos.length}`);
  }
  console.log('✓ fetchSubscriptionUploads successfully fetched and filtered to within 15-day window');

  console.log('ALL YOUTUBE HELPER TESTS PASSED!');
}

testYouTubeHelpers().catch((err) => {
  console.error(err);
  process.exit(1);
});
