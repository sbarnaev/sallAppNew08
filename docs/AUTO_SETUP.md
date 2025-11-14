# Автоматическая инициализация Directus при деплое

## Что сделано

Создан API endpoint `/api/setup` для автоматической настройки permissions в Directus. Он вызывается один раз при деплое.

## Как использовать

### Вариант 1: Вызов через API (рекомендуется)

После деплоя вызови один раз:

```bash
curl -X POST https://твой-домен.com/api/setup \
  -H "Content-Type: application/json" \
  -H "X-Setup-Token: твой_админский_токен" \
  -d '{"force": false}'
```

Или через браузер/Postman:
- URL: `POST /api/setup`
- Headers: `X-Setup-Token: твой_админский_токен`
- Body: `{"force": false}`

### Вариант 2: Автоматический запуск при деплое

Добавь в переменные окружения:
```env
DIRECTUS_ADMIN_TOKEN=твой_админский_токен
DIRECTUS_URL=https://directus.sposobniymaster.online
NEXT_PUBLIC_BASE_URL=https://твой-домен.com
```

И запусти скрипт инициализации:
```bash
npm run init:directus
```

Или добавь в docker-compose или процесс деплоя:
```yaml
command: sh -c "npm start & sleep 15 && npm run init:directus"
```

### Вариант 3: Вручную через скрипт

```bash
DIRECTUS_URL="https://directus.sposobniymaster.online" \
DIRECTUS_ADMIN_TOKEN="твой_токен" \
NEXT_PUBLIC_BASE_URL="https://твой-домен.com" \
npm run init:directus
```

## Что настраивается

- Создаётся роль "master" (если не существует)
- Настраиваются permissions для коллекций:
  - `clients` - только свои клиенты
  - `profiles` - только свои профили
  - `qa` - только Q&A для своих профилей
  - `profile_chunks` - только chunks своих профилей
  - `consultations` - только свои консультации
  - `consultation_details` - только детали своих консультаций
  - `images_id` - только изображения своих профилей

## Безопасность

- Endpoint защищён заголовком `X-Setup-Token`
- Можно использовать `DIRECTUS_ADMIN_TOKEN` из env переменных
- Скрипт идемпотентен - можно вызывать многократно

## Параметры

- `force: false` - не перезаписывает существующие permissions
- `force: true` - перезаписывает все permissions (используй осторожно!)

## Пример ответа

```json
{
  "success": true,
  "message": "Настройка permissions завершена",
  "results": [
    "Роль \"master\" уже существует",
    "Создано: clients.create",
    "Создано: clients.read",
    ...
  ],
  "timestamp": "2025-01-14T12:00:00.000Z"
}
```

