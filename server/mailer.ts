// Отправка писем формы обратной связи через SMTP Timeweb (smtp.timeweb.ru:465).
//
// Транспортер создаётся один раз на процесс: письма с формы уходят редко, но
// пересоздавать TLS-соединение на каждую заявку смысла нет.
import nodemailer from 'nodemailer';
import { env } from './env';

/**
 * Сколько ждём SMTP на каждом шаге (подключение, приветствие, ответ сервера).
 * Без лимитов «задумавшийся» почтовый сервер держал бы запрос формы открытым,
 * а посетитель — бесконечное «Отправляем...».
 */
const SMTP_TIMEOUT_MS = 8_000;

/**
 * Жёсткий предел на всю отправку письма.
 *
 * Ограничений внутри nodemailer мало: у почтового хоста несколько адресов, и при
 * недоступности порта попытка делается по очереди — 15 секунд на каждую. Внешний
 * посетитель столько ждать не должен, поэтому вся отправка целиком ограничена
 * этим дедлайном (клиент в `lib/api.ts` отваливается на 20 секундах).
 */
const SMTP_SEND_DEADLINE_MS = 12_000;

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

/** Заданы ли логин и пароль ящика. Без них форма честно скажет, что почта не настроена. */
export function isMailConfigured(): boolean {
  return env.smtp.user !== '' && env.smtp.pass !== '';
}

/**
 * Закрывает текущее соединение и забывает его. Нужно после дедлайна: следующий
 * запрос должен начать с чистого транспортера, а не с «зависшего» сокета.
 */
function dropTransport(): void {
  const current = transport;
  transport = null;
  if (current !== null) {
    try {
      current.close();
    } catch {
      // Соединение могло уже развалиться само — закрывать нечего, и это не ошибка.
    }
  }
}

export function getMailer(): ReturnType<typeof nodemailer.createTransport> {
  if (!isMailConfigured()) {
    throw new Error('Почта не настроена: не заданы SMTP_USER и SMTP_PASS (см. .env.example)');
  }
  if (transport === null) {
    transport = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      // Порт 465 — неявный TLS (secure: true), 587 — STARTTLS (secure: false).
      secure: env.smtp.secure,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    });
  }
  return transport;
}

/**
 * Отправляет письмо, но не дольше SMTP_SEND_DEADLINE_MS. По истечении дедлайна
 * соединение закрывается, а наружу уходит понятная ошибка — форма покажет
 * «не удалось отправить», а не будет крутить «Отправляем...» до таймаута клиента.
 */
async function sendWithDeadline(
  mailer: ReturnType<typeof nodemailer.createTransport>,
  message: Parameters<ReturnType<typeof nodemailer.createTransport>['sendMail']>[0],
) {
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(new Error(`почтовый сервер не ответил за ${SMTP_SEND_DEADLINE_MS / 1000} секунд`));
    }, SMTP_SEND_DEADLINE_MS);
  });

  try {
    return await Promise.race([mailer.sendMail(message), deadline]);
  } finally {
    clearTimeout(timer);
    if (timedOut) dropTransport();
  }
}

export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/**
 * Убирает переводы строк. Посетитель не должен иметь возможности «подклеить»
 * собственные SMTP-заголовки через имя или тему письма.
 */
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string,
  );
}

/**
 * Отправляет заявку с формы обратной связи на ящик клуба.
 * Возвращает ответ SMTP (messageId) — он попадает в лог приложения.
 */
export async function sendContactMessage(input: ContactMessage) {
  const mailer = getMailer();
  const name = singleLine(input.name);
  const email = singleLine(input.email);
  const subject = singleLine(input.subject) || 'Сообщение с сайта';
  const receivedAt = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

  const rows: Array<[string, string]> = [
    ['Имя', name],
    ['Email', email],
    ['Тема', subject],
    ['Отправлено', receivedAt],
  ];

  const text = [
    'Новая заявка с формы обратной связи на сайте hksvyatogor.ru',
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Сообщение:',
    input.message,
  ].join('\n');

  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111827">',
    '<h2 style="margin:0 0 16px">Новая заявка с сайта hksvyatogor.ru</h2>',
    '<table style="border-collapse:collapse;margin-bottom:16px">',
    ...rows.map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">${escapeHtml(label)}</td>` +
        `<td style="padding:4px 0;font-weight:bold">${escapeHtml(value)}</td></tr>`,
    ),
    '</table>',
    `<div style="padding:12px 16px;background:#f9fafb;border-radius:8px;white-space:pre-wrap">${escapeHtml(input.message)}</div>`,
    '</div>',
  ].join('');

  return sendWithDeadline(mailer, {
    // From обязан совпадать с ящиком авторизации: иначе Timeweb отклонит письмо.
    from: { name: env.smtp.fromName, address: env.smtp.user },
    to: env.smtp.to,
    // Ответ посетителю уйдёт на его адрес, если ответить прямо из почты.
    replyTo: { name, address: email },
    subject: `[Сайт] ${subject}`,
    text,
    html,
  });
}
