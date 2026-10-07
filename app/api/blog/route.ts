import { apiRoute, jsonNoStore } from '@/server/api';
import { getSessionUser, requireAdmin } from '@/server/auth';
import { prisma } from '@/server/db';
import { asObject, jsonBody, limitQuery, optionalBoolean, optionalString, requiredString } from '@/server/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/blog?published=true&limit=3
// Анонимные пользователи видят только опубликованные посты (как RLS-политика в Supabase).
export const GET = apiRoute(async (request) => {
  const user = await getSessionUser(request);
  const onlyPublished = !user || new URL(request.url).searchParams.get('published') === 'true';
  const rows = await prisma.blogPost.findMany({
    where: onlyPublished ? { published: true } : undefined,
    orderBy: { created_at: 'desc' },
    take: limitQuery(request),
  });
  return jsonNoStore(rows);
});

export const POST = apiRoute(async (request) => {
  const user = await requireAdmin(request);
  const body = asObject(await jsonBody(request));
  const row = await prisma.blogPost.create({
    data: {
      title: requiredString(body, 'title'),
      slug: requiredString(body, 'slug'),
      excerpt: optionalString(body, 'excerpt') ?? '',
      content: requiredString(body, 'content'),
      cover_image: optionalString(body, 'cover_image') || null,
      published: optionalBoolean(body, 'published') ?? false,
      author_id: user.id,
    },
  });
  return jsonNoStore(row, 201);
});
