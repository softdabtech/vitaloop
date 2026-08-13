import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  ClipboardList,
  FileSearch,
  Layers3,
  HeartPulse,
  Menu,
  MessageCircle,
  SearchCheck,
  Sparkles,
  X,
  Zap,
  Moon,
  Brain,
  Scale,
  Scissors,
  HeartHandshake,
  Thermometer,
  Dumbbell,
  Baby,
  Leaf,
  Wind,
  Droplets,
  TrendingDown,
  Timer,
  AlertCircle,
} from 'lucide-react'
import Seo from '../components/Seo.jsx'
import api from '../lib/api.js'
import { getPublicFunnelSessionId, trackPublicFunnelEvent } from '../lib/publicFunnel.js'

const HERO_IMAGE = '/images/ua-health-hero-dashboard-ua-20260606.jpg'
const BRAND_MARK_IMAGE = '/images/ua-vitaloop-mark-160-20260606.png'
const UA_OG_IMAGE = 'https://ua.vitaloop.today/images/ua-og-preview-20260604.png'

export const CTA_CLASS =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#0f766e_0%,#14b8a6_58%,#d4b483_135%)] px-5 py-3 text-center text-sm font-black leading-tight text-white shadow-[0_14px_34px_rgba(15,118,110,0.24)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,118,110,0.32)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0f766e]/20 sm:whitespace-nowrap'

export const NAV_LINKS = [
  { label: 'Як це працює', id: 'how', path: '/samopochuttia', anchor: 'how' },
  { label: 'Симптоми', id: 'wellbeing', path: '/symptomy', anchor: 'wellbeing' },
  { label: 'Аналізи', id: 'labs', path: '/analizy', anchor: 'laboratories' },
  { label: 'Центр знань', id: 'articles', path: '/health-hub', anchor: null },
  { label: 'Тарифи', id: 'pricing', path: '/tarify', anchor: 'pricing' },
  { label: 'FAQ', id: 'faq', path: '/#faq', anchor: 'faq' },
]

const LAB_UPLOAD_POINTS = [
  { title: 'PDF із кабінету лабораторії', body: 'Завантажуйте файл, який отримали після здачі аналізів.' },
  { title: 'Фото або скан бланка', body: 'Підійде чітке фото, якщо PDF недоступний.' },
  { title: 'Українські одиниці та референси', body: 'Сервіс зберігає показники, одиниці й межі в одному зрозумілому вигляді.' },
]

// Expanded symptom groups — mapped to 95+ biomarkers from knowledge base
const SYMPTOM_GROUPS = [
  {
    label: 'Енергія та відновлення', icon: '⚡',
    items: ['Постійна втома', 'Поганий сон', 'Низька енергія', 'Довго прокидаюсь / важко вставати'],
  },
  {
    label: 'Голова та настрій', icon: '🧠',
    items: ['Туман у голові / brain fog', 'Тривожність / нервозність', 'Перепади настрою', 'Часті головні болі'],
  },
  {
    label: 'Вага та метаболізм', icon: '⚖️',
    items: ['Не можу схуднути', 'Набір ваги без видимої причини', 'Тяга до солодкого / цукру'],
  },
  {
    label: 'Шкіра, волосся, нігті', icon: '💇',
    items: ['Випадіння волосся', 'Ламкі нігті / суха шкіра', 'Висипання / акне', 'Повільне загоєння ран'],
  },
  {
    label: 'М\'язи та суглоби', icon: '💪',
    items: ['М\'язова слабкість', 'Болі в суглобах / м\'язах', 'Судоми в литках / м\'язах'],
  },
  {
    label: 'Серце та судини', icon: '❤️',
    items: ['Серцебиття / аритмія', 'Холодні руки і ноги', 'Набряки ніг або рук'],
  },
  {
    label: 'Імунітет', icon: '🛡️',
    items: ['Часті застуди / хвороби', 'Довге відновлення після хвороби', 'Алергія / підвищена реакція'],
  },
  {
    label: 'Гормони та статеве здоров\'я', icon: '🔬',
    items: ['Порушення менструального циклу', 'Зниження лібідо', 'Планую вагітність', 'ПМС / важка менструація'],
  },
  {
    label: 'Травлення', icon: '🍃',
    items: ['Здуття / дискомфорт після їжі', 'Нерегулярне травлення'],
  },
  {
    label: 'Дитяче здоров\'я', icon: '👶',
    items: ['Проблема у дитини (ріст, розвиток, імунітет)'],
  },
]

// Flatten for backward compat
const SYMPTOM_OPTIONS = SYMPTOM_GROUPS.flatMap(g => g.items)

// Symptom → relevant biomarkers (Ukrainian names for result display)
const SYMPTOM_BIOMARKERS = {
  'Постійна втома':                 ['Феритин', 'Вітамін D', 'Гемоглобін', 'ТТГ', 'Вітамін B12', 'Кортизол'],
  'Поганий сон':                    ['Кортизол', 'Магній', 'ТТГ', 'Вітамін D'],
  'Низька енергія':                 ['Феритин', 'Вітамін B12', 'Вітамін D', 'Глюкоза', 'ТТГ'],
  'Довго прокидаюсь / важко вставати': ['Кортизол', 'ТТГ', 'Вітамін D', 'Феритин'],
  'Туман у голові / brain fog':     ['Вітамін B12', 'Вітамін D', 'Глюкоза', 'ТТГ', 'Феритин'],
  'Тривожність / нервозність':      ['Кортизол', 'Магній', 'Вітамін D', 'ТТГ'],
  'Перепади настрою':               ['Вітамін D', 'Вітамін B12', 'Кортизол', 'Естрадіол', 'Прогестерон'],
  'Часті головні болі':             ['Магній', 'Гомоцистеїн', 'Кортизол', 'АТ (тиск)'],
  'Не можу схуднути':               ['Інсулін', 'HOMA-IR', 'ТТГ', 'Кортизол', 'ЛГ/ФСГ'],
  'Набір ваги без видимої причини': ['ТТГ', 'Кортизол', 'Інсулін', 'Естрадіол'],
  'Тяга до солодкого / цукру':      ['Глюкоза', 'HbA1c', 'Інсулін', 'Магній', 'Хром'],
  'Випадіння волосся':              ['Феритин', 'ТТГ', 'Цинк', 'Селен', 'Тестостерон (для жінок)'],
  'Ламкі нігті / суха шкіра':      ['Цинк', 'Вітамін A', 'Вітамін E', 'Селен', 'Залізо'],
  'Висипання / акне':               ['Тестостерон', 'ДГЕА-С', 'Інсулін', 'Цинк', 'Вітамін A'],
  'Повільне загоєння ран':          ['Цинк', 'Вітамін C', 'Вітамін D', 'Глюкоза'],
  'М\'язова слабкість':             ['Вітамін D', 'Магній', 'Кортизол', 'Кальцій', 'КФК'],
  'Болі в суглобах / м\'язах':      ['Вітамін D', 'Сечова кислота', 'СРБ', 'Гомоцистеїн'],
  'Судоми в литках / м\'язах':      ['Магній', 'Кальцій', 'Калій', 'Вітамін D'],
  'Серцебиття / аритмія':           ['Магній', 'Калій', 'ТТГ', 'Вільний T4', 'Феритин'],
  'Холодні руки і ноги':            ['ТТГ', 'Гемоглобін', 'Феритин', 'Вільний T4'],
  'Набряки ніг або рук':            ['Альбумін', 'Креатинін', 'ШКФ', 'Загальний білок'],
  'Часті застуди / хвороби':        ['Вітамін D', 'Цинк', 'Селен', 'Феритин'],
  'Довге відновлення після хвороби':['Вітамін D', 'Цинк', 'Вітамін C', 'Феритин'],
  'Алергія / підвищена реакція':    ['Вітамін D', 'Еозинофіли', 'IgE загальний'],
  'Порушення менструального циклу': ['Естрадіол', 'Прогестерон', 'ФСГ', 'ЛГ', 'АМГ', 'ТТГ'],
  'Зниження лібідо':                ['Тестостерон', 'ДГЕА-С', 'Кортизол', 'ГСПГ', 'Естрадіол'],
  'Планую вагітність':              ['АМГ', 'ФСГ', 'Прогестерон', 'Фолат', 'Вітамін D', 'ТТГ'],
  'ПМС / важка менструація':        ['Прогестерон', 'Магній', 'Вітамін B6', 'Феритин'],
  'Здуття / дискомфорт після їжі':  ['Глюкоза', 'Інсулін', 'Загальний аналіз крові'],
  'Нерегулярне травлення':          ['Загальний аналіз крові', 'Вітамін B12', 'Феритин'],
  'Проблема у дитини (ріст, розвиток, імунітет)': ['Вітамін D', 'Феритин', 'Цинк', 'Загальний аналіз крові'],
}

