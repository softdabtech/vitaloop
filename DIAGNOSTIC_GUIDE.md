# Diagnostic Guide для Lab Results и других broken страниц

## 🔴 Что делать чтобы найти проблему

### STEP 1: Откройте браузер Developer Tools

1. Заходите на https://vitaloop.today/lab-results
2. Нажимаете **F12** (или Cmd+Option+I на Mac)
3. Переходите на вкладку **Console**

### STEP 2: Проверьте сообщения об ошибках

Ищите в Console:
- ❌ Red errors (ошибки)
- ⚠️  Yellow warnings (предупреждения)
- 🔵 Network errors

### STEP 3: Проверьте Network запросы

1. Откройте вкладку **Network**
2. Перезагрузите страницу (F5)
3. Ищите запросы к `/api/progress`

Посмотрите:
- **Status** (200 = успех, 401 = не авторизован, 500 = ошибка сервера)
- **Response** (содержимое ответа)

### STEP 4: Скопируйте одну из этих ошибок

Если видите красное сообщение об ошибке - скопируйте его полный текст и отправьте мне.

---

## 🔧 Вероятные проблемы и решения

### Проблема 1: "401 Unauthorized" на /api/progress

**Причина:** Supabase токен не передается в Authorization header

**Проверка:**
```javascript
// Откройте Console и выполните:
const key = Object.keys(window.localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
console.log('Auth token key:', key)
if (key) console.log('Token exists:', window.localStorage.getItem(key))
```

**Если токен НЕ найден:**
- Вы не авторизованы
- Нужно залогиниться: https://vitaloop.today/login
- Email: admin@vitaloop.today
- Password: VTLp!1776202263Aa9

---

### Проблема 2: "500 Internal Server Error" на /api/progress

**Причина:** Ошибка на бекенде при получении данных из БД

**Проверка на backend:**
```bash
# SSH на сервер и проверьте логи:
ssh root@159.65.252.227
tail -100 /var/log/vitaloop/backend.log
tail -100 /var/log/vitaloop/backend-error.log
```

**Возможные причины:**
- Supabase connection broken
- Database query error
- Missing data in database

---

### Проблема 3: "404 Not Found" на /api/progress

**Причина:** Endpoint не существует или неправильно зарегистрирован

**Проверка:**
```bash
# На бекенде проверьте что endpoint зарегистрирован:
grep -n "include_router.*progress" /var/www/VITALOOP/backend/app/main.py
# Должно быть: app.include_router(progress.router, prefix="/progress", tags=["progress"])
```

---

### Проблема 4: Empty page (пустая страница)

**Возможные причины:**
1. Service Worker кеширует старую версию
2. Сервер падает при запросе
3. React ошибка в компоненте

**Решение:**
```javascript
// В Console выполните:
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => reg.unregister())
  })
}
// Перезагрузите страницу
location.reload()
```

---

## 📋 Чек-лист для диагностики

- [ ] Вы залогинены (видите свой email в Profile)?
- [ ] В Network нет 401 ошибок на /api/progress?
- [ ] В Network нет 500 ошибок?
- [ ] В Console нет красных ошибок?
- [ ] Service Worker работает (есть зелёная галочка в DevTools)?
- [ ] Local Storage содержит Supabase токен (ключ начинается на `sb-`)?

---

## 🚀 Если все ОК но страница всё ещё не работает

Отправьте мне:
1. **Screenshot Console** с ошибками
2. **Network tab** - скрин с запросом к `/api/progress` и ответом
3. **Результат этой команды:**
   ```javascript
   // В Console:
   console.log({
     isLogged: !!window.localStorage.getItem(Object.keys(window.localStorage).find(k => k.startsWith('sb-'))),
     url: window.location.href,
     userAgent: navigator.userAgent
   })
   ```

---

## 🔍 Технические детали (для deep debug)

### Backend логирование

```bash
# Real-time логи бекенда:
ssh root@159.65.252.227
journalctl -u vitaloop-backend -f

# Проверка что сервис живой:
systemctl status vitaloop-backend

# Проверка что слушает порт 8004:
lsof -i :8004
```

### Проверка Supabase connection

```bash
# На сервере:
cat /etc/vitaloop/backend.env | grep SUPABASE
# Должны быть заполнены:
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - SUPABASE_JWT_SECRET
```

### Проверка API напрямую (с curl)

```bash
# Получить Supabase токен (нужна Supabase console):
SUPABASE_TOKEN="<ваш токен из Supabase>"

# Тестировать /progress endpoint:
curl -H "Authorization: Bearer $SUPABASE_TOKEN" \
  https://vitaloop.today/api/progress
```

---

## 📞 Если ничего не помогло

Соберите и отправьте:
1. Console errors (screenshot)
2. Network errors (screenshot)
3. Backend logs (последние 50 строк)
4. Результат команды `curl https://vitaloop.today/api/health`
5. Результат команды `systemctl status vitaloop-backend` на сервере
