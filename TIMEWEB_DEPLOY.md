# Инструкция по деплою на Timeweb Cloud

## Как устроено приложение

Это полноценное fullstack-приложение, а **не статичный сайт**. Оно построено на **Next.js 14
(App Router)**, и страницы, и API отдаёт один Node-процесс:

- Страницы — React-компоненты в `app/(site)/**` и `app/admin/page.tsx`. Публичные страницы
  экспортируют метаданные (`title`, `description`, OpenGraph) — базовые в `app/layout.tsx`,
  свои у каждой страницы; см. раздел «SEO и индексация».
- Статья блога — динамический серверный маршрут `app/(site)/blog/[id]/page.tsx`: свой `title`,
  `description` и `og:image` из данных поста (`generateMetadata`), текст статьи рендерится на
  сервере. Ссылки старого формата `/blog?post=<id>` приводятся к `/blog/<id>` постоянным
  редиректом (`permanentRedirect` в `app/(site)/blog/page.tsx`).
- Техническое SEO — `app/robots.ts` (отдаётся как `/robots.txt`), `app/sitemap.ts`
  (отдаётся как `/sitemap.xml`: статические маршруты + опубликованные посты блога из БД) и
  микроразметка Schema.org `SportsTeam` в `app/layout.tsx` (`lib/seo.ts`).
- API — Route Handlers в `app/api/**/route.ts`: `/api/health`, `/api/auth/{login,logout,me}`,
  `/api/content`, `/api/section-titles`, `/api/blog`, `/api/gallery`, `/api/team`, `/api/upload`,
  `/api/contact`,
  `/api/download` (галерея: отдаёт картинку из S3 как файл с `Content-Disposition: attachment` —
  у бакета нет CORS, поэтому прямая ссылка на фото открывается, а не скачивается; отсутствующий
  объект тоже отдаётся как 404 «Изображение не найдено», хотя Timeweb Object Storage отвечает
  на пропавший ключ 403 AccessDenied, а не 404).
  `/api/team` — состав команды: чтение публичное, запись только для админа; при удалении карточки
  игрока и при замене его фото прежний объект удаляется из S3 (`server/s3.ts`).
  `/api/contact` принимает заявку с формы обратной связи и отправляет её на почту клуба
  через SMTP Timeweb (`SMTP_*` в `.env`, см. `.env.example`).
- Данные хранятся в PostgreSQL, доступ — через Prisma (`prisma/schema.prisma`, клиент генерируется
  в `server/generated/prisma`).
- Изображения загружаются в S3-совместимое хранилище и раздаются по публичному URL.
- Авторизация администратора — собственная: сессия в http-only cookie `svy_session`
  (JWT HS256, библиотека `jose`).

Поэтому деплой — это **приложение с Node.js (App / Backend)**, а не «Frontend» со статикой.

## Что понадобится

1. **Node.js 20+** (проект собран и проверен на Node 20, совместим с Node 22).
2. **PostgreSQL 14+** — база данных Timeweb Cloud или собственный сервер.
3. **S3-бакет** — Timeweb Object Storage, MinIO или AWS. Бакет должен быть публичным на чтение
   (картинки отдаются напрямую по URL).
4. **Переменные окружения** — полный список с пояснениями в файле `.env.example`.

## Локальный запуск

```bash
cp .env.example .env          # заполните DATABASE_URL, JWT_SECRET и S3_*
npm install                   # выполнит prisma generate (postinstall)

npm run db:push                      # создаст таблицы по prisma/schema.prisma
# или версионные миграции: npx prisma migrate dev --name init
npm run db:seed                      # базовые site_content и section_titles
npm run create-admin -- admin@example.com "надёжный-пароль" "Имя Админа"

npm run dev                   # Next.js на http://localhost:3000
```

Страницы и API живут в одном процессе, поэтому проксировать `/api` и настраивать CORS не нужно:
клиент (`lib/api.ts`) обращается к тому же origin.

## Продакшен-сборка и запуск

```bash
npm ci
npm run db:push               # синхронизировать схему с БД (каталога prisma/migrations пока нет)
npm run build                 # prisma generate && next build -> .next/
NODE_ENV=production npm start # next start, слушает PORT (по умолчанию 3000)
```

`next start` — это и есть сервер приложения: он отдаёт и HTML-страницы, и JSON по `/api/*`.
Отдельный веб-сервер для статики не нужен и вреден (см. «Частые проблемы», п. 2).

