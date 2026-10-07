import { NextResponse } from 'next/server';
import { apiRoute } from '@/server/api';
import { requireAdmin } from '@/server/auth';
import { prisma } from '@/server/db';
import { asObject, badRequest, jsonBody, optionalString, requiredString } from '@/server/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseTitle(value: unknown) {
  const body = asObject(value);
  return {
    page: requiredString(body, 'page'),
    section: requiredString(body, 'section'),
    title: requiredString(body, 'title'),
    subtitle: optionalString(body, 'subtitle') ?? null,
  };
}

// GET /api/section-titles?page=blog
export const GET = apiRoute(async (request) => {
  const page = new URL(request.url).searchParams.get('page');
  const rows = await prisma.sectionTitle.findMany({
    where: page ? { page } : undefined,
    orderBy: [{ page: 'asc' }, { section: 'asc' }],
  });
  return NextResponse.json(rows);
});

// Принимает один объект или массив; уже существующие пары page+section пропускаются.
export const POST = apiRoute(async (request) => {
  await requireAdmin(request);
  const body = await jsonBody(request);
  if (Array.isArray(body)) {
    if (body.length === 0) badRequest('Пустой массив');
    const result = await prisma.sectionTitle.createMany({ data: body.map(parseTitle), skipDuplicates: true });
    return NextResponse.json({ count: result.count }, { status: 201 });
  }
  const row = await prisma.sectionTitle.create({ data: parseTitle(body) });
  return NextResponse.json(row, { status: 201 });
});
