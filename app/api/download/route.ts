import type { NextRequest } from 'next/server';
import { apiRoute } from '@/server/api';
import { env } from '@/server/env';
import { ApiError, badRequest } from '@/server/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Прокси для скачивания изображений галереи.
 *
 * Зачем нужен: картинки лежат в публичном S3-бакете, то есть на другом origin,
 * у которого нет заголовков CORS. Поэтому браузер открывает фото вместо
 * скачивания: атрибут `download` у ссылки на чужой origin игнорируется, а
 * `fetch` + Blob отбивается CORS. Здесь файл забирает сервер и отдаёт его своим
 * ответом с `Content-Disposition: attachment` — браузер скачивает файл и остаётся
 * на странице.
 */

/** Сколько ждём ответа от хранилища. */
const FETCH_TIMEOUT_MS = 15_000;

/** Расширение по типу содержимого — для имени файла, если его нет в URL. */
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

/**
 * Разбирает адрес картинки и пускает только объекты собственного бакета
 * (`S3_PUBLIC_URL`). Без этой проверки роут превратился бы в открытый прокси:
 * через наш сервер можно было бы тянуть любой чужой адрес.
 */
function parseTargetUrl(raw: string): URL {
  let target: URL | null = null;
  try {
    target = new URL(raw);
  } catch {
    target = null;
  }
  if (!target) badRequest('Параметр url должен быть абсолютным адресом изображения');
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    badRequest('Поддерживаются только адреса http(s)');
  }

  if (!env.s3.publicUrl) throw new ApiError(503, 'Хранилище изображений не настроено');
  let base: URL;
  try {
    base = new URL(env.s3.publicUrl);
  } catch {
    throw new ApiError(503, 'Некорректный S3_PUBLIC_URL в настройках сервера');
  }
  const basePath = base.pathname.replace(/\/+$/, '');
  const insideBucket =
    target.origin === base.origin &&
    (target.pathname === basePath || target.pathname.startsWith(`${basePath}/`));
  if (!insideBucket) {
    throw new ApiError(403, 'Скачать можно только изображения с сайта');
  }
  return target;
}

/** Имя файла: управляющие символы, кавычки и разделители пути заменяем пробелом. */
function sanitizeName(value: string): string {
  const forbidden = '"\\/:*?<>|';
  let cleaned = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    // Диапазон < 0x20 и 0x7f — управляющие символы (перевод строки, DEL и т. п.).
    cleaned += code < 0x20 || code === 0x7f || forbidden.includes(char) ? ' ' : char;
  }
  return cleaned.replace(/\s+/g, ' ').trim().slice(0, 120);
}

/** Имя для скачивания: параметр `name`, иначе — последний сегмент адреса. */
function buildFilename(requested: string | null, target: URL, contentType: string): string {
  let candidate = requested ? sanitizeName(requested) : '';
  if (candidate === '') {
    const last = target.pathname.split('/').filter(Boolean).pop() ?? '';
    // decodeURIComponent: в URL имя может быть процентно-кодированным.
    try {
      candidate = sanitizeName(decodeURIComponent(last));
    } catch {
      candidate = sanitizeName(last);
    }
  }
  if (candidate === '') return EXT_BY_TYPE[contentType] ? `photo.${EXT_BY_TYPE[contentType]}` : 'photo.jpg';
  // Расширение уже есть в имени — не дублируем его.
  if (/\.[a-z0-9]{2,5}$/i.test(candidate)) return candidate;
  return `${candidate}.${EXT_BY_TYPE[contentType] ?? 'jpg'}`;
}

/**
 * Заголовок Content-Disposition: ASCII-имя для старых клиентов плюс RFC 5987
 * (`filename*`) — иначе кириллица в названии фото превращается в кракозябры.
 */
function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'photo.jpg';
  const encoded = encodeURIComponent(filename).replace(
    /['()*!]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

// GET /api/download?url=<адрес объекта в бакете>&name=<имя файла без расширения>
export const GET = apiRoute(async (request: NextRequest) => {
  const params = new URL(request.url).searchParams;
  const raw = params.get('url');
  if (!raw) badRequest('Укажите параметр url — адрес изображения');

  const target = parseTargetUrl(raw);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      // Публичный объект неизменяем (ключ — uuid), кэш Next.js здесь только мешает.
      cache: 'no-store',
      headers: { Accept: 'image/*' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    console.error('[download] хранилище недоступно:', error);
    throw new ApiError(502, 'Не удалось получить файл из хранилища. Попробуйте позже.');
  }

  // Переадресация могла увести на другой хост — проверяем конечный адрес ещё раз.
  if (upstream.url && upstream.url !== target.href) parseTargetUrl(upstream.url);

  const body = upstream.body;
  if (!upstream.ok || !body) {
    /**
     * 404 — файла в бакете нет. 403 приходится трактовать так же: Timeweb
     * Object Storage (как и часть других S3-совместимых сервисов) не различает
     * «нет прав» и «нет объекта» и отвечает AccessDenied на отсутствующий ключ.
     * Проверяли: удалённый или никогда не существовавший объект отдаёт 403, а не
     * 404. Иначе фото, стёртое из бакета напрямую, показывало бы пользователю
     * 502 «хранилище недоступно» вместо понятного «не найдено».
     */
    const missing = upstream.status === 404 || upstream.status === 403;
    throw new ApiError(
      missing ? 404 : 502,
      missing ? 'Изображение не найдено' : 'Не удалось получить файл из хранилища',
    );
  }

  const contentType = (upstream.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!contentType.startsWith('image/')) {
    console.error(`[download] бакет отдал не изображение (${contentType || 'без Content-Type'})`);
    throw new ApiError(415, 'Этот файл не является изображением');
  }

  const headers = new Headers({
    'Content-Type': contentType,
    'Content-Disposition': contentDisposition(buildFilename(params.get('name'), target, contentType)),
    // Файл неизменяем, поэтому браузеру разрешаем закэшировать копию.
    'Cache-Control': 'public, max-age=86400',
  });
  const length = upstream.headers.get('content-length');
  if (length) headers.set('Content-Length', length);

  // Тело отдаём потоком: файл не буферизуется в памяти сервера.
  return new Response(body, { status: 200, headers });
});
