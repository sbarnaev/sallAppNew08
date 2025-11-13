# Остановка деплоя в Dokploy

## Через веб-интерфейс (рекомендуется)

1. Откройте Dokploy → ваше приложение
2. Найдите активный деплой в списке
3. Нажмите кнопку "Stop" или "Cancel"

## Через SSH (если есть доступ к серверу)

### Вариант 1: Остановить контейнер сборки

```bash
# Найти контейнеры сборки Dokploy
docker ps -a | grep dokploy

# Найти контейнеры с именем вашего приложения
docker ps -a | grep sal-service

# Остановить контейнер сборки (замените CONTAINER_ID на реальный ID)
docker stop CONTAINER_ID

# Или остановить все контейнеры сборки
docker ps -a --filter "name=sal-service" --format "{{.ID}}" | xargs docker stop
```

### Вариант 2: Остановить процесс сборки Docker

```bash
# Найти процесс сборки
ps aux | grep "docker build"

# Убить процесс сборки (замените PID на реальный ID процесса)
kill -9 PID
```

### Вариант 3: Очистить незавершенные сборки

```bash
# Остановить все контейнеры Dokploy
docker ps -a --filter "name=dokploy" --format "{{.ID}}" | xargs docker stop

# Удалить остановленные контейнеры
docker container prune -f
```

## Примечание

Если у вас нет SSH доступа к серверу, используйте веб-интерфейс Dokploy для остановки деплоя.

