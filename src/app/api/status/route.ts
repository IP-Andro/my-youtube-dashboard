import { NextResponse } from 'next/server';
import { isConfigured } from '@/lib/config';
import { getTokens, getSyncMetadata } from '@/lib/db';

export async function GET() {
  try {
    const configured = isConfigured();
    const tokens = getTokens();
    const authenticated = Boolean(tokens && tokens.access_token);
    const lastSyncedAt = getSyncMetadata('last_synced_at');

    return NextResponse.json({
      configured,
      authenticated,
      last_synced_at: lastSyncedAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
