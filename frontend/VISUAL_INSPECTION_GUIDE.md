# 🎨 Руководство по визуальной проверке мобильной вёрстки

**Версия:** 3.2.1  
**Дата:** 28 апреля 2026

---

## 🚀 БЫСТРЫЙ СТАРТ (2 МИНУТЫ)

```bash
# Терминал 1: Запустить dev сервер
cd frontend
npm run dev
# Будет доступен на http://localhost:5173

# Терминал 2: Запустить скрипт проверки вёрстки
cd frontend
node scripts/check-mobile-layout.mjs
```

Затем:
1. Открыть `http://localhost:5173` в браузере
2. Включить мобильный режим (F12 → Device Toolbar)
3. Выбрать устройство (Pixel 5 или iPhone 12)
4. Следовать чек-листу ниже

---

## ✅ ЧЕК-ЛИСТ ВЁРСТКИ (10 МИНУТ)

### Откройте каждую страницу и проверьте:

#### 1. ГОРИЗОНТАЛЬНЫЙ СКРОЛЛ ❌

**Самая частая ошибка!**

```
На КАЖДОЙ странице:
1. F12 → Device Toolbar
2. Выбрать Pixel 5 (375px) или iPhone 12 (390px)
3. Попытаться скролить влево-вправо
   ✅ ОК: Скролл ВЕРТИКАЛЬНЫЙ только (вверх-вниз)
   ❌ BUG: Можно скролить ВЛЕВО-ВПРАВО
```

**Как проверить программно:**
```javascript
// Открыть DevTools Console (F12)
document.body.scrollWidth > document.body.clientWidth
// Результат:
// true  = ЕСТЬ горизонтальный скролл ❌
// false = НОРМАЛЬНО ✅
```

---

#### 2. РАЗМЕРЫ КНОПОК 🎯

**Кнопки должны быть >= 44x44px (iOS/Android требование)**

```
На странице /login:
1. Найти кнопку "Sign in"
2. F12 → Inspect Element на кнопке
3. Посмотреть в DevTools вкладка "Styles"
   - height: должно быть >= 44px ✅
   - Минимальная ширина >= 44px ✅
4. На мобильной версии одного тапа должно хватать
```

**Быстро проверить все кнопки:**
```javascript
// В DevTools Console:
document.querySelectorAll('button').forEach(btn => {
  const rect = btn.getBoundingClientRect();
  if (rect.height < 44 || rect.width < 44) {
    console.warn('Маленькая кнопка:', btn.textContent, rect);
  }
});
```

---

#### 3. ТЕКСТ В КНОПКАХ 📝

**Текст ДОЛЖЕН быть полностью виден**

```
❌ БЕЗ: "Sign up for free →" обрезано до "Sign up for…"
✅ С: "Sign up for free →" полностью видно

Как проверить:
1. Смотри на каждую кнопку на странице
2. Текст должен быть ПОЛНОСТЬЮ видим (не обрезан)
3. Если видишь "…" в конце текста → BUG

В DevTools можно проверить:
const btn = document.querySelector('button');
btn.scrollWidth > btn.clientWidth  // true = текст переполняется
```

---

#### 4. INPUT ПОЛЯ 🔤

**Input поля должны быть видны ПОЛНОСТЬЮ**

```
✅ ОК:
[====== Email field ======]
[====== Password field ===]
[====== Sign Up ====]

❌ BUG:
[==== Email field ==== |  <- обрезано справа
[==== Password fie ---- |  <- обрезано и текст внутри обрезан
```

**Как проверить:**
```javascript
// В DevTools Console на странице /login:
document.querySelectorAll('input').forEach(input => {
  const rect = input.getBoundingClientRect();
  const viewport = window.innerWidth;
  if (rect.left + rect.width > viewport) {
    console.warn('Input выходит за экран:', input);
  }
});
```

---

#### 5. КНОПКИ "ПЛЫВУТ" при ROTATE 📱

**При поворте экрана элементы НЕ должны прыгать**

```
Проверка:
1. Открыть /dashboard в мобильном режиме (портрет)
2. Посмотреть на bottom bar с 5 иконками
3. Повернуть экран на ландшафт (Ctrl+Shift+K в DevTools)
4. Посмотреть на bottom bar
   ✅ ОК: Иконки остались на месте, просто экран шире
   ❌ BUG: Иконки прыгают, сдвигаются, исчезают

Проверка input'ов:
1. Открыть /login
2. Кликнуть на input (появится клавиатура)
3. Посмотреть на form
   ✅ ОК: Form не сдвигается вверх, только скролит page
   ❌ BUG: Form прыгает, перемещается, elements сдвигаются
```

---

#### 6. МОБИЛЬНАЯ КЛАВИАТУРА 🔤

**Клавиатура НЕ должна перекрывать form целиком**

