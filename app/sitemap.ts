import type { MetadataRoute } from 'next';
import { env } from '@/server/env';
import { prisma } from '@/server/db';

/**
 * Карта сайта: Next.js отдаёт её по адресу `/sitemap.xml`.
 *
 * Собирается на каждый запрос (не на сборке), поэтому опубликованный в админке
 * пост попадает в карту сразу — без пересборки приложения. Обращение к базе
 * обёрнуто в try/catch: если она недоступна, поисковик всё равно получит
 * валидную карту со статическими страницами, а не ошибку 500.
 */
export const dynamic = 'force-dynamic';

type SitemapEntry = MetadataRoute.Sitemap[number];

/** Публичные страницы — тот же набор, что в меню сайта (components/Header.tsx). */
const PAGES: Array<{ path: string; changeFrequency: SitemapEntry['changeFrequency']; priority: number }> = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/team', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/blog', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/gallery', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/contacts', changeFrequency: 'yearly', priority: 0.5 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = PAGES.map((page) => ({
    url: `${env.siteUrl}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  return [...pages, ...(await publishedPosts())];
}

/**
 * Опубликованные посты блога — по постоянному адресу `/blog/<id>`
 * (страница: app/(site)/blog/[id]/page.tsx).
 */
async function publishedPosts(): Promise<MetadataRoute.Sitemap> {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { published: true },
      select: { id: true, created_at: true, updated_at: true },
      orderBy: { created_at: 'desc' },
    });

    return posts.map((post) => ({
      url: `${env.siteUrl}/blog/${post.id}`,
      lastModified: post.updated_at ?? post.created_at ?? new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    }));
  } catch (error) {
    console.error('[sitemap] не удалось прочитать посты блога:', error);
    return [];
  }
}
