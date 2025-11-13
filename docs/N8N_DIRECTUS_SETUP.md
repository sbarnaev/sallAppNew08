# Настройка n8n для работы с Directus

## Получение токена из webhook

Токен передается в запросе к n8n двумя способами:

### 1. В HTTP заголовке
```
Authorization: Bearer <token>
```

В n8n webhook node доступен через:
```
{{ $headers.authorization }}
```
Вернет: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 2. В JSON body
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "directusUrl": "https://directus.sposobniymaster.online",
  ...
}
```

В n8n webhook node доступен через:
```
{{ $json.token }}
```
Вернет: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (без префикса Bearer)

## Настройка HTTP Request node в n8n

### Вариант 1: Использовать токен из body (рекомендуется)

1. **URL**: `{{ $json.directusUrl }}/users/me?fields=id,email,role.name`
2. **Method**: `GET`
3. **Authentication**: `Generic Credential Type`
4. **Generic Auth Type**: `Header Auth`
5. **Name**: `Authorization`
6. **Value**: `Bearer {{ $json.token }}`

Или напрямую в заголовках:
- **Add Header**:
  - **Name**: `Authorization`
  - **Value**: `Bearer {{ $json.token }}`

### Вариант 2: Использовать токен из заголовка

1. **URL**: `{{ $json.directusUrl }}/users/me?fields=id,email,role.name`
2. **Method**: `GET`
3. **Add Header**:
   - **Name**: `Authorization`
   - **Value**: `{{ $headers.authorization }}`

Или убрать префикс "Bearer " если он уже есть:
- **Value**: `{{ $headers.authorization.replace('Bearer ', '') }}`

## Проверка токена

Токен - это JWT. Проверить его можно на https://jwt.io

В payload токена:
- `exp` - время истечения (timestamp)
- `iat` - время создания (timestamp)
- `id` - ID пользователя
- `app_access` - доступ к приложению
- `admin_access` - доступ к админке

## Частые ошибки

### "Invalid user credentials" (401)

1. **Токен истек** - проверьте `exp` в JWT
2. **Неправильный формат заголовка** - должен быть `Bearer <token>` (с пробелом!)
3. **Токен не передается** - проверьте, что `{{ $json.token }}` или `{{ $headers.authorization }}` возвращает значение
4. **URL неправильный** - проверьте, что `{{ $json.directusUrl }}` содержит правильный URL без слеша в конце

### Правильный формат заголовка

✅ **Правильно**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

❌ **Неправильно**:
```
Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  (без Bearer)
Authorization: BearereyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  (без пробела)
```

## Пример полной настройки HTTP Request node

```
URL: {{ $json.directusUrl }}/users/me?fields=id,email,role.name
Method: GET
Authentication: None (используем заголовки)
Headers:
  - Name: Authorization
    Value: Bearer {{ $json.token }}
  - Name: Accept
    Value: application/json
```

## Отладка

1. Добавьте **Set** node перед HTTP Request для проверки:
   ```
   Token: {{ $json.token }}
   Directus URL: {{ $json.directusUrl }}
   Full URL: {{ $json.directusUrl }}/users/me?fields=id,email,role.name
   ```

2. Проверьте логи n8n - там будет видно, какой запрос отправляется

3. Проверьте токен на jwt.io - убедитесь, что он не истек

