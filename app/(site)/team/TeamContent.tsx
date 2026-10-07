'use client';

import { Team } from '@/components/pages/Team';
import { useNavigate } from '@/lib/useNavigate';

/**
 * Клиентская часть страницы «Состав»: компоненту нужен onNavigate, а хук
 * useNavigate доступен только в клиентском компоненте. Сам page.tsx остаётся
 * серверным — иначе из него нельзя экспортировать метаданные.
 */
export function TeamContent() {
  const navigate = useNavigate();
  return <Team onNavigate={navigate} />;
}
