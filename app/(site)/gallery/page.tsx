import type { Metadata } from 'next';

import { Gallery } from '@/components/pages/Gallery';

export const metadata: Metadata = {
  title: 'Фотогалерея',
  description:
    'Фотографии матчей и тренировок хоккейной команды «Святогор» из Зеленограда. Скачивайте снимки в высоком разрешении.',
};

export default function GalleryPage() {
  return <Gallery />;
}

