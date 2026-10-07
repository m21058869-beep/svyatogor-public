import { NextResponse } from 'next/server';
import { apiRoute, jsonNoStore } from '@/server/api';
import { requireAdmin } from '@/server/auth';
import { prisma } from '@/server/db';
import { deletePublicObjectByUrl } from '@/server/s3';
import {
  asObject,
  jsonBody,
  notFound,
  optionalInt,
  optionalString,
  requiredString,
  uuidParam,
} from '@/server/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

/**
 * Удаление фото игрока — вспомогательная операция. Карточка к этому моменту уже
 * сохранена/удалена, поэтому сбой S3 не должен ломать ответ: иначе админ не смог
 * бы ни заменить фото, ни убрать игрока из-за временной ошибки хранилища.
 * Адрес вне нашего бакета (keyFromPublicUrl вернёт null) молча игнорируется.
 */
async function removePhoto(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    await deletePublicObjectByUrl(url);
  } catch (error) {
    console.error(`[team] не удалось удалить фото из S3 (${url}):`, error);
  }
}

// GET /api/team/:id
export const GET = apiRoute<Params>(async (_request, { params }) => {
  const row = await prisma.player.findUnique({ where: { id: uuidParam(params) } });
  if (!row) notFound();
  return jsonNoStore(row);
});

export const PUT = apiRoute<Params>(async (request, { params }) => {
  await requireAdmin(request);
  const id = uuidParam(params);
  const body = asObject(await jsonBody(request));
  if (body.name !== undefined) requiredString(body, 'name');

  // Прежний адрес фото нужен, чтобы удалить объект из S3 после замены.
  const previous = await prisma.player.findUnique({ where: { id }, select: { photo_url: true } });
  if (!previous) notFound();

  const photoUrl = optionalString(body, 'photo_url');
  const row = await prisma.player.update({
    where: { id },
    data: {
      name: optionalString(body, 'name') ?? undefined,
      number: optionalInt(body, 'number'),
      position: optionalString(body, 'position') ?? undefined,
      bio: optionalString(body, 'bio') ?? undefined,
      // '' — явное «убрать фото» → null; undefined — поле не трогаем.
      photo_url: photoUrl === undefined ? undefined : photoUrl || null,
      sort_order: optionalInt(body, 'sort_order') ?? undefined,
    },
  });

  if (previous.photo_url && previous.photo_url !== row.photo_url) {
    await removePhoto(previous.photo_url);
  }
  return jsonNoStore(row);
});

export const DELETE = apiRoute<Params>(async (request, { params }) => {
  await requireAdmin(request);
  const id = uuidParam(params);
  const row = await prisma.player.findUnique({ where: { id }, select: { photo_url: true } });
  if (!row) notFound();

  await prisma.player.delete({ where: { id } });
  await removePhoto(row.photo_url);
  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
  });
});
