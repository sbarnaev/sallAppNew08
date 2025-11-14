# Исправление docker-compose.yml для долгоживущих токенов

## Проблема

Токены Directus истекают, несмотря на установку `AUTH_TOKEN_TTL=315360000` и `AUTH_REFRESH_TOKEN_TTL=315360000` в Environment Settings Directus.

## Решение

Нужно добавить эти переменные окружения в `docker-compose.yml` в секцию `environment` сервиса `directus`.

## Обновленный docker-compose.yml

```yaml
services:
  database:
    image: postgis/postgis:13-master
    volumes:
      - directus_database:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: "directus"
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
      POSTGRES_DB: "directus"
    healthcheck:
      test: ["CMD", "pg_isready", "--host=localhost", "--username=directus"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_interval: 5s
      start_period: 30s

  cache:
    image: redis:6
    healthcheck:
      test: ["CMD-SHELL", "[ $$(redis-cli ping) = 'PONG' ]"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_interval: 5s
      start_period: 30s

  directus:
    image: directus/directus:11.12.0
    ports:
      - 8055
    volumes:
      - directus_uploads:/directus/uploads
      - directus_extensions:/directus/extensions
    depends_on:
      database:
        condition: service_healthy
      cache:
        condition: service_healthy
    environment:
      SECRET: ${DIRECTUS_SECRET}
      DB_CLIENT: "pg"
      DB_HOST: "database"
      DB_PORT: "5432"
      DB_DATABASE: "directus"
      DB_USER: "directus"
      DB_PASSWORD: ${DATABASE_PASSWORD}
      CACHE_ENABLED: "true"
      CACHE_AUTO_PURGE: "true"
      CACHE_STORE: "redis"
      REDIS: "redis://cache:6379"
      
      # Долгоживущие токены (10 лет в секундах)
      AUTH_TOKEN_TTL: "315360000"
      AUTH_REFRESH_TOKEN_TTL: "315360000"
      
      # После первого успешного входа удалите ADMIN_EMAIL и ADMIN_PASSWORD
      # так как они теперь хранятся в базе данных
      # ADMIN_EMAIL: удалил
      # ADMIN_PASSWORD: удалил

volumes:
  directus_uploads:
  directus_extensions:
  directus_database:
```

## Важные моменты

1. **Значения в секундах**: 
   - `315360000` секунд = 10 лет
   - Если нужно другое время, используйте формулу: `дни × 24 × 60 × 60`

2. **Перезапуск контейнера**: После изменения `docker-compose.yml` нужно перезапустить:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

3. **Проверка**: После перезапуска проверьте, что переменные применились:
   ```bash
   docker-compose exec directus env | grep AUTH_TOKEN
   ```

4. **Существующие токены**: Токены, созданные до изменения настроек, будут иметь старый TTL. Пользователям нужно будет перелогиниться.

## Альтернативные значения

- **1 год**: `31536000`
- **5 лет**: `157680000`
- **10 лет**: `315360000` (текущее значение)
- **Бессрочно**: Не рекомендуется по соображениям безопасности

## Дополнительные настройки безопасности

Если нужны долгоживущие токены, рекомендуется также настроить:

```yaml
# Время жизни сессии (опционально)
AUTH_SESSION_TTL: "315360000"

# Включить проверку IP (опционально, может вызвать проблемы)
# AUTH_IP_TRUST_PROXY: "true"
```

## Проверка в Directus UI

После перезапуска проверьте в Directus:
1. Settings → Environment → Auth
2. Убедитесь, что `AUTH_TOKEN_TTL` и `AUTH_REFRESH_TOKEN_TTL` отображают правильные значения

## Примечание

Если токены все еще истекают после этих изменений:
1. Убедитесь, что контейнер перезапущен
2. Проверьте логи: `docker-compose logs directus | grep AUTH`
3. Убедитесь, что в коде Next.js правильно устанавливается `maxAge` для cookies (должно быть не меньше, чем TTL токенов)

