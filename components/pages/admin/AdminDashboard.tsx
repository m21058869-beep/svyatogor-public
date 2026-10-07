'use client';
import { useState } from 'react';
import { ArrowLeft, LogOut, FileText, Image, Settings, Heading, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { BlogManager } from './BlogManager';
import { GalleryManager } from './GalleryManager';
import { ContentEditor } from './ContentEditor';
import { SectionTitlesEditor } from './SectionTitlesEditor';
import { TeamManager } from './TeamManager';

interface AdminDashboardProps {
  onNavigateHome?: () => void;
}

export function AdminDashboard({ onNavigateHome }: AdminDashboardProps = {}) {
  const [activeTab, setActiveTab] = useState<'blog' | 'gallery' | 'team' | 'content' | 'titles'>('blog');
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut(() => {
        if (onNavigateHome) {
          onNavigateHome();
        }
      });
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <img
                src="/image_2025-10-07_19-50-30.png"
                alt="Святогор"
                className="h-10 w-10 object-contain"
              />
              <h1 className="text-xl font-bold text-gray-900">Админ-панель</h1>
            </div>
            <div className="flex items-center space-x-2">
              <a
                href="/"
                onClick={(e) => {
                  // В SPA уходим без перезагрузки; если проп не передан — сбрасываем
                  // сохранённую страницу и отдаём переход браузеру (href="/").
                  if (onNavigateHome) {
                    e.preventDefault();
                    onNavigateHome();
                  } else {
                    sessionStorage.setItem('currentPage', 'home');
                  }
                }}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-orange-600 transition-colors"
              >
                <ArrowLeft size={20} />
                <span className="hidden sm:inline">На сайт</span>
              </a>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-orange-600 transition-colors"
              >
                <LogOut size={20} />
                <span>Выйти</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-1 mb-8 bg-white rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('blog')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-md font-medium transition-colors ${
              activeTab === 'blog'
                ? 'bg-orange-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FileText size={20} />
            <span>Блог</span>
          </button>
          <button
            onClick={() => setActiveTab('gallery')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-md font-medium transition-colors ${
              activeTab === 'gallery'
                ? 'bg-orange-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Image size={20} />
            <span>Фотогалерея</span>
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-md font-medium transition-colors ${
              activeTab === 'team'
                ? 'bg-orange-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Users size={20} />
            <span>Команда</span>
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-md font-medium transition-colors ${
              activeTab === 'content'
                ? 'bg-orange-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Settings size={20} />
            <span>Контент страниц</span>
          </button>
          <button
            onClick={() => setActiveTab('titles')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-md font-medium transition-colors ${
              activeTab === 'titles'
                ? 'bg-orange-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Heading size={20} />
            <span>Заголовки</span>
          </button>
        </div>

        {activeTab === 'blog' && <BlogManager />}
        {activeTab === 'gallery' && <GalleryManager />}
        {activeTab === 'team' && <TeamManager />}
        {activeTab === 'content' && <ContentEditor />}
        {activeTab === 'titles' && <SectionTitlesEditor />}
      </div>
    </div>
  );
}
