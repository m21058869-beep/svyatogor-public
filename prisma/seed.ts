import { prisma } from '../server/db';
import { DEFAULT_SECTION_TITLES } from '../server/defaults';
import { DEFAULT_STATS, STATS_PAGE, STATS_SECTION, statsContent } from '../lib/stats';

// Базовые данные из бывших миграций Supabase. Существующие записи не перезаписываются.
const DEFAULT_SITE_CONTENT = [
  {
    page: 'home',
    section: 'hero',
    content: {
      title: 'Хоккейная команда Святогор',
      subtitle: 'Москва • Зеленоград • Рад',
      description: 'Любительская хоккейная команда с богатой историей и традициями',
    },
  },
  {
    // Карточки статистики на главной странице (редактируются в админ-панели).
    page: STATS_PAGE,
    section: STATS_SECTION,
    content: statsContent(DEFAULT_STATS),
  },
  {
    page: 'about',
    section: 'main',
    content: {
      title: 'О команде',
      content:
        'Хоккейная команда Святогор была основана любителями хоккея, которые объединились общей страстью к этому виду спорта. Мы регулярно тренируемся и участвуем в любительских турнирах.',
    },
  },
  {
    page: 'contacts',
    section: 'main',
    content: {
      title: 'Контакты',
      email: 'info@hksvyatogor.ru',
      phone: '+7 (XXX) XXX-XX-XX',
      address: 'Москва, Зеленоград',
    },
  },
];

async function main() {
  const content = await prisma.siteContent.createMany({
    data: DEFAULT_SITE_CONTENT,
    skipDuplicates: true,
  });
  const titles = await prisma.sectionTitle.createMany({
    data: DEFAULT_SECTION_TITLES,
    skipDuplicates: true,
  });
  console.log(`Seed: site_content +${content.count}, section_titles +${titles.count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
