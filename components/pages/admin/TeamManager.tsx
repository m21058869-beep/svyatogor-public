'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { api, uploadWithProgress, type Player, type PlayerInput } from '@/lib/api';

/** Уведомление с типом: цвет берётся из состояния, а не угадывается по тексту. */
type Notice = { kind: 'success' | 'error'; text: string };

/** Сколько живёт уведомление, чтобы не «прилипать» к следующему действию. */
const NOTICE_TTL_MS = 6_000;

function describeError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Черновик карточки игрока: id === null — создание новой, строка — правка. */
interface Draft {
  id: string | null;
  name: string;
  /** Номер храним строкой: пустое поле означает «номер не задан» (null). */
  number: string;
  position: string;
  bio: string;
  photoUrl: string;
  sortOrder: string;
}

const emptyDraft = (): Draft => ({
  id: null,
  name: '',
  number: '',
  position: '',
  bio: '',
  photoUrl: '',
  sortOrder: '0',
});

const draftFrom = (player: Player): Draft => ({
  id: player.id,
  name: player.name,
  number: player.number === null ? '' : String(player.number),
  position: player.position ?? '',
  bio: player.bio ?? '',
  photoUrl: player.photo_url ?? '',
  sortOrder: String(player.sort_order ?? 0),
});

/** '' — оставить значение не заданным, иначе целое число; иначе сообщение об ошибке. */
function parseOptionalInt(value: string): { value: number | null } | { error: string } {
  const trimmed = value.trim();
  if (trimmed === '') return { value: null };
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) return { error: `«${trimmed}» — не целое число` };
  return { value: parsed };
}

/**
 * Управление составом команды: список игроков, добавление, редактирование,
 * удаление и загрузка фото в S3 (папка team). Фото при правке можно заменить:
 * сервер сам удалит прежний объект из хранилища при сохранении.
 */
