'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLogin } from '@/components/pages/admin/AdminLogin';
import { AdminDashboard } from '@/components/pages/admin/AdminDashboard';

/**
 * Раньше админка рисовалась в App.tsx при currentPage === 'admin':
 * пока сессия проверяется — «Загрузка...», дальше форма входа или дашборд.
 */
export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    return <AdminLogin />;
  }

  return <AdminDashboard onNavigateHome={() => router.push('/')} />;
}
