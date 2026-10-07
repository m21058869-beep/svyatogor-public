'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Trophy, Users, Calendar, Zap, ChevronRight, ChevronLeft } from 'lucide-react';
import { api, type BlogPost, type GalleryPhoto } from '@/lib/api';
import {
  DEFAULT_STATS,
  STATS_PAGE,
  STATS_SECTION,
  parseStats,
  type StatItem,
} from '@/lib/stats';

interface HomeProps {
  onNavigate: (page: string, postId?: string) => void;
}

/** Иконки карточек статистики — по порядку метрик из site_content. */
const STAT_ICONS = [Users, Calendar, Trophy, Zap];

export function Home({ onNavigate }: HomeProps) {
  const [recentPosts, setRecentPosts] = useState<BlogPost[]>([]);
  const [recentPhotos, setRecentPhotos] = useState<GalleryPhoto[]>([]);
  const [stats, setStats] = useState<StatItem[]>(DEFAULT_STATS);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRecentPosts();
    loadRecentPhotos();
    loadStats();
  }, []);

  const loadRecentPosts = async () => {
    try {
      const posts = await api.blog.list({ published: true, limit: 3 });
      setRecentPosts(posts);
    } catch (err) {
      console.error('Failed to load blog posts:', err);
    }
  };

  const loadRecentPhotos = async () => {
    try {
      const photos = await api.gallery.list({ limit: 8 });
      setRecentPhotos(photos);
    } catch (err) {
      console.error('Failed to load gallery photos:', err);
    }
  };

  const loadStats = async () => {
    try {
      const data = await api.content.get(STATS_PAGE, STATS_SECTION);
      if (data) setStats(parseStats(data.content));
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const scrollPhotos = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current || recentPhotos.length === 0) return;

    const container = scrollContainerRef.current;
    const scrollAmount = 380;

    if (direction === 'right') {
      const maxScroll = container.scrollWidth - container.clientWidth;
      if (container.scrollLeft >= maxScroll - 10) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    } else {
      if (container.scrollLeft <= 10) {
        const maxScroll = container.scrollWidth - container.clientWidth;
        container.scrollTo({ left: maxScroll, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="flex-1 animate-fadeIn">
      <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 right-20 w-4 h-4 bg-orange-500 rounded-full"></div>
          <div className="absolute top-40 right-40 w-3 h-3 bg-blue-400 rounded-full"></div>
          <div className="absolute bottom-32 left-32 w-3 h-3 bg-pink-400 rounded-full"></div>
          <div className="absolute top-1/2 right-1/3 w-2 h-2 bg-orange-400 rounded-full"></div>
        </div>
        <div className="container mx-auto px-4 md:px-16 lg:px-24 py-20 md:py-32 relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="text-center md:text-left flex flex-col items-center md:items-start animate-slideInLeft">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-full mb-6">
                <span className="text-sm font-medium text-orange-400">🏒 Профессиональный подход • Любительская лига</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-black mb-1 leading-none tracking-tight">
                ХОККЕЙНАЯ
              </h1>
              <h1 className="text-5xl md:text-6xl font-black mb-1 leading-none tracking-tight">
                КОМАНДА
              </h1>
              <h1 className="text-5xl md:text-7xl font-black mb-6 leading-none tracking-tight text-orange-500">
                СВЯТОГОР
              </h1>
              <p className="text-lg mb-6 text-gray-300 max-w-xl">
                Объединяем страсть к хоккею с духом настоящего товарищества.
              </p>
              <p className="text-xl mb-10 text-orange-400 font-bold">
                Играем с душой, побеждаем с честью!
              </p>
              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                <button
                  onClick={() => onNavigate('about')}
                  className="px-8 py-4 bg-orange-500 text-white rounded-lg font-bold text-base hover:bg-orange-600 transition-all"
                >
                  О команде
                </button>
                <button
                  onClick={() => onNavigate('gallery')}
                  className="px-8 py-4 bg-transparent border-2 border-gray-600 text-white rounded-lg font-bold text-base hover:bg-gray-800 transition-all"
                >
                  Фотогалерея
                </button>
              </div>
            </div>
            <div className="flex justify-center md:justify-end animate-slideInRight">
              <div className="relative">
                <div className="absolute inset-0 bg-white/20 rounded-full blur-2xl"></div>
                <img
                  src="/image_2025-10-07_19-50-30 copy.png"
                  alt="Святогор"
                  className="relative w-72 h-72 md:w-[500px] md:h-[500px] object-contain filter drop-shadow-2xl"
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-100">
        <div className="container mx-auto px-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {stats.map((stat, index) => {
              const Icon = STAT_ICONS[index] ?? Users;
              return (
                <div
                  key={`${index}-${stat.label}`}
                  className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-2 transition-all duration-300 text-center animate-fadeInUp"
                  style={{animationDelay: '0.1s'}}
                >
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon className="text-orange-500" size={32} />
                  </div>
                  <h3 className="text-4xl font-black mb-2 text-orange-500">{stat.value}</h3>
                  <p className="text-sm text-gray-600 font-medium uppercase">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {recentPhotos.length === 0 && (
        <section className="py-20 bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="container mx-auto px-4">
            <div className="text-center">
              <p className="text-gray-600">Пока нет фотографий в галерее</p>
            </div>
          </div>
        </section>
      )}

      {recentPhotos.length > 0 && (
        <section className="py-20 bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12 animate-slideInUp">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-full mb-4">
                <span className="text-sm font-medium text-orange-500">📸 Фотогалерея</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-3">
                Актуальные <span className="text-orange-500">фотографии</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">
                Самые свежие моменты из жизни команды "Святогор"
              </p>
            </div>

            <div className="relative">
              <button
                onClick={() => scrollPhotos('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all hover:scale-110"
                aria-label="Прокрутить влево"
              >
                <ChevronLeft className="text-gray-900" size={24} />
              </button>

              <button
                onClick={() => scrollPhotos('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all hover:scale-110"
                aria-label="Прокрутить вправо"
              >
                <ChevronRight className="text-gray-900" size={24} />
              </button>

              <div
                ref={scrollContainerRef}
                className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 snap-x snap-mandatory scroll-smooth px-12"
              >
                {recentPhotos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="flex-shrink-0 snap-center group cursor-pointer animate-fadeInUp"
                    style={{
                      animationDelay: `${index * 0.1}s`,
                      width: index === Math.floor(recentPhotos.length / 2) ? '500px' : '350px',
                      transition: 'all 0.3s ease'
                    }}
                    onClick={() => onNavigate('gallery')}
                  >
                    <div className="relative overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300">
                      <img
                        src={photo.image_url}
                        alt={photo.title}
                        className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="absolute bottom-0 left-0 right-0 p-6">
                          <h3 className="text-white font-bold text-lg mb-1">{photo.title}</h3>
                          {photo.description && (
                            <p className="text-gray-200 text-sm line-clamp-2">{photo.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center mt-12">
              <button
                onClick={() => onNavigate('gallery')}
                className="px-8 py-3 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 transition-all"
              >
                Смотреть все фото
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="py-20 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-full mb-6">
              <img src="/64px-Telegram_logo.svg.png" alt="Telegram" className="w-6 h-6" />
              <span className="text-sm font-medium">Telegram Бот</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-6">
              Присоединяйтесь к нашему <span className="text-blue-300">Telegram боту!</span>
            </h2>
            <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
              Получайте мгновенные уведомления о матчах, тренировках и новостях команды.
              Будьте в курсе всех событий "Святогора"!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
              <div className="flex items-center gap-3 bg-white/10 px-6 py-3 rounded-lg">
                <span className="text-2xl">📅</span>
                <span className="text-sm">Расписание матчей</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 px-6 py-3 rounded-lg">
                <span className="text-2xl">📢</span>
                <span className="text-sm">Важные объявления</span>
              </div>
            </div>
            <a
              href="https://t.me/svyatogor_hockey_club_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-10 py-4 bg-white text-blue-600 rounded-full font-bold text-lg hover:bg-blue-50 transition-all hover:scale-105 shadow-lg"
            >
              <img src="/64px-Telegram_logo.svg.png" alt="Telegram" className="w-8 h-8" />
              Открыть Telegram бота
            </a>
          </div>
        </div>
      </section>

      {recentPosts.length === 0 && (
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center">
              <p className="text-gray-600">Пока нет опубликованных записей</p>
            </div>
          </div>
        </section>
      )}

      {recentPosts.length > 0 && (
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12 animate-slideInUp">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-full mb-4">
                <span className="text-sm font-medium text-orange-500">📰 Хоккейный блог</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-3">
                Статьи и <span className="text-orange-500">новости</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">
                Актуальные новости, статьи и события от команды "Святогор"
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {recentPosts.map((post, index) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.id}`}
                  className="group block bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-2 transition-all duration-300 animate-fadeInUp"
                  style={{animationDelay: `${0.5 + index * 0.1}s`}}
                >
                  {post.cover_image && (
                    <div className="relative overflow-hidden h-56">
                      <img
                        src={post.cover_image}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-3 py-1 bg-orange-100 text-orange-600 text-xs font-bold rounded-full">
                        {index === 0 ? 'Тактика 🏒' : index === 1 ? 'Психология' : 'Экипировка'}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-gray-900 line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-gray-600 mb-4 line-clamp-2 text-sm">{post.excerpt}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-orange-500 font-medium text-sm group-hover:text-orange-600">
                        Читать полностью →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-12">
              <button
                onClick={() => onNavigate('blog')}
                className="px-8 py-3 bg-white border-2 border-gray-900 text-gray-900 rounded-lg font-bold hover:bg-gray-900 hover:text-white transition-all"
              >
                Все статьи блога
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
