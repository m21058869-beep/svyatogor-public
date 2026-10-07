'use client';
import { Menu, X } from 'lucide-react';
import { useState, memo } from 'react';

interface HeaderProps {
  currentPage: string;
  onNavigate: (page: string, postId?: string) => void;
}

export const Header = memo(function Header({ currentPage, onNavigate }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'Главная' },
    { id: 'about', label: 'О нас' },
    { id: 'team', label: 'Состав' },
    { id: 'blog', label: 'Блог' },
    { id: 'gallery', label: 'Фотогалерея' },
    { id: 'contacts', label: 'Контакты' },
  ];

  return (
    <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-gray-200 animate-slideInUp">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          <div
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => onNavigate('home')}
          >
            <img
              src="/image_2025-10-07_19-50-30 copy.png"
              alt="Святогор"
              className="h-14 w-14 object-contain transition-transform group-hover:scale-110 group-hover:rotate-12 duration-300"
              loading="eager"
            />
            <div>
              <h1 className="text-2xl font-black text-orange-500 group-hover:text-orange-600 transition-colors">СВЯТОГОР</h1>
              <p className="text-xs text-gray-600 font-normal uppercase tracking-wide">ХОККЕЙНАЯ КОМАНДА</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`px-4 py-2 text-sm font-medium transition-all ${
                  currentPage === item.id
                    ? 'text-orange-500'
                    : 'text-gray-700 hover:text-orange-500'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => onNavigate('admin')}
              className="ml-4 px-6 py-2.5 text-sm font-bold text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-all"
            >
              Админ
            </button>
          </nav>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-700 hover:bg-orange-50 rounded-lg transition-colors"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`block w-full text-left px-4 py-3 text-sm font-medium ${
                  currentPage === item.id
                    ? 'text-orange-500 bg-orange-50'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => {
                onNavigate('admin');
                setMobileMenuOpen(false);
              }}
              className="block w-full text-left px-4 py-3 text-sm font-medium text-orange-500"
            >
              Админ
            </button>
          </nav>
        )}
      </div>
    </header>
  );
});
