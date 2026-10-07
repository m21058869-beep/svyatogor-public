import { NextResponse } from 'next/server';
import { apiRoute } from '@/server/api';
import { getSessionUser, SESSION_COOKIE, sessionCookieOptions } from '@/server/auth';
import { prisma } from '@/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const publicUser = { id: true, email: true, full_name: true, role: true, created_at: true } as const;

export const GET = apiRoute(async (request) => {
  const session = await getSessionUser(request);
  const user = session && (await prisma.adminUser.findUnique({ where: { id: session.id }, select: publicUser }));
  if (!user) {
    const response = NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    // Администратор удалён — сбрасываем cookie, как это делал endSession в Hono.
    if (session) response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
    return response;
  }
  return NextResponse.json({ user });
});
