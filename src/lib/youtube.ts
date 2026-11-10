import { google, youtube_v3 } from 'googleapis';
import { getConfig } from './config';
import { getTokens, saveTokens } from './db';

export function getOAuth2Client() {
  const config = getConfig();
  if (!config.googleClientId || !config.googleClientSecret) {
    throw new Error('Google OAuth credentials not configured in environment variables.');
  }

  const oauth2Client = new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri
  );

  return oauth2Client;
}

export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  const scopes = ['https://www.googleapis.com/auth/youtube.readonly'];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
  });
}

export async function exchangeCodeAndSaveTokens(code: string): Promise<void> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token) {
    throw new Error('Failed to obtain access token from Google.');
  }

  saveTokens({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });
}

export async function getAuthenticatedYouTubeClient(): Promise<youtube_v3.Youtube | null> {
  const tokenRecord = getTokens();
  if (!tokenRecord || !tokenRecord.access_token) {
    return null;
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokenRecord.access_token,
    refresh_token: tokenRecord.refresh_token,
    expiry_date: tokenRecord.expiry_date,
  });

  oauth2Client.on('tokens', (newTokens) => {
    saveTokens({
      access_token: newTokens.access_token || tokenRecord.access_token,
      refresh_token: newTokens.refresh_token || tokenRecord.refresh_token,
      expiry_date: newTokens.expiry_date || tokenRecord.expiry_date,
    });
  });

  // If token is expired and refresh token is available, refresh immediately
  if (tokenRecord.expiry_date && tokenRecord.expiry_date <= Date.now() && tokenRecord.refresh_token) {
    try {
      const refreshed = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(refreshed.credentials);
      saveTokens({
        access_token: refreshed.credentials.access_token || tokenRecord.access_token,
        refresh_token: refreshed.credentials.refresh_token || tokenRecord.refresh_token,
        expiry_date: refreshed.credentials.expiry_date || tokenRecord.expiry_date,
      });
    } catch (err) {
      console.error('Failed to refresh access token:', err);
    }
  }

  return google.youtube({ version: 'v3', auth: oauth2Client });
}

export interface IngestedVideo {
  id: string;
  title: string;
  channel_title: string;
  description: string;
  thumbnail_url: string;
  published_at: string;
  feed_type: 'likes' | 'subscriptions';
  liked_or_ingested_at: string;
}

export async function fetchLikedVideos(youtube: youtube_v3.Youtube, maxResults = 50): Promise<IngestedVideo[]> {
  const res = await youtube.videos.list({
    part: ['snippet', 'contentDetails'],
    myRating: 'like',
    maxResults,
  });

  const items = res.data.items || [];
  const now = new Date().toISOString();

  return items
    .filter((item) => item.id && item.snippet)
    .map((item) => {
      const snippet = item.snippet!;
      const thumb = snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '';
      return {
        id: item.id!,
        title: snippet.title || 'Untitled',
        channel_title: snippet.channelTitle || 'Unknown Channel',
        description: snippet.description || '',
        thumbnail_url: thumb,
        published_at: snippet.publishedAt || now,
        feed_type: 'likes' as const,
        liked_or_ingested_at: now,
      };
    });
}

export async function fetchSubscriptionUploads(
  youtube: youtube_v3.Youtube,
  maxChannels = 20,
  maxVideosPerChannel = 5
): Promise<IngestedVideo[]> {
  const subRes = await youtube.subscriptions.list({
    part: ['snippet', 'contentDetails'],
    mine: true,
    maxResults: maxChannels,
  });

  const channels = subRes.data.items || [];
  const now = new Date();
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
  const nowIso = now.toISOString();

  const allVideos: IngestedVideo[] = [];

  for (const sub of channels) {
    const channelId = sub.snippet?.resourceId?.channelId;
    if (!channelId) continue;

    // Convert channel ID UC... to uploads playlist UU...
    const uploadsPlaylistId = channelId.startsWith('UC') ? 'UU' + channelId.substring(2) : channelId;

    try {
      const playlistRes = await youtube.playlistItems.list({
        part: ['snippet'],
        playlistId: uploadsPlaylistId,
        maxResults: maxVideosPerChannel,
      });

      const items = playlistRes.data.items || [];
      for (const item of items) {
        const snippet = item.snippet;
        const videoId = snippet?.resourceId?.videoId;
        if (!videoId || !snippet) continue;

        const publishedAt = snippet.publishedAt ? new Date(snippet.publishedAt) : now;
        // Enforce 15-day window for subscription uploads
        if (publishedAt < fifteenDaysAgo) {
          continue;
        }

        const thumb = snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '';
        allVideos.push({
          id: videoId,
          title: snippet.title || 'Untitled',
          channel_title: snippet.channelTitle || 'Unknown Channel',
          description: snippet.description || '',
          thumbnail_url: thumb,
          published_at: publishedAt.toISOString(),
          feed_type: 'subscriptions' as const,
          liked_or_ingested_at: nowIso,
        });
      }
    } catch (err) {
      // Individual channel playlist failure shouldn't abort the whole sync
      console.warn(`Could not fetch uploads for channel ${channelId}:`, err);
    }
  }

  return allVideos;
}
