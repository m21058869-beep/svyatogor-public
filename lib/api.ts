// Клиент API приложения. Все запросы идут на тот же origin по /api/*:
// в dev их обрабатывает Next.js dev-сервер (Route Handlers в app/api/**), в
// продакшене — тот же процесс `next start`.
// Сессия администратора хранится в http-only cookie, поэтому credentials: 'include'.

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string | null;
  role?: string | null;
  created_at?: string;
}

export interface SiteContent {
  id: string;
  page: string;
  section: string;
  content: Record<string, unknown>;
  updated_at: string;
}

/**
 * Безопасно приводит значение из JSON-контента к строке для рендера в JSX.
 * Возвращает пустую строку, если значение не строка/число.
 */
export function contentText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image?: string | null;
  published: boolean;
  author_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogPostInput {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  cover_image?: string | null;
  published?: boolean;
}

export interface GalleryPhoto {
  id: string;
  title: string;
  description: string;
  image_url: string;
  thumbnail_url?: string | null;
  category: string;
  uploaded_by?: string | null;
  created_at: string;
}

export interface GalleryPhotoInput {
  title: string;
  description?: string;
  image_url: string;
  thumbnail_url?: string;
  category?: string;
}

/** Карточка игрока в разделе «Состав». */
export interface Player {
  id: string;
  name: string;
  number: number | null;
  position: string;
  bio: string;
  photo_url?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PlayerInput {
  name: string;
  number?: number | null;
  position?: string;
  bio?: string;
  photo_url?: string | null;
  sort_order?: number;
}

export interface SectionTitle {
  id: string;
  page: string;
  section: string;
  title: string;
  subtitle?: string | null;
  updated_at?: string;
}

export interface SectionTitleInput {
  page: string;
  section: string;
  title: string;
  subtitle?: string | null;
}

/** Данные формы обратной связи на странице «Контакты». */
export interface ContactMessageInput {
  name: string;
  email: string;
  subject?: string;
  message: string;
}

export type UploadFolder = 'blog-covers' | 'gallery' | 'team';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** HTTP-статусы, которые нужно вернуть как null вместо выброса исключения. */
  nullOn?: number[];
  /** Сколько миллисекунд ждать ответ. 0 — ждать бесконечно. */
  timeoutMs?: number;
}

/**
 * Предел ожидания для обычных запросов админки. Без него «повисший» сервер
 * (или потерянная сеть) оставлял кнопки и списки в состоянии «Загрузка...»
 * навсегда: пользователь не получал ни ошибки, ни возможности повторить.
 */