const SYMPTOM_ALIASES = {
  'Важко прокидатись': 'Довго прокидаюсь / важко вставати',
  'Туман у голові': 'Туман у голові / brain fog',
  'Тривожність': 'Тривожність / нервозність',
  'Головні болі': 'Часті головні болі',
  'Набір ваги': 'Набір ваги без видимої причини',
  'Тяга до солодкого': 'Тяга до солодкого / цукру',
  'Суха шкіра / нігті': 'Ламкі нігті / суха шкіра',
  'Акне / висипання': 'Висипання / акне',
  'Болі у суглобах': 'Болі в суглобах / м\'язах',
  'Судоми м\'язів': 'Судоми в литках / м\'язах',
  'Порушення циклу': 'Порушення менструального циклу',
}

const biomarkersForSymptom = (symptom) => SYMPTOM_BIOMARKERS[SYMPTOM_ALIASES[symptom] || symptom] || []

const DURATION_OPTIONS = [
  { value: 'до 2 тижнів', label: 'До 2 тижнів' },
  { value: '2-8 тижнів', label: '2-8 тижнів' },
  { value: 'понад 2 місяці', label: 'Понад 2 місяці' },
  { value: 'повертається хвилями', label: 'Повертається хвилями' },
]

const AGE_OPTIONS = ['до 18', '18-29', '30-44', '45-59', '60+']

const FAMILY_CONTEXT_OPTIONS = [
  'Для себе',
  'Для дитини',
  'Для партнера/партнерки',
  'Для батьків',
]

const HAS_LABS_OPTIONS = [
  { value: 'yes', label: 'Так, є результати' },
  { value: 'partial', label: 'Є деякі' },
  { value: 'no', label: 'Ще немає' },
]

const PRIORITY_COPY = {
  stable: { label: 'Стабільний сигнал', className: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  watch: { label: 'Варто відстежити', className: 'bg-amber-100 text-amber-800 ring-amber-200' },
  attention: { label: 'Потребує уваги', className: 'bg-rose-100 text-rose-800 ring-rose-200' },
}

const FLOW_STEPS = [
  {
    title: 'Опишіть симптоми', icon: MessageCircle,
    body: 'Оберіть 1–3 сигнали з 30 симптомних категорій: сон, енергія, волосся, метаболізм, гормони, травлення. AI-система одразу формує список ймовірних аналізів.',
  },
  {
    title: 'Отримайте пріоритети аналізів', icon: SearchCheck,
    body: 'База з 110 правил оцінки здоров\'я та 95+ біомаркерів підбирає перелік аналізів для вашої ситуації — з поясненням, чому кожен із них важливий.',
  },
  {
    title: 'Завантажте результати лабораторії', icon: FileSearch,
    body: 'PDF або фото бланка з будь-якої лабораторії. AI зчитує показники, одиниці і референси, порівнює з нормами та виділяє відхилення.',
  },
  {
    title: 'Отримайте персональний підсумок', icon: ClipboardList,
    body: 'Зрозумілий звіт: що в нормі, що потребує уваги, питання до лікаря і конкретний наступний крок — без медичного жаргону.',
  },
  {
    title: 'Відстежуйте динаміку', icon: BarChart3,
    body: 'Порівнюйте повторні аналізи, фіксуйте зміни самопочуття, перевіряйте ефективність дій у тижневому чек-іні.',
  },
]

const RESULT_EXAMPLE = [
  { label: 'Симптоми', value: 'Постійна втома, поганий сон, випадіння волосся, туман у голові' },
  { label: 'Пріоритетні аналізи', value: 'Феритин + ЗЗЗЕ, ЗАК, 25(OH)D, ТТГ + вільний Т4, Вітамін B12' },
  { label: 'Що потребує уваги', value: 'Феритин і 25(OH)D нижчі за референси в умовному бланку; ТТГ варто читати разом із симптомами та вільним Т4.' },
  { label: 'Питання до лікаря', value: 'Як інтерпретувати результати в моєму контексті? Чи потрібні додаткові обстеження та коли повторити аналізи?' },
  { label: 'Наступний крок', value: 'Обговорити результати з лікарем, узгодити план і зберегти повторні показники для порівняння.' },
]

const EDUCATION_ARTICLES = [
  { title: 'Постійна втома: з чого почати', path: '/health-hub/postiyna-vtoma', body: 'Симптоми, аналізи першої лінії і питання до лікаря.' },
  { title: 'Феритин і втома', path: '/health-hub/ferytyn-ta-vtoma', body: 'Як запаси заліза пов\'язані з енергією, волоссям і відновленням.' },
  { title: 'Вітамін D: що означають цифри', path: '/health-hub/vitamin-d-vtoma', body: 'Норма, дефіцит, одиниці виміру і безпечна корекція.' },
  { title: 'ТТГ і щитоподібна залоза', path: '/health-hub/shchytovydna-zaloza-tsh', body: 'Коли одного ТТГ недостатньо і що обговорити з лікарем.' },
  { title: 'Інсулін, вага і тяга до солодкого', path: '/health-hub/insulin-i-vaga', body: 'Метаболічні сигнали до діабету і корисні аналізи.' },
  { title: 'Випадіння волосся: які аналізи', path: '/health-hub/volossia-ta-analizy', body: 'Феритин, щитоподібна, дефіцити і гормональний контекст.' },
]

export const PRICING = [
  {
    name: 'Безкоштовно',
    price: '0 грн',
    note: 'для першого знайомства',
    description: 'Оцініть свій стан, отримайте перший підсумок і зрозумійте, з чого варто починати.',
    features: [
      'AI-оцінка самопочуття (30 симптомів)',
      '1 завантаження аналізів з лабораторії',
      'Розбір до 10 біомаркерів',
      'Короткий підсумок і пріоритети',
      'Список питань до лікаря',
    ],
    cta: 'Почати безкоштовно',
    featured: false,
  },
  {
    name: 'Premium',
    price: '199 грн/міс',
    note: 'для регулярного контролю',
    description: 'Необмежені аналізи, AI-протокол, 95+ біомаркерів і щотижневий чек-ін стану здоров\'я.',
    features: [
      'Необмежені завантаження аналізів',
      '95+ біомаркерів із поясненнями',
      'Повний AI-підсумок і рекомендації',
      'Динаміка показників у часі',
      'Тижневий чек-ін самопочуття',
      'Питання до лікаря + наступні кроки',
    ],
    cta: 'Спробувати Premium',
    featured: true,
  },
  {
    name: 'Для нутриціолога',
    price: 'Очікується',
    note: 'для практикуючих спеціалістів',
    description: 'Ведення клієнтів, порівняльний аналіз динаміки та персональні протоколи для кожного.',
    features: [
      'Профілі клієнтів і пацієнтів',
      'Призначення аналізів і чек-ін',
      'Порівняльна динаміка стану',
      'Інтеграція з лабораторіями',
    ],
    cta: 'Залишити заявку',
    featured: false,
    comingSoon: true,
  },
]

const FAQ_ITEMS = [
  {
    question: 'Чи замінює Vitaloop лікаря?',
    answer: 'Ні. Vitaloop — освітній сервіс. Він допомагає структурувати симптоми, розуміти аналізи і підготувати конкретні питання до консультації. Діагнозів не ставить і лікування не призначає.',
  },
  {
    question: 'Скільки біомаркерів аналізує Vitaloop?',
    answer: 'Понад 95 біомаркерів: загальний аналіз крові, залізо, вітаміни (D, B12, A, E), щитовидна залоза, глюкоза і HbA1c, ліпідний профіль, гормони (тестостерон, естрадіол, прогестерон, кортизол), запальні маркери (СРБ, гомоцистеїн), нирки, печінка та ін.',
  },
  {
    question: 'Можна почати без аналізів?',
    answer: 'Так. Оцінка самопочуття доступна з першого кроку — оберіть 1–3 симптоми і отримайте список ймовірних пріоритетних аналізів. Результати лабораторії можна додати пізніше.',
  },
  {
    question: 'Які формати аналізів підтримуються?',
    answer: 'PDF з лабораторного кабінету, чітке фото або скан бланка. Якість розпізнавання залежить від структури та якості файлу, тому перед аналізом показники потрібно перевірити.',
  },
  {
    question: 'Що таке 110 правил оцінки здоров\'я?',
    answer: 'Версіонована база знань Vitaloop містить правила, які пов\'язують симптоми, лабораторні показники, контекст безпеки та наступні кроки. Вони формують освітні пояснення, а не встановлюють діагноз.',
  },
  {
    question: 'Як Vitaloop захищає медичні дані?',
    answer: 'Доступ до даних прив\'язаний до вашого акаунта. Ми не продаємо медичні дані; для роботи сервісу можуть використовуватися перевірені технічні постачальники. Деталі, строки зберігання та права на експорт і видалення описані в політиці конфіденційності.',
  },
  {
    question: 'Чи можна використовувати для дітей?',
    answer: 'Так, є окрема категорія симптомів для дитячого здоров\'я. Будь-які рішення щодо дитячого здоров\'я потрібно обговорювати з педіатром — Vitaloop допомагає структурувати спостереження і підготувати питання.',
  },
]

const SCHEMA_FAQ = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
}

