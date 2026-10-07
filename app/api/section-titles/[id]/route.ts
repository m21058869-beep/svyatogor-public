import { NextResponse } from 'next/server';
import { apiRoute } from '@/server/api';
import { requireAdmin } from '@/server/auth';
import { prisma } from '@/server/db';
import { asObject, badRequest, jsonBody, optionalString, uuidParam } from '@/server/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

export const PUT = apiRoute<Params>(async (request, { params }) => {
  await requireAdmin(request);
  const id = uuidParam(params);
  const body = asObject(await jsonBody(request));
  const title = optionalString(body, 'title');
  if (title !== undefined && !title?.trim()) badRequest('Поле "title" обязательно');
  const row = await prisma.sectionTitle.update({
    where: { id },
    data: {
      ...(title != null && { title }),
      ...(body.subtitle !== undefined && { subtitle: optionalString(body, 'subtitle') ?? null }),
    },
  });
  return NextResponse.json(row);
});

export const DELETE = apiRoute<Params>(async (request, { params }) => {
  await requireAdmin(request);
  await prisma.sectionTitle.delete({ where: { id: uuidParam(params) } });
  return new NextResponse(null, { status: 204 });
});
