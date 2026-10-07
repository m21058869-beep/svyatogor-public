import './loadEnv';
import { isBuildPhase } from './buildPhase';

function required(name: string): string {
  const value = process.env[name];
  if (value) {
    return value;
  }
  // См. server/buildPhase.ts: на сборке значения не нужны, в рантайме — обязательны.
  if (isBuildPhase) {
    return '';
  }
  throw new Error(`Не задана переменная окружения ${name} (см. .env.example)`);
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

const isProduction = process.env.NODE_ENV === 'production';

export const env = {
  isProduction,
  port: Number(optional('PORT', '8787')),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  cookieSecure: optional('COOKIE_SECURE', isProduction ? 'true' : 'false') === 'true',
  uploadMaxMb: Number(optional('UPLOAD_MAX_MB', '10')),
  /**
   * Канонический адрес сайта. Нужен там, где поисковикам и соцсетям требуются
   * абсолютные ссылки: метаданные (metadataBase, превью OpenGraph), robots.txt
   * и sitemap.xml. Хранится без завершающего слэша — к нему приклеиваются пути.
   */
  siteUrl: optional('SITE_URL', 'https://hksvyatogor.ru').replace(/\/+$/, ''),
  s3: {
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: optional('S3_REGION', 'ru-1'),
    bucket: optional('S3_BUCKET', ''),
    accessKeyId: optional('S3_ACCESS_KEY_ID', ''),
    secretAccessKey: optional('S3_SECRET_ACCESS_KEY', ''),
    forcePathStyle: optional('S3_FORCE_PATH_STYLE', 'true') === 'true',
    publicUrl: optional('S3_PUBLIC_URL', '').replace(/\/+$/, ''),
  },
  /**
   * Почта для формы обратной связи. Значения не обязательные: без SMTP_USER и
   * SMTP_PASS сайт продолжает работать, а форма честно сообщает о ненастроенной
   * почте вместо непонятной 500. Значения по умолчанию — сервер Timeweb.
   */
  smtp: {
    host: optional('SMTP_HOST', 'smtp.timeweb.ru'),
    /** 465 — неявный TLS (secure: true), 587 — STARTTLS (secure: false). */
    port: Number(optional('SMTP_PORT', '465')),
    secure: optional('SMTP_SECURE', 'true') === 'true',
    /** Ящик, от имени которого уходят письма (он же логин SMTP). */
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    /** Куда приходят заявки с формы обратной связи. */
    to: optional('CONTACT_TO_EMAIL', 'info@hksvyatogor.ru'),
    /** Отображаемое имя отправителя в заголовке From. */
    fromName: optional('SMTP_FROM_NAME', 'ХК «Святогор»'),
  },
};
