import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { env } from '@/server/env';
import { CLUB_LOGO, SITE_DESCRIPTION, SITE_NAME, sportsTeamJsonLd } from '@/lib/seo';

/**
 * Глобальные метаданные сайта.
 *
 * - `title.template` применяется к страницам со своим title (см. `app/(site)/`);
 *   `title.default` показывается на главной.
 * - `metadataBase` превращает относительные адреса (картинка превью, canonical)
 *   в абсолютные — без него соцсети не смогут загрузить превью.
 * - В `openGraph` намеренно нет title/description: Next.js подставляет их из
 *   метаданных страницы, поэтому у каждой страницы корректное превью.
 */
export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: 'ХК «Святогор» — любительская хоккейная команда в Зеленограде',
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'хоккейная команда Святогор',
    'ХК Святогор',
    'любительский хоккей',
    'Зеленоград',
    'хоккей в Зеленограде',
    'хоккейная команда Зеленоград',
  ],
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  robots: { index: true, follow: true },
  // Эмблема клуба из public — браузер показывает её на вкладке и в закладках.
  icons: {
    icon: CLUB_LOGO.path,
    apple: CLUB_LOGO.path,
  },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: SITE_NAME,
    images: [
      {
        url: CLUB_LOGO.path,
        width: CLUB_LOGO.width,
        height: CLUB_LOGO.height,
        alt: CLUB_LOGO.alt,
      },
    ],
  },
  // Карточка `summary`: превью-картинка квадратная, крупный формат её обрезает.
  twitter: { card: 'summary' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        {/*
          Микроразметка Schema.org (SportsTeam): невидимый для гостей JSON-LD,
          из которого Яндекс и Google собирают карточку команды. Стоит на всех
          страницах — команда одна на весь сайт.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsTeamJsonLd()) }}
        />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

