# 📱 План тестирования флоу регистрации на мобильной версии

**Статус:** ✅ ГОТОВО К РУЧНОМУ ТЕСТИРОВАНИЮ  
**Версия:** 3.2.1  
**Дата:** 28 апреля 2026

---

## 🎯 Цель

Проверить полный пользовательский флоу на мобильной версии:
1. **Sign Up** (/login?signup=true)
2. **Email Confirmation** (/auth/confirmation)
3. **Onboarding** (/onboarding)
4. **Dashboard** (/dashboard)
5. **Upload & Settings** (/upload, /settings)

---

## 🛠 Инструменты и подготовка

### Требования
- [ ] Node.js 18+
- [ ] npm установлен
- [ ] Frontend dev сервер работает: `npm run dev` (на порту 5173)

### Браузеры для проверки
- [ ] **iOS Safari** (iPhone 12+)
- [ ] **Chrome Android** (Android 10+)
- [ ] **Desktop Safari** (эмуляция мобильного)
- [ ] **Chrome DevTools** (мобильный режим)

### Запуск dev сервера

```bash
cd frontend
npm install
npm run dev
```

Сервер будет доступен на: **http://localhost:5173**

---

## 📋 Быстрая проверка (5 минут)

### 1. Открыть страницу Sign Up
```
http://localhost:5173/login?signup=true
```

**Проверить:**
- [ ] Форма видна полностью (нет горизонтального скролла)
- [ ] Email поле есть
- [ ] Password поле есть
- [ ] reCAPTCHA видна
- [ ] Кнопка "Sign Up" видна

### 2. Открыть Onboarding
```
http://localhost:5173/onboarding
```

**Проверить:**
- [ ] Форма загружается
- [ ] Видны поля ввода (height, weight, goals)
- [ ] Кнопки "Next" и "Skip" видны
- [ ] Нет горизонтального скролла

### 3. Открыть Dashboard
```
http://localhost:5173/dashboard
```

**Проверить:**
- [ ] Страница загружается
- [ ] Видна нижняя навигация (bottom bar) с 5 иконками
- [ ] Иконки кликабельны

---

## 🧪 Полное тестирование (30 минут)

### ЧАСТЬ 1: Страница логина

**URL:** `http://localhost:5173/login` (Sign In) или `http://localhost:5173/login?signup=true` (Sign Up)

#### Визуальная проверка
```
[ ] Форма центрирована на мобильной ширине
[ ] Email input имеет тип "email"
[ ] Password input скрывает текст точками
[ ] Есть кнопка toggle show/hide password
[ ] Все элементы имеют размер >= 44x44px
[ ] Нет горизонтального скролла
[ ] Цвета контрастные
```

#### Функциональная проверка Sign Up
```
[ ] Вести email: test@example.com
[ ] Вести пароль: Test123!
[ ] reCAPTCHA требует отметки (если включена)
[ ] Клик на "Sign Up" не проходит без reCAPTCHA
```

#### Функциональная проверка валидации
```
[ ] Ввести невалидный email (example.com) → ошибка
[ ] Ввести валидный email → ошибка исчезает
[ ] Оставить пароль пустым → ошибка
[ ] Ввести пароль → ошибка исчезает
```

---

### ЧАСТЬ 2: Email Confirmation

После успешной регистрации пользователь редиректится на:
**URL:** `http://localhost:5173/auth/confirmation?pending=1&email=...`

#### Визуальная проверка
```
[ ] Страница загружается быстро
[ ] Видно сообщение о том, что письмо отправлено
[ ] Email отображается
[ ] Кнопка "Resend email" видна
[ ] Нет горизонтального скролла
```

#### Функциональная проверка
```
[ ] Клик на "Resend email" отправляет письмо повторно
[ ] Показывается сообщение "Email sent"
[ ] Если есть таймер, он отсчитывает корректно
```

#### Нажатие на ссылку в письме
```
⚠️ ВАЖНО: проверяется в реальном email, не в dev сервере
[ ] Клик на ссылку из письма подтверждения
[ ] Редирект на /onboarding (если not completed) или /dashboard
[ ] Сессия активна (пользователь вошел)
```

---

### ЧАСТЬ 3: Onboarding

**URL:** `http://localhost:5173/onboarding`

#### Шаг 1: Health Profile

**Видимые элементы:**
```
[ ] Progress bar: "1/4" или "Step 1 of 4"
[ ] Input "Height (cm)" с placeholder "180"
[ ] Input "Weight (kg)" с placeholder "75"
[ ] 8 чипсов с целями (Energy, Sleep, Weight, etc.)
[ ] Кнопка "Next" 
[ ] Кнопка "Skip"
```

**Взаимодействие:**
```
[ ] Ввести height: 180
[ ] Ввести weight: 75
[ ] Клик на 2-3 чипсов целей (должны выделиться)
[ ] Выделенные чипсы меняют цвет
[ ] Клик на "Next" → переход на Шаг 2
```

