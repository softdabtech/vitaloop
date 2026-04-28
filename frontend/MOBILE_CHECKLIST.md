# Чек-лист для ручной проверки мобильной версии VITALOOP

## 1. Общие требования
- [ ] Открывается главная страница, корректно отображается на мобильном устройстве
- [ ] Верхнее меню/бургер-меню адаптировано под мобильный экран
- [ ] Все основные кнопки и ссылки кликабельны, не перекрываются
- [ ] Нет горизонтального скролла, элементы не выходят за пределы экрана
- [ ] Все изображения и иконки корректно масштабируются

## 2. Проверка роутов (страниц)
**Marketing страницы:**
- [ ] / — Главная страница (Landing)
- [ ] /how-it-works — How It Works (якорь на Landing)
- [ ] /example-report — Example Report
- [ ] /for-nutritionists — For Nutritionists
- [ ] /for-investors — For Investors
- [ ] /privacy — Privacy Policy
- [ ] /terms — Terms of Service

**Авторизация:**
- [ ] /login — Sign In
- [ ] /login?signup=true — Sign Up

**Пользовательский кабинет (требуют авторизации):**
- [ ] /dashboard — Dashboard (главная страница кабинета)
- [ ] /upload — Upload Labs
- [ ] /lab-results — Lab Results List
- [ ] /assignments — Assignments
- [ ] /progress — Progress (Premium)
- [ ] /insights — Health Insights (Premium)
- [ ] /check-ins — Weekly Check-ins (Premium)
- [ ] /questionnaire — Questionnaire
- [ ] /onboarding — Onboarding
- [ ] /settings — Settings

**CRM (требуют авторизации + роль):**
- [ ] /ops — Operations Dashboard
- [ ] /crm/programs — CRM Programs
- [ ] /crm/clients — CRM Clients
- [ ] /crm/practitioners — CRM Practitioners
- [ ] /crm/activity — Activity Log

**Редиректы (legacy):**
- [ ] /checkin → /check-ins (автоматический редирект)
- [ ] /timeline → /insights (автоматический редирект)

## 3. Для каждой страницы
- [ ] UI не "плывёт", все элементы на своих местах
- [ ] Нет ошибок в консоли браузера
- [ ] Все основные действия (кнопки, формы) работают
- [ ] Если есть формы — валидация и отправка работают корректно
- [ ] Если есть списки/таблицы — скроллируются и читаемы
- [ ] Если есть модальные окна — открываются и закрываются корректно

## 4. Эндпоинты
- [ ] Все данные подгружаются (нет ошибок 4xx/5xx в Network)
- [ ] Ошибки API корректно отображаются пользователю

---

Для автоматизации можно использовать Cypress/Playwright с эмуляцией мобильного устройства и прогоном по всем роутам.