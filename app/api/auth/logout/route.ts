import { NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionCookieOptions } from '@/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST() {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
