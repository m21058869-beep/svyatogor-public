import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Calendar, User } from 'lucide-react';
import { marked } from 'marked';

import { CLUB_LOGO, SITE_NAME, absoluteUrl, toDescription } from '@/lib/seo';
import { prisma } from '@/server/db';
import { isUuid } from '@/server/validate';

export const runtime = 'nodejs';
/**
 * Статью читаем из базы на каждый запрос (не на сборке): правка в админке
 * видна сразу, без пересборки. Так же устроена карта сайта (app/sitemap.ts).
 */
export const dynamic = 'force-dynamic';

type Props = { params: { id: string } };

/**
 * Статья по постоянному адресу `/blog/<id>`.
 *
 * Ключ — id поста: slug в базе кириллический («расписание-») и без кодирования
 * в URL не годится. Для старых ссылок принимаем и slug — как это делает
 * `/api/blog/:idOrSlug`.
 *
 * `cache()` из React убирает дублирование запроса: generateMetadata и сама
 * страница обращаются к базе один раз на запрос.
 */
const getPost = cache(async (idOrSlug: string) => {
  const key = decodeURIComponent(idOrSlug);
  const post = await prisma.blogPost.findUnique({
    where: isUuid(key) ? { id: key } : { slug: key },
  });
  // Черновики видны только в админке: в открытом виде отдаём 404.
  return post?.published ? post : null;
});

/** Дата в формате «7 октября 2026 г.» — как в списке статей. */
function formatDate(date: Date | null): string {
  return (date ?? new Date()).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Markdown → HTML. `async: false` — разбор синхронный, поэтому результат строка. */
function renderMarkdown(markdown: string): string {
  return marked.parse(markdown, { async: false });
}

/**
 * Метаданные конкретной статьи: свой заголовок (в шаблонный «… | ХК «Святогор»»),
 * описание из анонса (или из первых строк текста) и своя картинка превью.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.id);

  if (!post) {
    return { title: 'Статья не найдена', robots: { index: false, follow: false } };
  }

  const description = post.excerpt?.trim() || toDescription(post.content);
  const cover = post.cover_image || null;

  return {
    title: post.title,
    description,
    // Постоянный адрес без query-параметров — его и склеивают поисковики.
    alternates: { canonical: `/blog/${post.id}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description,
      url: `/blog/${post.id}`,
      publishedTime: post.created_at?.toISOString(),
      modifiedTime: post.updated_at?.toISOString(),
      // Обложка статьи, а без неё — квадратная эмблема клуба.
      images: cover
        ? [{ url: cover, alt: post.title }]
        : [
            {
              url: CLUB_LOGO.path,
              width: CLUB_LOGO.width,
              height: CLUB_LOGO.height,
              alt: CLUB_LOGO.alt,
            },
          ],
    },
    // Крупная карточка уместна только с настоящей обложкой — эмблема квадратная.
    twitter: { card: cover ? 'summary_large_image' : 'summary' },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const post = await getPost(params.id);
  if (!post) notFound();

  const description = post.excerpt?.trim() || toDescription(post.content);
  const imageUrl = post.cover_image || absoluteUrl(CLUB_LOGO.path);

  // Микроразметка статьи: поисковик показывает в выдаче дату и обложку.
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description,
    image: [imageUrl],
    inLanguage: 'ru-RU',
    datePublished: post.created_at?.toISOString(),
    dateModified: (post.updated_at ?? post.created_at)?.toISOString(),
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: absoluteUrl(CLUB_LOGO.path) },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(`/blog/${post.id}`) },
  };

  return (
    <div className="flex-1">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <section className="py-16">
        <div className="container mx-auto px-4">
          <Link
            href="/blog"
            className="inline-flex items-center text-orange-600 hover:text-orange-700 font-semibold mb-8 group"
          >
            <span className="mr-1 group-hover:-translate-x-1 transition-transform">←</span>
            Назад к новостям
          </Link>

          <article className="max-w-4xl mx-auto">
            {post.cover_image && (
              <img
                src={post.cover_image}
                alt={post.title}
                className="w-full h-96 object-cover rounded-xl shadow-lg mb-8"
              />
            )}

            <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">{post.title}</h1>

            <div className="flex items-center space-x-6 text-gray-600 mb-8 pb-8 border-b">
              <div className="flex items-center">
                <Calendar size={18} className="mr-2" />
                <span>{formatDate(post.created_at)}</span>
              </div>
              <div className="flex items-center">
                <User size={18} className="mr-2" />
                <span>{SITE_NAME}</span>
              </div>
            </div>

            {/* Текст статьи рендерится на сервере — поисковик видит готовый HTML. */}
            <div
              className="prose prose-lg max-w-none text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
            />
          </article>
        </div>
      </section>
    </div>
  );
}
