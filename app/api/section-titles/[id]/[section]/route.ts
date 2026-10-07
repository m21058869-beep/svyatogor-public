import { NextResponse } from 'next/server';
import { apiRoute } from '@/server/api';
import { prisma } from '@/server/db';
import { notFound } from '@/server/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Первый сегмент назван [id], чтобы имя динамического сегмента совпадало с
// уровнем выше (Next требует единое имя slug на одном уровне). Здесь это page.
type Params = { id: string; section: string };

// GET /api/section-titles/:page/:section
export const GET = apiRoute<Params>(async (_request, { params }) => {
  const row = await prisma.sectionTitle.findUnique({
    where: { page_section: { page: params.id, section: params.section } },
  });
  if (!row) notFound();
  return NextResponse.json(row);
});
