# ⚡ QUICK FIX GUIDE - КРИТИЧЕСКИЕ ПРОБЛЕМЫ КАБИНЕТА

## 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ (Требуют немедленного исправления)

---

## ISSUE #1: Avatar.jsx React Key Warning

**Файл:** `frontend/src/pages/Avatar.jsx`  
**Тип:** React Warning / React Best Practice  
**Приоритет:** ВЫСОКИЙ 

### ❌ Проблема
```jsx
// НЕПРАВИЛЬНО - нет key prop
{items.map((item) => (
  <div>{item.name}</div>
))}
```

React не может отследить переупорядочение элементов.

### ✅ Решение
```jsx
// ПРАВИЛЬНО - добавить key
{items.map((item) => (
  <div key={item.id}>{item.name}</div>
))}
```

**Альтернатива (если нет ID):**
```jsx
{items.map((item, index) => (
  <div key={`${item.name}-${index}`}>{item.name}</div>
))}
```

### 🔧 Как применить
1. Открыть `frontend/src/pages/Avatar.jsx`
2. Найти все `.map()` вызовы
3. Добавить `key={uniqueValue}` в каждый элемент
4. Запустить `npm run lint` для проверки

**Время:** ~5 минут

---

## ISSUE #2: CRM Role Hard Redirect UX

**Файл:** `frontend/src/components/dashboard/UserCabinetLayout.jsx` (строки 59-61)  
**Тип:** UX Issue / Navigation  
**Приоритет:** СРЕДНИЙ

### ❌ Проблема
```jsx
// НЕПРАВИЛЬНО - внезапный редирект без уведомления
useEffect(() => {
  if (user && isCrmRole(user)) {
    window.location.assign(CRM_BASE_URL) // Пользователь не знает почему
  }
}, [user])
```

Пользователь смущен внезапным редиректом.

### ✅ Решение
```jsx
// ПРАВИЛЬНО - уведомить перед редиректом
useEffect(() => {
  if (user && isCrmRole(user)) {
    toast.loading('Redirecting to CRM...', { duration: 2000 })
    setTimeout(() => {
      window.location.assign(CRM_BASE_URL)
    }, 500)
  }
}, [user])
```

### 🔧 Как применить
1. Открыть `UserCabinetLayout.jsx`
2. Найти `isCrmRole(user)` check (строка 59)
3. Добавить toast перед `window.location.assign()`
4. Убедиться что `react-hot-toast` импортирован

**Код для копирования:**
```jsx
import toast from 'react-hot-toast' // Добавить если нет

useEffect(() => {
  if (user && isCrmRole(user)) {
    toast.loading('Redirecting to CRM dashboard...', {
      duration: 1500,
      icon: '→'
    })
    setTimeout(() => {
      window.location.assign(CRM_BASE_URL)
    }, 500)
  }
}, [user])
```

**Время:** ~10 минут

---

## ISSUE #3: Missing Onboarding Progress Bar

**Файл:** `frontend/src/pages/Onboarding.jsx`  
**Тип:** UX Issue / User Feedback  
**Приоритет:** ВЫСОКИЙ

### ❌ Проблема
Пользователь не знает:
- На каком шаге он находится?
- Сколько шагов всего?
- Сколько осталось?

### ✅ Решение
Добавить progress bar в top:

```jsx
// ДОБАВИТЬ в Onboarding.jsx компонент

function OnboardingProgressBar({ currentStep, totalSteps }) {
  const progress = (currentStep / totalSteps) * 100
  
  return (
    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-8">
      <div
        className="h-full bg-emerald-500 transition-all duration-300"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 5

  return (
    <>
      <OnboardingProgressBar currentStep={currentStep} totalSteps={totalSteps} />
      <div className="text-sm text-slate-600 mb-6">
        Step {currentStep} of {totalSteps}
      </div>
      {/* ... rest of onboarding */}
    </>
  )
}
```

### 🔧 Как применить
1. Открыть `frontend/src/pages/Onboarding.jsx`
2. Добавить компонент прогресс-бара выше
3. Отрендерить его с корректным шагом
4. Стилизовать под дизайн (использовать Tailwind classes)

**Время:** ~15 минут

---

## 🟡 СРЕДНИЕ ПРОБЛЕМЫ (Исправить в этом спринте)

---

## ISSUE #4: Results Page Missing Biomarker Count

**Файл:** `frontend/src/pages/Results.jsx`  
**Тип:** Data Display / User Info  
**Приоритет:** СРЕДНИЙ

### ❌ Проблема
Нет информации о том, сколько биомаркеров найдено vs. ожидалось.

### ✅ Решение
Добавить заголовок над таблицей:

```jsx
// В Results.jsx, над таблицей с результатами

const foundCount = results?.biomarkers?.length || 0
const totalExpected = 45 // или получить из конфига

return (
  <>
    {/* ... existing header ... */}
    
    <div className="mb-6 flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-600">
          Found <span className="font-bold text-slate-900">{foundCount}</span> of{' '}
          <span className="font-bold">{totalExpected}</span> biomarkers
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {((foundCount / totalExpected) * 100).toFixed(0)}% coverage
        </p>
      </div>
      
      {foundCount < totalExpected && (
        <div className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
          {totalExpected - foundCount} markers not found in sample
        </div>
      )}
    </div>
    
    {/* Таблица результатов */}
  </>
)
```

