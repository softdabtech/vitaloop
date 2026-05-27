# Промт для проверки всех API интеграций

## Задача: Выполнить полную диагностику API интеграций и протестировать функциональность

Проверить какой AI провайдер фактически подключен в приложении и выполнить все требуемые действия.

---

## Часть 1: Поиск всех API интеграций

### 1.1 Найти все конфиги OpenAI
```bash
grep -r "openai\|OPENAI\|OpenAI" /Users/oleksii/projects/vitaloop \
  --include="*.py" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" \
  --include="*.env*" --include="*.json" \
  | grep -v node_modules | grep -v ".git" | head -50
```

**Нужно проверить:**
- Есть ли OPENAI_API_KEY в переменных окружения?
- Есть ли импорты `openai` пакета?
- Есть ли эндпоинты для OpenAI?
- Есть ли конфигурация OpenAI в settings/config?

### 1.2 Найти все Claude/Anthropic интеграции
```bash
grep -r "anthropic\|claude\|Anthropic\|Claude\|AsyncAnthropic" /Users/oleksii/projects/vitaloop \
  --include="*.py" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" \
  | grep -v node_modules | grep -v ".git" | wc -l
```

### 1.3 Проверить settings/config файлы
```bash
# Найти все config файлы
find /Users/oleksii/projects/vitaloop -name "config.py" -o -name "settings.py" -o -name ".env*" \
  | xargs grep -l "openai\|anthropic\|api" 2>/dev/null
```

### 1.4 Проверить requirements/dependencies
```bash
# Проверить Python зависимости
cat /Users/oleksii/projects/vitaloop/backend/requirements.txt | grep -i "openai\|anthropic"

# Проверить JS зависимости
cat /Users/olексii/projects/vitaloop/frontend/package.json | grep -i "openai\|anthropic"
```

---

## Часть 2: Анализ сервисов

### 2.1 Проверить claude_service.py
```
Файл: /Users/oleksii/projects/vitaloop/backend/app/services/claude_service.py
Нужно найти и вывести:
- Какие функции используют Claude/OpenAI?
- Какие параметры API передаются?
- Есть ли fall-back логика?
- Какая модель по умолчанию?
```

### 2.2 Проверить claude_pdf_analyzer.py
```
Файл: /Users/olексii/projects/vitaloop/backend/app/services/claude_pdf_analyzer.py
Нужно найти:
- Какой класс используется для анализа PDF (AsyncAnthropic? OpenAI)?
- Как отправляются документы (document type, image type, или другое)?
- Какие параметры используются?
```

### 2.3 Проверить все роутеры анализа
```
Файлы:
- /Users/olексii/projects/vitaloop/backend/app/routers/analysis/analyze.py
- /Users/olексii/projects/vitaloop/backend/app/routers/analysis/dashboard.py

Нужно найти все вызовы к API сервисам и определить провайдеров
```

---

## Часть 3: Проверить переменные окружения

### 3.1 Найти все .env файлы
```bash
find /Users/olексii/projects/vitaloop -name ".env*" -o -name "*.env" 2>/dev/null | xargs ls -la
```

### 3.2 Проверить GitHub Secrets (если есть доступ)
```bash
# Если используется GitHub Actions
find /Users/olексii/projects/vitaloop -name "*.yml" -o -name "*.yaml" | xargs grep -i "openai\|anthropic" 2>/dev/null
```

### 3.3 Вывести что установлено в ENV (безопасно)
```bash
echo "=== Переменные окружения (первые символы) ==="
echo "OPENAI_API_KEY: ${OPENAI_API_KEY:0:10}..."
echo "ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:0:10}..."
echo "DIGITALOCEAN_CLAUDE_API_KEY: ${DIGITALOCEAN_CLAUDE_API_KEY:0:10}..."
```

---

## Часть 4: Проверка исходного кода провайдеров

### 4.1 Проверить который провайдер используется в analyze.py
```
Нужно найти все импорты и инициализация в:
/Users/olексii/projects/vitaloop/backend/app/routers/analysis/analyze.py

Особенно обратить внимание на:
- Строка с ClaudePDFAnalyzer 
- Какой класс передается api_key?
- Есть ли класс OpenAIPDFAnalyzer?
```

### 4.2 Проверить services директорию
```bash
ls -la /Users/olексii/projects/vitaloop/backend/app/services/ | grep -i "pdf\|analyzer\|llm\|ai"
```

---

## Часть 5: Функциональное тестирование