const SCHEMA_SOFTWARE = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Vitaloop Ukraine',
  applicationCategory: 'HealthApplication',
  operatingSystem: 'Web',
  url: 'https://ua.vitaloop.today/',
  inLanguage: 'uk-UA',
  description: 'Vitaloop допомагає почати з симптомів, зрозуміти можливі причини, підібрати доречні аналізи і сформувати персональний план дій.',
  offers: [
    { '@type': 'Offer', name: 'Безкоштовно', price: '0', priceCurrency: 'UAH' },
    { '@type': 'Offer', name: 'Premium', price: '199', priceCurrency: 'UAH' },
  ],
}

const SCHEMA_ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'VITALOOP Ukraine',
  url: 'https://ua.vitaloop.today/',
  areaServed: 'UA',
  knowsLanguage: ['uk-UA'],
  description: 'Український напрям Vitaloop з фокусом на симптоми, сімейне здоровʼя, лабораторні показники і зрозумілі рішення.',
}

export function getUaPath(path = '/') {
  if (typeof window === 'undefined') return path
  const normalizedPath = path === '/' ? '' : path
  const isUaHost = window.location.hostname.toLowerCase() === 'ua.vitaloop.today'
  return isUaHost ? path : `/ua${normalizedPath}`
}

export function getUaAuthPath({ signup = false } = {}) {
  const params = new URLSearchParams()
  if (signup) params.set('signup', 'true')
  params.set('lang', 'uk')
  params.set('from', 'ua')
  return `/login?${params.toString()}`
}

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function UaFlag() {
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e5dfd6] bg-white text-[17px] shadow-sm sm:h-7 sm:w-7 sm:text-[15px]" aria-label="Україна">
      🇺🇦
    </span>
  )
}

export function UaBrandMark() {
  return (
    <span className="inline-flex h-10 items-center gap-1.5 sm:h-11 sm:gap-2">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-white sm:h-9 sm:w-9 sm:rounded-[12px]">
        <img src={BRAND_MARK_IMAGE} alt="" className="h-[30px] w-[30px] object-contain sm:h-8 sm:w-8" />
      </span>
      <span className="text-[19px] font-black uppercase leading-none tracking-[0.02em] sm:text-[22px]" aria-label="VITALOOP">
        <span className="text-[#1f6ed4]">VITA</span>
        <span className="text-[#f4c542]">LOOP</span>
      </span>
    </span>
  )
}

export function UaHeader() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.body.dataset.uaMenuOpen = open ? 'true' : 'false'
    window.dispatchEvent(new window.Event('ua-ui-state'))
    return () => {
      delete document.body.dataset.uaMenuOpen
      window.dispatchEvent(new window.Event('ua-ui-state'))
    }
  }, [open])

  return (
    <header className="sticky top-0 z-40 border-b border-[#e5dfd6] bg-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div className="mx-auto flex h-[60px] w-full max-w-[1200px] items-center justify-between px-4 sm:h-[68px] sm:px-6">
        <Link to={getUaPath('/')} className="flex h-11 items-center gap-1.5 rounded-full pr-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0f766e]/20 sm:gap-2" aria-label="Vitaloop Україна">
          <UaBrandMark />
          <UaFlag />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.id}
              to={getUaPath(link.path)}
              className="rounded-full px-3.5 py-2 text-sm font-semibold text-[#4b5563] transition duration-200 hover:bg-[#f1fbf8] hover:text-[#0f766e]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            to={getUaAuthPath()}
            className="rounded-full px-4 py-2 text-sm font-semibold text-[#4b5563] transition duration-200 hover:bg-[#f1fbf8] hover:text-[#0f766e]"
          >
            Увійти
          </Link>
          <Link to={getUaAuthPath({ signup: true })} className={CTA_CLASS}>
            Почати
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <button
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e5dfd6] bg-white text-[#0f172a] shadow-sm transition hover:bg-[#f1fbf8] md:hidden"
          aria-label={open ? 'Закрити меню' : 'Відкрити меню'}
          aria-expanded={open}
          aria-controls="ua-mobile-navigation"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div id="ua-mobile-navigation" className="border-t border-[#e5dfd6] bg-white md:hidden">
          <div className="mx-auto grid max-w-[1200px] gap-1 px-4 py-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.id}
                to={getUaPath(link.path)}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#4b5563] transition hover:bg-[#f1fbf8] hover:text-[#0f766e]"
              >
                {link.label}
              </Link>
            ))}
            <Link to={getUaAuthPath({ signup: true })} onClick={() => setOpen(false)} className={`${CTA_CLASS} mt-2 w-full`}>
              Отримати персональну оцінку
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

