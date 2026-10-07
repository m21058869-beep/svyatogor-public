import { NextResponse } from 'next/server';
import type { Prisma } from '@/server/generated/prisma/client';
import { apiRoute } from '@/server/api';
import { requireAdmin } from '@/server/auth';
import { prisma } from '@/server/db';
import { asObject, badRequest, jsonBody, requiredString } from '@/server/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function contentField(body: Record<string, unknown>): Prisma.InputJsonObject {
  const content = body.content;
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    badRequest('Поле "content" должно быть JSON-объектом');
  }
  return content as Prisma.InputJsonObject;
}

// GET /api/content?page=home&section=hero
export const GET = apiRoute(async (request) => {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page');
  const section = searchParams.get('section');
  const rows = await prisma.siteContent.findMany({
    where: { ...(page ? { page } : {}), ...(section ? { section } : {}) },
    orderBy: [{ page: 'asc' }, { section: 'asc' }],
  });
  return NextResponse.json(rows);
});

export const POST = apiRoute(async (request) => {
  await requireAdmin(request);
  const body = asObject(await jsonBody(request));
  const row = await prisma.siteContent.create({
    data: {
      page: requiredString(body, 'page'),
      section: requiredString(body, 'section'),
      content: contentField(body),
    },
  });
  return NextResponse.json(row, { status: 201 });
});