export function TeamManager() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const mountedRef = useRef(true);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listAbortRef = useRef<AbortController | null>(null);
  const listPromiseRef = useRef<Promise<boolean> | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

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
      // Уходим со вкладки — отменяем незавершённые запросы, чтобы не обновлять
      // состояние уже размонтированного компонента.
      mountedRef.current = false;
      listAbortRef.current?.abort();
      uploadAbortRef.current?.abort();
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  /** Загрузка списка: ошибку показываем баннером с «Повторить», не бросаем наружу. */
  const loadPlayers = useCallback(async (): Promise<boolean> => {
    if (listPromiseRef.current) return listPromiseRef.current;

    const request = (async () => {
      listAbortRef.current?.abort();
      const controller = new AbortController();
      listAbortRef.current = controller;
      if (mountedRef.current) setListLoading(true);

      try {
        const data = await api.team.list(controller.signal);
        if (!mountedRef.current) return false;
        setPlayers(data);
        setListError('');
        return true;
      } catch (error) {
        if (!mountedRef.current) return false;
        // Отмена при размонтировании — не ошибка.
        if (controller.signal.aborted) return false;
        setListError(describeError(error, 'Не удалось загрузить состав'));
        return false;
      } finally {
        if (mountedRef.current) setListLoading(false);
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
    loadPlayers();
  }, [loadPlayers]);

  const updateDraft = (patch: Partial<Draft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const startCreate = () => {
    setNotice(null);
    setDraft(emptyDraft());
  };

  const handleEdit = (player: Player) => {
    setNotice(null);
    setDraft(draftFrom(player));
  };

  const cancelForm = () => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    setUploadingImage(false);
    setUploadPercent(0);
    setDraft(null);
  };

  /** Загрузка фото игрока в S3 (папка team). URL подставляется в черновик. */
  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    // Сбрасываем инпут сразу: без этого повторный выбор того же файла не вызовет change.
    input.value = '';
    if (!file || uploadingImage) return;

    if (!file.type.startsWith('image/')) {
      showNotice('error', 'Можно загружать только изображения (JPEG, PNG, WebP, GIF, AVIF)');
      return;
    }

    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setUploadingImage(true);
    setUploadPercent(0);
    try {
      const { url } = await uploadWithProgress(file, 'team', {
        signal: controller.signal,
        onProgress: ({ percent }) => {
          if (mountedRef.current) setUploadPercent(percent);
        },
      });
      if (!mountedRef.current) return;
      updateDraft({ photoUrl: url });
      showNotice('success', 'Фото загружено — не забудьте сохранить карточку');
    } catch (error) {
      if (mountedRef.current && !controller.signal.aborted) {
        showNotice('error', describeError(error, 'Не удалось загрузить фото'));
      }
    } finally {
      uploadAbortRef.current = null;
      if (mountedRef.current) {
        setUploadingImage(false);
        setUploadPercent(0);
      }
    }
  };

  const handleSave = async () => {
    const current = draft;
    if (!current || saving || uploadingImage) return;

    const name = current.name.trim();
    if (!name) {
      showNotice('error', 'Укажите имя игрока');
      return;
    }

    const number = parseOptionalInt(current.number);
    if ('error' in number) {
      showNotice('error', `Номер: ${number.error}`);
      return;
    }
    const sortOrder = parseOptionalInt(current.sortOrder);
    if ('error' in sortOrder) {
      showNotice('error', `Порядок: ${sortOrder.error}`);
      return;
    }

    const payload: PlayerInput = {
      name,
      number: number.value,
      position: current.position.trim(),
      bio: current.bio.trim(),
      photo_url: current.photoUrl.trim() || null,
      sort_order: sortOrder.value ?? 0,
    };

    setSaving(true);
    try {
      if (current.id) {
        await api.team.update(current.id, payload);
        showNotice('success', 'Карточка игрока обновлена');
      } else {
        await api.team.create(payload);
        showNotice('success', 'Игрок добавлен в состав');
      }
      // Форму закрываем только после успеха: при ошибке введённый текст останется.
      cancelForm();
      await loadPlayers();
    } catch (error) {
      showNotice('error', describeError(error, 'Не удалось сохранить карточку игрока'));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  const handleDelete = async (player: Player) => {
    if (deletingId) return;
    if (!confirm(`Удалить игрока «${player.name}»? Фото также будет удалено из хранилища.`)) return;

    setDeletingId(player.id);
    try {
      await api.team.delete(player.id);
      showNotice('success', 'Игрок удалён');
      // Если в форме была эта же карточка — закрываем её.
      setDraft((prev) => (prev?.id === player.id ? null : prev));
    } catch (error) {
      showNotice('error', describeError(error, 'Не удалось удалить игрока'));
    } finally {
      if (mountedRef.current) setDeletingId(null);
      // Список перечитываем всегда: если сервер успел удалить, но ответ потерялся
      // (таймаут), карточка не останется висеть на экране.
      await loadPlayers();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Управление составом</h2>
        <button
          onClick={() => (draft ? cancelForm() : startCreate())}
          disabled={saving || uploadingImage}
          className="flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400"
        >
          {draft ? (
            <>
              <X size={20} />
              <span>Отмена</span>
            </>
          ) : (
            <>
              <Plus size={20} />
              <span>Добавить игрока</span>
            </>
          )}
        </button>
      </div>

      {notice && <NoticeBanner notice={notice} />}

      {draft && (
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
          <h3 className="text-xl font-bold text-gray-900">
            {draft.id ? 'Редактировать карточку' : 'Новый игрок'}
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Имя и фамилия *</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => updateDraft({ name: e.target.value })}
                disabled={saving}
                placeholder="Иван Иванов"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Игровой номер</label>
              <input
                type="number"
                min={0}
                max={99}
                value={draft.number}
                onChange={(e) => updateDraft({ number: e.target.value })}
                disabled={saving}
                placeholder="10"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Амплуа</label>
              <input
                type="text"
                list="team-positions"
                value={draft.position}
                onChange={(e) => updateDraft({ position: e.target.value })}
                disabled={saving}
                placeholder="Нападающий"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100"
              />
              <datalist id="team-positions">
                <option value="Вратарь" />
                <option value="Защитник" />
                <option value="Нападающий" />
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Порядок вывода</label>
              <input
                type="number"
                value={draft.sortOrder}
                onChange={(e) => updateDraft({ sortOrder: e.target.value })}
                disabled={saving}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500">Меньше — выше в списке</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Краткое резюме</label>
            <textarea
              rows={4}
              value={draft.bio}
              onChange={(e) => updateDraft({ bio: e.target.value })}
              disabled={saving}
              placeholder="Игровая карьера, сильные стороны, достижения"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100"
            />
          </div>


          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Фото игрока</label>
            <div className="flex items-start gap-4">
              {draft.photoUrl ? (
                <img
                  src={draft.photoUrl}
                  alt="Фото игрока"
                  className="w-28 h-28 object-cover rounded-lg border border-gray-200"
                />
              ) : (
                <div className="w-28 h-28 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                  <Users size={28} />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <label
                  className={`inline-flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg transition-colors ${
                    uploadingImage || saving
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-pointer hover:border-orange-500 hover:bg-orange-50'
                  }`}
                >
                  {uploadingImage ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Upload size={18} />
                  )}
                  <span className="text-sm font-medium">
                    {uploadingImage ? `Загрузка... ${uploadPercent}%` : 'Загрузить фото с компьютера'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={uploadingImage || saving}
                    className="hidden"
                  />
                </label>
                {draft.photoUrl && (
                  <button
                    type="button"
                    onClick={() => updateDraft({ photoUrl: '' })}
                    disabled={saving || uploadingImage}
                    className="block text-sm text-red-600 hover:underline disabled:opacity-40"
                  >
                    Убрать фото
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => void handleSave()}
              disabled={saving || uploadingImage}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              disabled={saving}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:bg-gray-100 disabled:text-gray-400"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {listError && !listLoading && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg bg-red-50 text-red-600">
          <span className="flex items-center gap-2">
            <AlertCircle size={20} className="shrink-0" />
            {listError}
          </span>
          <button
            onClick={() => void loadPlayers()}
            className="shrink-0 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Повторить
          </button>
        </div>
      )}

      {listLoading && players.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
          <Loader2 size={20} className="animate-spin" />
          <span>Загрузка состава...</span>
        </div>
      )}


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {players.map((player) => (
          <div key={player.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="relative h-56 bg-gray-100">
              {player.photo_url ? (
                <img
                  src={player.photo_url}
                  alt={player.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <Users size={48} />
                </div>
              )}
              {player.number !== null && (
                <span className="absolute bottom-0 left-0 bg-orange-500 text-white font-black text-xl px-4 py-1 rounded-tr-xl">
                  #{player.number}
                </span>
              )}
              <span
                className="absolute top-2 right-2 bg-black/60 text-white text-xs font-semibold px-2 py-1 rounded"
                title="Порядок вывода"
              >
                {player.sort_order}
              </span>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 truncate">{player.name}</h3>
                  {player.position && (
                    <p className="text-sm text-orange-600 font-semibold">{player.position}</p>
                  )}
                </div>
                <div className="flex space-x-1 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(player)}
                    disabled={saving || uploadingImage}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40"
                    title="Редактировать"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => void handleDelete(player)}
                    disabled={deletingId !== null}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                    title="Удалить"
                  >
                    {deletingId === player.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                </div>
              </div>
              {player.bio && (
                <p className="mt-2 text-sm text-gray-600 line-clamp-3 whitespace-pre-line">
                  {player.bio}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {!listLoading && !listError && players.length === 0 && !draft && (
        <div className="text-center py-12 text-gray-500">
          <Users size={40} className="mx-auto mb-3 text-gray-300" />
          <p>В составе пока нет игроков. Добавьте первого!</p>
        </div>
      )}
    </div>
  );
}

/** Единый вид уведомления: тип приходит из состояния, а не угадывается по тексту. */
function NoticeBanner({ notice }: { notice: Notice }) {
  const success = notice.kind === 'success';
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg ${
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

