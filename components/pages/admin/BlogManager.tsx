'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api, type BlogPost, type BlogPostInput } from '@/lib/api';
import { RichTextEditor } from '@/components/RichTextEditor';

/** Уведомление с типом: цвет больше не угадывается по подстроке в тексте. */
type Notice = { kind: 'success' | 'error'; text: string };

/** Сколько живёт уведомление, чтобы не «прилипать» к следующему действию. */
const NOTICE_TTL_MS = 6_000;

function describeError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

const draftFrom = (post: BlogPost): Partial<BlogPost> => ({
  ...post,
  excerpt: post.excerpt ?? '',
  cover_image: post.cover_image ?? '',
});

export function BlogManager() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [editingPost, setEditingPost] = useState<Partial<BlogPost> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const mountedRef = useRef(true);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listAbortRef = useRef<AbortController | null>(null);
  const listPromiseRef = useRef<Promise<boolean> | null>(null);

  const showNotice = useCallback((kind: Notice['kind'], text: string) => {
    if (!mountedRef.current) return;
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice({ kind, text });
    noticeTimerRef.current = setTimeout(() => {
      noticeTimerRef.current = null;
      if (mountedRef.current) setNotice(null);
    }, NOTICE_TTL_MS);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      // Уходим со вкладки «Блог» — отменяем незавершённый список, чтобы не
      // обновлять состояние уже размонтированного компонента.
      mountedRef.current = false;
      listAbortRef.current?.abort();
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  /**
   * Загрузка списка постов. Никогда не бросает исключение: ошибка показывается
   * баннером с кнопкой «Повторить», поэтому интерфейс не может «зависнуть».
   * Возвращает true, если список удалось обновить.
   */
  const loadPosts = useCallback(async (): Promise<boolean> => {
    // Дедупликация параллельных вызовов (например, двойной клик по «Повторить»).
    if (listPromiseRef.current) return listPromiseRef.current;

    const request = (async () => {
      listAbortRef.current?.abort();
      const controller = new AbortController();
      listAbortRef.current = controller;
      if (mountedRef.current) setPostsLoading(true);

      try {
        const data = await api.blog.list({}, controller.signal);
        if (!mountedRef.current) return false;
        setPosts(data);
        setListError('');
        return true;
      } catch (error) {
        if (!mountedRef.current) return false;
        // Отмена при размонтировании — не ошибка: показывать её некому.
        if (error instanceof Error && error.message === 'Запрос отменён') return false;
        setListError(describeError(error, 'Не удалось загрузить список постов'));
        return false;
      } finally {
        if (mountedRef.current) setPostsLoading(false);
      }
    })();

    listPromiseRef.current = request;
    try {
      return await request;
    } finally {
      listPromiseRef.current = null;
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const handleCreate = () => {
    setIsCreating(true);
    setNotice(null);
    setEditingPost({
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      cover_image: '',
      published: false,
    });
  };

  const handleEdit = (post: BlogPost) => {
    setNotice(null);
    setEditingPost(draftFrom(post));
    setIsCreating(false);
  };

  const handleCancel = () => {
    // Уведомление о результате живёт в списке, поэтому после закрытия формы
    // администратор всё равно видит «Пост создан».
    setEditingPost(null);
    setIsCreating(false);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    // Сбрасываем input сразу: без этого повторный выбор того же файла не вызывал
    // onChange, и загрузка «не срабатывала» второй раз.
    input.value = '';
    if (!file || uploadingImage) return;

    if (!file.type.startsWith('image/')) {
      showNotice('error', 'Можно загрузить только изображение');
      return;
    }

    setUploadingImage(true);
    try {
      const { url } = await api.upload(file, 'blog-covers');
      if (!mountedRef.current) return;
      // Функциональное обновление вместо снимка editingPost: пока шла загрузка,
      // администратор мог печатать текст, и перезапись стёрла бы эти правки.
      setEditingPost((prev) => (prev ? { ...prev, cover_image: url } : prev));
      showNotice('success', 'Изображение загружено');
    } catch (error) {
      showNotice('error', describeError(error, 'Не удалось загрузить изображение'));
    } finally {
      if (mountedRef.current) setUploadingImage(false);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleSave = async () => {
    const post = editingPost;
    if (!post || saving) return;

    const title = (post.title ?? '').trim();
    const content = (post.content ?? '').trim();
    if (!title || !content) {
      showNotice('error', 'Заполните заголовок и содержание поста');
      return;
    }

    const slug = ((post.slug ?? '').trim() || generateSlug(title)).trim();
    if (!slug) {
      showNotice('error', 'Не удалось сформировать URL поста — заполните поле «URL (slug)»');
      return;
    }
    if (!isCreating && !post.id) {
      showNotice('error', 'Не указан идентификатор поста — обновите страницу и попробуйте снова');
      return;
    }

    const coverImage = (post.cover_image ?? '').trim();
    const payload: BlogPostInput = {
      title,
      slug,
      excerpt: (post.excerpt ?? '').trim(),
      content,
      cover_image: coverImage || null,
      published: post.published ?? false,
    };

    setSaving(true);
    try {
      if (isCreating) {
        await api.blog.create(payload);
        showNotice('success', 'Пост создан');
      } else {
        await api.blog.update(post.id as string, payload);
        showNotice('success', 'Пост обновлён');
      }
      // Форму закрываем только после успеха: при ошибке введённый текст останется.
      handleCancel();
      await loadPosts();
    } catch (error) {
      showNotice('error', describeError(error, 'Не удалось сохранить пост'));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  const handleDelete = async (post: BlogPost) => {
    if (deletingId) return;
    if (!confirm(`Удалить пост «${post.title}»?`)) return;

    setDeletingId(post.id);
    try {
      await api.blog.delete(post.id);
      showNotice('success', 'Пост удалён');
    } catch (error) {
      showNotice('error', describeError(error, 'Не удалось удалить пост'));
    } finally {
      if (mountedRef.current) setDeletingId(null);
      // Список перечитываем всегда: если сервер успел удалить пост, но ответ
      // потерялся (таймаут), строка не останется висеть на экране.
      await loadPosts();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ru-RU');
  };


  if (editingPost) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {isCreating ? 'Создать пост' : 'Редактировать пост'}
          </h2>
          <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {notice && <NoticeBanner notice={notice} />}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Заголовок *</label>
            <input
              type="text"
              value={editingPost.title ?? ''}
              onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Заголовок поста"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">URL (slug)</label>
            <input
              type="text"
              value={editingPost.slug ?? ''}
              onChange={(e) => setEditingPost({ ...editingPost, slug: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Автоматически создастся из заголовка"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Краткое описание</label>
            <textarea
              value={editingPost.excerpt ?? ''}
              onChange={(e) => setEditingPost({ ...editingPost, excerpt: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Краткое описание поста"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Содержание * (поддерживается Markdown)
            </label>
            <RichTextEditor
              value={editingPost.content ?? ''}
              onChange={(content) => setEditingPost({ ...editingPost, content })}
              placeholder="Содержание поста"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Обложка поста</label>
            <div className="space-y-3">
              <label
                className={`flex-1 cursor-pointer ${uploadingImage ? 'cursor-wait opacity-70' : ''}`}
              >
                <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors">
                  {uploadingImage ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Upload size={20} />
                  )}
                  <span className="text-sm font-medium">
                    {uploadingImage ? 'Загрузка...' : 'Загрузить изображение'}
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="hidden"
                />
              </label>
              <input
                type="text"
                value={editingPost.cover_image ?? ''}
                onChange={(e) => setEditingPost({ ...editingPost, cover_image: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="или вставьте URL изображения"
              />
              {editingPost.cover_image && (
                <div className="mt-2">
                  <img
                    src={editingPost.cover_image}
                    alt="Обложка поста"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="published"
              checked={editingPost.published ?? false}
              onChange={(e) => setEditingPost({ ...editingPost, published: e.target.checked })}
              className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
            />
            <label htmlFor="published" className="ml-2 text-sm font-medium text-gray-700">
              Опубликовать
            </label>
          </div>

          <div className="flex space-x-3 pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving || uploadingImage}
              className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
            >
              {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              <span>{saving ? 'Сохранение...' : 'Сохранить'}</span>
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-60"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Управление блогом</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadPosts()}
            disabled={postsLoading}
            className="flex items-center space-x-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-60"
            title="Обновить список"
          >
            {postsLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <RefreshCw size={20} />
            )}
            <span className="hidden sm:inline">Обновить</span>
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <Plus size={20} />
            <span>Создать пост</span>
          </button>
        </div>
      </div>

      {notice && <NoticeBanner notice={notice} />}

      {listError && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 text-red-600">
          <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p>{listError}</p>
            <button
              onClick={() => void loadPosts()}
              disabled={postsLoading}
              className="mt-2 text-sm font-semibold underline disabled:opacity-60"
            >
              Повторить загрузку
            </button>
          </div>
        </div>
      )}

      {postsLoading && posts.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
          <Loader2 size={20} className="animate-spin" />
          <span>Загрузка постов...</span>
        </div>
      )}

      <div className="grid gap-6">
        {posts.map((post) => (
          <div key={post.id} className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-start justify-between gap-4">
              {post.cover_image && (
                <img
                  src={post.cover_image}
                  alt={post.title}
                  className="w-32 h-24 object-cover rounded-lg flex-shrink-0"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-xl font-bold text-gray-900">{post.title}</h3>
                  {post.published ? (
                    <span className="px-2 py-1 bg-green-100 text-green-600 text-xs font-semibold rounded">
                      Опубликовано
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded">
                      Черновик
                    </span>
                  )}
                </div>
                <p className="text-gray-600 mb-2">{post.excerpt}</p>
                <p className="text-sm text-gray-500">Создано: {formatDate(post.created_at)}</p>
              </div>
              <div className="flex space-x-2 flex-shrink-0">
                <button
                  onClick={() => handleEdit(post)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Редактировать"
                >
                  <Edit size={20} />
                </button>
                <button
                  onClick={() => void handleDelete(post)}
                  disabled={deletingId !== null}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                  title="Удалить"
                >
                  {deletingId === post.id ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Trash2 size={20} />
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}

        {!postsLoading && posts.length === 0 && !listError && (
          <div className="text-center py-12 text-gray-500">
            <p>Нет постов. Создайте первый пост!</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Единый вид уведомления: тип приходит из состояния, а не угадывается по тексту. */
function NoticeBanner({ notice }: { notice: Notice }) {
  const success = notice.kind === 'success';
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg mb-6 ${
        success ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
      }`}
      role="status"
    >
      {success ? (
        <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0" />
      ) : (
        <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
      )}
      <p>{notice.text}</p>
    </div>
  );
}

