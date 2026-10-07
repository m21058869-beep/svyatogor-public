import { NextResponse } from 'next/server';
import { apiRoute } from '@/server/api';
import { requireAdmin } from '@/server/auth';
import { prisma } from '@/server/db';
import { asObject, jsonBody, notFound, optionalString, requiredString, uuidParam } from '@/server/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

export const GET = apiRoute<Params>(async (_request, { params }) => {
  const row = await prisma.galleryPhoto.findUnique({ where: { id: uuidParam(params) } });
  if (!row) notFound();
  return NextResponse.json(row);
});

export const PUT = apiRoute<Params>(async (request, { params }) => {
  await requireAdmin(request);
  const id = uuidParam(params);
  const body = asObject(await jsonBody(request));
  for (const key of ['title', 'image_url'] as const) {
    if (body[key] !== undefined) requiredString(body, key);
  }
  const description = optionalString(body, 'description');
  const thumbnailUrl = optionalString(body, 'thumbnail_url');
  const category = optionalString(body, 'category');
  const row = await prisma.galleryPhoto.update({
    where: { id },
    data: {
      title: optionalString(body, 'title') ?? undefined,
      image_url: optionalString(body, 'image_url') ?? undefined,
      description: description === undefined ? undefined : (description ?? ''),
      thumbnail_url: thumbnailUrl,
      category: category === undefined ? undefined : category || 'general',
    },
  });
  return NextResponse.json(row);
});

export const DELETE = apiRoute<Params>(async (request, { params }) => {
  await requireAdmin(request);
  await prisma.galleryPhoto.delete({ where: { id: uuidParam(params) } });
  return new NextResponse(null, { status: 204 });
});
