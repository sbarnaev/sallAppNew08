# SAL App Starter (Next.js + Directus + n8n + PostgreSQL)

Готовый старт проекта под твой сервис САЛ:

- **Next.js (App Router, TS, Tailwind)** — фронт и API-прокси
- **Directus** — авторизация, роли, доступ к БД
- **n8n** — расчёт профиля и Q&A по профилю
- **PostgreSQL** — хранение данных

## Быстрый старт

1) Склонируй и установи зависимости
```bash
pnpm i # или npm i / yarn
```

2) Заполни `.env` по образцу `.env.example`:
- `DIRECTUS_URL` или `NEXT_PUBLIC_DIRECTUS_URL` — URL твоего Directus
- `N8N_CALC_URL` — вебхук n8n для расчёта профиля
- `N8N_QA_URL` — вебхук n8n для вопросов

3) Запусти dev-сервер
```bash
pnpm dev # http://localhost:3000
```

## Как работает авторизация

- `/api/login` → прокси к `POST {DIRECTUS_URL}/auth/login`, сохраняет `directus_access_token` и `directus_refresh_token` в **httpOnly** cookies.
- `/api/logout` → очищает cookies.
- Protected-роуты (все под `(protected)`) проверяют cookie и редиректят на `/login` при её отсутствии.

## Данные

- Фронт не ходит напрямую в Directus: все запросы идут через роуты `/api/*`, которые передают токен в заголовке Authorization.
- Профили: `/api/profiles` и `/api/profiles/[id]` проксируют к Directus Items API.
- Создание профиля: `/api/calc` проксирует на твой n8n-вебхук `calc-profile` (ожидается, что n8n создаёт записи в БД/Directus).
- Вопросы: `/api/qa` → твой n8n-вебхук `qa` (с контекстом и логированием).

## Что нужно настроить в Directus

- Подключить к твоей PostgreSQL со схемой `clients`, `profiles`, `profile_chunks`, `qa` (или создать коллекции прямо в Directus — поля можно привязать к существующим таблицам).
- Включить Email/Password auth и SMTP.
- Создать роли:
  - `master` — доступ только к **своим** `profiles`/`qa` и привязанным `clients`.
- В Permissions задать фильтры `user_created = $CURRENT_USER` (или твой способ связывания).
- (Опционально) сервисный статический токен для публичных справочников.

## Настройка n8n (минимум)

- В начале каждого воркфлоу (`calc-profile`, `qa`) — нода, которая:
  - Читает заголовок `Authorization: Bearer <directus_access_token>`,
  - Валидирует его запросом `GET {DIRECTUS_URL}/users/me`,
  - Если невалиден — 401.
- `calc-profile`: получает данные формы (имя, дата и т.д.), вызывает ИИ, пишет в `profiles` (и `profile_chunks`/`profile_embeddings` если используешь), возвращает `{ profileId }`.
- `qa`: принимает `{ profileId, question }`, достаёт контекст (pgvector/FTS), зовёт ИИ, сохраняет в `qa`, возвращает `{ answer }`.

## Деплой в CapRover

- Собери образ Next: `docker build -t sal-app-starter .` (создай Dockerfile при необходимости или деплой из GitHub по buildpack).
- Пропиши переменные окружения как в `.env.example`.
- Проксируй через HTTPS.

## Дальше

- Добавь формы параметров расчёта (имя, дата, т.п.) на `/profiles` → отправляй в `/api/calc`.
- Рендер профиля: сейчас показывается HTML, который ты сохраняешь в Directus. Можно ещё рисовать «живые» блоки из `raw_json`.
- История клиента: сделай страницу `/clients/[id]` и вывод из коллекции `qa` с фильтром `profile_id`.

Удачи! 🚀
