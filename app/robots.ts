import type { MetadataRoute } from 'next';
import { env } from '@/server/env';

/**
 * Правила для роботов: Next.js отдаёт этот файл по адресу `/robots.txt`.
 *
 * Индексировать разрешено весь сайт; закрыты только служебные адреса — API
 * (в ответах JSON нет полезного для поиска текста) и админ-панель.
 * `sitemap` и `host` обязаны быть абсолютными — поэтому берём домен из SITE_URL
 * (см. server/env.ts, .env.example).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin'],
    },
    sitemap: `${env.siteUrl}/sitemap.xml`,
    // Директива Host понимается Яндексом: подсказывает основной домен сайта.
    host: env.siteUrl,
  };
}
