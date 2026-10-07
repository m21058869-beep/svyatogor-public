'use client';
import { useEffect, useState } from 'react';
import { Target, Heart, Award } from 'lucide-react';
import { api, contentText, type SiteContent } from '@/lib/api';

interface AboutProps {
  onNavigate: (page: string) => void;
}

interface SectionTitle {
  title: string;
  subtitle?: string;
}

export function About({ onNavigate }: AboutProps) {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [sectionTitle, setSectionTitle] = useState<SectionTitle>({
    title: 'О нашей команде',
    subtitle: 'История, ценности и достижения команды Святогор'
  });

  useEffect(() => {
    loadContent();
    loadSectionTitle();
  }, []);

  const loadContent = async () => {
    const data = await api.content.get('about', 'main');
    if (data) setContent(data);
  };

  const loadSectionTitle = async () => {
    const data = await api.sectionTitles.get('about', 'main');
    if (data) setSectionTitle({ title: data.title, subtitle: data.subtitle ?? undefined });
  };

  return (
    <div className="flex-1 animate-fadeIn">
      <section className="bg-white py-20">
        <div className="container mx-auto px-4 text-center animate-slideInUp">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-full mb-4">
            <span className="text-sm font-medium text-orange-500">⭐ История команды</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-3">
            {sectionTitle.title}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {sectionTitle.subtitle}
          </p>
        </div>
      </section>

      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-12 animate-fadeInUp" style={{animationDelay: '0.2s'}}>
              <h2 className="text-3xl font-bold mb-6 text-gray-900">Наша история</h2>
              <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed">
                <p className="mb-4">
                  {contentText(content?.content.content) ||
                    'Хоккейная команда Святогор была основана любителями хоккея, которые объединились общей страстью к этому виду спорта. Мы регулярно тренируемся и участвуем в любительских турнирах.'}
                </p>
                <p className="mb-4">
                  С момента основания команда прошла долгий путь развития. Мы начинали как
                  небольшая группа энтузиастов, а сегодня представляем собой сплоченный коллектив
                  игроков разного уровня подготовки, объединенных общей целью.
                </p>
                <p>
                  Наша команда активно участвует в любительских турнирах Москвы и Московской
                  области, регулярно показывая достойные результаты и завоевывая призовые места.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-12">
              <div className="text-center animate-fadeInUp" style={{animationDelay: '0.3s'}}>
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="text-orange-600" size={36} />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">Наша цель</h3>
                <p className="text-gray-600">
                  Развитие хоккея, спортивный рост и достижение высоких результатов
                </p>
              </div>

              <div className="text-center animate-fadeInUp" style={{animationDelay: '0.4s'}}>
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="text-orange-600" size={36} />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">Наши ценности</h3>
                <p className="text-gray-600">
                  Командный дух, взаимоподдержка, честная игра и уважение к соперникам
                </p>
              </div>

              <div className="text-center animate-fadeInUp" style={{animationDelay: '0.5s'}}>
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Award className="text-orange-600" size={36} />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">Достижения</h3>
                <p className="text-gray-600">
                  Множество побед в турнирах и постоянное совершенствование мастерства
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-lg p-8 md:p-12 text-white text-center animate-fadeInUp" style={{animationDelay: '0.6s'}}>
              <h2 className="text-3xl font-bold mb-4">Присоединяйтесь к нам!</h2>
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
        </div>
      </section>
    </div>
  );
}
