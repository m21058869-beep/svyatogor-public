import type { Metadata } from 'next';

import { AboutContent } from './AboutContent';

export const metadata: Metadata = {
  title: 'О нас',
  description:
    'О любительской хоккейной команде «Святогор» из Зеленограда: история клуба, принципы и ценности, тренировки и товарищеские матчи. Хоккей для взрослых любого уровня подготовки.',
};

export default function AboutPage() {
  return <AboutContent />;
}