```
Проверка на iOS/Android:
1. Открыть /login на реальном iPhone/Pixel
2. Кликнуть на input поле
3. Появится клавиатура
   ✅ ОК: Form видна хотя бы на 50%, можно скролить
   ❌ BUG: Form полностью перекрыта клавиатурой

Стандартная высота клавиатуры:
- iOS: ~300-350px
- Android: ~300-400px

Решение:
- Использовать scrollIntoView() при фокусе input
- Или сдвигать form вверх при focus input
```

---

#### 7. SAFE AREA (iPhone X+) 📍

**На iPhone X, 12, 13, 14 (с notch) bottom bar должна быть выше**

```
Проверка:
1. Открыть /dashboard
2. Посмотреть на bottom bar
   ✅ ОК: Иконки не скрыты за Home Indicator
         Есть отступ снизу (~20-30px)
   ❌ BUG: Иконки скрыты за home button
         Нет отступа снизу

В коде должно быть:
.bottom-bar {
  padding-bottom: max(10px, env(safe-area-inset-bottom));
}
```

---

## 📱 ПРОВЕРКА ПО СТРАНИЦАМ

### ✅ /login (Sign In)

```
1. Горизонтальный скролл?          NO ✅
2. Email input виден полностью?    YES ✅
3. Password input виден?           YES ✅
4. Toggle "Show" кнопка работает?  YES ✅
5. Кнопка "Sign In" >= 44px?       YES ✅
6. Текст "Sign In" полностью виден? YES ✅
7. Ошибки валидации видны?        YES ✅
```

### ✅ /login?signup=true (Sign Up)

```
1. Горизонтальный скролл?          NO ✅
2. Email input виден полностью?    YES ✅
3. Password input виден?           YES ✅
4. reCAPTCHA видна?                YES ✅
5. Кнопка "Sign Up" >= 44px?       YES ✅
6. Текст "Sign up for free" виден? YES ✅
7. Нет перекрытия элементов?       YES ✅
```

### ✅ /onboarding (4 шага)

**Шаг 1: Health Profile**
```
1. Height input виден?       YES ✅
2. Weight input виден?       YES ✅
3. 8 Goal chips видны?       YES ✅ (нет горизонтального скролла!)
4. Next кнопка работает?     YES ✅
5. Нет горизонтального скролла для выбора целей? YES ✅
```

**Шаг 2: Supplements**
```
1. Textarea видна полностью? YES ✅
2. Кнопки Next/Previous работают? YES ✅
```

**Шаг 3: Location**
```
1. City input виден?         YES ✅
2. Country dropdown работает? YES ✅
3. Dropdown не выходит за экран? YES ✅
4. На мобильной версии можно скролить список? YES ✅
```

**Шаг 4: Complaints**
```
1. Textarea видна полностью? YES ✅
2. Кнопка Complete работает? YES ✅
```

### ✅ /dashboard

```
1. Горизонтальный скролл?     NO ✅
2. Top bar (Dashboard название) видна? YES ✅
3. Bottom bar с 5 иконками видна? YES ✅
4. Каждая иконка >= 44px?     YES ✅
5. Иконки не "плывут" при rotate? YES ✅
6. На iPhone: safe-area работает? YES ✅
7. Основной контент видим?    YES ✅
```

### ✅ /upload

```
1. Горизонтальный скролл?     NO ✅
2. Upload кнопка видна?       YES ✅
3. File picker работает?      YES ✅ (на iOS и Android)
```

### ✅ /settings

```
1. Горизонтальный скролл?     NO ✅
2. Email видно?               YES ✅
3. Checkboxes видны?          YES ✅
4. Sign Out кнопка видна?     YES ✅
```

---

## 🔬 ИНСПЕКТИРОВАНИЕ ЭЛЕМЕНТОВ

### Как быстро проверить элемент в DevTools

```
1. F12 → открыть DevTools
2. Ctrl+Shift+C (или иконка "Inspect") → выбрать элемент
3. Посмотреть в левой части:
   - Computed tab → видны все CSS свойства
   - Box Model → видны размеры (width, height, padding, margin)

Что нужно проверить:
- width: должна быть в пикселях или % (не 100vw)
- height: кнопка >= 44px
- overflow: не должна быть скрыта (hidden)
- display: должна быть visible (не none, не hidden)
- max-width: если задана, не должна быть слишком маленькой
```

---

## 🧪 АВТОМАТИЗИРОВАННАЯ ПРОВЕРКА

### Запустить Playwright тесты (требует установки)

```bash
cd frontend

# Установка (один раз)
npm install --save-dev @playwright/test
npx playwright install

# Запуск тестов вёрстки
npx playwright test tests/mobile-layout-visual.spec.ts

# Результат:
# ✅ 10 passed
# ❌ 2 failed (если есть проблемы)
```

### Запустить Node.js скрипт проверки (быстро)

