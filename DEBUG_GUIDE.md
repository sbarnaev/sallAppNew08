# Руководство по отладке базового расчета

## Как проверить промпт

### 1. Просмотр примера промпта

Откройте в браузере:
```
http://localhost:3000/api/calc-base/debug?name=Тестовый%20Клиент&birthday=1990-01-15
```

Или с другими параметрами:
```
http://localhost:3000/api/calc-base/debug?name=Иван%20Иванов&birthday=1985-05-20
```

Этот эндпоинт покажет:
- Рассчитанные коды САЛ
- Полный system prompt
- User prompt с данными клиента
- Пример запроса к OpenAI

### 2. Проверка логов в консоли браузера

При запуске базового расчета откройте DevTools (F12) и смотрите логи:

**Клиентская сторона:**
- `[CLIENT] Starting base calculation...` - начало запроса
- `[CLIENT] Response status:` - статус ответа
- `[CLIENT] Profile ID received:` - получен ID профиля
- `[CLIENT] ✅ Generation complete!` - генерация завершена
- `[CLIENT] ❌ Error received:` - ошибка

**Серверная сторона (в терминале/логах сервера):**
- `[CALC-BASE] ===== POST /api/calc-base called =====` - запрос получен
- `[CALC-BASE] Profile created:` - профиль создан
- `[CALC-BASE] ===== PROMPT DEBUG INFO =====` - информация о промпте
- `[CALC-BASE] ===== FULL PROMPT =====` - полный промпт
- `[CALC-BASE] ===== OPENAI REQUEST =====` - запрос к OpenAI
- `[CALC-BASE] ===== OPENAI RESPONSE =====` - ответ от OpenAI
- `[CALC-BASE] ===== STREAM STARTED =====` - стрим начался
- `[CALC-BASE] ===== FINAL MESSAGE RECEIVED =====` - получен финальный ответ
- `[CALC-BASE] ✅ Complete data saved to Directus` - данные сохранены

### 3. Проверка этапов генерации

1. **Запрос отправляется?**
   - Проверьте `[CLIENT] Starting base calculation...` в консоли браузера
   - Проверьте Network tab в DevTools - должен быть запрос к `/api/calc-base?stream=1`

2. **Профиль создается?**
   - Проверьте `[CALC-BASE] Profile created:` в логах сервера
   - Проверьте, что profileId не null

3. **Промпт формируется?**
   - Проверьте `[CALC-BASE] ===== PROMPT DEBUG INFO =====`
   - Проверьте, что codesDescription не пустой

4. **Запрос к OpenAI отправляется?**
   - Проверьте `[CALC-BASE] ===== OPENAI REQUEST =====`
   - Проверьте, что есть OpenAI API key

5. **Ответ от OpenAI приходит?**
   - Проверьте `[CALC-BASE] ===== OPENAI RESPONSE =====`
   - Проверьте статус ответа (должен быть 200)

6. **Стрим работает?**
   - Проверьте `[CALC-BASE] ===== STREAM STARTED =====`
   - Проверьте `[CLIENT] Received data chunk:` в браузере

7. **Данные сохраняются?**
   - Проверьте `[CALC-BASE] ✅ Complete data saved to Directus`
   - Проверьте поле `base_profile_json` в Directus

8. **Данные отображаются?**
   - Проверьте, что на странице профиля есть данные
   - Проверьте, что используется правильный источник данных (base_profile_json или raw_json)

## Типичные проблемы

### Проблема: "Calculation failed"
**Решение:** Проверьте логи сервера, скорее всего проблема с OpenAI API key или с формированием промпта.

### Проблема: "Failed to create profile"
**Решение:** Проверьте подключение к Directus и права доступа.

### Проблема: "Empty codes description"
**Решение:** Проверьте файлы в папке "от меня " - должны быть все JSON файлы с трактовками.

### Проблема: "No content in response"
**Решение:** OpenAI не вернул контент. Проверьте API key и лимиты.

### Проблема: Пустые страницы в PDF
**Решение:** 
- Проверьте консоль браузера на наличие ошибок
- Проверьте, что данные есть в base_profile_json
- Проверьте логи `[PDF Export] Debug info:` в консоли

## Пример промпта

Системный промпт содержит:
- Легенду о кодах САЛ
- Инструкции по стилю и тональности
- Жёсткие правила по структуре каждого блока
- Примеры форматирования

User промпт содержит:
- Имя клиента
- Дату рождения
- Описания всех 5 кодов с их трактовками

## Проверка данных в Directus

1. Откройте Directus
2. Перейдите в коллекцию `profiles`
3. Найдите нужный профиль
4. Проверьте поле `base_profile_json` - там должны быть все данные
5. Если поле пустое, проверьте логи сохранения

