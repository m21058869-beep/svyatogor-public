// Карточки статистики на главной странице ("22 игрока", "28 матчей", ...).
// Раньше значения были захардкожены в компоненте главной; теперь они хранятся
// в site_content (page: stats, section: main) и редактируются в админ-панели.
//
// Модуль общий для клиента и сервера: его импортируют главная страница,
// редактор контента в админ-панели и seed-скрипт (prisma/seed.ts).

/** Одна метрика: крупное значение и подпись под ним. */
export type StatItem = {
  value: string;
  label: string;
};

/** Ключ записи в site_content, в которой лежит блок статистики. */
export const STATS_PAGE = 'stats';
export const STATS_SECTION = 'main';

/** Поле внутри content, в котором лежит массив метрик. */
export const STATS_ITEMS_KEY = 'items';

/** Значения по умолчанию — совпадают с прежней вёрсткой главной страницы. */
export const DEFAULT_STATS: StatItem[] = [
  { value: '22', label: 'Игроков в команде' },
  { value: '28', label: 'Матчей в сезоне' },
  { value: '18', label: 'Побед' },
  { value: '5', label: 'Лет команде' },
];

function toText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

/**
 * Приводит значение к строке без trim.
 * Нужен редактору в админке: он обязан отдавать в input ровно то, что набрал
 * пользователь. С trim «Игроков » схлопывалось бы в «Игроков», React возвращал
 * бы в поле подрезанный текст, а каретка прыгала бы в конец строки.
 */
function toRawText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/** Достаёт массив метрик из content записи site_content (может отсутствовать). */
function readStatItems(content: unknown): unknown[] {
  const raw =
    content && typeof content === 'object' && !Array.isArray(content)
      ? (content as Record<string, unknown>)[STATS_ITEMS_KEY]
      : undefined;
  return Array.isArray(raw) ? raw : [];
}

/**
 * Достаёт метрики из content записи site_content.
 * Всегда возвращает столько же карточек, сколько в DEFAULT_STATS: отсутствующие
 * или повреждённые значения подменяются значениями по умолчанию, поэтому блок
 * на главной не пропадает даже до создания записи в БД.
 *
 * Для формы редактирования этот парсер не подходит — там нужен statsDraft.
 */
export function parseStats(content: unknown): StatItem[] {
  const items = readStatItems(content);

  return DEFAULT_STATS.map((fallback, index) => {
    const item = items[index];
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { ...fallback };

    const record = item as Record<string, unknown>;
    return {
      value: toText(record.value) || fallback.value,
      label: toText(record.label) || fallback.label,
    };
  });
}

/**
 * Черновик метрик для редактора контента в админке.
 *
 * Отличие от parseStats: значения полей берутся как есть, включая пустые строки.
 * Иначе поле «Значение» невозможно было бы очистить — parseStats тут же
 * подставлял значение по умолчанию, и Backspace «съедал» только последнюю цифру,
 * а каретка улетала в конец: React возвращал в input подставленный текст.
 * Значение по умолчанию остаётся только для отсутствующих карточек, чтобы в форме
 * всегда были видны все 4 метрики.
 */
export function statsDraft(content: unknown): StatItem[] {
  const items = readStatItems(content);

  return DEFAULT_STATS.map((fallback, index) => {
    const item = items[index];
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { ...fallback };

    const record = item as Record<string, unknown>;
    return {
      value: toRawText(record.value),
      label: toRawText(record.label),
    };
  });
}

/** Собирает content для записи site_content из списка метрик (seed и админка). */
export function statsContent(items: StatItem[]): { items: StatItem[] } {
  return { items: items.map((item) => ({ value: item.value, label: item.label })) };
}
