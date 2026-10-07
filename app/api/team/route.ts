import { apiRoute, jsonNoStore } from '@/server/api';
import { requireAdmin } from '@/server/auth';
import { prisma } from '@/server/db';
import { asObject, jsonBody, optionalInt, optionalString, requiredString } from '@/server/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/team — весь состав в порядке, заданном полем sort_order.
export const GET = apiRoute(async () => {
  const rows = await prisma.player.findMany({
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  });
  return jsonNoStore(rows);
});

export const POST = apiRoute(async (request) => {
  await requireAdmin(request);
  const body = asObject(await jsonBody(request));
  const row = await prisma.player.create({
    data: {
      name: requiredString(body, 'name'),
      number: optionalInt(body, 'number') ?? null,
      position: optionalString(body, 'position') ?? '',
      bio: optionalString(body, 'bio') ?? '',
      photo_url: optionalString(body, 'photo_url') || null,
      sort_order: optionalInt(body, 'sort_order') ?? 0,
    },
  });
  return jsonNoStore(row, 201);
});