## Деплой на Timeweb Cloud (приложение Node.js)

1. Панель управления → **Приложения** → создать приложение типа **Node.js / Backend**.
2. Подключите git-репозиторий проекта.
3. **Команда сборки:** `npm ci && npx prisma generate && npm run build`
4. **Команда запуска:** `npm run start`
5. **Порт** приложения: `3000` (или задайте свой через переменную `PORT`).
6. Пропишите переменные окружения из `.env.example`. Обязательно:
   - `NODE_ENV=production`
   - `COOKIE_SECURE=true` (cookie сессии только по HTTPS)
   - `DATABASE_URL`, `JWT_SECRET`, `S3_*`
   - `SITE_URL` — канонический домен сайта; без него метаданные и `sitemap.xml` будут ссылаться
     на значение по умолчанию `https://hksvyatogor.ru`
7. Синхронизируйте схему с БД — один раз по SSH: `npm run db:push`. Каталога `prisma/migrations`
   в репозитории нет, поэтому `prisma migrate deploy` пока нечего применять; если позже заведёте
   миграции (`npm run db:migrate -- --name init`), добавьте `prisma migrate deploy` в релиз.
8. Создайте администратора: `npm run create-admin -- <email> <пароль> ["Имя"]`
9. Привяжите домен и включите HTTPS.

Секреты нужны только запущенному процессу: `next build` импортирует модули Route Handlers, чтобы
прочитать их конфиг, но не требует переменных времени выполнения (`server/buildPhase.ts`).

## Обновление кода на нашем VPS (pm2)

Сервер развёрнут из каталога `/var/www/svyatogor` и не имеет доступа к git-remote проекта,
поэтому свежий код переносится одним файлом-пакетом (`git bundle`). Команды с рабочей машины:

```bash
cd final-svyatogor-copy
git bundle create /tmp/svyatogor.bundle main      # полная ветка, доли мегабайта
scp /tmp/svyatogor.bundle root@<IP-сервера>:/root/deploy/
git push origin main                              # бандл не отменяет обычный пуш в origin
```

На сервере:

```bash
cd /var/www/svyatogor
git fetch /root/deploy/svyatogor.bundle main:refs/remotes/bundle/main
git merge --ff-only refs/remotes/bundle/main
npm run db:push                                   # только если менялась prisma/schema.prisma
npm run build                                     # обязательная пересборка .next/
pm2 restart svyatogor --update-env                # перечитать .env и подхватить новый бандл
curl -s http://127.0.0.1:3000/api/health          # ожидаем {"ok":true}
rm /root/deploy/svyatogor.bundle
```

Нюансы:

- Если `git bundle` отказывается с сообщением `Refusing to create empty bundle`, собирайте пакет
  из всей ветки (`git bundle create <файл> main`), а не из диапазона `A..B`.
- `ecosystem.config.cjs` (конфиг pm2) лежит только на сервере и не коммитится — в `git status`
  он виден как `??`. Правки в нём не мешают `git merge --ff-only`.
- `.env` процесс читает сам через `server/loadEnv.ts`, поэтому после изменения переменных
  достаточно `pm2 restart svyatogor --update-env` — пересборка не нужна.
- После `git merge` **с изменениями кода** без пересборки сайт продолжит отдавать прежний
  `.next/` (см. «Частые проблемы», п. 3).

## Nginx перед приложением (опционально)