const REQUEST_TIMEOUT_MS = 20_000;

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, nullOn, timeoutMs = REQUEST_TIMEOUT_MS } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  // Отдельный контроллер на таймаут: внешний signal (отмена при размонтировании
  // компонента) продолжает работать и просто «пробрасывается» внутрь.
  const controller = new AbortController();
  let timedOut = false;
  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : null;
  const forwardAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', forwardAbort);
  }

  try {
    const response = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      signal: controller.signal,
      // Ответы /api всегда нужны свежими: иначе после сохранения админка могла
      // показывать список из кэша браузера/прокси (симптом «срабатывает через раз»).
      cache: 'no-store',
      headers:
        body === undefined || isFormData ? undefined : { 'Content-Type': 'application/json' },
      body:
        body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
    });

    if (nullOn?.includes(response.status)) {
      return null as T;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    // Разбираем тело только если это действительно JSON: иначе `response.json()`
    // вернул бы null, и вызывающий код упал бы с "Cannot read properties of null".
    const contentType = response.headers.get('content-type') ?? '';
    const data: unknown = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : null;

    if (!response.ok) {
      const fromApi =
        data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
          ? (data as { error: string }).error
          : null;
      // Не-JSON ответ на ошибку — почти всегда статика/прокси перед Node, а не наше API.
      // Без подсказки админу видно только «Ошибка запроса (405)», что не объясняет причину.
      const hint =
        fromApi || data
          ? ''
          : ` Сервер ответил не-JSON${contentType ? ` (Content-Type: ${contentType})` : ''}: похоже, запросы /api перехватывает статика, а не Node-сервер.`;
      const message = (fromApi ?? `Ошибка запроса (${response.status})`) + hint;
      const error = new Error(message) as Error & { status: number };
      error.status = response.status;
      throw error;
    }

    if (data === null) {
      // 2xx без JSON — это почти всегда HTML от статики/прокси, то есть запросы
      // `/api/*` обрабатывает не Next.js, а файловый сервер (см. TIMEWEB_DEPLOY.md).
      const suffix = contentType ? ` (Content-Type: ${contentType})` : '';
      throw new Error(
        `API вернул не-JSON ответ${suffix}. Проверьте, что запросы /api обрабатывает сервер, а не статика.`,
      );
    }

    return data as T;
  } catch (error) {
    // Причина важнее кода: администратору нужно понять, что делать дальше.
    if (timedOut) {
      throw new Error(
        `Сервер не ответил за ${Math.round(timeoutMs / 1000)} с. Возможно, он перегружен или соединение прервалось — попробуйте ещё раз.`,
      );
    }
    if (signal?.aborted) {
      throw new Error('Запрос отменён');
    }
    if (error instanceof TypeError) {
      throw new Error('Нет связи с сервером: проверьте интернет-соединение и попробуйте снова.');
    }
    throw error;
  } finally {
    if (timer !== null) clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

const encode = (value: string) => encodeURIComponent(value);

export interface UploadProgress {
  /** Сколько байт файла уже отправлено на сервер. */
  loaded: number;
  /** Полный размер тела запроса (0, если браузер не смог его посчитать). */
  total: number;
  /** Процент отправленного: 0–100. */
  percent: number;
}

export interface UploadOptions {
  /** Вызывается по мере отправки файла — отсюда берётся прогресс-бар. */
  onProgress?: (progress: UploadProgress) => void;
  /**
   * Сколько миллисекунд без прогресса считать зависанием. Если за это время не
   * пришло ни одного события о ходе отправки, запрос прерывается: иначе при
   * обрыве сети интерфейс навсегда остался бы на «Загрузка...».
   */
  idleTimeoutMs?: number;
  /** Отмена загрузки (например, кнопкой «Отменить»). */
  signal?: AbortSignal;
}

/** 60 с без единого события о прогрессе — считаем соединение потерянным. */
const UPLOAD_IDLE_TIMEOUT_MS = 60_000;

/**
 * Загружает файл на /api/upload и сообщает о ходе отправки.
 *
 * Используется XMLHttpRequest, а не fetch: только XHR умеет отдавать событие
 * `xhr.upload.onprogress`, из которого считается процент для прогресс-бара.
 * Библиотека axios в проекте не подключена, поэтому обходимся браузерным API.
 * Запрос намеренно отправляется по одному файлу за раз (см. GalleryManager):
 * так каждый HTTP-пакет остаётся небольшим и проходит через лимиты Nginx.
 */
export function uploadWithProgress(
  file: File,
  folder: UploadFolder,
  options: UploadOptions = {},
): Promise<{ url: string; key: string }> {
  const { onProgress, idleTimeoutMs = UPLOAD_IDLE_TIMEOUT_MS, signal } = options;

  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('folder', folder);

    const xhr = new XMLHttpRequest();
    let settled = false;
    let reportedComplete = false;
    /** Причина прерывания, которую нужно показать вместо общего «прервано». */
    let abortReason: string | null = null;
    let watchdog: ReturnType<typeof setTimeout> | null = null;

    const disarmWatchdog = () => {
      if (watchdog !== null) clearTimeout(watchdog);
      watchdog = null;
    };

    const finish = (settle: () => void) => {
      if (settled) return;
      settled = true;
      disarmWatchdog();
      signal?.removeEventListener('abort', handleSignalAbort);
      settle();
    };

    const report = (loaded: number, total: number) => {
      const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
      onProgress?.({ loaded, total, percent });
    };

    /** Перезаряжает «сторож»: любое событие о прогрессе означает живое соединение. */
    const armWatchdog = () => {
      if (idleTimeoutMs <= 0) return;
      disarmWatchdog();
      watchdog = setTimeout(() => {
        abortReason = `Загрузка прервана: сервер не отвечает дольше ${Math.round(idleTimeoutMs / 1000)} с. Проверьте соединение и попробуйте снова.`;
        xhr.abort();
      }, idleTimeoutMs);
    };

    const handleSignalAbort = () => {
      abortReason = 'Загрузка отменена';
      xhr.abort();
    };

    xhr.open('POST', '/api/upload');
    // Сессия администратора живёт в http-only cookie — отправляем её с запросом.
    xhr.withCredentials = true;

    if (signal) {
      if (signal.aborted) {
        finish(() => reject(new Error('Загрузка отменена')));
        return;
      }
      signal.addEventListener('abort', handleSignalAbort);
    }

    xhr.upload.onprogress = (event) => {
      armWatchdog();
      report(event.loaded, event.lengthComputable ? event.total : file.size);
    };
    // Сервер после приёма файла ещё пишет объект в S3 — «сторож» держим активным
    // до самого ответа, но полосу больше не двигаем.
    xhr.onprogress = () => armWatchdog();

    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      const fromApi =
        data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
          ? (data as { error: string }).error
          : null;

      if (xhr.status >= 200 && xhr.status < 300 && data) {
        if (!reportedComplete) {
          reportedComplete = true;
          report(file.size, file.size);
        }
        finish(() => resolve(data as { url: string; key: string }));
        return;
      }

      // 413 приходит от Nginx (HTML, а не JSON) — подсказываем, что править.
      const message =
        fromApi ??
        (xhr.status === 413
          ? 'Файл слишком большой: сервер отклонил запрос (413). Увеличьте client_max_body_size в Nginx и UPLOAD_MAX_MB в .env.'
          : `Ошибка загрузки (${xhr.status || 'нет ответа от сервера'})`);
      const error = new Error(message) as Error & { status?: number };
      error.status = xhr.status;
      finish(() => reject(error));
    };

    xhr.onerror = () =>
      finish(() => reject(new Error('Сеть недоступна: не удалось отправить файл')));
    xhr.ontimeout = () =>
      finish(() => reject(new Error('Истекло время ожидания загрузки')));
    xhr.onabort = () =>
      finish(() => reject(new Error(abortReason ?? 'Загрузка прервана')));

    armWatchdog();
    xhr.send(form);
  });
}

