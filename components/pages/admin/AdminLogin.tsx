'use client';
import { useState } from 'react';
import { ArrowLeft, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitAttempts, setSubmitAttempts] = useState(0);
  const { signIn } = useAuth();

  // Публичная часть сайта — это SPA без роутера: «страница» хранится в sessionStorage
  // (см. App.tsx). Переход по href="/" перезагружает приложение, поэтому перед ним
  // сбрасываем сохранённое значение на главную — иначе reload вернул бы обратно в админку.
  const handleBackToSite = () => {
    sessionStorage.setItem('currentPage', 'home');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setSubmitAttempts(prev => prev + 1);

    console.log('Form submitted, attempt:', submitAttempts + 1);
    console.log('Email:', email);

    try {
      await signIn(email, password);
      console.log('Login successful');
    } catch (err: unknown) {
      console.error('Login error:', err);
      setError(err instanceof Error && err.message ? err.message : 'Неверный email или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
              <Lock className="text-orange-600" size={32} />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">
            Админ-панель
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Войдите для управления сайтом
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                placeholder="admin@svyatogor.ru"
                autoComplete="email"
                inputMode="email"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Пароль
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed touch-manipulation text-lg"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>

            {submitAttempts > 0 && (
              <p className="text-xs text-gray-500 text-center mt-2">
                Попыток входа: {submitAttempts}
              </p>
            )}
          </form>

          <a
            href="/"
            onClick={handleBackToSite}
            className="mt-6 w-full inline-flex items-center justify-center space-x-2 py-3 text-sm font-medium text-gray-600 rounded-lg hover:text-orange-600 hover:bg-orange-50 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Вернуться на сайт</span>
          </a>
        </div>
      </div>
    </div>
  );
}
