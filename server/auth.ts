import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';
import { env } from './env';
import { ApiError } from './validate';

export const SESSION_COOKIE = 'svy_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 дней

export interface SessionUser {
  id: string;
  email: string;
}

/** Секрет для HS256: те же данные, что раньше использовал hono/jwt. */
const secretKey = () => new TextEncoder().encode(env.jwtSecret);

export const sessionCookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
} as const;

/** Подписывает JWT сессии; exp выставляется как абсолютное время (секунды). */
export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS)
    .sign(secretKey());
}

/** Читает сессию из http-only cookie; отсутствующий/невалидный токен = анонимный пользователь. */
export async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub === 'string' && typeof payload.email === 'string') {
      return { id: payload.sub, email: payload.email };
    }
  } catch {
    // Просроченный или подделанный токен — считаем пользователя анонимным.
  }
  return null;
}

/** Пропускает только авторизованных администраторов (аналог hono-мидлвари requireAdmin). */
export async function requireAdmin(request: NextRequest): Promise<SessionUser> {
  const user = await getSessionUser(request);
  if (!user) {
    throw new ApiError(401, 'Требуется авторизация');
  }
  return user;
}
