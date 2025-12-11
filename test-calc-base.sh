#!/bin/bash

# Скрипт для тестирования базового расчета вручную

echo "=== Тест базового расчета ==="
echo ""

# Параметры теста
NAME="Тестовый Клиент"
BIRTHDAY="1990-01-15"
STREAM="1"

echo "Параметры:"
echo "  Имя: $NAME"
echo "  Дата рождения: $BIRTHDAY"
echo "  Стриминг: $STREAM"
echo ""

# URL API
API_URL="http://localhost:3000/api/calc-base?stream=$STREAM"

echo "Отправка запроса к: $API_URL"
echo ""

# Отправка POST запроса
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Cookie: $(cat .test-cookies 2>/dev/null || echo '')" \
  -d "{
    \"name\": \"$NAME\",
    \"birthday\": \"$BIRTHDAY\",
    \"stream\": true
  }" \
  -v \
  --no-buffer

echo ""
echo "=== Тест завершен ==="

