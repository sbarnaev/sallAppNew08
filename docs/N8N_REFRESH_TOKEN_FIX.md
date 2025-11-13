# Исправление ошибки "Invalid payload. The refresh token is required"

## Проблема

Ошибка возникает при попытке обновить токен через `/auth/refresh` в n8n:
```
Invalid payload. The refresh token is required in either the payload or cookie.
```

## Решение

### Правильная настройка HTTP Request node в n8n для обновления токена

1. **URL**: `{{ $json.directusUrl }}/auth/refresh`
   - Убедитесь, что нет слеша в конце: `https://directus.sposobniymaster.online/auth/refresh` ✅
   - Неправильно: `https://directus.sposobniymaster.online/auth/refresh/` ❌

2. **Method**: `POST`

3. **Body Content Type**: Выберите `JSON` (не form-data, не raw!)

4. **Body** (JSON):
   ```json
   {
     "refresh_token": "{{ $json.refreshToken }}"
   }
   ```

5. **Headers**:
   - `Content-Type`: `application/json`
   - `Accept`: `application/json`

### Проверка данных

Перед HTTP Request node добавьте **Set** node для проверки:
```
refreshToken: {{ $json.refreshToken }}
directusUrl: {{ $json.directusUrl }}
```

Убедитесь, что:
- `refreshToken` не пустой
- `directusUrl` правильный (без слеша в конце)

### Пример полной настройки

**HTTP Request node "Refresh Token":**
- **URL**: `{{ $json.directusUrl }}/auth/refresh`
- **Method**: `POST`
- **Body Content Type**: `JSON`
- **Body**:
  ```json
  {
    "refresh_token": "{{ $json.refreshToken }}"
  }
  ```
- **Headers**:
  - Name: `Content-Type`, Value: `application/json`
  - Name: `Accept`, Value: `application/json`

### После обновления токена

Ответ от Directus будет в формате:
```json
{
  "data": {
    "access_token": "новый_токен",
    "refresh_token": "новый_refresh_токен"
  }
}
```

Используйте `{{ $json.data.access_token }}` в следующем HTTP Request node.

## Альтернатива: Статический токен

Если проблемы продолжаются, используйте статический токен Directus:
1. Directus → Settings → Access Tokens → Create Token
2. Используйте этот токен напрямую в n8n (не обновляйте)

