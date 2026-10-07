'use client';

import { type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

/**
 * Общая оболочка публичных страниц: Header + контент + Footer.
 * Раньше это рисовал App.tsx при currentPage !== 'admin'.
 *
 * Вокруг {children} намеренно нет <Suspense>: с ним оболочка (включая
 * фолбэк «Загрузка...») уходила в ответ раньше страницы, и notFound() —
 * например, для несуществующей статьи блога — отдавал «мягкий 404»: страницу
 * 404 с кодом ответа 200, что путает поисковики. Граница Suspense нужна только
 * страницам с useSearchParams, таких в проекте нет.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // '/about' -> 'about', '/' -> 'home' (как currentPage в старом SPA).
  const currentPage = pathname === '/' ? 'home' : pathname.replace(/^\//, '').split('/')[0];

  /**
   * Переход по меню. Статья блога открывается по постоянному адресу
   * `/blog/<id>` (раньше — query-параметр `?post=`), остальные страницы — по
   * своему пути.
   */
  const handleNavigate = (page: string, postId?: string) => {
    if (postId) {
      router.push(`/blog/${encodeURIComponent(postId)}`);
      return;
    }
    router.push(page === 'home' ? '/' : `/${page}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header currentPage={currentPage} onNavigate={handleNavigate} />
      {children}
      <Footer onNavigate={handleNavigate} />
    </div>
  );
}
