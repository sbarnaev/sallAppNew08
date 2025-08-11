## Карта кода проекта (SAL App)

Краткое описание структуры кода, ответственности директорий и ключевых файлов. Проект на Next.js (App Router, TypeScript, Tailwind). Backend-прокси реализован через API-роуты Next.js, основная БД и авторизация — в Directus, автоматизация — в n8n.

### Корень проекта
- `package.json` — скрипты, зависимости.
- `next.config.mjs` — конфигурация Next.js.
- `tailwind.config.ts`, `postcss.config.js` — стили.
- `.env`, `.env.local` — переменные окружения:
  - `NEXT_PUBLIC_BASE_URL` — базовый URL фронтенда.
  - `DIRECTUS_URL` или `NEXT_PUBLIC_DIRECTUS_URL` — URL инстанса Directus.
  - `N8N_CALC_URL`, `N8N_QA_URL` — вебхуки n8n.
  - `DIRECTUS_STATIC_TOKEN` — статический токен (опционально).

### `app/` — App Router и страницы
- `layout.tsx` — общий макет сайта (глобальная навигация/стили).
- `globals.css` — глобальные стили.
- `page.tsx` — корневая страница (редиректы на логин/дашборд по необходимости).

#### `app/(auth)/` — публичная зона
- `login/page.tsx` — страница входа. Делает POST на `/api/login`, сохраняет httpOnly куки `directus_access_token` и `directus_refresh_token`.

#### `app/(protected)/` — защищённая зона (после логина)
- `layout.tsx` — общий макет для защищённых страниц (навигация, проверка авторизации UI-уровня).

- `dashboard/page.tsx` — дашборд после входа.

- `clients/`
  - `page.tsx` — список клиентов. Вызывает внутренний API `/api/clients`, отображает карточки клиентов, поиск (UI), пагинация.
  - `new/page.tsx` — форма создания клиента (client component). POST в `/api/clients` с полями: имя/фамилия, дата рождения, телефон, email, источник, способ связи. Обрабатывает 401 (редирект на логин).
  - `[id]/page.tsx` — карточка клиента: контактные данные, быстрые действия, список расчётов клиента с пагинацией. Источники данных — `/api/clients/[id]` и `/api/profiles` с фильтром по `client_id`.

- `profiles/`
  - `page.tsx` — список расчётов (при необходимости).
  - `new/page.tsx` — создание расчёта (интеграция с n8n, вебхук для расчёта профиля).
  - `[id]/page.tsx` — детали расчёта.

- `consultations/`
  - `page.tsx`, `[id]/page.tsx` — список и детали консультаций.

### `app/api/` — серверные API-роуты (прокси к Directus/n8n)
Все роуты работают на сервере, используют httpOnly куки для аутентификации, обращаются к `process.env.*`.

- `login/route.ts` — логин в Directus (`/auth/login`), установка access/refresh токенов в httpOnly куки.
- `logout/route.ts` — логаут, очистка кук.
- `refresh/route.ts` — обновление токена по `directus_refresh_token` (POST на `DIRECTUS_URL/auth/refresh`), перезапись кук.
- `me/route.ts` — получение текущего пользователя из Directus (`/users/me`).

- `clients/route.ts`
  - `GET` — получение списка клиентов из Directus `/items/clients`.
    - Поля: `id,name,birth_date,email,phone,source,communication_method,created_at,owner_user`.
    - Фильтрация: по текущему пользователю (через `/users/me` и фильтр `owner_user=_eq:<id>`).
  - `POST` — создание клиента в Directus `/items/clients`.
    - Формирует `name` из имени/фамилии, проставляет `owner_user` по текущему пользователю.
    - Обрабатывает истечение токена: при `401 Token expired.` вызывает `/api/refresh`, повторяет запрос.

- `clients/[id]/route.ts`
  - `GET` — детали клиента по ID. Поля: `id,name,birth_date,email,phone,source,communication_method,created_at,owner_user`.

- `profiles/route.ts`, `profiles/[id]/route.ts` — работа с расчётами (получение списка/деталей). Создание может дергать n8n.

- `consultations/route.ts`, `consultations/[id]/route.ts`, `consultations/[id]/details/route.ts` — работа с консультациями (список/детали/доп.данные).

- `calc/route.ts` — прокси к n8n для расчёта профиля (POST на `N8N_CALC_URL`).
- `qa/route.ts` — прокси к n8n для вопросов-ответов (POST на `N8N_QA_URL`).

### `lib/` — клиентские и серверные утилиты
- `fetchers.ts` — вспомогательные функции для обращений к внутренним API (например, `internalApiFetch`), `refreshToken()`.
- `cookies.ts` — работа с куками.
- `guards.ts` — потенциальные guard-хелперы для доступа/ролей.
- `types.ts` — общие типы данных.

### `components/` — UI-компоненты
- `Nav.tsx`, `Sidebar.tsx` — навигация и сайдбар.
- `Card.tsx`, `Button.tsx` — базовые UI-компоненты.

### Потоки данных (важно понимать)
1) Пользователь логинится на странице `/(auth)/login` → POST `/api/login` → Directus → в ответе устанавливаются httpOnly куки `directus_access_token` и `directus_refresh_token`.
2) Любые защищённые страницы под `/(protected)` получают данные только через серверные API-роуты под `app/api/*`, а те — обращаются к Directus с `Authorization: Bearer <access_token>`.
3) При `401 Token expired.` серверный код вызывает `/api/refresh` и повторяет запрос.
4) Права доступа в Directus (ролевая модель) ограничивают видимость и изменение коллекций. Для клиентов используется связь с пользователем через поле `owner_user`; листинг фильтруется по текущему пользователю.
5) Создание профилей и расчётов может вызывать n8n по вебхукам из переменных окружения.

### Где менять что
- Новые страницы UI: `app/(protected)/*/page.tsx` или `app/(auth)/*/page.tsx`.
- Логика работы с Directus: `app/api/*` (серверные маршруты). Здесь добавляются поля, фильтры, перезагрузка токена и пр.
- Стили/компоненты: `components/*`, а также Tailwind в `globals.css` и `tailwind.config.ts`.
- Переменные окружения/урлы: `.env`, `.env.local`.

### Советы по отладке
- Смотреть логи терминала при обращении к API: там включено подробное логирование (токен есть/нет, URL, статус, тело ответа Directus).
- При проблемах 401 — перелогиниться в браузере; при 403 — проверить права в Directus и фильтры.
- Если запросы уходят не туда — проверить `DIRECTUS_URL` и `NEXT_PUBLIC_BASE_URL`.

Если нужно — дополню карту по конкретным коллекциям Directus и схемам данных.


