'use client';
import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Upload, Trash2, X } from 'lucide-react';
import {
  api,
  uploadWithProgress,
  type GalleryPhoto,
  type GalleryPhotoInput,
} from '@/lib/api';

type PhotoStatus = 'pending' | 'uploading' | 'done' | 'error';

interface DraftPhoto {
  /** Стабильный ключ для React: индекс использовать нельзя — элементы удаляют. */
  id: string;
  title: string;
  description: string;
  category: string;
  /** Превью: blob-URL до загрузки, публичный URL в S3 после неё. */
  imageUrl: string;
  file?: File;
  status: PhotoStatus;
  /** Прогресс отправки этого файла, 0–100. */
  progress: number;
  error?: string;
}

/** Прогресс всего пакета: номер файла и проценты (текущий / по всему пакету). */
interface BatchProgress {
  current: number;
  total: number;
  /** Процент отправки текущего файла. */
  percent: number;
  /** Процент по всему пакету: (current - 1 + percent/100) / total * 100. */
  overall: number;
}

interface Notice {
  text: string;
  tone: 'success' | 'error';
}

let draftCounter = 0;
const nextDraftId = () => `draft-${(draftCounter += 1)}`;

const titleFromFileName = (name: string) => name.replace(/\.[^.]+$/, '') || name;

