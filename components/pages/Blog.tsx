'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { api, type BlogPost } from '@/lib/api';

interface SectionTitle {
  title: string;
  subtitle?: string;
}

/**
 * Список опубликованных статей. Карточка — настоящая ссылка `/blog/<id>`:
 * поисковик видит адрес статьи в HTML (раньше пост открывался на этой же
 * странице скриптом через query-параметр `?post=`). Сама статья рендерится на
 * сервере — см. app/(site)/blog/[id]/page.tsx.
 */
export function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [sectionTitle, setSectionTitle] = useState<SectionTitle>({
    title: 'Статьи и советы',
    subtitle: 'Экспертные статьи, советы и инсайты от команды "Святогор"'
  });

  useEffect(() => {
    loadPosts();
    loadSectionTitle();
  }, []);

  const loadPosts = async () => {
    const data = await api.blog.list({ published: true });
    setPosts(data);
  };

  const loadSectionTitle = async () => {
    const data = await api.sectionTitles.get('blog', 'main');
    if (data) setSectionTitle({ title: data.title, subtitle: data.subtitle ?? undefined });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="flex-1 animate-fadeIn">
      <section className="bg-white py-20">
        <div className="container mx-auto px-4 text-center animate-slideInUp">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-full mb-4">
            <span className="text-sm font-medium text-orange-500">📰 Хоккейный блог</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-3">
            {sectionTitle.title}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-12">
            {sectionTitle.subtitle}
          </p>
        </div>
      </section>

      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          {posts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-2xl text-gray-600 font-medium">Пока нет опубликованных записей</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {posts.map((post, index) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.id}`}
                  className="group block bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-2 transition-all duration-300 animate-fadeInUp"
                  style={{animationDelay: `${index * 0.1}s`}}
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
                        {index % 3 === 0 ? 'Тактика 🏒' : index % 3 === 1 ? 'Психология' : 'Экипировка'}
                      </span>
                      <span className="text-xs text-gray-500">
                        <Calendar size={14} className="inline mr-1" />
                        {formatDate(post.created_at)}
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
          )}
        </div>
      </section>
    </div>
  );
}
