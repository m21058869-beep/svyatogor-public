import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';

import { Blog } from '@/components/pages/Blog';

export const metadata: Metadata = {
  title: 'Блог',
  description:
    'Блог ХК «Святогор»: новости команды, обзоры матчей и заметки о любительском хоккее в Зеленограде.',
};

interface BlogPageProps {
  /** Ссылки старого формата на статью: `/blog?post=<id>`. */
  searchParams?: { post?: string };
}

/**
 * Список статей. Сама статья открывается по постоянному адресу `/blog/<id>`
 * (см. `app/(site)/blog/[id]/page.tsx`), а ссылки старого формата
 * `/blog?post=<id>` приводим к нему постоянным редиректом: накопленный вес
 * переходит на новый адрес, и старые ссылки не отдают 404.
 */
export default function BlogPage({ searchParams }: BlogPageProps) {
  const postId = searchParams?.post;
  if (postId) permanentRedirect(`/blog/${encodeURIComponent(postId)}`);
  return <Blog />;
}


