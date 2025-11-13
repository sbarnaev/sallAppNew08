# Исправление проблемы с неправильным URL Directus в n8n

## Проблема

n8n использует старый URL Directus (например, `217.114.14.254:443`) вместо нового (`https://directus.sposobniymaster.online`).

## Причины

1. **Захардкоженный URL в n8n workflow** - старый URL сохранен в настройках HTTP Request node
2. **Неправильная переменная окружения** - `DIRECTUS_URL` указывает на старый адрес
3. **Кэш в n8n** - старый URL сохранен в workflow

## Решение

### 1. Проверьте переменную окружения DIRECTUS_URL

В настройках вашего приложения (где деплоится Next.js) проверьте:
- `DIRECTUS_URL` должен быть: `https://directus.sposobniymaster.online`
- Без слеша в конце!

### 2. Обновите URL в n8n workflow

В n8n workflow найдите все HTTP Request nodes, которые обращаются к Directus:

1. **Замените захардкоженный URL** на переменную:
   - Старый способ: `http://217.114.14.254:443/...` ❌
   - Новый способ: `{{ $json.directusUrl }}/...` ✅

2. **Проверьте все HTTP Request nodes**:
   - URL должен использовать `{{ $json.directusUrl }}`
   - Например: `{{ $json.directusUrl }}/users/me`
   - Например: `{{ $json.directusUrl }}/items/profiles`

### 3. Проверьте, что directusUrl передается правильно

В webhook node (первый node в workflow) проверьте:
- `{{ $json.directusUrl }}` должен содержать `https://directus.sposobniymaster.online`

Добавьте **Set** node для отладки:
```
directusUrl: {{ $json.directusUrl }}
```

### 4. Обновите все HTTP Request nodes

Найдите все HTTP Request nodes в workflow и замените:
- ❌ `http://217.114.14.254:443/...`
- ❌ `https://217.114.14.254/...`
- ✅ `{{ $json.directusUrl }}/...`

### 5. Проверка переменных окружения

В системе деплоя проверьте:
```env
DIRECTUS_URL=https://directus.sposobniymaster.online
```

Без слеша в конце!

## Быстрая проверка

1. Откройте n8n workflow
2. Найдите все HTTP Request nodes
3. Проверьте поле "URL" - там не должно быть захардкоженного IP адреса
4. Все URL должны начинаться с `{{ $json.directusUrl }}`

## Пример правильной настройки

**HTTP Request node:**
- **URL**: `{{ $json.directusUrl }}/users/me?fields=id,email,role.name`
- **Method**: `GET`
- **Headers**:
  - `Authorization`: `Bearer {{ $json.token }}`

**НЕ используйте:**
- ❌ `http://217.114.14.254:443/users/me`
- ❌ `https://217.114.14.254/users/me`
- ❌ Любой захардкоженный IP адрес

