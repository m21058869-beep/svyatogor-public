'use client';
import { useEffect, useState } from 'react';
import { Download, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, type GalleryPhoto } from '@/lib/api';

interface SectionTitle {
  title: string;
  subtitle?: string;
}

export function Gallery() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sectionTitle, setSectionTitle] = useState<SectionTitle>({
    title: 'Лучшие моменты',
    subtitle: 'Откройте для себя захватывающие моменты из жизни команды "Святогор"'
  });

  useEffect(() => {
    loadPhotos();
    loadSectionTitle();
  }, []);

  const loadPhotos = async () => {
    const data = await api.gallery.list();
    setPhotos(data);
  };

  const loadSectionTitle = async () => {
    const data = await api.sectionTitles.get('gallery', 'main');
    if (data) setSectionTitle({ title: data.title, subtitle: data.subtitle ?? undefined });
  };

  /**
   * Скачивание идёт через собственный роут `/api/download`.
   *
   * Прямая ссылка на файл в S3 не работает: у бакета другой origin и нет
   * CORS-заголовков, поэтому браузер открывает фото вместо скачивания (атрибут
   * `download` для чужого origin игнорируется, а `fetch` + Blob отбивается CORS).
   * Сервер забирает файл сам и отдаёт его с заголовком
   * `Content-Disposition: attachment`, поэтому браузер скачивает файл и остаётся
   * на странице галереи.
   */
  const downloadUrl = (photo: GalleryPhoto) => {
    const params = new URLSearchParams({
      url: photo.image_url,
      name: photo.title.trim() || `svyatogor-${photo.id}`,
    });
    return `/api/download?${params.toString()}`;
  };

  const handleDownload = (photo: GalleryPhoto) => {
    // Клик по временной ссылке: так скачивание стартует без перехода на другую
    // страницу и без блокировки всплывающих окон.
    const link = document.createElement('a');
    link.href = downloadUrl(photo);
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const openLightbox = (photo: GalleryPhoto, index: number) => {
    setSelectedPhoto(photo);
    setSelectedIndex(index);
  };

  const closeLightbox = () => {
    setSelectedPhoto(null);
  };

  const goToPrevious = () => {
    const newIndex = selectedIndex > 0 ? selectedIndex - 1 : photos.length - 1;
    setSelectedIndex(newIndex);
    setSelectedPhoto(photos[newIndex]);
  };

  const goToNext = () => {
    const newIndex = selectedIndex < photos.length - 1 ? selectedIndex + 1 : 0;
    setSelectedIndex(newIndex);
    setSelectedPhoto(photos[newIndex]);
  };

  return (
    <div className="flex-1 animate-fadeIn">
      <section className="bg-white py-20">
        <div className="container mx-auto px-4 text-center animate-slideInUp">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-pink-50 rounded-full mb-4">
            <span className="text-sm font-medium text-pink-600">📸 Фотогалерея команды</span>
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
          {photos.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-xl text-gray-600">Пока нет фотографий в галерее</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="group relative aspect-square bg-gray-200 rounded-lg overflow-hidden cursor-pointer shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 animate-fadeInUp"
                  style={{animationDelay: `${index * 0.05}s`}}
                  onClick={() => openLightbox(photo, index)}
                >
                  <img
                    src={photo.thumbnail_url || photo.image_url}
                    alt={photo.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-white font-semibold mb-1">{photo.title}</h3>
                      {photo.description && (
                        <p className="text-white/90 text-sm line-clamp-2">
                          {photo.description}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* stopPropagation: клик по кнопке скачивания не должен открывать модалку. */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(photo);
                    }}
                    className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-orange-50"
                    title="Скачать фото"
                  >
                    <Download size={18} className="text-orange-600" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors z-10"
          >
            <X size={32} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
            className="absolute left-4 p-3 text-white hover:bg-white/10 rounded-full transition-colors z-10"
          >
            <ChevronLeft size={32} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            className="absolute right-4 p-3 text-white hover:bg-white/10 rounded-full transition-colors z-10"
          >
            <ChevronRight size={32} />
          </button>

          <div
            className="max-w-7xl max-h-[90vh] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedPhoto.image_url}
              alt={selectedPhoto.title}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <div className="mt-4 text-white text-center">
              <h3 className="text-2xl font-bold mb-2">{selectedPhoto.title}</h3>
              {selectedPhoto.description && (
                <p className="text-white/80">{selectedPhoto.description}</p>
              )}
              <button
                onClick={(e) => {
                  // stopPropagation: клик по кнопке не закрывает модалку (у неё клик по фону = закрыть).
                  e.stopPropagation();
                  handleDownload(selectedPhoto);
                }}
                className="mt-4 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold inline-flex items-center transition-colors"
              >
                <Download size={20} className="mr-2" />
                Скачать фото
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