**Время:** ~10 минут

---

## ISSUE #5: Subscription Date Not Displayed

**Файл:** `frontend/src/pages/BillingHistory.jsx`  
**Тип:** Missing Information  
**Приоритет:** СРЕДНИЙ

### ❌ Проблема
Пользователь не знает когда будет следующий платеж.

### ✅ Решение
Добавить "Next Billing Date" информацию:

```jsx
// В BillingHistory.jsx, в top:

export default function BillingHistory() {
  const { subscriptionData } = useSubscription() // или получить из API
  const nextBillingDate = subscriptionData?.next_billing_date
  
  return (
    <>
      <CabinetPageHeader title="Billing History" ... />
      
      {nextBillingDate && (
        <motion.div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">Next billing date:</span>{' '}
            {new Date(nextBillingDate).toLocaleDateString()}
          </p>
        </motion.div>
      )}
      
      {/* Таблица истории платежей */}
    </>
  )
}
```

**Время:** ~10 минут

---

## ISSUE #6: No Session Timeout Handling

**Файл:** `frontend/src/lib/api.js`  
**Тип:** Security / Error Handling  
**Приоритет:** СРЕДНИЙ

### ❌ Проблема
Когда токен истекает, пользователь получает ошибку 401 без явного сообщения.

### ✅ Решение
Добавить response interceptor:

```jsx
// frontend/src/lib/api.js

import axios from 'axios'
import { supabase } from './supabase'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

// Добавить response interceptor
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Token истек или невалиден
      toast.error('Your session has expired. Please sign in again.')
      
      // Sign out
      await supabase.auth.signOut()
      
      // Редирект на login
      window.location.href = '/login'
    }
    
    return Promise.reject(error)
  }
)

export default api
```

**Время:** ~15 минут

---

## 🟢 НИЗКОПРИОРИТЕТНЫЕ (Можно отложить)

---

## ISSUE #7: Console Warnings Cleanup

**Файл:** Разные файлы  
**Тип:** Code Quality  
**Приоритет:** НИЗКИЙ

### ❌ Проблема
В production коде есть `console.log()` вызовы.

### ✅ Решение
```bash
# Найти все console.log
grep -r "console\.log" frontend/src --include="*.jsx" --include="*.js"

# Удалить их все
grep -r "console\." frontend/src --include="*.jsx" --include="*.js" | grep -v node_modules
```

**Или установить eslint правило:**
```jsx
// .eslintrc.json
{
  "rules": {
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

**Время:** ~20 минут

---

## ISSUE #8: Add Error Boundary

**Файл:** `frontend/src/App.jsx`  
**Тип:** Robustness  
**Приоритет:** НИЗКИЙ

### ❌ Проблема
Если компонент крашнется, весь кабинет не работает.

### ✅ Решение
```jsx
// frontend/src/components/ErrorBoundary.jsx

import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Oops! Something went wrong</h1>
            <p className="text-slate-600 mt-2">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
```

**Использование в App.jsx:**
```jsx
<ErrorBoundary>
  <BrowserRouter>
    {/* ... routes ... */}
  </BrowserRouter>
</ErrorBoundary>
```

**Время:** ~25 минут

---

## 📋 CHECKLIST ИСПРАВЛЕНИЙ

### Этап 1: СРОЧНО (сегодня)
- [ ] Fix Avatar.jsx key props
- [ ] Add CRM redirect toast
- [ ] Add onboarding progress bar

**Время:** ~30 минут  
**Приоритет:** CRITICAL

### Этап 2: ВАЖНО (завтра)
- [ ] Add biomarker count to Results
- [ ] Display next billing date
- [ ] Add session timeout handling

**Время:** ~35 минут  
**Приоритет:** HIGH

### Этап 3: NICE-TO-HAVE (в спринте)
- [ ] Clean up console warnings
- [ ] Add error boundary
- [ ] Improve loading states

**Время:** ~45 минут  
**Приоритет:** MEDIUM

---

## 🧪 ТЕСТИРОВАНИЕ ПОСЛЕ ИСПРАВЛЕНИЙ

После каждого исправления:

```bash
# 1. Запустить dev сервер
npm run dev

# 2. Запустить linter
npm run lint

# 3. Проверить в браузере
# - Нет console errors
# - UI выглядит правильно
# - Функциональность работает

# 4. Запустить QA скрипты
npm run qa

# 5. Перед production build
npm run build
```

---

## 📞 КОНТАКТЫ И ПОДДЕРЖКА

Если что-то непонятно:
1. Прочитать соответствующий раздел в основном отчете
2. Проверить детальные test cases в `CABINET_TEST_CASES_2026-05-18.md`
3. Запустить QA скрипты для проверки

---

**Документ подготовлен:** 2026-05-18  
**Для:** Development Team  
**Статус:** READY FOR IMPLEMENTATION