**На мобильной версии специфично:**
```
[ ] Все 8 чипсов видны на экране (не нужно горизонтальный скролл)
[ ] Каждый чип имеет размер >= 44px (touch target)
[ ] Выделение чипса очевидно (цвет, фон)
[ ] Нет горизонтального скролла
```

#### Шаг 2: Supplements & Medications

**Видимые элементы:**
```
[ ] Progress bar: "2/4"
[ ] Textarea "Current supplements" с placeholder "Vitamin D, Omega-3"
[ ] Textarea "Current medications" с placeholder "None"
[ ] Кнопка "Previous"
[ ] Кнопка "Next"
```

**Взаимодействие:**
```
[ ] Ввести в supplements: "Vitamin D"
[ ] Ввести в medications: "None"
[ ] Клик на "Previous" → возврат на Шаг 1 (данные сохранены!)
[ ] Клик на "Next" → переход на Шаг 3
```

#### Шаг 3: Location

**Видимые элементы:**
```
[ ] Progress bar: "3/4"
[ ] Input "City"
[ ] Input "State/Province"
[ ] Select "Country" (dropdown)
[ ] Кнопка "Previous"
[ ] Кнопка "Next"
```

**Взаимодействие на мобильной версии:**
```
[ ] Ввести city: "San Francisco"
[ ] Ввести state: "CA"
[ ] Клик на Country dropdown
[ ] Dropdown открывается полной высотой (не перекрывает формы)
[ ] На мобильной версии можно скролить список стран
[ ] Выбрать страну (например, "USA")
[ ] Клик на "Next"
```

#### Шаг 4: Health Complaints

**Видимые элементы:**
```
[ ] Progress bar: "4/4" (финальный шаг)
[ ] Textarea "Describe your main complaint"
[ ] Input "Duration" (как долго)
[ ] Textarea "What have you tried"
[ ] Кнопка "+ Add another complaint"
[ ] Кнопка "Previous"
[ ] Кнопка "Complete" или "Submit"
```

**Взаимодействие:**
```
[ ] Ввести complaint: "Low energy"
[ ] Ввести duration: "2 months"
[ ] Ввести interventions: "More sleep, caffeine"
[ ] Клик на "Complete"
[ ] Ожидание обработки (может быть спиннер)
[ ] Редирект на /dashboard
```

---

### ЧАСТЬ 4: Dashboard (главная страница кабинета)

**URL:** `http://localhost:5173/dashboard`

#### Нижняя навигация (Bottom Bar)

```
[ ] Bottom bar видна внизу экрана
[ ] 5 иконок: Home | Upload | Tasks | Insights | More
[ ] Каждая иконка имеет текстовую подпись
[ ] Активная страница отмечена цветом (выделена)
[ ] Иконки имеют размер >= 44x44px
```

**На iPhone X/12+ специфично:**
```
[ ] Bottom bar не скрыта за Home Indicator
[ ] Есть отступ внизу (safe-area-inset-bottom)
[ ] Иконки полностью видны и кликабельны
```

#### Основной контент
```
[ ] Заголовок "Dashboard" или приветствие видно
[ ] Если есть "Upload labs" карточка → видна
[ ] Если есть "Recent results" → видны примеры
[ ] Все текст читаем (не обрезан)
[ ] Нет горизонтального скролла
```

#### Навигация по bottom bar
```
[ ] Клик на "Upload" → /upload (страница загружается)
[ ] Клик на "Tasks" → /assignments
[ ] Клик на "Insights" → /insights (если premium или показывает paywall)
[ ] Клик на "More" → /settings
[ ] Active состояние обновляется корректно
```

---

### ЧАСТЬ 5: Upload страница

**URL:** `http://localhost:5173/upload`

#### Визуальная проверка
```
[ ] Страница загружается полностью
[ ] Видна инструкция "Upload your lab PDF"
[ ] Видна зона для drag-drop или кнопка выбора файла
[ ] Нет горизонтального скролла
```

#### Функциональная проверка на мобильной версии
```
[ ] Клик на зону загрузки → открывается file picker
[ ] На iOS file picker предлагает Camera/Library/Files
[ ] На Android file picker предлагает Gallery/Files
[ ] После выбора файла показывается прогресс
[ ] После загрузки показывается "Processing..."
[ ] Редирект на /results/[uploadId] (примерно 5-10 сек)
```

---

### ЧАСТЬ 6: Settings страница

**URL:** `http://localhost:5173/settings`

#### Визуальная проверка
```
[ ] Форма загружается
[ ] Видно email пользователя
[ ] Видны checkboxes для уведомлений
[ ] Кнопка "Sign Out" видна внизу
[ ] Нет горизонтального скролла
```

#### Функциональная проверка
```
[ ] Перечитать одну из notification preferences (checkbox)
[ ] Сохранение происходит автоматически (или есть кнопка Save)
[ ] Показывается сообщение "Saved" (if applicable)
[ ] Клик на "Sign Out" выходит из аккаунта
[ ] Редирект на /login
[ ] Session очищена (при refresh нет cookies)
```

---

## 🐛 Проверка обработки ошибок

