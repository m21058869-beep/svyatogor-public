'use client';
import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '@/lib/api';

interface SectionTitle {
  id: string;
  page: string;
  section: string;
  title: string;
  subtitle?: string;
}

export function SectionTitlesEditor() {
  const [titles, setTitles] = useState<SectionTitle[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    loadTitles();
  }, []);

  const initializeDefaultTitles = async () => {
    setInitializing(true);
    setMessage('');

    try {
      const defaultTitles = [
        { page: 'home', section: 'hero', title: 'СВЯТОГОР', subtitle: 'Хоккейная команда Москвы' },
        { page: 'home', section: 'blog', title: 'Статьи и советы', subtitle: 'Экспертные статьи, советы и инсайты от команды "Святогор"' },
        { page: 'about', section: 'main', title: 'О нашей команде', subtitle: 'История, ценности и достижения команды Святогор' },
        { page: 'blog', section: 'main', title: 'Статьи и советы', subtitle: 'Экспертные статьи, советы и инсайты от команды "Святогор"' },
        { page: 'gallery', section: 'main', title: 'Лучшие моменты', subtitle: 'Откройте для себя захватывающие моменты из жизни команды "Святогор"' },
        { page: 'contacts', section: 'main', title: 'Свяжитесь с нами', subtitle: 'Оставьте свое сообщение или свяжитесь с нами любым удобным способом' },
      ];

      await api.sectionTitles.create(defaultTitles);

      setMessage('Заголовки успешно инициализированы');
      loadTitles();
    } catch (error: unknown) {
      console.error('Error initializing titles:', error);
      setMessage(`Ошибка инициализации: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`);
    } finally {
      setInitializing(false);
    }
  };

  const loadTitles = async () => {
    try {
      const data = await api.sectionTitles.list();

      if (data.length > 0) {
        setTitles(
          data.map((item) => ({
            id: item.id,
            page: item.page,
            section: item.section,
            title: item.title,
            subtitle: item.subtitle ?? undefined,
          })),
        );
      } else {
        setMessage('Нет данных. Возможно, нужно добавить заголовки вручную или применить миграцию.');
      }
    } catch (err: unknown) {
      console.error('Unexpected error:', err);
      setMessage(`Ошибка при загрузке заголовков: ${err instanceof Error ? err.message : 'неизвестная ошибка'}`);
    }
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
  };

  const handleSave = async (id: string) => {
    const titleToSave = titles.find(t => t.id === id);
    if (!titleToSave) return;

    setLoading(true);
    setMessage('');

    try {
      await api.sectionTitles.update(id, {
        title: titleToSave.title,
        subtitle: titleToSave.subtitle ?? null,
      });

      setMessage('Заголовок успешно сохранен');
      setEditingId(null);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving title:', error);
      setMessage('Ошибка при сохранении заголовка');
    } finally {
      setLoading(false);
    }
  };

  const updateTitle = (id: string, field: 'title' | 'subtitle', value: string) => {
    setTitles(titles.map(t =>
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const getPageDisplayName = (page: string) => {
    const names: Record<string, string> = {
      home: 'Главная',
      about: 'О нас',
      blog: 'Блог',
      gallery: 'Фотогалерея',
      contacts: 'Контакты',
    };
    return names[page] || page;
  };

  const getSectionDisplayName = (section: string) => {
    const names: Record<string, string> = {
      hero: 'Главный баннер',
      blog: 'Блог',
      main: 'Заголовок',
    };
    return names[section] || section;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Редактор заголовков</h2>
        {titles.length === 0 && !message.includes('Ошибка') && (
          <button
            onClick={initializeDefaultTitles}
            disabled={initializing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            {initializing ? 'Инициализация...' : 'Инициализировать заголовки'}
          </button>
        )}
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-lg ${
            message.includes('успешно')
              ? 'bg-green-50 text-green-600'
              : 'bg-red-50 text-red-600'
          }`}
        >
          {message}
        </div>
      )}

      <div className="grid gap-6">
        {titles.map((item) => (
          <div key={item.id} className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{getPageDisplayName(item.page)}</h3>
                <p className="text-sm text-gray-500">{getSectionDisplayName(item.section)}</p>
              </div>
              {editingId !== item.id && (
                <button
                  onClick={() => handleEdit(item.id)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Редактировать
                </button>
              )}
            </div>

            {editingId === item.id ? (
              <div className="space-y-4 border-t pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Заголовок
                  </label>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateTitle(item.id, 'title', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                {item.subtitle !== undefined && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Подзаголовок
                    </label>
                    <textarea
                      value={item.subtitle}
                      onChange={(e) => updateTitle(item.id, 'subtitle', e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                )}
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleSave(item.id)}
                    disabled={loading}
                    className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
                  >
                    <Save size={20} />
                    <span>{loading ? 'Сохранение...' : 'Сохранить'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      loadTitles();
                    }}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-600 space-y-2 border-t pt-4">
                <div>
                  <span className="font-medium">Заголовок:</span>{' '}
                  <span>{item.title}</span>
                </div>
                {item.subtitle && (
                  <div>
                    <span className="font-medium">Подзаголовок:</span>{' '}
                    <span>{item.subtitle}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
