const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ошибка с HTTP-статусом. Перехватывается обёрткой apiRoute (server/api.ts)
 * и превращается в JSON `{ error }` — так же, как раньше это делал onError в Hono.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function badRequest(message: string): never {
  throw new ApiError(400, message);
}

export function notFound(message = 'Запись не найдена'): never {
  throw new ApiError(404, message);
}

/** Проверяет id из URL: некорректный uuid трактуем как отсутствующую запись. */
export function uuidParam(params: Record<string, string>, name = 'id'): string {
  const value = params[name];
  if (!value || !isUuid(value)) notFound();
  return value;
}

export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    badRequest('Некорректный JSON в теле запроса');
  }
}

export function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    badRequest('Ожидался JSON-объект');
  }
  return value as Record<string, unknown>;
}

export function requiredString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value.trim() === '') {
    badRequest(`Поле "${key}" обязательно`);
  }
  return value;
}

/** undefined — поле не передано; null — явно очищено. */
export function optionalString(body: Record<string, unknown>, key: string): string | null | undefined {
  const value = body[key];
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') badRequest(`Поле "${key}" должно быть строкой`);
  return value;
}

export function optionalBoolean(body: Record<string, unknown>, key: string): boolean | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') badRequest(`Поле "${key}" должно быть boolean`);
  return value;
}

/**
 * undefined — поле не передано; null — явно очищено (например, пустой номер игрока).
 * Принимает и число, и числовую строку (input type="number" в админке шлёт строку);
 * пустая строка трактуется как «значение не задано» (null).
 */
export function optionalInt(body: Record<string, unknown>, key: string): number | null | undefined {
  const value = body[key];
  if (value === undefined || value === null) return value;
  if (typeof value === 'string' && value.trim() === '') return null;
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  const parsed = typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isInteger(parsed)) badRequest(`Поле "${key}" должно быть целым числом`);
  return parsed;
}

export function limitQuery(request: Request, max = 100): number | undefined {
  const raw = new URL(request.url).searchParams.get('limit');
  if (raw === null) return undefined;
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1) badRequest('Параметр limit должен быть положительным целым');
  return Math.min(limit, max);
}