### Сетевые ошибки
```
[ ] Отключить интернет (Dev Tools → Network → Offline)
[ ] Попытаться отправить форму
[ ] Должно появиться сообщение об ошибке (не "blank screen")
[ ] Кнопка "Retry" позволяет повторить запрос
```

### Истекшая сессия
```
[ ] Открыть DevTools → Application → Cookies
[ ] Удалить auth_token (или все cookies)
[ ] Refresh страницы
[ ] Должен быть редирект на /login с сообщением "Session expired"
```

### Невалидные данные в Onboarding
```
[ ] Попытаться отправить Onboarding с пустыми обязательными полями
[ ] Кнопка "Complete" disabled (или невозможно кликнуть)
[ ] Показывается сообщение об ошибке
```

---

## 📊 Тестирование на разных устройствах

### iPhone (реальное устройство)
```
Safari 17+:
[ ] Все страницы загружаются < 3 сек
[ ] Нет FOUC (Flash of Unstyled Content)
[ ] Bottom bar не перекрывает контент
[ ] Safe Area уважается
[ ] Keyboard не перекрывает форму целиком
```

### Android (реальное устройство)
```
Chrome 120+:
[ ] Все страницы загружаются < 3 сек
[ ] Material Design elements отображаются корректно
[ ] System navbar не перекрывает контент
[ ] Keyboard slide-up работает нормально
```

### Desktop (эмуляция мобильной версии)
```
Chrome DevTools (Pixel 5):
[ ] F12 → Toggle device toolbar
[ ] Выбрать Pixel 5 (375x667)
[ ] Повторить все тесты из ЧАСТИ 1-6
```

---

## ✅ Чек-лист завершения

По окончании тестирования:

```
[ ] Все основные страницы доступны
[ ] Нет горизонтального скролла ни на одной странице
[ ] Все кнопки и ссылки кликабельны на мобильной версии
[ ] Forms работают и отправляют данные корректно
[ ] Валидация отображается правильно
[ ] Error handling работает (нет пустых экранов при ошибках)
[ ] Navigation работает (bottom bar, back buttons, redirects)
[ ] Данные сохраняются при переходах (Onboarding → не теряются при "Previous")
[ ] Performance приемлемой (< 3 сек loading, smooth animations)
[ ] Accessibility базовая (размеры элементов >= 44px, контраст OK)
[ ] На iOS: Safe Area поддерживается
[ ] На Android: System UI не перекрывает контент
```

---

## 🐛 Если найдены баги

### Форматирование бага
```
**Название:** Описание проблемы

**Шаги для воспроизведения:**
1. Открыть /login?signup=true
2. Ввести email
3. ...

**Ожидаемое поведение:**
Форма должна показать сообщение об ошибке

**Фактическое поведение:**
Ничего не происходит, форма зависает

**Серьёзность:** HIGH / MEDIUM / LOW

**Устройство:** iPhone 12 / Pixel 5 / Desktop emulation

**Browser:** Safari 17 / Chrome 120 / Chrome Dev Tools
```

### Пример отчёта
```
**Название:** Bottom bar навигация не работает на Pixel 5

**Шаги для воспроизведения:**
1. Открыть /dashboard на Android Pixel 5
2. Клик на "Upload" иконку в bottom bar
3. Ожидать загрузки /upload

**Ожидаемое поведение:**
Должна загрузиться страница /upload

**Фактическое поведение:**
Страница не меняется, URL не меняется

**Серьёзность:** HIGH

**Причина:** (Optional) Bottom bar onclick handler не работает на Android

**Браузер:** Chrome 120 на Android 12
```

---

## 📝 Результаты

После прохождения тестирования заполнить таблицу:

| Раздел | Статус | Браузер | Дата |
|--------|--------|---------|------|
| Sign Up | ✅ / ⚠️ / ❌ | iOS Safari 17 | 28.04.2026 |
| Email Confirmation | ✅ / ⚠️ / ❌ | Chrome Android | 28.04.2026 |
| Onboarding | ✅ / ⚠️ / ❌ | Desktop DevTools | 28.04.2026 |
| Dashboard | ✅ / ⚠️ / ❌ | iOS Safari 17 | 28.04.2026 |
| Upload | ✅ / ⚠️ / ❌ | Chrome Android | 28.04.2026 |
| Settings | ✅ / ⚠️ / ❌ | Desktop DevTools | 28.04.2026 |

---

## 🎬 Автоматизированное тестирование (опционально)

Создан Playwright тест файл: `tests/mobile-registration-flow.spec.ts`

```bash
# Установить Playwright
npm install --save-dev @playwright/test

# Запустить тесты
npx playwright install
npx playwright test tests/mobile-registration-flow.spec.ts

# Запустить в UI режиме (удобнее для отладки)
npx playwright test --ui
```

---

## 📞 Контакты и вопросы

Если есть вопросы по тестированию:
- Проверить MOBILE_VERIFICATION_REPORT.md (общая информация о роутах)
- Проверить App.jsx (структура роутов)
- Проверить Login.jsx (форма регистрации)
- Проверить Onboarding.jsx (форма онбординга)

---

**Готово к тестированию!** ✨