export const api = {
  auth: {
    /** Текущий администратор или null, если сессии нет. */
    me: async (signal?: AbortSignal): Promise<AuthUser | null> => {
      const data = await request<{ user: AuthUser } | null>('/auth/me', { nullOn: [401], signal });
      return data?.user ?? null;
    },
    login: async (email: string, password: string): Promise<AuthUser> => {
      const data = await request<{ user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      return data.user;
    },
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
  },

  content: {
    list: () => request<SiteContent[]>('/content'),
    get: (page: string, section: string) =>
      request<SiteContent | null>(`/content/${encode(page)}/${encode(section)}`, { nullOn: [404] }),
    create: (data: { page: string; section: string; content: Record<string, unknown> }) =>
      request<SiteContent>('/content', { method: 'POST', body: data }),
    update: (page: string, section: string, content: Record<string, unknown>) =>
      request<SiteContent>(`/content/${encode(page)}/${encode(section)}`, {
        method: 'PUT',
        body: { content },
      }),
  },

  sectionTitles: {
    list: () => request<SectionTitle[]>('/section-titles'),
    get: (page: string, section: string) =>
      request<SectionTitle | null>(`/section-titles/${encode(page)}/${encode(section)}`, {
        nullOn: [404],
      }),
    create: (data: SectionTitleInput | SectionTitleInput[]) =>
      request<SectionTitle | SectionTitle[] | { count: number }>('/section-titles', {
        method: 'POST',
        body: data,
      }),
    update: (id: string, data: { title?: string; subtitle?: string | null }) =>
      request<SectionTitle>(`/section-titles/${id}`, { method: 'PUT', body: data }),
  },

  contact: {
    /** Отправляет заявку с формы обратной связи на почту клуба. */
    send: (data: ContactMessageInput) =>
      request<{ ok: true }>('/contact', { method: 'POST', body: data }),
  },

  blog: {
    list: (params: { published?: boolean; limit?: number } = {}, signal?: AbortSignal) => {
      const query = new URLSearchParams();
      if (params.published) query.set('published', 'true');
      if (params.limit) query.set('limit', String(params.limit));
      const search = query.toString();
      return request<BlogPost[]>(`/blog${search ? `?${search}` : ''}`, { signal });
    },
    create: (data: BlogPostInput) => request<BlogPost>('/blog', { method: 'POST', body: data }),
    update: (id: string, data: BlogPostInput) =>
      request<BlogPost>(`/blog/${id}`, { method: 'PUT', body: data }),
    delete: (id: string) => request<void>(`/blog/${id}`, { method: 'DELETE' }),
  },

  gallery: {
    list: (params: { limit?: number } = {}) =>
      request<GalleryPhoto[]>(`/gallery${params.limit ? `?limit=${params.limit}` : ''}`),
    create: (data: GalleryPhotoInput | GalleryPhotoInput[]) =>
      request<GalleryPhoto | GalleryPhoto[]>('/gallery', { method: 'POST', body: data }),
    delete: (id: string) => request<void>(`/gallery/${id}`, { method: 'DELETE' }),
  },

  team: {
    /** Список состава (публичный). signal — отмена запроса при уходе со вкладки. */
    list: (signal?: AbortSignal) => request<Player[]>('/team', { signal }),
    create: (data: PlayerInput) => request<Player>('/team', { method: 'POST', body: data }),
    update: (id: string, data: Partial<PlayerInput>) =>
      request<Player>(`/team/${id}`, { method: 'PUT', body: data }),
    delete: (id: string) => request<void>(`/team/${id}`, { method: 'DELETE' }),
  },

  /** Загружает изображение в S3 и возвращает публичный URL (без отчёта о прогрессе). */
  upload: (file: File, folder: UploadFolder) => uploadWithProgress(file, folder),
};
