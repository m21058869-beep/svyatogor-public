import type { NextRequest } from 'next/server';
import { apiRoute, jsonNoStore } from '@/server/api';
import { ApiError, asObject, jsonBody } from '@/server/validate';
import { env } from '@/server/env';
import { isMailConfigured, sendContactMessage } from '@/server/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Максимальные длины полей формы. */
const LIMITS = { name: 100, email: 200, subject: 150, message: 5000 } as const;

/** Минимальная длина сообщения: отсекаем случайные нажатия кнопки. */
const MIN_MESSAGE_LENGTH = 10;

/** Простая проверка «похоже на адрес»: точную проверку делает уже почтовый сервер. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

/** Не больше пяти заявок с одного адреса за десять минут — форма публичная. */
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
/** Отметки времени последних заявок по IP. Хранятся в памяти процесса (pm2, fork, 1 инстанс). */
const recentByIp = new Map<string, number[]>();

/**
 * Адрес посетителя для лимита заявок.
 *
 * Перед приложением всегда стоит Nginx (см. nginx.conf), он-то и подставляет
 * X-Real-IP / X-Forwarded-For. Клиентский заголовок X-Forwarded-For целиком
 * доверять нельзя — посетитель может подставить туда что угодно, поэтому
 * берём X-Real-IP, а из X-Forwarded-For (если его нет) — последнее значение,
 * которое дописал наш прокси, а не первое, присланное клиентом.
 */
function clientIp(request: NextRequest): string {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',');
    const last = parts[parts.length - 1]?.trim();
    if (last) return last;
  }
  return 'unknown';
}

/**
 * Читает текстовое поле: обрезает пробелы, проверяет тип и длину.
 * Слишком длинное поле — явная ошибка, а не молчаливое обрезание: иначе
 * посетитель думает, что отправил текст целиком.
 */
function text(body: Record<string, unknown>, key: keyof typeof LIMITS): string {
  const value = body[key];
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new ApiError(400, `Поле «${key}» должно быть строкой`);
  }
  const trimmed = value.trim();
  if (trimmed.length > LIMITS[key]) {
    throw new ApiError(400, `Поле «${key}» длиннее ${LIMITS[key]} символов`);
  }
  return trimmed;
}

function checkRateLimit(ip: string): void {
  const now = Date.now();
  const stamps = (recentByIp.get(ip) ?? []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
  if (stamps.length >= RATE_LIMIT_MAX) {
    recentByIp.set(ip, stamps);
    throw new ApiError(
      429,
      `Слишком много сообщений подряд. Подождите несколько минут или напишите нам на ${env.smtp.to}.`,
    );
  }
  stamps.push(now);
  recentByIp.set(ip, stamps);
  // Заодно чистим память: отметки по адресам, которые давно не писали, больше не нужны.
  for (const [key, times] of recentByIp) {
    if (times.every((time) => now - time >= RATE_LIMIT_WINDOW_MS)) recentByIp.delete(key);
  }
}

// POST /api/contact — заявка с формы обратной связи на странице «Контакты».
export const POST = apiRoute(async (request) => {
  const body = asObject(await jsonBody(request));

  const name = text(body, 'name');
  const email = text(body, 'email');
  const subject = text(body, 'subject');
  const message = text(body, 'message');

  if (name === '') throw new ApiError(400, 'Укажите имя');
  if (email === '') throw new ApiError(400, 'Укажите email');
  if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Проверьте email: похоже, в адресе опечатка');
  if (message.length < MIN_MESSAGE_LENGTH) {
    throw new ApiError(400, `Сообщение слишком короткое — нужно хотя бы ${MIN_MESSAGE_LENGTH} символов`);
  }

  checkRateLimit(clientIp(request));

  if (!isMailConfigured()) {
    // 503, а не 500: сервер жив, но отправлять письма пока нечем.
    throw new ApiError(503, `Почта на сайте ещё не настроена. Напишите нам на ${env.smtp.to}.`);
  }

  try {
    const info = await sendContactMessage({ name, email, subject, message });
    console.log(`[contact] письмо от ${email} принято SMTP (${info.messageId ?? 'без messageId'})`);
  } catch (error) {
    // Подробности с паролем/хостом SMTP — только в лог сервера, посетителю — понятный текст.
    console.error('[contact] не удалось отправить письмо:', error);
    throw new ApiError(
      502,
      `Не удалось отправить сообщение. Попробуйте ещё раз или напишите нам на ${env.smtp.to}.`,
    );
  }

  return jsonNoStore({ ok: true });
});
