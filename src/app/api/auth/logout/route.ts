import { NextRequest, NextResponse } from 'next/server';
import { clearTokens } from '@/lib/db';

export async function POST(request: NextRequest) {
  clearTokens();
  return NextResponse.json({ success: true, message: 'Logged out successfully' });
}

export async function GET(request: NextRequest) {
  clearTokens();
  const origin = request.nextUrl.origin;
  return NextResponse.redirect(`${origin}/`);
}
