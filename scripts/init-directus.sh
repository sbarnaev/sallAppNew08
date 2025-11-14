#!/bin/sh
# Скрипт для автоматической инициализации Directus permissions при деплое
# Вызывается один раз после запуска приложения

set -e

DIRECTUS_URL="${DIRECTUS_URL:-}"
DIRECTUS_ADMIN_TOKEN="${DIRECTUS_ADMIN_TOKEN:-}"
APP_URL="${NEXT_PUBLIC_BASE_URL:-http://localhost:3000}"

if [ -z "$DIRECTUS_URL" ]; then
  echo "⚠️  DIRECTUS_URL не установлен, пропускаем инициализацию"
  exit 0
fi

if [ -z "$DIRECTUS_ADMIN_TOKEN" ]; then
  echo "⚠️  DIRECTUS_ADMIN_TOKEN не установлен, пропускаем инициализацию"
  exit 0
fi

echo "🚀 Инициализация Directus permissions..."

# Ждём, пока приложение запустится
echo "⏳ Ожидание запуска приложения..."
for i in 1 2 3 4 5; do
  if curl -f -s "${APP_URL}/api/me" > /dev/null 2>&1; then
    echo "✓ Приложение запущено"
    break
  fi
  if [ $i -eq 5 ]; then
    echo "⚠️  Приложение не запустилось за 25 секунд, пропускаем инициализацию"
    exit 0
  fi
  sleep 5
done

# Вызываем endpoint инициализации
echo "📝 Настройка permissions..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${APP_URL}/api/setup" \
  -H "Content-Type: application/json" \
  -H "X-Setup-Token: ${DIRECTUS_ADMIN_TOKEN}" \
  -d '{"force": false}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Инициализация завершена успешно"
  echo "$BODY" | grep -o '"message":"[^"]*"' | head -1 || echo "Permissions настроены"
else
  echo "⚠️  Ошибка инициализации (HTTP $HTTP_CODE):"
  echo "$BODY" | head -5
  exit 0  # Не прерываем деплой, если инициализация не удалась
fi

