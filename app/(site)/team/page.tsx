import type { Metadata } from 'next';

import { TeamContent } from './TeamContent';

export const metadata: Metadata = {
  title: 'Состав команды',
  description:
    'Состав хоккейной команды «Святогор» (Зеленоград): игроки, амплуа и игровые номера. Хотите играть в любительский хоккей — напишите нам через страницу контактов.',
};

export default function TeamPage() {
  return <TeamContent />;
}

