'use client';

import { About } from '@/components/pages/About';
import { useNavigate } from '@/lib/useNavigate';

/**
 * Клиентская часть страницы «О нас»: компоненту нужен onNavigate, а хук
 * useNavigate доступен только в клиентском компоненте. Сам page.tsx остаётся
 * серверным — иначе из него нельзя экспортировать метаданные.
 */
export function AboutContent() {
  const navigate = useNavigate();
  return <About onNavigate={navigate} />;
}
