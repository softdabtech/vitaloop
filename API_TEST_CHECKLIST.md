# ✅ Чек-лист для тестирования OpenAI API интеграции

## Подготовка к тесту

- [ ] Убедиться что `OPENAI_API_KEY` установлена
  ```bash
  echo $OPENAI_API_KEY | head -c 10
  # Должно вывести: sk-...
  ```

- [ ] Проверить что backend запущен
  ```bash
  curl http://localhost:8000/health
  # Ожидается: 200 OK
  ```

- [ ] Проверить что frontend доступен
  ```bash
  Открыть http://localhost:5173 в браузере
  ```

---

## ТЕСТ 1: PDF анализ (основной сценарий)

**Что тестируем:** OpenAI API анализирует PDF

### Шаги:
1. [ ] Перейти на `/upload` page
2. [ ] Нажать на "📄 Upload PDF"
3. [ ] Подготовить sample PDF:
   - Можно создать простой PDF с текстом лабораторного отчета
   - Или использовать пример:
     ```
     LAB REPORT
     Patient: John Doe
     Date: 2026-05-27
     
     Hemoglobin: 14.5 g/dL (Normal: 13.5-17.5)
     Glucose: 95 mg/dL (Normal: 70-100)
     Vitamin D: 25 ng/mL (Normal: 30-100)
     ```
4. [ ] Загрузить PDF файл
5. [ ] (Опционально) Добавить симптомы: "Fatigue", "Headache"
6. [ ] Нажать "Upload"
7. [ ] **Ожидаемый результат:**
   - Прогресс индикатор 30-120 сек
   - Редирект на `/results/{upload_id}`
   - Страница показывает:
     - ✅ Найденные биомаркеры
     - ✅ Статус каждого (OPTIMAL, DEFICIENT, etc)
     - ✅ Рекомендуемые добавки (protocol)
     - ✅ Время анализа

### Проверить в логах:
```bash
# Backend логи должны показать:
docker logs vitaloop-backend | grep -i "openai\|analysis_method"
# Ожидается: "analysis_method": "openai_pdf"
```

### API Response проверка:
```json
{
  "upload_id": "uuid-here",
  "biomarkers": [
    {
      "name": "Hemoglobin",
      "value": 14.5,
      "status": "OPTIMAL"
    }
  ],
  "analysis_method": "openai_pdf",  // ← KEY: показывает что OpenAI использован
  "analysis_time": 3.5
}
```

---

## ТЕСТ 2: PNG загрузка (должна ПАДАТЬ)

**Что тестируем:** PNG не поддерживается

### Шаги:
1. [ ] На странице `/upload` нажать "Upload PDF"
2. [ ] Создать или найти PNG файл
3. [ ] Попытаться загрузить PNG
4. [ ] **Ожидаемый результат:**
   - ❌ Ошибка: "Unsupported file type. Please upload a PDF file."
   - Файл отклонен
   - Никакой анализ не происходит

### Почему не работает:
- Frontend: `SUPPORTED_FILE_TYPES = ['application/pdf']` (строка 21 в Upload.jsx)
- UploadZone: `accept: { 'application/pdf': ['.pdf'] }` (строка 13)
- Backend: Валидация PDF (строка 99 в analyze.py)

---

## ТЕСТ 3: JPG загрузка (должна ПАДАТЬ)

**Что тестируем:** JPG не поддерживается

### Шаги:
1. [ ] На странице `/upload` нажать "Upload PDF"
2. [ ] Создать или найти JPG файл
3. [ ] Попытаться загрузить JPG
4. [ ] **Ожидаемый результат:**
   - ❌ Ошибка: "Unsupported file type. Please upload a PDF file."
   - Файл отклонен

---

## ТЕСТ 4: Ручной ввод биомаркеров

**Что тестируем:** Manual entry работает и генерирует протокол

### Шаги:
1. [ ] Перейти на `/upload`
2. [ ] Нажать "✋ Enter Manually"
3. [ ] Нажать "+ Add Biomarker"
4. [ ] Выбрать из dropdown (например, "Hemoglobin")
5. [ ] Ввести значение: `14.5`
6. [ ] Выбрать unit: `g/dL`
7. [ ] Добавить еще один маркер (например, Glucose: 95 mg/dL)
8. [ ] Нажать "Analyze"
9. [ ] **Ожидаемый результат:**
   - ✅ Валидация прошла
   - ✅ Редирект на `/results/{upload_id}`
   - ✅ Показаны биомаркеры
   - ✅ Показан протокол с рекомендациями

---

## ТЕСТ 5: Проверка логов и мониторинга

**Что тестируем:** OpenAI API используется корректно

