import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { apiRoute } from '@/server/api';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/server/auth';
import { prisma } from '@/server/db';
import { ApiError, asObject, jsonBody, requiredString } from '@/server/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Хэш-заглушка, чтобы время ответа не выдавало, существует ли email.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

export const POST = apiRoute(async (request) => {
  const body = asObject(await jsonBody(request));
  const email = requiredString(body, 'email').trim().toLowerCase();
  const password = requiredString(body, 'password');

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, admin?.password_hash ?? DUMMY_HASH);
  if (!admin || !ok) {
    throw new ApiError(401, 'Неверный email или пароль');
  }

  const token = await createSessionToken({ id: admin.id, email: admin.email });
  const { id, full_name, role, created_at } = admin;
  const response = NextResponse.json({ user: { id, email: admin.email, full_name, role, created_at } });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
});
