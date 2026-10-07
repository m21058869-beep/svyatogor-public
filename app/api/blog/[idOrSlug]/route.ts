import { NextResponse } from 'next/server';
import { apiRoute, jsonNoStore } from '@/server/api';
import { getSessionUser, requireAdmin } from '@/server/auth';
import { prisma } from '@/server/db';
import {
  asObject,
  isUuid,
  jsonBody,
  notFound,
  optionalBoolean,
  optionalString,
  requiredString,
  uuidParam,
} from '@/server/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { idOrSlug: string };

// GET /api/blog/:idOrSlug
export const GET = apiRoute<Params>(async (request, { params }) => {
  const key = params.idOrSlug;
  const row = await prisma.blogPost.findUnique({ where: isUuid(key) ? { id: key } : { slug: key } });
  const user = await getSessionUser(request);
  if (!row || (!row.published && !user)) notFound();
  return jsonNoStore(row);
});

export const PUT = apiRoute<Params>(async (request, { params }) => {
  await requireAdmin(request);
  const id = uuidParam(params, 'idOrSlug');
  const body = asObject(await jsonBody(request));
  for (const key of ['title', 'slug', 'content'] as const) {
    if (body[key] !== undefined) requiredString(body, key);
  }
  const coverImage = optionalString(body, 'cover_image');
  const excerpt = optionalString(body, 'excerpt');
  const row = await prisma.blogPost.update({
    where: { id },
    data: {
      title: optionalString(body, 'title') ?? undefined,
      slug: optionalString(body, 'slug') ?? undefined,
      content: optionalString(body, 'content') ?? undefined,
      excerpt: excerpt === undefined ? undefined : (excerpt ?? ''),
      cover_image: coverImage === undefined ? undefined : coverImage || null,
      published: optionalBoolean(body, 'published'),
    },
  });
  return jsonNoStore(row);
});

export const DELETE = apiRoute<Params>(async (request, { params }) => {
  await requireAdmin(request);
  await prisma.blogPost.delete({ where: { id: uuidParam(params, 'idOrSlug') } });
  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
  });
});
