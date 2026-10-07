'use client';

import { useRouter } from 'next/navigation';

/**
 * Замена SPA-навигации из App.tsx (страница хранилась в useState/sessionStorage)
 * на маршрутизацию Next.js. Второй аргумент передаёт статью блога — она
 * открывается по постоянному адресу `/blog/<id>` (раньше — `?post=<id>`).
 */
export function useNavigate() {
  const router = useRouter();
  return (page: string, postId?: string) => {
    if (postId) {
      router.push(`/blog/${encodeURIComponent(postId)}`);
      return;
    }
    router.push(page === 'home' ? '/' : `/${page}`);
  };
}