export function UaFooter() {
  const openCookieSettings = () => window.openVitaloopCookieSettings?.()

  return (
    <footer className="border-t border-[#e5dfd6] bg-white">
      <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.1fr_0.9fr_0.9fr]">
        <div>
          <Link to={getUaPath('/')} className="flex w-fit items-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0f766e]/20" aria-label="Vitaloop Україна">
            <UaBrandMark />
            <UaFlag />
          </Link>
          <p className="mt-4 max-w-md text-sm leading-7 text-[#4b5563]">
            VITALOOP Ukraine допомагає зібрати симптоми, аналізи й динаміку в один спокійний маршрут: що важливо зараз, що перевірити далі і з якими питаннями йти до спеціаліста.
          </p>
          <div className="mt-5 rounded-[22px] border border-[#e5dfd6] bg-[#f8f5f0] p-4">
            <p className="text-sm font-black text-[#0f172a]">Для українських форматів аналізів</p>
            <p className="mt-1 text-sm leading-6 text-[#4b5563]">
              Завантажуйте PDF, фото або скан результатів. Ми не називаємо лабораторії партнерами без офіційних домовленостей.
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-[#0f766e]">Сторінки</p>
          <div className="mt-4 grid gap-2">
            {NAV_LINKS.map((link) => (
              <Link key={link.id} to={getUaPath(link.path)} className="w-fit text-left text-sm font-semibold text-[#4b5563] transition hover:text-[#0f766e]">
                {link.label}
              </Link>
            ))}
            <Link to={getUaPath('/about')} className="w-fit text-sm font-semibold text-[#4b5563] transition hover:text-[#0f766e]">Про Vitaloop</Link>
          </div>
        </div>

        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-[#0f766e]">Важливо</p>
          <p className="mt-4 text-sm leading-7 text-[#4b5563]">
            Vitaloop не ставить діагноз, не призначає лікування і не замінює лікаря. Сервіс допомагає підготуватися до консультації й не загубити важливі дані.
          </p>
          <div className="mt-4 grid gap-2 text-sm font-semibold text-[#4b5563]">
            <Link to={getUaPath('/privacy-policy')} className="w-fit hover:text-[#0f766e]">Політика конфіденційності</Link>
            <Link to={getUaPath('/terms')} className="w-fit hover:text-[#0f766e]">Умови використання</Link>
            <button type="button" onClick={openCookieSettings} className="w-fit text-left hover:text-[#0f766e]">Керування cookie</button>
            <a href="mailto:privacy@vitaloop.today" className="w-fit hover:text-[#0f766e]">Запит на експорт або видалення даних</a>
            <a href="mailto:support@vitaloop.today" className="w-fit hover:text-[#0f766e]">Контакти</a>
          </div>
          <p className="mt-5 text-xs font-semibold text-[#6b7280]">© 2026 VITALOOP Ukraine 🇺🇦</p>
        </div>
      </div>
    </footer>
  )
}

function SectionHeading({ eyebrow, title, body, center = false }) {
  return (
    <div className={center ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      {eyebrow && <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0f766e] sm:text-sm">{eyebrow}</p>}
      <h2 className="mt-3 text-[28px] font-black leading-[1.12] tracking-tight text-[#0f172a] sm:text-[38px] md:text-[44px]">
        {title}
      </h2>
      {body && <p className="mt-4 text-[15px] leading-7 text-[#4b5563] sm:text-base sm:leading-8">{body}</p>}
    </div>
  )
}

function ChoiceButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 items-center gap-3 rounded-[18px] border px-4 py-3 text-left text-sm font-black transition hover:-translate-y-0.5 ${
        active
          ? 'border-[#0f766e] bg-[#0f766e] text-white shadow-[0_14px_34px_rgba(15,118,110,0.22)]'
          : 'border-[#e5dfd6] bg-white text-[#0f172a] hover:border-[#14b8a6]/40 hover:bg-[#f1fbf8]'
      }`}
    >
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${active ? 'border-white/70 bg-white text-[#0f766e]' : 'border-[#d6d0c7] bg-[#f8f5f0] text-transparent'}`}>
        <Check className="h-3.5 w-3.5" />
      </span>
      {children}
    </button>
  )
}