```bash
cd frontend
node scripts/check-mobile-layout.mjs
```

---

## 🐛 ТИПИЧНЫЕ ПРОБЛЕМЫ И КАК ИХ НАЙТИ

### Проблема 1: Горизонтальный скролл

**Как найти:**
```javascript
// DevTools Console
document.body.scrollWidth - document.body.clientWidth
// Результат > 0 = ЕСТЬ горизонтальный скролл
```

**Где ищи в CSS:**
- `width: 100vw` (плохо!) → измени на `width: 100%`
- Элемент с `position: fixed` и `width: 100vw`
- Контейнер без `max-width` или `overflow: hidden`

**Как исправить:**
```css
/* ❌ ПЛОХО */
body {
  width: 100vw;
}

/* ✅ ХОРОШО */
body {
  width: 100%;
  overflow-x: hidden;
}
```

---

### Проблема 2: Обрезанный текст

**Как найти:**
```javascript
// DevTools Console
const btn = document.querySelector('button');
btn.scrollWidth > btn.clientWidth  // true = текст обрезан
```

**Где ищи в CSS:**
- `width: 100px` (фиксированная ширина кнопки)
- `white-space: nowrap` (текст не переносится)
- `overflow: hidden` (текст обрезан)

**Как исправить:**
```css
/* ❌ ПЛОХО */
button {
  width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ✅ ХОРОШО */
button {
  max-width: 100%;
  padding: 12px 16px;
  overflow-wrap: break-word;
  word-break: break-word;
}
```

---

### Проблема 3: Маленькие кнопки

**Как найти:**
```javascript
// DevTools Console
document.querySelectorAll('button').forEach(btn => {
  const rect = btn.getBoundingClientRect();
  if (rect.height < 44 || rect.width < 44) {
    console.warn('Маленькая кнопка:', btn);
  }
});
```

**Где ищи в CSS:**
- `height: 30px` или меньше
- `padding: 2px 4px` (слишком маленький паддинг)

**Как исправить:**
```css
/* ❌ ПЛОХО */
button {
  height: 30px;
  padding: 2px 4px;
}

/* ✅ ХОРОШО */
button {
  min-height: 44px;
  min-width: 44px;
  padding: 12px 16px;
}
```

---

### Проблема 4: Элементы выходят за экран

**Как найти:**
```javascript
// DevTools Console
const rect = element.getBoundingClientRect();
const viewport = window.innerWidth;
if (rect.left + rect.width > viewport) {
  console.warn('Элемент выходит за экран:', element);
}
```

**Где ищи в CSS:**
- `position: fixed` без `max-width` или `width: 100%`
- Элемент с padding/margin выходит за границы
- Контейнер с `display: flex` без `flex-wrap`

**Как исправить:**
```css
/* ❌ ПЛОХО */
.container {
  position: fixed;
  width: 100vw;
  left: 0;
}

/* ✅ ХОРОШО */
.container {
  position: fixed;
  left: 0;
  right: 0;
  max-width: 100%;
}
```

---

## 📊 ФИНАЛЬНЫЙ ЧЕКЛИСТ

```
ПЕРЕД ОТПРАВКОЙ НА PRODUCTION:

[ ] Проверил /login на портрете
[ ] Проверил /login на ландшафте
[ ] Проверил /login?signup=true на портрете
[ ] Проверил /login?signup=true на ландшафте
[ ] Проверил /onboarding все 4 шага
[ ] Проверил /dashboard на портрете
[ ] Проверил /dashboard на ландшафте
[ ] Проверил /upload на портрете
[ ] Проверил /settings на портрете

[ ] НЕТ горизонтального скролла ни на одной странице
[ ] Все кнопки >= 44px высоты
[ ] Все текст в кнопках виден полностью (не обрезан)
[ ] Все input поля видны полностью
[ ] Bottom bar на iPhone: safe-area работает
[ ] Нет элементов, выходящих за экран

[ ] На iPhone 12/13/14: notch не перекрывает контент
[ ] На Android Pixel 5: system navbar не перекрывает контент
[ ] На iPad 768px: форма не растянута на всю ширину

[ ] Все ссылки/кнопки ведут на нужные роуты
[ ] После rotate экрана: данные в форме сохранились
[ ] После rotate экрана: элементы НЕ прыгают
```

---

## 📞 БЫСТРАЯ СПРАВКА

```
Проверить горизонтальный скролл:
→ document.body.scrollWidth > document.body.clientWidth

Проверить размер кнопки:
→ document.querySelector('button').getBoundingClientRect()

Проверить обрезан ли текст:
→ element.scrollWidth > element.clientWidth

Инспектировать элемент:
→ F12 → Ctrl+Shift+C → кликнуть на элемент

Посмотреть iOS/Android специфичное:
→ F12 → Device Toolbar → выбрать устройство
```

---

**Готово к проверке! ✨**
