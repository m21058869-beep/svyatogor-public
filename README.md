# 🏒 ХК «Святогор» — официальный сайт

![Next.js 14](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)
![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS 3](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![Prisma 7](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![PostgreSQL 14+](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?logo=postgresql&logoColor=white)

**Рабочий сайт:** <https://hksvyatogor.ru>

## 📖 О проекте

Официальный сайт любительского хоккейного клуба **«Святогор»** (Москва, Зеленоград): состав
команды и карточки игроков, новости и статьи блога, фотогалерея с матчей, контакты для новых
игроков.

Это не статичный лендинг, а полноценное веб-приложение:

- **SSR и React Server Components** — статьи, метаданные и карта сайта собираются на сервере,
  поэтому поисковик получает готовый HTML, а не пустой каркас страницы;
- **SEO из коробки** — `generateMetadata` для каждой страницы, микроразметка Schema.org,
  `robots.txt` и динамический `sitemap.xml`, постоянные адреса статей и корректный код 404;
- **встроенная админ-панель** — контент главной, блог, статистика, состав команды и
  фотогалерея управляются через веб-интерфейс, без правки кода и без пересборки приложения;
- **один Node-процесс** отдаёт и HTML-страницы, и JSON API (`app/api/**/route.ts`) — отдельный
  бэкенд и проксирование `/api` не нужны;
- **данные в PostgreSQL** (доступ через Prisma), **медиа — в S3**-совместимом хранилище.

## 🧱 Стек технологий

| Слой | Технологии |
| --- | --- |
| **Фронтенд** | [Next.js 14](https://nextjs.org/) (App Router), [React 18](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/), [Tailwind CSS 3](https://tailwindcss.com/), [lucide-react](https://lucide.dev/) — иконки, [marked](https://marked.js.org/) — Markdown → HTML |
| **Бэкенд** | Route Handlers Next.js (Node-рантайм), [Prisma 7](https://www.prisma.io/) + `@prisma/adapter-pg`, [PostgreSQL 14+](https://www.postgresql.org/) |
| **Медиа** | S3-совместимое хранилище ([Timeweb Object Storage](https://timeweb.cloud/), MinIO, AWS) через `@aws-sdk/client-s3` |
| **Авторизация** | Собственная: JWT **HS256** ([jose](https://github.com/panva/jose)) в http-only cookie `svy_session` (7 дней), пароль — bcrypt (`bcryptjs`). Supabase Auth не используется |
| **Почта** | [nodemailer](https://nodemailer.com/) → SMTP Timeweb (форма обратной связи) |
| **Инфраструктура** | [Nginx](https://nginx.org/) — реверс-прокси и TLS, [PM2](https://pm2.keymetrics.io/) — процесс-менеджер, VPS Timeweb Cloud |
| **Требования** | Node.js **20+**, PostgreSQL **14+**, S3-бакет, публичный на чтение |

## ✨ Ключевой функционал

### 🛠️ Админ-панель (`/admin`)

Вход по e-mail и паролю; сессия хранится в http-only cookie (`COOKIE_SECURE=true` в
продакшене) и проверяется на сервере в каждом защищённом роуте (`requireAdmin`).

| Вкладка | Возможности |
| --- | --- |
| **Блог** | создание, редактирование и удаление статей, Markdown-редактор с превью, черновик/публикация, обложка в S3 |
| **Фотогалерея** | массовая загрузка фото (файлы уходят по одному), подписи и категории, удаление вместе с объектом в S3 |
| **Команда** | карточки игроков: имя, номер, амплуа, описание, фото; порядок вывода (`sort_order`) |
| **Контент страниц** | тексты главной и внутренних страниц, а также блок **«Статистика»** главной |
| **Заголовки** | заголовки и подзаголовки секций (таблица `section_titles`) |

**Контролируемые числовые поля (блок «Статистика»).** Значения метрик хранятся в базе
строками и редактируются как черновик: поле **«Значение»** можно полностью очистить и набрать
заново — каретка не прыгает в конец, Backspace удаляет ровно один символ, а пустое значение
сохраняется как пустое. Почему так сделано:

- раньше форма рендерилась через `parseStats()` — парсер **публичной** страницы, который
  подставляет значение по умолчанию вместо пустого поля. Как только Backspace оставлял `''`,
  React получал из рендера `'22'` и возвращал его в `input`: визуально стиралась только
  последняя цифра, а при сохранении стёртое значение воскресало;
- теперь редактор использует `statsDraft()` (`lib/stats.ts`): значения берутся **как есть**,
  пустая строка допустима, `trim` намеренно не применяется (иначе каретка прыгает при вводе
  пробела), а значение по умолчанию остаётся только для отсутствующих карточек;
- `parseStats()` оставлен для главной страницы и предпросмотра — там пустое значение
  подменяется дефолтным, и блок статистики никогда не «ломается»;
- у карточек и полей стабильные `key`, поэтому React не перемонтирует инпуты и не теряет
  фокус, а JSON-поля редактора всегда рендерятся строками (`displayValue()`).

Загрузка файлов (multipart) принимается только с того же хоста — сервер сравнивает `Origin` с
`X-Forwarded-Host` (замена готовой CSRF-мидлвари).

### 📝 Блог и SEO

- **Статья по постоянному адресу** — `app/(site)/blog/[id]/page.tsx`: пост читается из базы
  на каждый запрос (`dynamic = 'force-dynamic'`), поэтому публикация или правка в админке
  видны сразу, без пересборки. Ключ — `id`; для совместимости принимается и `slug`.
- **Ссылки старого формата** `/blog?post=<id>` приводятся к `/blog/<id>` постоянным редиректом
  (`permanentRedirect`): накопленный вес переходит на новый адрес, старые ссылки не отдают 404.
- **Метаданные** — `generateMetadata` собирает `title`, `description` (из анонса или из первых
  строк статьи, `toDescription()` в `lib/seo.ts`), `canonical`, OpenGraph и Twitter Card;
  без собственной обложки подставляется эмблема клуба.
- **Микроразметка Schema.org (JSON-LD)** — `SportsTeam` на всех страницах
  (`app/layout.tsx`, `sportsTeamJsonLd()`) и `BlogPosting` на каждой статье (дата публикации,
  обложка, издатель) — поисковик показывает в выдаче дату и картинку.
- **`robots.txt`** — `app/robots.ts`: индексируется весь сайт, закрыты только `/api/` и
  `/admin`; `Sitemap` и `Host` указываются абсолютными (из `SITE_URL`).
- **`sitemap.xml`** — `app/sitemap.ts`: статические страницы сайта **плюс** опубликованные
  посты из БД. Карта собирается на запрос и обёрнута в `try/catch`: если база недоступна,
  поисковик всё равно получит валидную карту, а не ошибку 500.
- **Корректный 404 без «soft 404»** — вокруг `{children}` в `app/(site)/layout.tsx` намеренно
  нет `<Suspense>`: с ним оболочка уходила в ответ раньше страницы, и `notFound()` отдавал
  страницу 404 с кодом **200**, что путает поисковики (для несуществующей статьи в том числе).
- **Черновики скрыты** — неопубликованная статья отдаёт 404 вне админки, а её метаданные
  помечены `robots: { index: false, follow: false }`.

### 👥 Состав команды

Карточки игроков лежат в таблице `players` (имя, номер, амплуа, описание, фото, порядок
вывода `sort_order`) и отдаются публичной страницей `/team`:

- `GET /api/team` — список игроков в порядке `sort_order` (чтение публичное);
- `POST /api/team`, `PUT /api/team/:id`, `DELETE /api/team/:id` — изменение только для админа.

Медиа синхронизировано с S3: при замене фото и при удалении карточки прежний объект
удаляется из бакета (`server/s3.ts` → `deletePublicObjectByUrl`). Сбой хранилища не ломает
ответ — админ всё равно сможет убрать игрока или заменить фото.

### 🖼️ Фотогалерея

- **Загрузка** — `POST /api/upload`: разрешены только растровые форматы (`jpeg`, `png`,
  `webp`, `gif`, `avif`), **SVG запрещён** — он может содержать исполняемый JavaScript.
  Файлы раскладываются по папкам бакета `blog-covers`, `gallery`, `team`; лимит размера —
  `UPLOAD_MAX_MB` (та же величина задана в `nginx.conf` как `client_max_body_size`).
- **Скачивание** — `GET /api/download`: у публичного S3-бакета нет CORS, поэтому браузер
  открывал фото вместо сохранения (атрибут `download` на чужой origin игнорируется). Роут
  забирает объект **на сервере** и отдаёт своим ответом с заголовком
  `Content-Disposition: attachment` — плюс RFC 5987 `filename*`, иначе кириллица в имени файла
  превращается в кракозябры; тело передаётся потоком, без буферизации в памяти.
- **Безопасность прокси** — скачать можно только объекты **своего** бакета (`S3_PUBLIC_URL`),
  иначе роут превратился бы в открытый прокси; конечный адрес после редиректа проверяется
  повторно. Отсутствующий объект отдаёт понятный 404, хотя Timeweb Object Storage отвечает на
  пропавший ключ `403 AccessDenied` — этот случай трактуется так же.

### 📬 Обратная связь

Форма на странице «Контакты» отправляет заявку через `POST /api/contact` на почту клуба по
SMTP (`SMTP_*` в окружении, см. `.env.example`).

## 🚀 Локальная разработка

**Требования:** Node.js 20+, PostgreSQL 14+, S3-бакет (нужен только для работы с медиа).

```bash
git clone https://github.com/m21058869-beep/final-svyatogor-copy.git
cd final-svyatogor-copy
npm install                     # postinstall автоматически выполняет prisma generate

cp .env.example .env            # заполните DATABASE_URL, JWT_SECRET, S3_*
# JWT_SECRET — длинная случайная строка, например: openssl rand -base64 48

npx prisma db push              # создать таблицы по prisma/schema.prisma (то же: npm run db:push)
npm run db:seed                 # базовый контент: site_content, section_titles, статистика
npm run create-admin -- admin@example.com "надёжный-пароль" "Имя Админа"

npm run dev                     # http://localhost:3000, админка — http://localhost:3000/admin
```

Все читаемые переменные окружения перечислены в [`.env.example`](./.env.example) и
разбираются в `server/env.ts`; для запуска минимально нужны `DATABASE_URL`, `JWT_SECRET` и
блок `S3_*`.

**Скрипты (`package.json`):**

| Команда | Назначение |
| --- | --- |
| `npm run dev` | дев-сервер Next.js |
| `npm run build` | `prisma generate && next build` → `.next/` |
| `npm run start` | прод-сервер `next start` (порт из `PORT`) |
| `npm run lint` / `npm run typecheck` | ESLint и `tsc --noEmit` |
| `npm run db:push` | синхронизировать схему с БД (миграций в репозитории нет) |
| `npm run db:migrate` / `npm run db:deploy` | версионные миграции Prisma (локально / в продакшене) |
| `npm run db:seed` | базовые `site_content`, `section_titles` и статистика |
| `npm run db:studio` | Prisma Studio |
| `npm run create-admin -- <email> <пароль> ["Имя"]` | создать администратора |

## 🚢 Деплой

Сайт разворачивается как **приложение Node.js (App / Backend)**, а не как статика: и
HTML-страницы, и API отдаёт один процесс `next start` (порт `3000`), перед ним стоит Nginx
(см. [`nginx.conf`](./nginx.conf)).

**Исчерпывающая инструкция по развёртыванию и настройке VPS находится в файле
[`TIMEWEB_DEPLOY.md`](./TIMEWEB_DEPLOY.md)** — создание приложения, переменные окружения,
PostgreSQL и синхронизация схемы, первый администратор, настройка Nginx и HTTPS, а также
обновление кода на сервере через `git bundle` и `pm2 restart`.

Кратко, продакшен-сборка и запуск:

```bash
npm ci                         # установка зависимостей (выполняет prisma generate)
npm run db:push                # синхронизировать схему с БД
npm run build                  # prisma generate && next build
NODE_ENV=production npm start  # next start, слушает PORT (по умолчанию 3000)
```

Проверка после выката: `curl -s http://127.0.0.1:3000/api/health` → `{"ok":true}`.

## 📁 Структура проекта

```
app/                 маршруты Next.js
├─ (site)/           публичные страницы: /, /team, /blog, /blog/[id], /gallery, /about, /contacts
├─ admin/            страница админ-панели
├─ api/              Route Handlers: auth, content, section-titles, blog, gallery, team, upload, download, contact, health
├─ layout.tsx        глобальные метаданные, иконки, микроразметка SportsTeam
├─ robots.ts         /robots.txt
└─ sitemap.ts        /sitemap.xml (страницы сайта + посты из БД)
components/          UI: публичные страницы, Header/Footer, RichTextEditor, админ-панель (components/pages/admin)
contexts/            AuthContext — сессия администратора
lib/                 общие модули: api.ts (fetch-обёртка), seo.ts, stats.ts, useNavigate.ts
server/              серверный слой: env, db, auth, s3, mailer, validate, api, defaults, scripts/
prisma/              schema.prisma и seed.ts
nginx.conf           пример конфигурации реверс-прокси
TIMEWEB_DEPLOY.md    подробная инструкция по деплою на VPS
```

## ✅ Качество кода

Перед коммитом прогоняются линт и проверка типов, а прод-сборка Next.js должна проходить без
ошибок:

```bash
npm run lint && npm run typecheck && npm run build
```

---

© ХК «Святогор» — любительский хоккей в Зеленограде.