function UaWellbeingModal({ open, initialSymptoms, onClose, returnFocusRef }) {
  const navigate = useNavigate()
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const [step, setStep] = useState(1)
  const [symptoms, setSymptoms] = useState(initialSymptoms?.length ? initialSymptoms : [])
  const [duration, setDuration] = useState('2-8 тижнів')
  const [intensity, setIntensity] = useState(3)
  const [ageRange, setAgeRange] = useState('')
  const [familyContext, setFamilyContext] = useState('Для себе')
  const [hasLabs, setHasLabs] = useState('')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [assessmentId, setAssessmentId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return undefined
    setStep(1)
    setSymptoms(initialSymptoms?.length ? initialSymptoms : [])
    setDuration('2-8 тижнів')
    setIntensity(3)
    setAgeRange('')
    setFamilyContext('Для себе')
    setHasLabs('')
    setContext('')
    setResult(null)
    setAssessmentId('')
    setError('')
    trackPublicFunnelEvent('ua_wellbeing_started', { source: 'ua_modal' })
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const banner = document.getElementById('vl-cookie-banner')
    const previousBannerDisplay = banner?.style.display || ''
    if (banner) banner.style.display = 'none'

    const dialog = dialogRef.current
    const siblings = dialog?.parentElement
      ? [...dialog.parentElement.children].filter((element) => element !== dialog)
      : []
    const siblingStates = siblings.map((element) => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute('aria-hidden'),
    }))
    siblings.forEach((element) => {
      element.inert = true
      element.setAttribute('aria-hidden', 'true')
    })

    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus())
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hasAttribute('hidden') && element.getClientRects().length > 0)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousBodyOverflow
      if (banner) banner.style.display = previousBannerDisplay
      siblingStates.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert
        if (ariaHidden === null) element.removeAttribute('aria-hidden')
        else element.setAttribute('aria-hidden', ariaHidden)
      })
      window.requestAnimationFrame(() => returnFocusRef?.current?.focus())
    }
  }, [open, initialSymptoms, onClose, returnFocusRef])

  if (!open) return null

  const toggleSymptom = (symptom) => {
    setSymptoms((current) => (
      current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom]
    ))
  }

  const canContinue = symptoms.length > 0 && duration && intensity
  const priority = PRIORITY_COPY[result?.priority_level] || PRIORITY_COPY.watch

  async function submitAssessment() {
    if (!canContinue || loading) return
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/assessment/ua-wellbeing', {
        session_id: getPublicFunnelSessionId(),
        symptoms,
        duration,
        intensity,
        context: context.trim() || null,
        age_range: ageRange || null,
        family_context: familyContext || null,
        has_labs: hasLabs || null,
        relevant_biomarkers: [...new Set(symptoms.flatMap(biomarkersForSymptom))].slice(0, 12),
        source: 'ua.vitaloop.today',
      })
      setResult(data?.result || null)
      setAssessmentId(data?.assessment_id || '')
      setStep(4)
    } catch {
      setError('Не вдалося сформувати підсумок. Спробуйте ще раз за хвилину.')
    } finally {
      setLoading(false)
    }
  }

  function goSignup() {
    const params = new URLSearchParams({ signup: 'true', lang: 'uk', from: 'ua_wellbeing' })
    if (assessmentId) params.set('assessment', assessmentId)
    navigate(`/login?${params.toString()}`)
  }

  function goUpload() {
    const params = new URLSearchParams({ signup: 'true', lang: 'uk', from: 'ua_wellbeing', returnUrl: '/upload?locale=uk' })
    if (assessmentId) params.set('assessment', assessmentId)
    navigate(`/login?${params.toString()}`)
  }

  return (
    <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-[80] bg-[#0f172a]/60 p-0 backdrop-blur-sm sm:p-4 lg:p-8" role="dialog" aria-modal="true" aria-label="Оцінка самопочуття">
      <div className="mx-auto flex h-full w-full max-w-[980px] items-stretch lg:items-center">
        <div className="relative flex h-[100svh] w-full flex-col overflow-hidden bg-[#f8f5f0] shadow-[0_24px_80px_rgba(15,23,42,0.38)] sm:h-[calc(100svh-32px)] sm:rounded-[28px] sm:border sm:border-white/70 lg:h-[min(760px,calc(100svh-64px))] lg:grid lg:grid-cols-[0.82fr_1.18fr] lg:rounded-[34px]">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Закрити"
            className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[#e5dfd6] bg-white text-[#0f172a] shadow-sm transition hover:bg-[#f1fbf8] hover:text-[#0f766e] sm:right-4 sm:top-4 sm:h-11 sm:w-11"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          <aside className="relative shrink-0 overflow-hidden bg-[linear-gradient(145deg,#0f172a,#0f766e)] px-5 py-4 text-white sm:p-6 lg:p-8">
            <div className="absolute inset-0 opacity-40">
              <div className="absolute -left-24 top-10 h-48 w-48 rounded-full bg-[#14b8a6]/40 blur-3xl" />
              <div className="absolute bottom-4 right-0 h-52 w-52 rounded-full bg-[#d4b483]/30 blur-3xl" />
            </div>
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#d9fffb]">
                <Sparkles className="h-3.5 w-3.5" />
                  AI оцінка самопочуття
              </div>
              <h2 className="mt-3 max-w-[300px] pr-10 text-[24px] font-black leading-tight tracking-tight sm:mt-5 sm:text-[30px] lg:max-w-none lg:pr-0 lg:text-[34px]">
                  Коротко опишіть стан — Vitaloop збере карту уваги.
              </h2>
              <p className="mt-4 hidden text-sm leading-7 text-[#d9fffb] sm:block">
                  Це освітній підсумок українською: можливі звʼязки симптомів, напрямки аналізів, питання до лікаря і наступні кроки.
              </p>
              <div className="mt-8 hidden gap-3 text-sm lg:grid">
                {['Не діагноз', 'Без лікувальних призначень', 'З фокусом на наступний крок'].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/12">
                    <Check className="h-4 w-4 text-[#5eead4]" />
                    <span className="font-bold">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfaf7] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 lg:p-8">
            {!result ? (
              <>
                {/* Progress bar */}
                <div className="mb-5 flex items-center gap-1.5">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step >= item ? 'bg-[#0f766e]' : 'bg-[#e5dfd6]'}`} />
                  ))}
                </div>

                {/* ── STEP 1: Symptoms with icons ── */}
                {step === 1 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0f766e]">Крок 1</p>
                    <h3 className="mt-1.5 text-[22px] font-black leading-tight text-[#0f172a]">Що зараз турбує?</h3>
                    <p className="mt-1 text-sm text-[#64748b]">
                        Оберіть симптоми — AI підбере аналізи
                      {symptoms.length > 0 && <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0f766e] text-[10px] font-black text-white">{symptoms.length}</span>}
                    </p>

                    <div className="mt-4 space-y-3 pr-0.5">
                      {[
                        {
                          label: 'Енергія та сон', Icon: Zap, color: '#f59e0b',
                          items: [
                            { Icon: Zap, label: 'Постійна втома' },
                            { Icon: Moon, label: 'Поганий сон' },
                            { Icon: TrendingDown, label: 'Низька енергія' },
                            { Icon: Timer, label: 'Важко прокидатись' },
                          ],
                        },
                        {
                          label: 'Голова та настрій', Icon: Brain, color: '#8b5cf6',
                          items: [
                            { Icon: Wind, label: 'Туман у голові' },
                            { Icon: AlertCircle, label: 'Тривожність' },
                            { Icon: Activity, label: 'Перепади настрою' },
                            { Icon: Brain, label: 'Головні болі' },
                          ],
                        },
                        {
                          label: 'Вага та метаболізм', Icon: Scale, color: '#0ea5e9',
                          items: [
                            { Icon: Scale, label: 'Не можу схуднути' },
                            { Icon: TrendingDown, label: 'Набір ваги' },
                            { Icon: Droplets, label: 'Тяга до солодкого' },
                          ],
                        },
                        {
                          label: 'Шкіра та волосся', Icon: Scissors, color: '#ec4899',
                          items: [
                            { Icon: Scissors, label: 'Випадіння волосся' },
                            { Icon: Leaf, label: 'Суха шкіра / нігті' },
                            { Icon: Thermometer, label: 'Акне / висипання' },
                          ],
                        },
                        {
                          label: "М'язи та суглоби", Icon: Dumbbell, color: '#10b981',
                          items: [
                            { Icon: Dumbbell, label: "М'язова слабкість" },
                            { Icon: Activity, label: 'Болі у суглобах' },
                            { Icon: HeartPulse, label: "Судоми м'язів" },
                          ],
                        },
                        {
                          label: 'Гормони та цикл', Icon: HeartHandshake, color: '#f43f5e',
                          items: [
                            { Icon: HeartHandshake, label: 'Порушення циклу' },
                            { Icon: HeartPulse, label: 'Зниження лібідо' },
                            { Icon: Baby, label: 'Планую вагітність' },
                          ],
                        },
                      ].map((group) => (
                        <div key={group.label}>
                          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#9ca3af]">
                            <group.Icon className="h-3 w-3" style={{ color: group.color }} />
                            {group.label}
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {group.items.map(({ Icon: ItemIcon, label }) => {
                              const active = symptoms.includes(label)
                              return (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() => toggleSymptom(label)}
                                  className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left text-[13px] font-bold transition active:scale-[0.97] ${
                                    active
                                      ? 'border-[#0f766e] bg-[#0f766e] text-white shadow-[0_6px_20px_rgba(15,118,110,0.25)]'
                                      : 'border-[#e5dfd6] bg-white text-[#0f172a] hover:border-[#14b8a6]/50'
                                  }`}
                                >
                                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-white/20' : 'bg-[#f0fdfa]'}`}>
                                    <ItemIcon className={`h-3.5 w-3.5 ${active ? 'text-white' : 'text-[#0d9488]'}`} />
                                  </span>
                                  <span className="leading-tight">{label}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── STEP 2: Duration + KB-linked impact questions ── */}
                {step === 2 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0f766e]">Крок 2</p>
                    <h3 className="mt-1.5 text-[22px] font-black leading-tight text-[#0f172a]">Деталі для AI-аналізу</h3>
                    <p className="mt-1 text-sm text-[#64748b]">Це допоможе точніше підібрати біомаркери</p>

                    {/* Duration */}
                    <div className="mt-5">
                      <p className="mb-2.5 text-sm font-black text-[#0f172a]">Як довго тривають симптоми?</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'до 2 тижнів', label: 'До 2 тижнів', hint: 'Гостре' },
                          { value: '2-8 тижнів', label: '2–8 тижнів', hint: 'Підгостре' },
                          { value: 'понад 2 місяці', label: 'Понад 2 місяці', hint: 'Хронічне' },
                          { value: 'повертається хвилями', label: 'Хвилями', hint: 'Рецидивуюче' },
                        ].map((item) => (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => setDuration(item.value)}
                            className={`flex flex-col rounded-2xl border p-3 text-left transition ${
                              duration === item.value
                                ? 'border-[#0f766e] bg-[#0f766e] text-white'
                                : 'border-[#e5dfd6] bg-white text-[#0f172a] hover:border-[#14b8a6]/50'
                            }`}
                          >
                            <span className="text-[13px] font-black">{item.label}</span>
                            <span className={`text-[11px] ${duration === item.value ? 'text-white/70' : 'text-[#9ca3af]'}`}>{item.hint}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Impact — visual 5-scale */}
                    <div className="mt-5">
                      <div className="mb-2.5 flex items-center justify-between">
                        <p className="text-sm font-black text-[#0f172a]">Наскільки впливає на життя?</p>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                          intensity <= 2 ? 'bg-emerald-100 text-emerald-700'
                            : intensity === 3 ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                        }`}>
                          {['', 'Мінімально', 'Помірно', 'Відчутно', 'Сильно', 'Дуже сильно'][intensity]}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setIntensity(v)}
                            className={`flex-1 rounded-xl py-3 text-sm font-black transition ${
                              intensity === v
                                ? v <= 2 ? 'bg-emerald-500 text-white'
                                  : v === 3 ? 'bg-amber-500 text-white'
                                    : 'bg-rose-500 text-white'
                                : 'bg-white text-[#9ca3af] ring-1 ring-[#e5dfd6]'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                      <div className="mt-1.5 flex justify-between text-[10px] text-[#9ca3af]">
                        <span>Майже не помічаю</span>
                        <span>Заважає щодня</span>
                      </div>
                    </div>

                    {/* KB-relevant biomarker preview */}
                    {symptoms.length > 0 && (() => {
                      const allBiomarkers = [...new Set(symptoms.flatMap(biomarkersForSymptom))]
                      const bms = allBiomarkers.slice(0, 6)
                      return bms.length > 0 ? (
                        <div className="mt-5 rounded-2xl border border-[#d1fae5] bg-[#f0fdf4] p-4">
                          <p className="mb-2.5 text-[11px] font-black uppercase tracking-[0.1em] text-[#0f766e]">
                              🔬 Ймовірні пріоритетні аналізи
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {bms.map(b => (
                              <span key={b} className="rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-[#0f172a] ring-1 ring-[#6ee7b7]">{b}</span>
                            ))}
                            {allBiomarkers.length > 6 && (
                              <span className="rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-[#9ca3af] ring-1 ring-[#e5dfd6]">
                                  +{allBiomarkers.length - 6} ще
                              </span>
                            )}
                          </div>
                        </div>
                      ) : null
                    })()}
                  </div>
                )}

                {/* ── STEP 3: Context ── */}
                {step === 3 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0f766e]">Крок 3</p>
                    <h3 className="mt-1.5 text-[22px] font-black leading-tight text-[#0f172a]">Контекст</h3>
                    <p className="mt-1 text-sm text-[#64748b]">Кілька деталей для точнішого підсумку</p>

                    {/* Has labs */}
                    <div className="mt-5">
                      <p className="mb-2 text-[13px] font-black text-[#0f172a]">Є результати аналізів?</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: 'yes', label: 'Так', icon: '✅' },
                          { value: 'partial', label: 'Частково', icon: '📋' },
                          { value: 'no', label: 'Немає', icon: '➕' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setHasLabs(opt.value)}
                            className={`flex flex-col items-center gap-1 rounded-2xl border py-3 text-center transition ${
                              hasLabs === opt.value
                                ? 'border-[#0f766e] bg-[#0f766e] text-white'
                                : 'border-[#e5dfd6] bg-white text-[#0f172a]'
                            }`}
                          >
                            <span className="text-lg">{opt.icon}</span>
                            <span className="text-[12px] font-black">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Who + Age in one row */}
                    <div className="mt-5 grid grid-cols-2 gap-4">
                      <div>
                        <p className="mb-2 text-[13px] font-black text-[#0f172a]">Для кого?</p>
                        <div className="space-y-1.5">
                          {['Для себе', 'Для дитини', 'Для партнера', 'Для батьків'].map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => setFamilyContext(item)}
                              className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-bold transition ${
                                familyContext === item
                                  ? 'border-[#0f766e] bg-[#0f766e] text-white'
                                  : 'border-[#e5dfd6] bg-white text-[#0f172a]'
                              }`}
                            >
                              {familyContext === item && <Check className="h-3 w-3 shrink-0" />}
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-[13px] font-black text-[#0f172a]">Вікова група</p>
                        <div className="space-y-1.5">
                          {['до 18', '18–29', '30–44', '45–59', '60+'].map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => setAgeRange(ageRange === item ? '' : item)}
                              className={`flex w-full items-center justify-center rounded-xl border px-3 py-2 text-[12px] font-bold transition ${
                                ageRange === item
                                  ? 'border-[#0f766e] bg-[#0f766e] text-white'
                                  : 'border-[#e5dfd6] bg-white text-[#0f172a]'
                              }`}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Optional note */}
                    <textarea
                      value={context}
                      onChange={(event) => setContext(event.target.value)}
                      rows={2}
                      maxLength={400}
                      placeholder="Деталь: гірше вранці, після стресу, приймаю ліки..."
                      className="mt-4 w-full resize-none rounded-2xl border border-[#e5dfd6] bg-white px-4 py-3 text-sm text-[#0f172a] outline-none transition placeholder:text-[#9ca3af] focus:border-[#14b8a6] focus:ring-4 focus:ring-[#14b8a6]/10"
                    />
                  </div>
                )}

                {error && (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                    {error}
                  </div>
                )}

                {/* Navigation */}
                <div className="sticky bottom-0 z-10 -mx-4 mt-5 flex flex-col-reverse gap-2 border-t border-[#e5dfd6] bg-[#fbfaf7]/96 px-4 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-6 sm:flex-row sm:justify-between sm:px-6 lg:-mx-8 lg:px-8">
                  <button
                    type="button"
                    onClick={() => (step === 1 ? onClose() : setStep((v) => v - 1))}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#e5dfd6] bg-white px-5 text-sm font-black text-[#0f172a] transition hover:bg-[#f1fbf8]"
                  >
                    {step === 1 ? 'Закрити' : '← Назад'}
                  </button>
                  {step < 3 ? (
                    <button
                      type="button"
                      disabled={step === 1 && symptoms.length === 0}
                      onClick={() => setStep((v) => v + 1)}
                      className={`${CTA_CLASS} disabled:pointer-events-none disabled:opacity-40`}
                    >
                        Далі <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canContinue || loading}
                      onClick={submitAssessment}
                      className={`${CTA_CLASS} disabled:pointer-events-none disabled:opacity-50`}
                    >
                      {loading ? 'Формуємо підсумок...' : 'Сформувати AI-підсумок'}
                      {!loading && <ArrowRight className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#0f766e] ring-1 ring-[#e5dfd6]">
                    Ваш підсумок
                </div>
                <h3 className="mt-4 text-[32px] font-black leading-tight text-[#0f172a]">{result.headline}</h3>
                <span className={`mt-4 inline-flex rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] ring-1 ${priority.className}`}>
                  {priority.label}
                </span>
                <p className="mt-5 text-base leading-8 text-[#334155]">{result.summary}</p>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[24px] border border-[#e5dfd6] bg-white p-5">
                    <h4 className="text-sm font-black uppercase tracking-[0.12em] text-[#0f766e]">Можливі звʼязки</h4>
                    <ul className="mt-4 grid gap-3 text-sm leading-6 text-[#4b5563]">
                      {(result.possible_links || []).map((item) => (
                        <li key={item} className="flex gap-3">
                          <Check className="mt-1 h-4 w-4 shrink-0 text-[#0f766e]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-[24px] border border-[#e5dfd6] bg-white p-5">
                    <h4 className="text-sm font-black uppercase tracking-[0.12em] text-[#0f766e]">Що перевірити</h4>
                    <div className="mt-4 grid gap-3">
                      {(result.lab_directions || []).map((item) => (
                        <div key={`${item.name}-${item.reason}`} className="rounded-2xl bg-[#f8f5f0] px-4 py-3">
                          <p className="text-sm font-black text-[#0f172a]">{item.name}</p>
                          <p className="mt-1 text-sm leading-6 text-[#4b5563]">{item.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[24px] border border-[#e5dfd6] bg-white p-5">
                    <h4 className="text-sm font-black uppercase tracking-[0.12em] text-[#0f766e]">Питання до лікаря</h4>
                    <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-[#4b5563]">
                      {(result.doctor_questions || []).map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-[24px] border border-[#e5dfd6] bg-white p-5">
                    <h4 className="text-sm font-black uppercase tracking-[0.12em] text-[#0f766e]">Наступні кроки</h4>
                    <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-[#4b5563]">
                      {(result.next_steps || []).map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                </div>

                <p className="mt-5 rounded-[20px] bg-[#f8f5f0] px-4 py-3 text-xs font-semibold leading-5 text-[#6b7280] ring-1 ring-[#e5dfd6]">
                  {result.disclaimer}
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={goUpload} className={`${CTA_CLASS} w-full sm:w-auto`}>
                      Завантажити аналізи
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={goSignup} className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[#e5dfd6] bg-white px-5 py-3 text-sm font-black text-[#0f172a] transition hover:bg-[#f1fbf8] sm:w-auto">
                      Створити акаунт
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function UaLanding() {
  const navigate = useNavigate()
  const assessmentTriggerRef = useRef(null)
  const [selectedSymptoms, setSelectedSymptoms] = useState([])
  const [showStickyCta, setShowStickyCta] = useState(false)
  const [showWellbeingModal, setShowWellbeingModal] = useState(false)

  useEffect(() => {
    const visibleTargets = new Set()
    const targets = [...document.querySelectorAll('[data-ua-primary-cta], footer')]
    const updateStickyCta = () => {
      const pastHero = window.scrollY > Math.max(520, window.innerHeight * 0.72)
      const cookieBannerVisible = Boolean(document.getElementById('vl-cookie-banner'))
      const menuOpen = document.body.dataset.uaMenuOpen === 'true'
      setShowStickyCta(pastHero && visibleTargets.size === 0 && !cookieBannerVisible && !menuOpen)
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visibleTargets.add(entry.target)
        else visibleTargets.delete(entry.target)
      })
      updateStickyCta()
    }, { threshold: 0.15 })
    targets.forEach((target) => observer.observe(target))
    const bodyObserver = new MutationObserver(updateStickyCta)
    bodyObserver.observe(document.body, { childList: true })
    updateStickyCta()
    window.addEventListener('scroll', updateStickyCta, { passive: true })
    window.addEventListener('resize', updateStickyCta)
    window.addEventListener('ua-ui-state', updateStickyCta)
    return () => {
      observer.disconnect()
      bodyObserver.disconnect()
      window.removeEventListener('scroll', updateStickyCta)
      window.removeEventListener('resize', updateStickyCta)
      window.removeEventListener('ua-ui-state', updateStickyCta)
    }
  }, [])

  const dismissModal = useCallback(() => {
    setShowWellbeingModal(false)
  }, [])

  const startSignup = () => navigate(getUaAuthPath({ signup: true }))
  const startWellbeingAssessment = useCallback((event) => {
    assessmentTriggerRef.current = event?.currentTarget || document.activeElement
    setShowWellbeingModal(true)
  }, [])
  const toggleSymptom = (symptom) => {
    setSelectedSymptoms((current) =>
      current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom],
    )
  }

  return (
    <div id="top" className="min-h-screen bg-[#f8f5f0] pb-24 text-[#0f172a] md:pb-0">
      <Seo
        title="Vitaloop Ukraine — персональна оцінка симптомів і аналізів"
        description="Постійна втома, поганий сон чи низька енергія? Vitaloop допоможе знайти можливі причини, пріоритети аналізів і персональний план дій."
        canonicalUrl="https://ua.vitaloop.today/"
        locale="uk_UA"
        image={UA_OG_IMAGE}
        imageAlt="Vitaloop Ukraine — персональна оцінка симптомів, аналізів і плану дій"
        schemas={[SCHEMA_SOFTWARE, SCHEMA_ORGANIZATION, SCHEMA_FAQ]}
      />
      <UaHeader />

      <main>
        <section className="relative isolate overflow-hidden bg-[#fbfaf7]">
          <img
            src={HERO_IMAGE}
            alt=""
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 -z-20 h-full w-full object-cover object-[58%_34%] opacity-[0.38] sm:object-center sm:opacity-[0.48]"
          />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(251,250,247,0.94)_0%,rgba(251,250,247,0.76)_48%,rgba(251,250,247,0.38)_100%)]" />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_12%,rgba(20,184,166,0.18),transparent_34%),radial-gradient(circle_at_82%_8%,rgba(212,180,131,0.18),transparent_28%)]" />
          <div className="mx-auto grid min-h-[calc(100svh-68px)] w-full max-w-[1240px] gap-7 px-4 py-8 sm:gap-10 sm:px-6 sm:py-16 lg:grid-cols-[0.9fr_0.62fr] lg:items-center lg:py-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#cdeee7] bg-white/80 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#0f766e] shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-[#14b8a6]" />
                Українська оцінка самопочуття
              </div>
              <h1 className="mt-5 max-w-[720px] text-[30px] font-bold leading-[1.12] tracking-[-0.018em] text-[#0f172a] sm:mt-6 sm:text-[46px] sm:leading-[1.06] lg:text-[54px]">
                Самопочуття й аналізи в одній зрозумілій картині.
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#42526b] sm:mt-6 sm:text-lg sm:leading-8">
                Vitaloop допомагає українською описати симптоми, розібрати лабораторні показники, побачити пріоритети й підготувати питання до сімейного лікаря, нутриціолога або ендокринолога.
              </p>
              <div className="mt-5 rounded-3xl border border-[#dcefe9] bg-white/86 p-4 shadow-[0_18px_46px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#0f766e]">Карта уваги</p>
                    <p className="mt-1 text-[15px] font-black leading-snug text-[#0f172a]">Сон, енергія, дефіцити</p>
                  </div>
                  <span className="rounded-full bg-[#ecfdf5] px-2.5 py-1 text-[10px] font-black text-[#047857]">освітньо</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    ['Феритин', 'залізо'],
                    ['D', 'вітамін'],
                    ['ТТГ', 'щитоп.'],
                  ].map(([value, label]) => (
                    <div key={value} className="rounded-2xl bg-[#f8f5f0] px-2 py-2 text-center ring-1 ring-[#eee7dc]">
                      <p className="text-sm font-black text-[#0f172a]">{value}</p>
                      <p className="mt-0.5 text-[10px] font-bold text-[#64748b]">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
                <button data-ua-primary-cta onClick={startWellbeingAssessment} className={`${CTA_CLASS} w-full sm:w-auto`}>
                  Описати самопочуття
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button onClick={() => scrollTo('result-example')} className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#d8d1c8] bg-white px-5 py-3 text-sm font-black text-[#0f172a] shadow-sm transition hover:-translate-y-0.5 hover:border-[#14b8a6]/50 hover:text-[#0f766e]">
                  Подивитися приклад
                </button>
              </div>
              <div className="mt-5 hidden flex-wrap gap-x-4 gap-y-2 text-[13px] font-bold text-[#5b677a] sm:mt-7 sm:flex sm:gap-x-5 sm:text-sm">
                {['Без діагнозів', 'Працює з PDF і фото', 'Українські назви показників', 'Приватність даних'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#0f766e]" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="ml-auto max-w-[430px] rounded-[34px] border border-white/70 bg-white/58 p-5 shadow-[0_28px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl">
                <div className="rounded-[26px] bg-[#0f766e] p-5 text-white shadow-[0_20px_54px_rgba(15,118,110,0.24)]">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#b7fff6]">Освітній підсумок</p>
                  <h2 className="mt-3 text-3xl font-black leading-tight">Втома, сон, дефіцити</h2>
                  <p className="mt-3 text-sm leading-6 text-white/76">Сервіс збирає симптоми, аналізи й динаміку в одну карту уваги перед консультацією.</p>
                </div>
                <div className="mt-4 grid gap-3">
                  {[
                    ['Симптоми', 'контекст перед аналізом'],
                    ['Біомаркери', 'пріоритети й причини'],
                    ['Динаміка', 'повторні перевірки'],
                  ].map(([title, body]) => (
                    <div key={title} className="rounded-2xl border border-[#e5dfd6]/80 bg-white/72 px-4 py-3">
                      <p className="text-sm font-black text-[#0f172a]">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-[#64748b]">{body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="wellbeing" className="mx-auto grid w-full max-w-[1240px] gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <SectionHeading
              eyebrow="Почніть без аналізів"
              title="Спочатку опишіть, що відбувається з тілом."
              body="Втома, сон, волосся, вага, настрій, щитоподібна, дитячі питання. Vitaloop перетворює розрізнені скарги на карту уваги і підказує, які аналізи можуть бути корисними для обговорення."
            />
            <button data-ua-primary-cta onClick={startWellbeingAssessment} className={`${CTA_CLASS} mt-7 w-full sm:w-auto`}>
              Відкрити AI-оцінку
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-hidden rounded-[34px] border border-[#e5dfd6] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <div className="border-b border-[#e5dfd6] bg-[#fbfaf7] px-5 py-5 sm:px-7">
              <p className="text-sm font-black text-[#0f172a]">
                {selectedSymptoms.length > 0 ? <><span className="text-[#0f766e]">{selectedSymptoms.length}</span> симптомів обрано</> : 'Оберіть кілька сигналів'}
              </p>
              <p className="mt-1 text-xs font-bold text-[#64748b]">Повна форма відкриється в модальному вікні.</p>
            </div>
            <div className="divide-y divide-[#eee7dc]">
              {SYMPTOM_GROUPS.slice(0, 4).map((group) => (
                <div key={group.label} className="grid gap-3 px-5 py-5 sm:grid-cols-[180px_1fr] sm:px-7">
                  <p className="text-sm font-black text-[#0f172a]">{group.icon} {group.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((symptom) => {
                      const active = selectedSymptoms.includes(symptom)
                      return (
                        <button
                          key={symptom}
                          onClick={() => toggleSymptom(symptom)}
                          className={`rounded-full px-3.5 py-2 text-sm font-bold transition ${active ? 'bg-[#0f766e] text-white shadow-[0_10px_24px_rgba(15,118,110,0.22)]' : 'bg-[#f8f5f0] text-[#42526b] hover:bg-[#f1fbf8] hover:text-[#0f766e]'}`}
                        >
                          {symptom}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-[#e5dfd6] bg-[#fbfaf7] px-5 py-5 sm:px-7">
              {selectedSymptoms.length > 0 ? (
                <p className="text-sm leading-7 text-[#42526b]">
                  <span className="font-black text-[#0f766e]">Ймовірні напрямки аналізів: </span>
                  {[...new Set(selectedSymptoms.flatMap(biomarkersForSymptom))].slice(0, 7).join(' · ')}
                </p>
              ) : (
                <p className="text-sm leading-7 text-[#42526b]">Оберіть симптоми або відкрийте повну AI-оцінку, щоб отримати освітню карту уваги.</p>
              )}
            </div>
          </div>
        </section>

        <section id="how" className="bg-[#0f172a] py-16 text-white sm:py-24">
          <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#5eead4]">Маршрут Vitaloop</p>
            <h2 className="mt-4 max-w-4xl text-[34px] font-black leading-tight tracking-[-0.02em] sm:text-[52px]">
              Від “я не розумію, що зі мною” до конкретного наступного кроку.
            </h2>
            <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
              {FLOW_STEPS.map((item, index) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.title}
                    onClick={() => {
                      const anchors = ['wellbeing', 'wellbeing', 'laboratories', 'result-example', 'how']
                      document.getElementById(anchors[index] || 'wellbeing')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    className="group grid w-full gap-4 py-6 text-left transition hover:bg-white/[0.03] sm:grid-cols-[72px_0.55fr_1fr] sm:items-start"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/8 text-[#5eead4] ring-1 ring-white/12 transition group-hover:bg-[#5eead4] group-hover:text-[#0f172a]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="text-xl font-black leading-snug">{item.title}</h3>
                    <p className="text-sm leading-7 text-slate-300 sm:text-[15px]">{item.body}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section id="result-example" className="mx-auto grid w-full max-w-[1240px] gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
          <SectionHeading
            eyebrow="Результат"
            title="Підсумок, який можна реально використати."
            body="Замість сухого списку показників користувач отримує пояснення, що стабільне, що варто відстежити, які питання поставити спеціалісту і коли повертатися до повторних аналізів."
          />
          <div className="overflow-hidden rounded-[34px] border border-[#e5dfd6] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.10)]">
            <p className="border-b border-[#eee7dc] bg-[#fbfaf7] px-5 py-3 text-xs font-bold text-[#64748b] sm:px-7">
              Умовний освітній приклад, не медичний висновок
            </p>
            {RESULT_EXAMPLE.map((item) => (
              <div key={item.label} className="grid gap-2 border-b border-[#eee7dc] px-5 py-5 last:border-0 sm:grid-cols-[190px_1fr] sm:px-7">
                <p className="text-sm font-black text-[#0f172a]">{item.label}</p>
                <p className="text-sm leading-7 text-[#42526b]">{item.value}</p>
              </div>
            ))}
            <div className="bg-[#f1fbf8] px-5 py-5 sm:px-7">
              <button data-ua-primary-cta onClick={startWellbeingAssessment} className={`${CTA_CLASS} w-full sm:w-auto`}>
                Отримати освітній підсумок
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <section id="laboratories" className="bg-white py-16 sm:py-24">
          <div className="mx-auto grid w-full max-w-[1120px] gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div className="lg:sticky lg:top-24">
              <SectionHeading
                eyebrow="Для України"
                title="Працює з українськими лабораторними форматами."
                body="PDF з кабінету лабораторії, фото бланка, українські назви, одиниці й референси зберігаються в одному зрозумілому вигляді."
              />
            </div>
            <div className="divide-y divide-[#e5dfd6] border-y border-[#e5dfd6]">
              {LAB_UPLOAD_POINTS.map((point, index) => (
                <div key={point.title} className="grid gap-3 py-6 sm:grid-cols-[48px_180px_1fr] sm:items-start">
                  <span className="text-sm font-black text-[#0f766e]">0{index + 1}</span>
                  <h3 className="text-sm font-black text-[#0f172a]">{point.title}</h3>
                  <p className="text-sm leading-7 text-[#42526b]">{point.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#fbfaf7] py-16 sm:py-24">
          <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6">
            <SectionHeading center eyebrow="Корисні матеріали" title="Питання, з яких варто почати" />
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {EDUCATION_ARTICLES.slice(0, 4).map((article) => (
                <Link key={article.title} to={getUaPath(article.path)} className="min-h-[154px] rounded-[24px] border border-[#e5dfd6] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#14b8a6]/45 hover:text-[#0f766e]">
                  <span className="text-base font-black text-[#0f172a]">{article.title}</span>
                  <span className="mt-3 block text-sm font-semibold leading-6 text-[#42526b]">{article.body}</span>
                </Link>
              ))}
            </div>
            <div className="mt-8 flex justify-center">
              <Link to={getUaPath('/health-hub')} className="inline-flex items-center gap-2 rounded-full border border-[#d8d1c8] bg-white px-5 py-3 text-sm font-black text-[#0f172a] shadow-sm transition hover:-translate-y-0.5 hover:border-[#14b8a6]/50 hover:text-[#0f766e]">
                Відкрити всі статті
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24">
          <SectionHeading center eyebrow="Тарифи" title="Почніть безкоштовно, масштабуйте за потребою" body="Для першої оцінки достатньо безкоштовного старту. Premium потрібен для регулярної роботи з аналізами й динамікою." />
          <div className="mx-auto mt-8 grid max-w-[1100px] gap-4 lg:grid-cols-3">
            {PRICING.map((plan) => (
              <article
                key={plan.name}
                className={`relative flex h-full flex-col rounded-[28px] border p-6 shadow-sm ${plan.featured ? 'border-[#0f766e] bg-[#0f172a] text-white shadow-[0_28px_80px_rgba(15,23,42,0.24)]' : plan.comingSoon ? 'border-[#e5dfd6] bg-[#f8f5f0] text-[#0f172a]' : 'border-[#e5dfd6] bg-white text-[#0f172a]'}`}
              >
                {plan.featured && <span className="absolute right-5 top-5 rounded-full bg-[#d4b483] px-3 py-1 text-xs font-black text-[#111111]">Найкращий вибір</span>}
                <p className={`text-sm font-black uppercase tracking-[0.14em] ${plan.featured ? 'text-[#5eead4]' : 'text-[#0f766e]'}`}>{plan.name}</p>
                <h3 className="mt-3 text-4xl font-black">{plan.price}</h3>
                <p className={`mt-1 text-sm ${plan.featured ? 'text-[#cbd5e1]' : 'text-[#6b7280]'}`}>{plan.note}</p>
                <p className={`mt-5 text-sm leading-7 ${plan.featured ? 'text-[#e2e8f0]' : 'text-[#42526b]'}`}>{plan.description}</p>
                <div className="mt-6 grid flex-1 content-start gap-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${plan.featured ? 'bg-white text-[#0f172a]' : 'bg-[#f1fbf8] text-[#0f766e]'}`}>
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span className={`text-sm leading-6 ${plan.featured ? 'text-white' : 'text-[#42526b]'}`}>{feature}</span>
                    </div>
                  ))}
                </div>
                <button onClick={plan.comingSoon ? undefined : startSignup} disabled={plan.comingSoon} className={`${plan.comingSoon ? 'inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-black text-[#6b7280] ring-1 ring-[#e5dfd6]' : CTA_CLASS} mt-7 w-full`}>
                  {plan.cta}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section id="faq" className="mx-auto w-full max-w-[920px] px-4 pb-16 sm:px-6 sm:pb-24">
          <SectionHeading center eyebrow="Питання" title="Коротко про важливе" />
          <div className="mt-7 divide-y divide-[#e5dfd6] overflow-hidden rounded-[26px] border border-[#e5dfd6] bg-white shadow-sm">
            {FAQ_ITEMS.map((item) => (
              <details key={item.question} className="group p-4 open:bg-[#f8f5f0] sm:p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-black text-[#0f172a]">
                  {item.question}
                  <ChevronDown className="h-5 w-5 shrink-0 text-[#6b7280] transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#42526b]">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <UaFooter />
      </main>

      <div id="ua-sticky-cta" className={`fixed inset-x-0 bottom-0 z-40 border-t border-[#e5dfd6] bg-white/94 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_34px_rgba(15,23,42,0.10)] backdrop-blur-xl transition duration-300 md:hidden ${showStickyCta && !showWellbeingModal ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'}`}>
        <button onClick={startWellbeingAssessment} className={`${CTA_CLASS} w-full`}>
          Отримати персональну оцінку
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <UaWellbeingModal
        open={showWellbeingModal}
        initialSymptoms={selectedSymptoms}
        onClose={dismissModal}
        returnFocusRef={assessmentTriggerRef}
      />
    </div>
  )
}
