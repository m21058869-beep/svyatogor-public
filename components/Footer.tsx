'use client';
import { memo } from 'react';

interface FooterProps {
  onNavigate?: (page: string) => void;
}

export const Footer = memo(function Footer({ onNavigate }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <div className="flex items-center space-x-3 mb-6">
              <img
                src="/image_2025-10-07_19-50-30.png"
                alt="Святогор"
                className="h-16 w-16 object-contain brightness-0 invert"
              />
              <div>
                <h3 className="text-2xl font-black">Святогор</h3>
                <p className="text-sm text-gray-400 font-medium">Хоккейная команда</p>
              </div>
            </div>
            <p className="text-gray-300 text-base leading-relaxed">
              Любительская хоккейная команда из Москвы
            </p>
          </div>

          <div>
            <h4 className="font-black text-lg mb-6 text-orange-400">Навигация</h4>
            <ul className="space-y-3 text-base">
              <li
                onClick={() => onNavigate?.('about')}
                className="text-gray-300 hover:text-orange-400 transition-colors cursor-pointer"
              >
                О команде
              </li>
              <li
                onClick={() => onNavigate?.('team')}
                className="text-gray-300 hover:text-orange-400 transition-colors cursor-pointer"
              >
                Состав
              </li>
              <li
                onClick={() => onNavigate?.('blog')}
                className="text-gray-300 hover:text-orange-400 transition-colors cursor-pointer"
              >
                Блог
              </li>
              <li
                onClick={() => onNavigate?.('gallery')}
                className="text-gray-300 hover:text-orange-400 transition-colors cursor-pointer"
              >
                Фотогалерея
              </li>
              <li
                onClick={() => onNavigate?.('contacts')}
                className="text-gray-300 hover:text-orange-400 transition-colors cursor-pointer"
              >
                Контакты
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-black text-lg mb-6 text-orange-400">Контакты</h4>
            <ul className="space-y-3 text-base text-gray-300">
              <li>Москва, Зеленоград</li>
              <li>
                <a
                  href="mailto:info@hksvyatogor.ru"
                  className="hover:text-orange-400 transition-colors"
                >
                  info@hksvyatogor.ru
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-12 pt-8 text-center">
          <p className="text-gray-400 font-medium">&copy; {currentYear} Святогор. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
});
