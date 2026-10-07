'use client';
import { useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { api, type Player } from '@/lib/api';

interface TeamProps {
  onNavigate: (page: string) => void;
}

interface SectionTitle {
  title: string;
  subtitle?: string;
}

const DEFAULT_TITLE: SectionTitle = {
  title: 'Наш состав',
  subtitle: 'Игроки хоккейной команды «Святогор»',
};

/**
 * Публичный раздел «Состав»: карточки игроков (фото, номер, имя, амплуа, резюме).
 * Данные приходят из /api/team; заголовок раздела редактируется в админке
 * (вкладка «Заголовки», страница team). Сетка адаптивная: 1 колонка на телефоне,
 * 2 на планшете, 3 на широких экранах.
 */
export function Team({ onNavigate }: TeamProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sectionTitle, setSectionTitle] = useState<SectionTitle>(DEFAULT_TITLE);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const [list, title] = await Promise.all([
          api.team.list(controller.signal),
          api.sectionTitles.get('team', 'main'),
        ]);
        if (controller.signal.aborted) return;
        setPlayers(list);
        if (title) setSectionTitle({ title: title.title, subtitle: title.subtitle ?? undefined });
        setError('');
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error && err.message ? err.message : 'Не удалось загрузить состав команды',
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, []);

  return (
    <div className="flex-1 animate-fadeIn">
      <section className="bg-white py-20">
        <div className="container mx-auto px-4 text-center animate-slideInUp">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-full mb-4">
            <span className="text-sm font-medium text-orange-500">🏒 Хоккейная команда</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-3">
            {sectionTitle.title}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">{sectionTitle.subtitle}</p>
        </div>
      </section>

      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-20 text-gray-500">
              <Loader2 size={22} className="animate-spin" />
              <span className="text-lg">Загрузка состава...</span>
            </div>
          )}

          {!loading && error && (
            <div className="max-w-xl mx-auto text-center py-16">
              <p className="text-lg text-red-600 mb-2">Не удалось показать состав</p>
              <p className="text-gray-600">{error}</p>
            </div>
          )}

          {!loading && !error && players.length === 0 && (
            <div className="text-center py-20">
              <Users size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-2xl text-gray-600 font-medium">Состав пока не опубликован</p>
            </div>
          )}

          {!loading && !error && players.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {players.map((player, index) => (
                <article
                  key={player.id}
                  className="group bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-2 transition-all duration-300 animate-fadeInUp"
                  style={{ animationDelay: `${index * 0.08}s` }}
                >
                  <div className="relative h-72 overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900">
                    {player.photo_url ? (
                      <img
                        src={player.photo_url}
                        alt={player.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users size={72} className="text-gray-600" />
                      </div>
                    )}
                    {player.number !== null && (
                      <div className="absolute bottom-0 left-0 bg-orange-500 text-white font-black text-2xl px-5 py-2 rounded-tr-2xl">
                        #{player.number}
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{player.name}</h3>
                    {player.position && (
                      <span className="inline-block mb-3 px-3 py-1 bg-orange-100 text-orange-600 text-xs font-bold rounded-full uppercase tracking-wide">
                        {player.position}
                      </span>
                    )}
                    {player.bio && (
                      <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                        {player.bio}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-lg p-8 md:p-12 text-white text-center">
            <h2 className="text-3xl font-bold mb-4">Хотите играть с нами?</h2>
            <p className="text-xl text-gray-300 mb-6">
              Мы всегда рады новым игрокам, которые разделяют нашу любовь к хоккею
            </p>
            <button
              onClick={() => onNavigate('contacts')}
              className="px-8 py-3 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 transition-all"
            >
              Связаться с нами
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
