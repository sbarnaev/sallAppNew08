# Настройка системы подписок

## Шаг 1: Добавление поля в Directus

Необходимо добавить поле `subscription_expires_at` в коллекцию `directus_users`:

### Через Directus UI:

1. Откройте Directus Admin Panel
2. Перейдите в Settings → Data Model
3. Найдите коллекцию `directus_users` (системная коллекция)
4. Нажмите "Create Field"
5. Настройки поля:
   - **Field Key**: `subscription_expires_at`
   - **Field Type**: `DateTime`
   - **Interface**: `Date Time`
   - **Required**: Нет (опционально)
   - **Default Value**: Оставить пустым
   - **Note**: "Дата окончания подписки. Если пусто - доступ не ограничен (для существующих пользователей)"

### Через SQL (альтернативный способ):

```sql
ALTER TABLE directus_users 
ADD COLUMN subscription_expires_at TIMESTAMP NULL;

COMMENT ON COLUMN directus_users.subscription_expires_at IS 'Дата окончания подписки. NULL = доступ не ограничен';
```

## Шаг 2: Установка сроков для существующих пользователей

Для существующих пользователей (около 10) нужно вручную установить сроки доступа:

1. Откройте Directus Admin Panel
2. Перейдите в Users
3. Для каждого пользователя:
   - Откройте редактирование
   - Установите `subscription_expires_at` на нужную дату
   - Сохраните

Или через SQL:

```sql
-- Пример: установить доступ до 31 декабря 2025 для всех пользователей
UPDATE directus_users 
SET subscription_expires_at = '2025-12-31 23:59:59'
WHERE subscription_expires_at IS NULL;
```

## Шаг 3: Проверка работы

1. Новые пользователи при регистрации автоматически получают 7 дней доступа
2. При истечении срока пользователь видит страницу `/subscription-expired`
3. На дашборде отображается статус подписки
4. При остатке менее 7 дней показывается предупреждение

## Логика работы

- **Новые пользователи**: При регистрации автоматически устанавливается `subscription_expires_at = текущая дата + 7 дней`
- **Существующие пользователи**: Если поле `subscription_expires_at` пустое (NULL), доступ считается неограниченным
- **Проверка доступа**: Выполняется в `requireAuthAndSubscription()` для всех защищённых страниц
- **Блокировка**: При истечении срока пользователь перенаправляется на `/subscription-expired`

## Продление доступа

Для продления доступа:
1. Администратор обновляет поле `subscription_expires_at` в Directus
2. Пользователь может написать в Telegram @roman_acc для продления
3. После обновления пользователь сразу получает доступ

## API для проверки подписки

- `GET /api/me` - возвращает информацию о пользователе, включая статус подписки:
  ```json
  {
    "data": {
      "id": 1,
      "email": "user@example.com",
      "subscription": {
        "expiresAt": "2025-12-31T23:59:59Z",
        "hasAccess": true,
        "daysRemaining": 30
      }
    }
  }
  ```

