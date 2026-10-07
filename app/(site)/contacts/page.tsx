import type { Metadata } from 'next';

import { Contacts } from '@/components/pages/Contacts';

export const metadata: Metadata = {
  title: 'Контакты',
  description:
    'Контакты ХК «Святогор»: почта, телефон и адрес. Как присоединиться к команде или договориться о товарищеском матче в Зеленограде.',
};

export default function ContactsPage() {
  return <Contacts />;
}

