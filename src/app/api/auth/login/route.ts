import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/youtube';
import { isConfigured } from '@/lib/config';

export async function GET() {
  const { google } = isConfigured();
  if (!google) {
    return NextResponse.json(
      {
        error: 'Google OAuth not configured',
        message: 'Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local',
      },
      { status: 400 }
    );
  }

  try {
    const authUrl = getAuthUrl();
    return NextResponse.redirect(authUrl);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to initiate login', details: message }, { status: 500 });
  }
}
