'use client';

import { Home } from '@/components/pages/Home';
import { useNavigate } from '@/lib/useNavigate';

export default function HomePage() {
  const navigate = useNavigate();
  return <Home onNavigate={navigate} />;
}
