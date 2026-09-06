/**
 * Cabinet UI translations (EN / UK).
 * Usage: import { ct } from '../lib/cabinetI18n.js'
 *        const t = ct()
 *        <CabinetPageHeader title={t.dashboard.title} />
 */
import { isUkrainianLocale } from './locale.js'

const translations = {
  en: {
    dashboard: {
      title: (name) => name ? `Today, ${name}` : 'Today',
      subtitle: 'One clear next action across your health loop.',
      helper: 'Symptom-first path: concern → questions → lab plan → results → protocol → check-in → retest.',
    },
    upload: {
      title: 'Upload',
      subtitle: 'Add a lab file to see biomarker context and priorities.',
    },
    results: {
      title: 'Results & Trends',
      subtitle: 'Uploaded results, biomarker context, and longitudinal trends.',
    },
    protocol: {
      title: 'Action Plan',
      subtitle: 'Personalised supplement and lifestyle protocol based on your results.',
    },
    insights: {
      title: 'Insights',
      subtitle: 'Interpretation layer for uploads, adherence, timeline, and follow-up signals.',
      helper: 'Upload a lab result and complete a weekly check-in to unlock personalized AI insights and trend analysis.',
    },
    labResults: {
      title: 'Lab Results',
      subtitle: 'All uploaded results in one place.',
      helper: 'Top cards explain what changed, what needs attention, and what to retest next.',
    },
    labPlan: {
      title: 'Lab Plan',
      subtitle: (concern) => concern ? `Practical testing direction for: ${concern}` : 'Practical testing direction.',
      helper: 'Use this plan to decide what to check first and why before uploading results.',
    },
    assignments: {
      title: 'Assignments',
      subtitle: 'Tasks and protocols assigned by your practitioner.',
      helper: 'Use this page as your execution layer for the current protocol cycle.',
    },
    assignmentDetails: {
      title: 'Assignment',
      subtitle: 'Details and progress for this assignment.',
    },
    checkin: {
      title: 'Weekly Check-in',
      subtitle: 'Track how you feel and monitor your health loop progress.',
      helper: 'Symptom severity + adherence + side effects + red flags → next weekly adjustment.',
    },
    questionnaire: {
      title: 'Health Questionnaire',
      subtitle: 'Help us personalise your recommendations.',
      helper: 'Goal: turn a concern into a safer, clearer lab and protocol path.',
    },
    subscription: {
      title: 'Subscription',
      subtitle: 'Manage your plan and billing.',
      helper: 'See which loop stages are unlocked and manage billing details.',
    },
    billing: {
      title: 'Billing History',
      subtitle: 'Your subscription timeline and plan changes.',
      helper: 'All subscription events are listed newest-first.',
    },
    avatar: {
      title: 'Health Avatar',
      subtitle: 'Tap a body zone to see connected biomarkers and protocol recommendations.',
      helper: 'This view translates your biomarker data into an interactive body map for faster interpretation.',
    },
    healthProfile: {
      title: 'Health Profile',
      subtitle: 'Medical context, goals, and constraints that improve personalisation quality.',
      helper: 'Completing safety and context sections improves recommendation quality and reduces unsafe suggestions.',
    },
    settings: {
      title: 'Account',
      subtitle: 'Manage credentials, notifications, and account-level controls.',
    },
    subscriptionPlans: {
      free: 'Free',
      premium: 'Premium',
      currentPlan: 'Current Plan',
      upgrade: 'Upgrade',
      comingSoon: 'Coming Soon',
      selectPlan: 'Select Plan',
      cancelSubscription: 'Cancel subscription',
      manageBilling: 'Manage billing',
      activeUntil: 'Active until',
      noActiveSubscription: 'No active subscription',
      yourPlan: 'Your Plan',
    },
    assignments_extra: {
      noAssignments: 'No assignments yet.',
      viewDetails: 'View details',
      assignedBy: 'Assigned by',
    },
    checkin_extra: {
      howAreYou: 'How are you feeling today?',
      noCheckin: 'No check-ins yet.',
      submitCheckin: 'Submit check-in',
    },
    questionnaire_extra: {
      noSymptoms: 'No active symptom check.',
      startNew: 'Start new check',
    },
    insights_extra: {
      currentInsights: 'Current insights',
      biomarkerAlerts: 'Biomarker Alerts',
      noInsights: 'No insights yet — upload your first lab result.',
    },
    // Stage 2D-2: clinical/biomarker progress panel, backed by GET /progress/overview.
    // These are display-copy labels only — the underlying data (dates, values,
    // direction, status) always comes from the backend overview, never computed here.
    labProgress: {
      title: 'Clinical progress',
      helperTimeTrend: 'Backend-computed change since your previous dated result.',
      helperSnapshot: 'One dated result so far — a trend needs a second dated lab.',
      helperUndated: 'None of your results have a lab date yet — add lab dates to see progress.',
      helperEmpty: 'Upload a lab result to start tracking progress.',
      changed: 'Changed',
      stable: 'Stable',
      newMarkers: 'New / not yet comparable',
      insufficientHistory: 'Insufficient history',
      direction: { rising: 'Increased', falling: 'Decreased', stable: 'Unchanged' },
      previousLabel: 'Previous',
      latestLabel: 'Latest',
      onLabel: 'on',
      moreStable: (count) => `+${count} more stable`,
    },
  },
  uk: {
    dashboard: {
      title: (name) => name ? `Сьогодні, ${name}` : 'Сьогодні',
      subtitle: 'Ваш поточний стан і наступний крок у циклі здоров\'я.',
      helper: 'Шлях від симптому: скарга → питання → план аналізів → результати → протокол → чек-ін → повторна перевірка.',
    },
    upload: {
      title: 'Завантажити аналізи',
      subtitle: 'Додайте файл результатів, щоб побачити контекст і пріоритети біомаркерів.',
    },
    results: {
      title: 'Результати й динаміка',
      subtitle: 'Завантажені результати, контекст біомаркерів і динаміка показників.',
    },
    protocol: {
      title: 'План дій',
      subtitle: 'Персональний протокол добавок і способу життя на основі ваших результатів.',
    },
    insights: {
      title: 'Аналітика',
      subtitle: 'Інтерпретація завантажень, дотримання протоколу і сигнали для наступних кроків.',
      helper: 'Завантажте результат аналізів і пройдіть тижневий чек-ін, щоб відкрити персональну AI-аналітику й динаміку.',
    },
    labResults: {
      title: 'Результати аналізів',
      subtitle: 'Усі завантажені результати в одному місці.',
      helper: 'Верхні картки показують що змінилось, що потребує уваги і що варто перевірити повторно.',
    },
    labPlan: {
      title: 'План аналізів',
      subtitle: (concern) => concern ? `Пріоритети перевірок для: ${concern}` : 'Практичні рекомендації щодо аналізів.',
      helper: 'Цей план допомагає визначити, що перевірити першим і чому, ще до завантаження результатів.',
    },
    assignments: {
      title: 'Завдання',
      subtitle: 'Завдання та протоколи від вашого нутриціолога.',
      helper: 'Ця сторінка — ваш робочий простір для поточного циклу протоколу.',
    },
    assignmentDetails: {
      title: 'Завдання',
      subtitle: 'Деталі та прогрес по цьому завданню.',
    },
    checkin: {
      title: 'Тижневий чек-ін',
      subtitle: 'Відстежуйте самопочуття і прогрес у циклі здоров\'я.',
      helper: 'Інтенсивність симптомів + дотримання + побічні ефекти + тривожні ознаки → коригування на тиждень.',
    },
    questionnaire: {
      title: 'Анкета здоров\'я',
      subtitle: 'Допоможіть нам персоналізувати рекомендації.',
      helper: 'Мета: перетворити скаргу на безпечніший і зрозуміліший шлях аналізів та протоколу.',
    },
    subscription: {
      title: 'Підписка',
      subtitle: 'Управляйте вашим тарифом і оплатою.',
      helper: 'Перегляньте які етапи доступні та керуйте деталями оплати.',
    },
    billing: {
      title: 'Історія оплат',
      subtitle: 'Ваша хронологія підписок і змін тарифу.',
      helper: 'Усі події підписки відсортовані від найновіших.',
    },
    avatar: {
      title: 'Аватар здоров\'я',
      subtitle: 'Натисніть на зону тіла, щоб побачити пов\'язані біомаркери і рекомендації.',
      helper: 'Цей розділ показує ваші біомаркери як інтерактивну мапу тіла для швидшого розуміння.',
    },
    healthProfile: {
      title: 'Профіль здоров\'я',
      subtitle: 'Медичний контекст, цілі та обмеження для кращої персоналізації.',
      helper: 'Заповнення розділів безпеки й контексту покращує якість рекомендацій і знижує ризик небезпечних порад.',
    },
    settings: {
      title: 'Акаунт',
      subtitle: 'Управляйте даними входу, сповіщеннями й налаштуваннями.',
    },
    subscriptionPlans: {
      free: 'Безкоштовний',
      premium: 'Premium',
      currentPlan: 'Поточний тариф',
      upgrade: 'Оновити',
      comingSoon: 'Скоро',
      selectPlan: 'Обрати тариф',
      cancelSubscription: 'Скасувати підписку',
      manageBilling: 'Управляти оплатою',
      activeUntil: 'Активний до',
      noActiveSubscription: 'Немає активної підписки',
      yourPlan: 'Ваш тариф',
    },
    assignments_extra: {
      noAssignments: 'Завдань поки немає.',
      viewDetails: 'Детальніше',
      assignedBy: 'Призначив',
    },
    checkin_extra: {
      howAreYou: 'Як ви себе почуваєте сьогодні?',
      noCheckin: 'Чек-інів ще немає.',
      submitCheckin: 'Надіслати чек-ін',
    },
    questionnaire_extra: {
      noSymptoms: 'Немає активної перевірки симптомів.',
      startNew: 'Почати нову перевірку',
    },
    insights_extra: {
      currentInsights: 'Поточні висновки',
      biomarkerAlerts: 'Попередження біомаркерів',
      noInsights: 'Висновків ще немає — завантажте перший результат аналізів.',
    },
    labProgress: {
      title: 'Клінічна динаміка',
      helperTimeTrend: 'Зміна з попереднього датованого результату, розрахована на бекенді.',
      helperSnapshot: 'Поки що один датований результат — для динаміки потрібен другий датований аналіз.',
      helperUndated: 'Жоден результат ще не має дати аналізу — додайте дати, щоб побачити динаміку.',
      helperEmpty: 'Завантажте результат аналізу, щоб почати відстежувати динаміку.',
      changed: 'Змінилось',
      stable: 'Стабільно',
      newMarkers: 'Нові / ще не порівнянні',
      insufficientHistory: 'Недостатньо історії',
      direction: { rising: 'Збільшилось', falling: 'Зменшилось', stable: 'Без змін' },
      previousLabel: 'Попереднє',
      latestLabel: 'Останнє',
      onLabel: 'від',
      moreStable: (count) => `ще +${count} стабільних`,
    },
  },
}

/** Returns the current locale's translation object */
export function ct() {
  return isUkrainianLocale() ? translations.uk : translations.en
}

export default translations
