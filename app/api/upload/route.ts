import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { apiRoute } from '@/server/api';
import { requireAdmin } from '@/server/auth';
import { env } from '@/server/env';
import { uploadPublicObject } from '@/server/s3';
import { ApiError, badRequest } from '@/server/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  // SVG намеренно не разрешён: он может содержать исполняемый JavaScript.
};

// Папки внутри бакета, как раньше в Supabase Storage (бакет images).
const FOLDERS = new Set(['blog-covers', 'gallery', 'team']);

const maxBytes = env.uploadMaxMb * 1024 * 1024;

/**
 * Лимит размера тела запроса для Route Handler.
 *
 * У Route Handlers App Router (в отличие от pages/api с bodyParser) своего
 * ограничения нет — `next start` не режет тело запроса. Поэтому реальные пределы
 * задаются здесь и на прокси:
 *   • Nginx:    client_max_body_size 150m  (/etc/nginx/sites-available/svyatogor);
 *   • приложение: UPLOAD_MAX_MB (ниже в POST, ошибка 413).
 * Пакетная загрузка галереи отправляет файлы по одному, поэтому каждое тело
 * запроса содержит ровно один файл и укладывается в оба лимита.
 */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

// CSRF: запросы с форм-контентом (multipart) принимаем только с того же хоста —
// замена hono/csrf. Сравниваем именно host, а не схему: за реверс-прокси с TLS
// сервер видит http.
function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin) return;
  try {
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    if (new URL(origin).host !== host) throw new ApiError(403, 'Недопустимый Origin запроса');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(403, 'Недопустимый Origin запроса');
  }
}

// Разбор multipart-тела: сбой (оборванная отправка, слишком большой файл) должен
// возвращать понятную 400, а не превращаться в 500 «Внутренняя ошибка сервера».
async function readFormData(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    badRequest('Не удалось разобрать multipart-тело запроса. Попробуйте загрузить файл ещё раз.');
  }
}

// POST /api/upload  (multipart/form-data: file, folder)
// Ответ: { url, key } — url указывает на объект в публичном бакете.
export const POST = apiRoute(async (request) => {
  await requireAdmin(request);
  assertSameOrigin(request);

  // Ранний отказ по Content-Length: не буферизуем в память заведомо слишком
  // большое тело (запрос может быть отклонён и на уровне Nginx — см. выше).
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > maxBytes + MULTIPART_OVERHEAD_BYTES) {
    throw new ApiError(413, `Файл больше ${env.uploadMaxMb} МБ`);
  }

  const form = await readFormData(request);
  const file = form.get('file');
  if (!(file instanceof File)) badRequest('Передайте файл в поле "file"');

  const ext = IMAGE_TYPES[file.type];
  if (!ext) badRequest('Можно загружать только изображения (JPEG, PNG, WebP, GIF, AVIF)');
  if (file.size > maxBytes) {
    throw new ApiError(413, `Файл больше ${env.uploadMaxMb} МБ`);
  }

  const folderValue = form.get('folder');
  const folder = typeof folderValue === 'string' && FOLDERS.has(folderValue) ? folderValue : 'gallery';
  const key = `${folder}/${randomUUID()}.${ext}`;
  const url = await uploadPublicObject(key, new Uint8Array(await file.arrayBuffer()), file.type);
  return NextResponse.json({ url, key }, { status: 201 });
});
