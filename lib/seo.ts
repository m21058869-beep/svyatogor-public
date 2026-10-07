import { env } from '@/server/env';

/**
 * Общие SEO-константы сайта: их используют корневой layout (метаданные и
 * микроразметка) и страницы блога. Модуль серверный — `env` читает process.env,
 * из клиентских компонентов его импортировать нельзя.
 */

/** Название клуба: заголовки вкладок, OpenGraph, подпись автора статьи. */
export const SITE_NAME = 'ХК «Святогор»';

/** Название клуба в микроразметке — как его пишут в поиске и на афишах. */
export const CLUB_NAME = 'ХК Святогор';

/** Описание по умолчанию — для главной и любой страницы без своего описания. */
export const SITE_DESCRIPTION =
  'ХК «Святогор» — хоккейная команда из Зеленограда. Любительский хоккей для взрослых: состав команды, новости и анонсы матчей, фотографии с игр и контакты для новых игроков.';

/** Эмблема клуба из public: иконка вкладки, превью OpenGraph, обложка статьи без картинки. */
export const CLUB_LOGO = {
  path: '/image_2025-10-07_19-50-30.png',
  width: 1045,
  height: 1132,
  alt: 'Эмблема хоккейной команды «Святогор»',
} as const;

/** Абсолютный адрес: соцсети и поисковики принимают только полные URL. */
export function absoluteUrl(path: string): string {
  return `${env.siteUrl}${path}`;
}

/**
 * Микроразметка Schema.org (JSON-LD) для поисковиков. На странице не видна:
 * Яндекс и Google читают её из HTML и собирают карточку организации.
 */
export function sportsTeamJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: CLUB_NAME,
    alternateName: SITE_NAME,
    sport: 'Ice Hockey',
    description: SITE_DESCRIPTION,
    url: env.siteUrl,
    logo: absoluteUrl(CLUB_LOGO.path),
    location: { '@type': 'Place', name: 'Москва, Зеленоград' },
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Зеленоград',
      addressRegion: 'Москва',
      addressCountry: 'RU',
    },
  };
}

/**
 * Сжимает Markdown-текст статьи в описание для meta-тегов: убирает разметку и
 * html-теги, схлопывает переносы и обрезает по границе слова.
 */
export function toDescription(text: string, limit = 300): string {
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ') // блоки кода
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // картинки
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // ссылки → их текст
    .replace(/<[^>]+>/g, ' ') // html-теги
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '') // заголовки, цитаты, списки
    .replace(/[*_`~]/g, '') // инлайн-выделение
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= limit) {
    return plain;
  }

  const cut = plain.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