```nginx
server {
    listen 80;
    server_name svyatogor.example;

    # Лимит тела запроса. Админка отправляет фото по одному, но с запасом на
    # тяжёлые пакеты ставим 150m — столько же, сколько UPLOAD_MAX_MB.
    client_max_body_size 150m;
    # Медленный канал: не обрываем долгую загрузку между пакетами данных.
    client_body_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        # Нужен для проверки CSRF/Origin при multipart-загрузке изображений.
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        # Запись крупного файла в S3 может занять больше минуты.
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

Готовый пример лежит в `nginx.conf`. Заголовок `X-Forwarded-Host` обязателен: сервер сверяет с ним
`Origin` при загрузке файлов (`app/api/upload/route.ts`).

## Структура роутинга — важно не сломать

1. `app/api/**/route.ts` — API. Next.js разводит методы сам: `405 Method Not Allowed` возможен
   только если конкретный метод не экспортирован из модуля маршрута.
2. Ошибки всегда JSON. Обёртка `apiRoute` (`server/api.ts`) превращает `ApiError`, ошибки Prisma
   `P2002`/`P2025` и любые прочие исключения в `{ error }` с кодами 400/401/403/404/409/500.
3. Аутентификация — `requireAdmin` (`server/auth.ts`): читает cookie из `NextRequest`, при
   отсутствии/подделке токена отдаёт `401 {"error":"Требуется авторизация"}`.
4. Валидация — `server/validate.ts` (обязательные поля, uuid из URL, `limit`, размер загрузки) —
   та же логика, что была у прежнего Hono-сервера.
5. Страницы — `app/(site)/layout.tsx` (общий Header/Footer) и `app/(site)/{page,about,blog,
   gallery,contacts}/page.tsx`; админка — `app/admin/page.tsx` с гейтом по `/api/auth/me`.

Быстрая проверка инварианта (после `npm run start`):

```bash
curl -s -i http://127.0.0.1:3000/api/health                 # 200 + Content-Type: application/json
curl -s -o /dev/null -w 'POST /api/auth/login -> %{http_code}\n' -X POST \
  -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:3000/api/auth/login
