Теперь вы можете протестировать загрузку PDF анализов. Откройте браузер и перейдите на http://localhost:5175/upload (или https://vitaloop.today/upload на проде), затем:

1. Создайте PDF из test_lab_simple.html:
   - Откройте файл test_lab_simple.html в браузере
   - Нажмите Ctrl+P (или Cmd+P на Mac)
   - Выберите 'Save as PDF'
   - Сохраните как test_lab_report.pdf

2. Загрузите этот PDF файл на страницу upload

3. Проверьте консоль браузера (F12) для детального логирования процесса OCR

4. Посмотрите, правильно ли распознаются биомаркеры и сохраняются в статистике

Если возникнут ошибки, логи в консоли помогут понять, на каком этапе происходит сбой.

## Live Smoke: Health Profile

Для постоянной проверки health-profile на staging и после деплоя в production добавлен live smoke test:

- `backend/tests/test_health_profile_live_smoke.py`

Этот тест:

1. Создаёт временного Supabase-пользователя
2. Подтверждает email через admin API
3. Выполняет `GET /profile`
4. Выполняет `PATCH /profile` для ключевых полей health-profile
5. Проверяет legacy значения пола `M/F/O`
6. Удаляет временного пользователя

Тест подключён в workflow:

- `.github/workflows/staging-live-smoke.yml`
- `.github/workflows/post-deploy-live-smoke.yml`

Для запуска нужны GitHub Actions secrets:

- `E2E_API_BASE_URL`
- `E2E_BEARER_TOKEN`
- `E2E_ORG_ID`
- `E2E_INVITE_EMAIL`
- `E2E_SUPABASE_URL`
- `E2E_SUPABASE_SERVICE_ROLE_KEY`
- `E2E_SUPABASE_ANON_KEY`

Если новые Supabase secrets не заданы, workflow завершится ошибкой до запуска pytest, чтобы smoke не был пропущен незаметно.

Локальная проверка коллекции теста:

```bash
cd backend
pytest -q tests/test_health_profile_live_smoke.py --tb=short
```

Без live env/secrets тест должен корректно показывать `skipped`.
