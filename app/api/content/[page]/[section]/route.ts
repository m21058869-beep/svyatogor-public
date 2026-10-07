import { NextResponse } from 'next/server';
import type { Prisma } from '@/server/generated/prisma/client';
import { apiRoute } from '@/server/api';
import { requireAdmin } from '@/server/auth';
import { prisma } from '@/server/db';
import { asObject, badRequest, jsonBody, notFound } from '@/server/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { page: string; section: string };

function contentField(body: Record<string, unknown>): Prisma.InputJsonObject {
  const content = body.content;
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    badRequest('Поле "content" должно быть JSON-объектом');
  }
  return content as Prisma.InputJsonObject;
}

export const GET = apiRoute<Params>(async (_request, { params }) => {
  const row = await prisma.siteContent.findUnique({
    where: { page_section: { page: params.page, section: params.section } },
  });
  if (!row) notFound();
  return NextResponse.json(row);
});

export const PUT = apiRoute<Params>(async (request, { params }) => {
  await requireAdmin(request);
  const body = asObject(await jsonBody(request));
  const row = await prisma.siteContent.update({
    where: { page_section: { page: params.page, section: params.section } },
    data: { content: contentField(body) },
  });
  return NextResponse.json(row);
});

export const DELETE = apiRoute<Params>(async (request, { params }) => {
  await requireAdmin(request);
  await prisma.siteContent.delete({
    where: { page_section: { page: params.page, section: params.section } },
  });
  return new NextResponse(null, { status: 204 });
});
