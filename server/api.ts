import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Prisma } from './generated/prisma/client';
import { ApiError } from './validate';

type RouteContext<P> = { params: P };
type RouteHandler<P> = (request: NextRequest, context: RouteContext<P>) => Promise<Response> | Response;

/**
 * Обёртка для Route Handlers Next.js: приводит исключения к тем же JSON-ответам,
 * что раньше отдавал onError в Hono (ApiError, Prisma P2002/P2025, 500).
 */
/**
 * JSON-ответ, который запрещено кэшировать.
 *
 * У Route Handlers с `dynamic = 'force-dynamic'` Next.js отдаёт JSON без
 * заголовка Cache-Control, поэтому браузер (и любой прокси) вправе закэшировать
 * ответ по своим эвристикам. Для админки это означало устаревший список постов
 * сразу после сохранения — «раздел срабатывает через раз».
 */
export function jsonNoStore(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
  });
}

export function apiRoute<P extends Record<string, string> = Record<string, never>>(
  handler: RouteHandler<P>,
): RouteHandler<P> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          return NextResponse.json({ error: 'Запись с таким значением уже существует' }, { status: 409 });
        }
        if (error.code === 'P2025') {
          return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 });
        }
      }
      console.error(error);
      return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
    }
  };
}