# ожидаем JSON-код (400/401); HTML и 405 с «Allow: GET, HEAD» быть не должно
```

## Частые проблемы

**1. `/api/*` возвращает `index.html` вместо JSON** → на клиенте это выглядит как
`TypeError: ... is null`. Значит запросы `/api` не доходят до Node-процесса. Проверьте, что тип
приложения — **Node.js / Backend**, команда запуска — `npm run start`, и что порт указывает на
этот процесс. Дополнительный признак описан в п. 2.

**2. `405 Method Not Allowed` с заголовком `Allow: GET, HEAD`** на `POST /api/*` (админка пишет
«Ошибка запроса (405) … Сервер ответил не-JSON»). Это подпись **статического файлового сервера**:
он умеет отдавать только `GET`/`HEAD`, поэтому любой `POST` отвергается ещё до Node, а `GET`
уходит в отдачу HTML. Именно из-за этой проблемы приложение переведено на Next.js: и HTML, и API
отдаёт один процесс `next start`, и такое поведение возможно только если перед приложением стоит
свой статический сервер/SPA-раздача. Уберите её либо проксируйте **весь** трафик на Node
(в `nginx.conf` это делает `location /`).

**3. Изменения не видны после деплоя** → каталог `.next/` — артефакт сборки, он не коммитится
(см. `.gitignore`) и пересоздаётся командой `npm run build`. Если сайт остался прежним, проверьте
логи сборки и что запускается именно свежий релиз.

**4. Форма на «Контактах» отвечает `502`, в логе приложения `Connection timeout` (`ETIMEDOUT`,
command: 'CONN'`)** → сервер не может открыть соединение с `smtp.timeweb.ru`. У Timeweb исходящие
SMTP-порты (`25`, `465`, `587`) для VPS закрыты по умолчанию (защита от рассылки спама), при этом
IMAP и почта других провайдеров с того же сервера работают. Проверка прямо на сервере:

```bash
timeout 8 bash -c 'cat < /dev/null > /dev/tcp/smtp.timeweb.ru/465' && echo "порт открыт" || echo "порт закрыт"
```

Если порт закрыт — обратитесь в поддержку Timeweb с просьбой открыть исходящие `25/465/587`
для IP сервера (в панели VPS это делается запросом в поддержку). Код приложения тут ни при чём:
отправка ограничена 12 секундами (`server/mailer.ts`), поэтому посетитель увидит понятное
«Не удалось отправить сообщение», а не бесконечное «Отправляем...».

Для нашего сервера порты открыты поддержкой Timeweb 06.10.2026. Если `502` появился снова, сначала
повторите проверку порта выше и приветствие SMTP:

```bash
timeout 12 openssl s_client -connect smtp.timeweb.ru:465 -quiet </dev/null 2>/dev/null | head -1
# ожидаем: 220 smtp.timeweb.ru ESMTP
```

Затем смотрите логи приложения — `pm2 logs svyatogor`.

## Проверка после деплоя

1. `GET /api/health` должен вернуть `{"ok":true}`.
2. `POST /api/auth/login` (например, формой входа) не должен возвращать `405` и HTML — только JSON.
   Ожидаемые ответы: `400` (пустое тело), `401` (неверный пароль) или `200`.
3. Откройте главную страницу и внутренние маршруты (`/about`, `/team`, `/blog`, `/gallery`, `/contacts`).
   В исходном коде страницы («Просмотр кода страницы») у каждой должен быть свой заголовок вида
   `Раздел | ХК Святогор` — см. раздел «SEO и индексация».
4. Проверьте SEO-файлы: `curl -s https://hksvyatogor.ru/robots.txt` (правила и ссылка на карту) и
   `curl -s https://hksvyatogor.ru/sitemap.xml` (все страницы и опубликованные посты блога).
5. Войдите в админку (`/admin`), создайте пост и загрузите изображение — так вы проверите
   авторизацию, БД и S3 разом. Опубликованный пост сразу появляется в `/sitemap.xml` (карта
   собирается на каждый запрос, пересборка не нужна). Ссылка «Вернуться на сайт» на странице входа
   и в шапке панели должна уводить на главную.
6. Отправьте тестовую заявку с формы на «Контактах» — письмо должно прийти на `CONTACT_TO_EMAIL`
   (`info@hksvyatogor.ru`). Ответ `502` означает, что сервер не может соединиться с SMTP:
   см. «Частые проблемы», п. 4. Успешная отправка видна в логе (`pm2 logs svyatogor`) строкой
   `[contact] письмо от <адрес> принято SMTP (<message-id>)` — тот же `message-id` есть в
   заголовках полученного письма.

## SEO и индексация

Что уже сделано в коде:

- **Метаданные** (`app/layout.tsx`): `title` с шаблоном «`%s | ХК Святогор`» (страница задаёт только
  короткое название, например `title: 'Состав команды'`), `description`, `keywords`, OpenGraph
  (`og:title`, `og:description`, `og:image` — эмблема клуба из `public/`) и `twitter:card`.
  `metadataBase` берётся из `SITE_URL`, поэтому соцсети получают абсолютные адреса превью.
- **Страница со своими метаданными обязана быть серверным компонентом**: `export const metadata`
  нельзя объявить в файле с `'use client'`. Поэтому рядом с `app/(site)/{about,team}/page.tsx`
  лежат клиентские части (`AboutContent.tsx`, `TeamContent.tsx`) с хуками навигации, а сам
  `page.tsx` остаётся серверным. Список статей блога — клиентский компонент
  `components/pages/Blog.tsx`, который серверная `app/(site)/blog/page.tsx` рендерит как есть
  (карточки — настоящие ссылки `/blog/<id>`, поэтому поисковик видит адреса статей в HTML).
- **Метаданные статьи** (`app/(site)/blog/[id]/page.tsx`) строит `generateMetadata`: заголовок
  поста (в общий шаблон «`%s | ХК Святогор`»), описание из анонса, а без анонса — из первых строк
  текста (`toDescription`), `og:image` — обложка поста, без обложки — эмблема клуба;
  `alternates.canonical` указывает постоянный адрес `/blog/<id>`. Черновик (`published = false`)
  отдаёт 404. Текст статьи рендерится на сервере (`marked`, `async: false`), поэтому поисковик
  получает готовый HTML, а не пустой контейнер.
- **`/robots.txt`** (`app/robots.ts`): индексация разрешена (`Allow: /`), закрыты только `/api/` и
  `/admin`; указаны `Sitemap` и `Host` (директива Яндекса).
- **`/sitemap.xml`** (`app/sitemap.ts`) собирается на каждый запрос (`dynamic = 'force-dynamic'`)
  и содержит `/`, `/team`, `/blog`, `/gallery`, `/about`, `/contacts` плюс все опубликованные
  (`published = true`) посты блога по адресам `/blog/<id>`. Если БД недоступна, отдаётся карта
  только со статическими страницами — вместо ошибки 500.
- **Микроразметка Schema.org** (`lib/seo.ts` + `app/layout.tsx`): невидимый для гостей
  `<script type="application/ld+json">` с типом `SportsTeam` — название клуба, `sport`
  (`Ice Hockey`), город (`location` и `address`), логотип и адрес сайта из `SITE_URL`. Статьи
  дополнительно размечены как `BlogPosting` (заголовок, описание, обложка, даты, издатель).
- **`notFound()` внутри группы `(site)` отдаёт честный 404 только без `<Suspense>` вокруг
  `{children}`** в `app/(site)/layout.tsx`. С границей Suspense оболочка (включая фолбэк
  «Загрузка...») уходит в ответ раньше страницы, статус фиксируется как `200`, и поисковик
  получает «мягкий 404» — страницу 404 с кодом 200. Границы Suspense нужны только страницам
  с `useSearchParams`; таких в проекте нет, поэтому оболочка рендерится целиком.

Проверка после деплоя:

```bash
curl -s https://hksvyatogor.ru/robots.txt
curl -s https://hksvyatogor.ru/sitemap.xml | head -30
curl -s https://hksvyatogor.ru/team | grep -o '<title>[^<]*</title>'   # Состав команды | ХК «Святогор»
# статья: id берётся из /sitemap.xml
curl -s https://hksvyatogor.ru/blog/<id> | grep -o '<title>[^<]*</title>'  # Заголовок поста | ХК «Святогор»
curl -s https://hksvyatogor.ru/blog/<id> | grep -c 'application/ld+json'   # 2: BlogPosting статьи + SportsTeam
curl -sI 'https://hksvyatogor.ru/blog?post=<id>' | grep -iE '^(HTTP|location)'  # 308 → /blog/<id>
```

Регистрация в поисковиках:

1. Убедитесь, что `SITE_URL` в `.env` равен рабочему домену (`https://hksvyatogor.ru`); после
   изменения переменной достаточно `pm2 restart svyatogor --update-env` — пересборка не нужна.
2. Яндекс.Вебмастер → «Индексирование» → «Файлы Sitemap»: добавьте `https://hksvyatogor.ru/sitemap.xml`.
3. Google Search Console → «Файлы Sitemap»: добавьте `sitemap.xml`.
4. Превью ссылок проверяйте отладчиками: Telegram (`@WebpageBot`), VK, Facebook Sharing Debugger.
   Если превью не подтягивается, причина обычно одна — не задан или задан неверно `SITE_URL`.

Адрес статьи — `/blog/<id>` (uuid поста), а не слаг: в базе `slug` заполнен кириллицей
(например «`расписание-`») и в URL без кодирования не годится. Роут принимает и `slug` — так же
как `/api/blog/:idOrSlug`, — поэтому ссылки по слагу тоже работают.

Что ещё стоит сделать для индексации статей:

1. Перевести слаги постов на латиницу и отдавать адреса `/blog/<slug>` — человекочитаемая ссылка
   лучше ранжируется и выглядит в выдаче; роут уже умеет искать по `slug`.
2. Сделать горизонтальную обложку 1200×630 для превью в соцсетях: сейчас у статей без своей
   картинки используется квадратная эмблема клуба, поэтому выбран формат карточки `summary`.

## Устаревшие файлы (удалены)

Вместе с переходом на Next.js удалены артефакты прежней SPA-архитектуры: `vite.config.ts`,
`index.html`, `dist/`, `tsconfig.app.json`, `tsconfig.node.json`, `.bolt/`, а также Hono-сервер
(`server/index.ts`, `server/routes/`). Ранее были удалены `public/_redirects`, `public/.htaccess`,
`public/nginx.conf`, `public/nginx-timeweb.conf`, `.htaccess` и `.timewebrc` — они остались от
статичной раздачи фронтенда. Единственный актуальный конфиг nginx — корневой `nginx.conf`.

## Бывшая версия на Supabase

Раньше проект использовал Supabase (БД + Auth + Storage): каталог `supabase/migrations`,
файл `public/config.js` и библиотека `@supabase/supabase-js` удалены, фронтенд обращается
к собственному API через `lib/api.ts`.

## Если раньше видели 404

Старые 404 возникали из-за статичной раздачи без SPA-fallback. Сейчас все маршруты описаны
файлами в `app/`, поэтому несуществующий адрес отдаёт 404 самого Next.js, а несохранённая
запись в API — `404 {"error":"Запись не найдена"}`. Если 404 приходит на реально существующий
внутренний маршрут, значит его нет в `app/(site)/**` — добавьте `page.tsx`.

## Поддержка

Если проблема сохраняется, обратитесь в поддержку Timeweb Cloud — но приложите логи
Node-приложения: почти все ошибки (нет БД, нет S3, не задан `JWT_SECRET`) видны там.