### Шаги:
```bash
# 1. Посмотреть логи в реальном времени
docker logs -f vitaloop-backend 2>&1 | grep -i "analysis\|openai"

# 2. Запустить PDF анализ (из теста 1)
# Должны увидеть логи:

# - openai_pdf_analysis_ok biomarkers=42 protocol=5 duration_ms=3500
# ИЛИ
# - openai_pdf_analysis_failed error=...

# 3. Проверить что используется правильный API endpoint
docker logs vitaloop-backend 2>&1 | grep "api.openai.com"

# 4. Проверить модель
docker logs vitaloop-backend 2>&1 | grep "gpt-4o-mini"
```

---

## ТЕСТ 6: Quota и Limit проверка

**Что тестируем:** Freemium лимиты работают

### Шаги для свободного пользователя:
1. [ ] Загрузить PDF (первый раз) - должно работать
2. [ ] Попытаться загрузить еще один PDF (второй раз)
3. [ ] **Ожидаемый результат:**
   - ❌ Ошибка 402: "You've reached your free analysis limit"
   - Предложение upgrade

### Проверить в ответе API:
```json
{
  "detail": {
    "detail": "You've reached your free analysis limit",
    "code": "BIOMARKER_QUOTA_EXCEEDED",
    "used_by": "pdf"
  }
}
```

---

## ТЕСТ 7: OpenAI API Key валидация

**Что тестируем:** Ошибка если ключ неверный

### Шаги:
1. [ ] Временно установить неверный ключ:
   ```bash
   export OPENAI_API_KEY=sk-invalid-key
   ```

2. [ ] Перезапустить backend:
   ```bash
   docker restart vitaloop-backend
   ```

3. [ ] Попытаться загрузить PDF
4. [ ] **Ожидаемый результат:**
   - ❌ Ошибка 503: "Analysis service is temporarily unavailable"
   - Логи: "Connection error - unable to reach OpenAI API"

5. [ ] Восстановить правильный ключ

---

## БЫСТРЫЕ ПРОВЕРКИ

### Проверка 1: Файлы конфигурации
```bash
# OpenAI конфигурирована?
grep "openai_api_key\|openai_model" /Users/oleksii/projects/vitaloop/backend/app/config.py
# Должно быть: openai_api_key, openai_model="gpt-4o-mini"

# OpenAIPDFAnalyzer используется?
grep "OpenAIPDFAnalyzer" /Users/oleksii/projects/vitaloop/backend/app/routers/analysis/analyze.py
# Должно быть найдено в импорте и инициализации
```

### Проверка 2: Версия библиотек
```bash
# httpx установлен?
python -c "import httpx; print(httpx.__version__)"
# Ожидается: 0.27.0 или выше

# PyPDF установлен?
python -c "import pypdf; print(pypdf.__version__)"
# Ожидается: любая версия
```

### Проверка 3: API ключ загружен
```bash
python -c "from app.config import settings; print(f'OpenAI API Key loaded: {bool(settings.openai_api_key)}')"
# Ожидается: True
```

---

## ИТОГОВЫЙ РЕЗУЛЬТАТ

Если все тесты прошли, то:

✅ OpenAI API подключена и работает  
✅ PDF анализируется через gpt-4o-mini  
✅ Биомаркеры извлекаются корректно  
✅ Протокол генерируется успешно  
✅ Ручной ввод работает  
✅ Quota система работает  
❌ PNG/JPG не поддерживаются (как и ожидается)  

---

## РЕКОМЕНДУЕМЫЕ ИСПРАВЛЕНИЯ

После подтверждения что OpenAI работает:

### 1. Исправить UI Label (КРИТИЧНО)
**Файл:** `frontend/src/pages/Upload.jsx` строка 287
```diff
- 📄 Upload PDF / Photo
+ 📄 Upload PDF
```

### 2. Обновить UploadZone (КРИТИЧНО)
**Файл:** `frontend/src/components/UploadZone.jsx` строка 33
```diff
- PDF only. Max 20MB.
+ PDF lab reports only. Max 20MB.
```

### 3. Добавить комментарий в код (РЕКОМЕНДУЕМО)
**Файл:** `backend/app/services/claude_pdf_analyzer.py` строка 215
```python
# Backward-compatible alias for existing imports.
# NOTE: Despite the name "Claude", this uses OpenAI API (gpt-4o-mini)
# The class was renamed for backward compatibility but remains OpenAI-based
class ClaudePDFAnalyzer(OpenAIPDFAnalyzer):
    pass
```

### 4. Если требуется PNG/JPG (ОПЦИОНАЛЬНО)
Нужно:
- Создать новый класс `OpenAIVisionPDFAnalyzer`
- Использовать `gpt-4-vision` модель
- Отправлять изображения как base64
- Создать новый эндпоинт `POST /analyze/image`
