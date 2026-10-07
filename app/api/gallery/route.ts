import { NextResponse } from 'next/server';
import { apiRoute } from '@/server/api';
import { requireAdmin } from '@/server/auth';
import { prisma } from '@/server/db';
import { asObject, badRequest, jsonBody, limitQuery, optionalString, requiredString } from '@/server/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parsePhoto(value: unknown, uploadedBy: string) {
  const body = asObject(value);
  const imageUrl = requiredString(body, 'image_url');
  return {
    title: requiredString(body, 'title'),
    description: optionalString(body, 'description') ?? '',
    image_url: imageUrl,
    thumbnail_url: optionalString(body, 'thumbnail_url') ?? imageUrl,
    category: optionalString(body, 'category') || 'general',
    uploaded_by: uploadedBy,
  };
}

// GET /api/gallery?limit=8
export const GET = apiRoute(async (request) => {
  const rows = await prisma.galleryPhoto.findMany({
    orderBy: { created_at: 'desc' },
    take: limitQuery(request, 500),
  });
  return NextResponse.json(rows);
});

// Принимает один объект или массив фото (пакетная загрузка в админке).
export const POST = apiRoute(async (request) => {
  const user = await requireAdmin(request);
  const body = await jsonBody(request);
  if (Array.isArray(body)) {
    if (body.length === 0) badRequest('Пустой массив');
    const rows = await prisma.galleryPhoto.createManyAndReturn({
      data: body.map((item) => parsePhoto(item, user.id)),
    });
    return NextResponse.json(rows, { status: 201 });
  }
  const row = await prisma.galleryPhoto.create({ data: parsePhoto(body, user.id) });
  return NextResponse.json(row, { status: 201 });
});