export function GalleryManager() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [newPhotos, setNewPhotos] = useState<DraftPhoto[]>([]);
  const [batch, setBatch] = useState<BatchProgress | null>(null);
  /** Позволяет прервать текущий пакет кнопкой «Отменить загрузку». */
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      const data = await api.gallery.list();
      setPhotos(data);
    } catch (error) {
      setNotice({
        text:
          error instanceof Error && error.message
            ? error.message
            : 'Не удалось загрузить список фото',
        tone: 'error',
      });
    }
  };

  const updateDraft = (id: string, patch: Partial<DraftPhoto>) => {
    setNewPhotos((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const chosen = Array.from(input.files ?? []);
    // Сбрасываем инпут сразу: без этого повторный выбор тех же файлов не вызовет change.
    input.value = '';
    if (chosen.length === 0) return;

    const images = chosen.filter((file) => file.type.startsWith('image/'));
    const skipped = chosen.length - images.length;

    if (images.length === 0) {
      setNotice({
        text: 'Можно загружать только изображения (JPEG, PNG, WebP, GIF, AVIF)',
        tone: 'error',
      });
      return;
    }

    const drafts: DraftPhoto[] = images.map((file) => ({
      id: nextDraftId(),
      title: titleFromFileName(file.name),
      description: '',
      category: 'general',
      imageUrl: URL.createObjectURL(file),
      file,
      status: 'pending',
      progress: 0,
    }));

    // Функциональное обновление: не теряем файлы, если выбор сделали дважды подряд.
    setNewPhotos((prev) => [...prev, ...drafts]);
    setNotice({
      text:
        skipped > 0
          ? `Добавлено фото: ${drafts.length}. Пропущено файлов (не изображения): ${skipped}`
          : `Добавлено фото: ${drafts.length}`,
      tone: skipped > 0 ? 'error' : 'success',
    });
  };

  /** Освобождает blob-URL превью, чтобы не копить память в браузере. */
  const revokePreview = (photo: DraftPhoto) => {
    if (photo.imageUrl.startsWith('blob:')) URL.revokeObjectURL(photo.imageUrl);
  };

  const removeDraft = (id: string) => {
    setNewPhotos((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) revokePreview(target);
      return prev.filter((item) => item.id !== id);
    });
  };

  const clearDrafts = () => {
    setNewPhotos((prev) => {
      prev.forEach(revokePreview);
      return [];
    });
    setNotice(null);
  };

  const cancelUpload = () => {
    abortRef.current?.abort();
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPhotos.length === 0) {
      setNotice({ text: 'Добавьте хотя бы одно фото', tone: 'error' });
      return;
    }
    if (newPhotos.some((photo) => photo.title.trim() === '')) {
      setNotice({ text: 'Заполните название для всех фото', tone: 'error' });
      return;
    }

    // Файлы уходят по одному; пакет можно прервать кнопкой «Отменить загрузку».
    const controller = new AbortController();
    abortRef.current = controller;

    const batchPhotos = newPhotos;
    const total = batchPhotos.length;
    const uploaded: GalleryPhotoInput[] = [];
    const uploadedIds: string[] = [];
    const savedIds = new Set<string>();
    const failures: string[] = [];

    setUploading(true);
    setNotice(null);
    setBatch({ current: 1, total, percent: 0, overall: 0 });

    try {
      for (let index = 0; index < batchPhotos.length; index += 1) {
        const photo = batchPhotos[index];
        if (controller.signal.aborted) break;

        updateDraft(photo.id, { status: 'uploading', progress: 0, error: undefined });
        setBatch({ current: index + 1, total, percent: 0, overall: (index / total) * 100 });

        try {
          let imageUrl = photo.imageUrl;

          if (photo.file) {
            // Каждый файл — отдельный запрос: тело пакета остаётся небольшим и
            // точно проходит лимиты Nginx, а прогресс считается по каждому файлу.
            const { url } = await uploadWithProgress(photo.file, 'gallery', {
              signal: controller.signal,
              onProgress: ({ percent }) => {
                updateDraft(photo.id, { progress: percent });
                setBatch({
                  current: index + 1,
                  total,
                  percent,
                  overall: ((index + percent / 100) / total) * 100,
                });
              },
            });
            imageUrl = url;
          }

          updateDraft(photo.id, { status: 'done', progress: 100 });
          uploadedIds.push(photo.id);
          uploaded.push({
            title: photo.title.trim(),
            description: photo.description,
            image_url: imageUrl,
            thumbnail_url: imageUrl,
            category: photo.category,
          });
        } catch (error) {
          // Ошибка одного файла не ломает пакет: помечаем фото и идём дальше.
          const reason =
            error instanceof Error && error.message ? error.message : 'Неизвестная ошибка';
          updateDraft(photo.id, { status: 'error', progress: 0, error: reason });
          failures.push(`${photo.title || photo.file?.name || 'фото'} — ${reason}`);
        }
      }

      let savedRows = 0;
      if (uploaded.length > 0) {
        try {
          await api.gallery.create(uploaded);
          uploadedIds.forEach((id) => savedIds.add(id));
          savedRows = uploaded.length;
        } catch (error) {
          // Файлы уже в S3, но записей в галерее нет: возвращаем их в форму как
          // ошибку, чтобы админ мог повторить сохранение.
          const reason =
            error instanceof Error && error.message ? error.message : 'Неизвестная ошибка';
          uploadedIds.forEach((id) =>
            updateDraft(id, {
              status: 'error',
              error: `Файл загружен, но не сохранён в галерее: ${reason}`,
            }),
          );
          failures.push(`сохранение в галерее — ${reason}`);
        }
      }

      if (savedRows > 0) {
        await loadPhotos();
      }

      // Сохранённые убираем из формы (и освобождаем их blob-превью), неудачные
      // оставляем — их можно отправить повторно, не выбирая файлы заново.
      batchPhotos.forEach((photo) => {
        if (savedIds.has(photo.id)) revokePreview(photo);
      });
      setNewPhotos((prev) =>
        prev
          .filter((photo) => !savedIds.has(photo.id))
          .map((photo) => ({ ...photo, status: 'pending' as PhotoStatus, progress: 0 })),
      );

      if (controller.signal.aborted) {
        setNotice({
          text: `Загрузка отменена. Сохранено фото: ${savedRows} из ${total}. Остальные остались в форме.`,
          tone: 'error',
        });
      } else if (failures.length === 0) {
        setNotice({ text: `Успешно добавлено фото: ${savedRows}`, tone: 'success' });
        setShowUploadForm(false);
      } else if (savedRows === 0) {
        setNotice({ text: `Не удалось загрузить фото. ${failures.join('; ')}`, tone: 'error' });
      } else {
        setNotice({
          text: `Загружено фото: ${savedRows} из ${total}. Ошибки: ${failures.join('; ')}`,
          tone: 'error',
        });
      }
    } catch (error) {
      // Непредвиденный сбой: интерфейс всё равно разблокируется в finally.
      setNotice({
        text: error instanceof Error && error.message ? error.message : 'Ошибка при загрузке',
        tone: 'error',
      });
    } finally {
      abortRef.current = null;
      setBatch(null);
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить это фото?')) return;

    try {
      await api.gallery.delete(id);
      setNotice({ text: 'Фото удалено', tone: 'success' });
      await loadPhotos();
    } catch (error) {
      setNotice({
        text: error instanceof Error && error.message ? error.message : 'Ошибка при удалении',
        tone: 'error',
      });
    }
  };

  /** Сколько выбранных фото ещё не сохранено в галерее. */
  const pendingCount = newPhotos.filter((photo) => photo.status !== 'done').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Управление фотогалереей</h2>
        <button
          onClick={() => setShowUploadForm(!showUploadForm)}
          disabled={uploading}
          className="flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400"
        >
          {showUploadForm ? (
            <>
              <X size={20} />
              <span>Отмена</span>
            </>
          ) : (
            <>
              <Upload size={20} />
              <span>Загрузить фото</span>
            </>
          )}
        </button>
      </div>

      {notice && (
        <div
          className={`flex items-start gap-2 px-4 py-3 rounded-lg ${
            notice.tone === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {notice.tone === 'success' ? (
            <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {showUploadForm && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-900">Добавить фото</h3>
          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Выберите изображения *
              </label>
              <label className={`block ${uploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors">
                  <Upload size={20} />
                  <span className="text-sm font-medium">
                    Загрузить изображения с компьютера (можно выбрать несколько)
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>

            {uploading && (
              <div className="space-y-2 rounded-lg bg-orange-50 p-4">
                <div className="flex items-center justify-between text-sm font-medium text-orange-900">
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Загрузка фото {batch?.current ?? 0} из {batch?.total ?? newPhotos.length}
                  </span>
                  <span>{Math.round(batch?.overall ?? 0)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-orange-200">
                  <div
                    className="h-full rounded-full bg-orange-600 transition-all duration-200"
                    style={{ width: `${batch?.overall ?? 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-orange-800">
                  <span>Текущий файл: {batch?.percent ?? 0}%</span>
                  <button
                    type="button"
                    onClick={cancelUpload}
                    className="font-semibold underline hover:no-underline"
                  >
                    Отменить загрузку
                  </button>
                </div>
              </div>
            )}

            {newPhotos.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Выбрано фото: {newPhotos.length}</h4>
                {newPhotos.map((photo) => (
                  <div key={photo.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex gap-4">
                      <img
                        src={photo.imageUrl}
                        alt={photo.title || photo.file?.name || 'Фото'}
                        className="w-32 h-32 object-cover rounded-lg"
                      />
                      <div className="flex-1 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Название *
                          </label>
                          <input
                            type="text"
                            value={photo.title}
                            onChange={(e) => updateDraft(photo.id, { title: e.target.value })}
                            disabled={uploading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100"
                            placeholder="Название фото"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Описание
                          </label>
                          <input
                            type="text"
                            value={photo.description}
                            onChange={(e) => updateDraft(photo.id, { description: e.target.value })}
                            disabled={uploading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100"
                            placeholder="Описание фото"
                          />
                        </div>
                        <div className="flex gap-3 items-center">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Категория
                            </label>
                            <select
                              value={photo.category}
                              onChange={(e) => updateDraft(photo.id, { category: e.target.value })}
                              disabled={uploading}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100"
                            >
                              <option value="general">Общее</option>
                              <option value="games">Игры</option>
                              <option value="training">Тренировки</option>
                              <option value="tournaments">Турниры</option>
                              <option value="team">Команда</option>
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDraft(photo.id)}
                            disabled={uploading}
                            className="mt-6 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:text-gray-400"
                            title="Удалить"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {photo.status === 'uploading' && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-orange-600 transition-all duration-200"
                          style={{ width: `${photo.progress}%` }}
                        />
                      </div>
                    )}
                    {photo.status === 'error' && photo.error && (
                      <p className="flex items-start gap-2 text-sm text-red-600">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <span>{photo.error}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={uploading || newPhotos.length === 0}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
              >
                {uploading && <Loader2 size={18} className="animate-spin" />}
                {uploading ? 'Загрузка...' : `Загрузить ${newPhotos.length} фото`}
              </button>
              {newPhotos.length > 0 && (
                <button
                  type="button"
                  onClick={clearDrafts}
                  disabled={uploading}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:bg-gray-100 disabled:text-gray-400"
                >
                  Очистить все
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="group relative bg-white rounded-xl shadow-lg overflow-hidden"
          >
            <img
              src={photo.thumbnail_url || photo.image_url}
              alt={photo.title}
              className="w-full h-48 object-cover"
            />
            <div className="p-4">
              <h3 className="font-bold text-gray-900 mb-1 line-clamp-1">{photo.title}</h3>
              {photo.description && (
                <p className="text-sm text-gray-600 line-clamp-2">{photo.description}</p>
              )}
              <span className="inline-block mt-2 px-2 py-1 bg-orange-100 text-orange-600 text-xs font-semibold rounded">
                {photo.category}
              </span>
            </div>
            <button
              onClick={() => handleDelete(photo.id)}
              className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
              title="Удалить"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>

      {photos.length === 0 && !showUploadForm && (
        <div className="text-center py-12 text-gray-500">
          <p>Нет фотографий. Загрузите первое фото!</p>
        </div>
      )}

      {pendingCount > 0 && !showUploadForm && (
        <p className="text-sm text-gray-500">
          В форме осталось неотправленных фото: {pendingCount}
        </p>
      )}
    </div>
  );
}
