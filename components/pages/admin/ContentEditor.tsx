'use client';
import { useEffect, useState } from 'react';
import { Save, PlusCircle } from 'lucide-react';
import { api } from '@/lib/api';
import {
  DEFAULT_STATS,
  STATS_ITEMS_KEY,
  STATS_PAGE,
  STATS_SECTION,
  parseStats,
  statsDraft,
  type StatItem,
} from '@/lib/stats';

interface ContentSection {
  page: string;
  section: string;
  content: Record<string, unknown>;
}

/** Поля карточки статистики, доступные для редактирования. */
const STAT_FIELDS: { key: keyof StatItem; label: string }[] = [
  { key: 'value', label: 'Значение' },
  { key: 'label', label: 'Подпись' },
];

/** Названия карточек статистики в порядке метрик. */
const STAT_CARD_TITLES = ['Карточка 1', 'Карточка 2', 'Карточка 3', 'Карточка 4'];

/** Статистика хранится в отдельной записи site_content. */
function isStatsSection(section: { page: string; section: string }): boolean {
  return section.page === STATS_PAGE && section.section === STATS_SECTION;
}

/** Показывает значение из JSON: объекты и массивы не рендерим как React-ребёнка. */
function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function ContentEditor() {
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [editingSection, setEditingSection] = useState<ContentSection | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    const data = await api.content.list();
    setSections(data);
    setLoaded(true);
  };

  const hasStatsSection = sections.some(isStatsSection);

  /** Создаёт запись статистики, если её ещё нет в БД (аналог инициализации заголовков). */
  const initializeStats = async () => {
    setInitializing(true);
    setMessage('');

    try {
      await api.content.create({
        page: STATS_PAGE,
        section: STATS_SECTION,
        content: { [STATS_ITEMS_KEY]: DEFAULT_STATS },
      });

      setMessage('Статистика успешно инициализирована');
      await loadContent();
    } catch (error) {
      console.error('Error initializing stats:', error);
      setMessage('Ошибка при создании записи статистики');
    } finally {
      setInitializing(false);
    }
  };

  const handleEdit = (section: ContentSection) => {
    setEditingSection({ ...section });
  };

  const handleSave = async () => {
    if (!editingSection) return;

    setLoading(true);
    setMessage('');

    try {
      await api.content.update(editingSection.page, editingSection.section, editingSection.content);

      setMessage('Контент успешно сохранен');
      loadContent();
      setEditingSection(null);
    } catch {
      setMessage('Ошибка при сохранении');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (key: string, value: string) => {
    if (!editingSection) return;
    setEditingSection({
      ...editingSection,
      content: {
        ...editingSection.content,
        [key]: value,
      },
    });
  };

  /**
   * Обновляет одно поле (значение или подпись) конкретной карточки статистики.
   *
   * Массив берём из statsDraft, а не из parseStats: parseStats подставляет
   * значения по умолчанию вместо пустых полей, поэтому он и стирал ввод, и
   * возвращал стёртое значение обратно при сохранении. Значение кладём строкой
   * как есть — пустая строка допустима.
   */
  const updateStatItem = (index: number, key: keyof StatItem, value: string) => {
    if (!editingSection) return;
    const items = statsDraft(editingSection.content);
    setEditingSection({
      ...editingSection,
      content: {
        ...editingSection.content,
        [STATS_ITEMS_KEY]: items.map((item, itemIndex) =>
          itemIndex === index ? { ...item, [key]: value } : item,
        ),
      },
    });
  };

  const getPageName = (page: string) => {
    const names: Record<string, string> = {
      home: 'Главная',
      about: 'О нас',
      contacts: 'Контакты',
      [STATS_PAGE]: 'Статистика',
    };
    return names[page] || page;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Редактор контента</h2>
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

      {loaded && !hasStatsSection && (
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-dashed border-orange-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Статистика</h3>
              <p className="text-sm text-gray-500">
                Запись ещё не создана в базе данных — на главной странице показываются значения
                по умолчанию.
              </p>
            </div>
            <button
              onClick={initializeStats}
              disabled={initializing}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400"
            >
              <PlusCircle size={20} />
              <span>{initializing ? 'Создание...' : 'Создать запись'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {sections.map((section) => (
          <div key={`${section.page}-${section.section}`} className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{getPageName(section.page)}</h3>
                <p className="text-sm text-gray-500">Раздел: {section.section}</p>
              </div>
              <button
                onClick={() => handleEdit(section)}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                Редактировать
              </button>
            </div>

            {editingSection?.page === section.page &&
            editingSection?.section === section.section ? (
              <div className="space-y-4 border-t pt-4">
                {isStatsSection(editingSection) ? (
                  <>
                    <p className="text-xs text-gray-500">
                      Поле можно оставить пустым. На сайте пустое значение подменяется значением по
                      умолчанию, чтобы блок статистики на главной не выглядел пустым.
                    </p>
                    {/* Карточки статистики — фиксированный список из 4 метрик без добавления и
                        перестановки, поэтому ключ по индексу стабилен: React не пересоздаёт
                        инпуты и не теряет фокус при вводе. */}
                    {statsDraft(editingSection.content).map((item, index) => (
                      <div
                        key={STAT_CARD_TITLES[index] ?? `stat-${index}`}
                        className="border border-gray-100 rounded-lg p-4 grid sm:grid-cols-2 gap-4"
                      >
                        <p className="sm:col-span-2 text-sm font-semibold text-gray-500">
                          {STAT_CARD_TITLES[index] ?? `Карточка ${index + 1}`}
                        </p>
                        {STAT_FIELDS.map((field) => (
                          <div key={field.key}>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {field.label}
                            </label>
                            {/* Значение — строка как есть: пустое остаётся пустым, поэтому
                                Backspace стирает символ за символом, а каретка не прыгает
                                (React возвращал бы в input подставленное значение из parseStats). */}
                            <input
                              type="text"
                              value={item[field.key]}
                              onChange={(e) => updateStatItem(index, field.key, e.target.value)}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                  </>
                ) : (
                  Object.entries(editingSection.content).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                        {key}
                      </label>
                      {typeof value === 'string' && value.length > 100 ? (
                        <textarea
                          value={value}
                          onChange={(e) => updateField(key, e.target.value)}
                          rows={4}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      ) : (
                        // В JSON значение может быть не строкой (число, boolean) — приводим
                        // к строке через displayValue, чтобы input остался контролируемым
                        // и React не сбрасывал каретку. На любом вводе в content пишется
                        // строка: редактирование всегда идёт строкой, без Number().
                        <input
                          type="text"
                          value={displayValue(value)}
                          onChange={(e) => updateField(key, e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      )}
                    </div>
                  ))
                )}
                <div className="flex space-x-3">
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
                  >
                    <Save size={20} />
                    <span>{loading ? 'Сохранение...' : 'Сохранить'}</span>
                  </button>
                  <button
                    onClick={() => setEditingSection(null)}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-600 space-y-2">
                {isStatsSection(section)
                  ? // Предпросмотр показывает то же, что увидит посетитель: parseStats
                    // подставляет значения по умолчанию вместо пустых полей.
                    parseStats(section.content).map((item, index) => (
                      <div key={STAT_CARD_TITLES[index] ?? `stat-${index}`}>
                        <span className="font-medium">{item.label}:</span>{' '}
                        <span className="line-clamp-2">{item.value}</span>
                      </div>
                    ))
                  : Object.entries(section.content).map(([key, value]) => (
                      <div key={key}>
                        <span className="font-medium capitalize">{key}:</span>{' '}
                        <span className="line-clamp-2">{displayValue(value)}</span>
                      </div>
                    ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