### 5.1 Тест 1: Загрузка PDF файла
**Что проверить:**
1. Перейти на https://vitaloop.today/upload
2. Нажать "📄 Upload PDF / Photo"
3. Загрузить sample PDF файл (минимум 50KB)
4. Добавить症状 (опционально)
5. Нажать "Upload"
6. **Ожидается:** 
   - Прогресс индикатор
   - Анализ 30-120 секунд
   - Страница результатов с биомаркерами
   - **Какой API в логах?** Claude или OpenAI?

### 5.2 Тест 2: Загрузка PNG файла
**Что проверить:**
1. Перейти на https://vitaloop.today/upload
2. Попытаться загрузить PNG файл
3. **Ожидается:** 
   - Ошибка "Unsupported file type"
   - Или успешная загрузка и анализ?
   - **Это скажет нам есть ли OpenAI Vision поддержка**

### 5.3 Тест 3: Загрузка JPG файла
**Как тест 5.2, но с JPG**

### 5.4 Тест 4: Ручной ввод маркеров
**Что проверить:**
1. Перейти на /upload
2. Нажать "✋ Enter Manually"
3. Добавить 2-3 маркера (например, Hemoglobin: 14.5 g/dL)
4. Нажать "Analyze"
5. **Ожидается:**
   - Валидация значений
   - Генерация протокола
   - **Какой API в логах?**

### 5.5 Проверить логи во время анализа
**Где найти:**
```bash
# Логи backend
tail -f backend/logs/app.log

# Или через Docker
docker logs vitaloop-backend 2>&1 | grep -i "claude\|openai\|analysis" | head -20
```

---

## Часть 6: Анализ результатов

### Создать отчет со следующей информацией:

1. **Какой провайдер фактически используется:**
   - [ ] OpenAI API
   - [ ] Claude API (Anthropic)
   - [ ] DigitalOcean Claude API
   - [ ] Несколько провайдеров?

2. **Какие файлы поддерживаются:**
   - [ ] PDF - YES/NO (каким провайдером?)
   - [ ] PNG - YES/NO (каким провайдером?)
   - [ ] JPG - YES/NO (каким провайдером?)

3. **Ручной ввод маркеров:**
   - [ ] Работает - YES/NO
   - [ ] Использует какой провайдер для генерации протокола?

4. **Конфигурация:**
   - Какие API ключи загружены?
   - Какая модель по умолчанию?
   - Есть ли fallback провайдеры?

5. **Проблемы (если есть):**
   - Почему UI говорит "Photo" но PNG/JPG не работают?
   - Есть ли код для OpenAI но он не используется?
   - Есть ли конфликты между провайдерами?

---

## Часть 7: Исправления (если требуются)

### Если OpenAI загружен но не используется:
1. Найти где он конфигурируется
2. Понять почему Claude используется вместо него
3. Либо включить OpenAI, либо удалить неиспользуемый код

### Если PNG/JPG должны работать:
1. Добавить поддержку в frontend (UploadZone.jsx)
2. Создать `POST /analyze/image` эндпоинт
3. Реализовать vision анализ для изображений

### Если PNG/JPG не должны работать:
1. Исправить UI label с "PDF / Photo" на просто "PDF"
2. Удалить "Photo" из комментариев и подсказок

---

## Команда для полного анализа (one-liner)

```bash
echo "=== OPENAI REFERENCES ===" && \
grep -r "openai\|OPENAI" /Users/olексii/projects/vitaloop --include="*.py" --include="*.js" --include="*.jsx" 2>/dev/null | grep -v node_modules | head -20 && \
echo -e "\n=== CLAUDE REFERENCES ===" && \
grep -r "AsyncAnthropic\|claude_pdf_analyzer\|claude_service" /Users/olексii/projects/vitaloop --include="*.py" 2>/dev/null | grep -v node_modules | head -20 && \
echo -e "\n=== API KEYS IN ENV ===" && \
env | grep -i "openai\|anthropic\|digitalocean" && \
echo -e "\n=== PYTHON DEPENDENCIES ===" && \
cat /Users/olексii/projects/vitaloop/backend/requirements.txt | grep -i "openai\|anthropic"
```

---

## Ожидаемый результат

Отчет должен содержать:
✅ Какой провайдер подключен
✅ Какие файлы поддерживаются
✅ Работает ли ручной ввод
✅ Какие проблемы найдены
✅ Что нужно исправить
✅ Примеры логов и ошибок (если есть)

