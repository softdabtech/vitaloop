import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Check,
  ChevronDown,
  ClipboardList,
  FileSearch,
  FlaskConical,
  HeartPulse,
  Menu,
  MessageCircle,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import Seo from '../components/Seo.jsx'

const HERO_IMAGE = '/images/ua-health-hero-dashboard-ua-20260603.png'
const UA_OG_IMAGE = 'https://ua.vitaloop.today/images/ua-og-preview-20260604.png'

export const CTA_CLASS =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#0f766e_0%,#14b8a6_58%,#d4b483_135%)] px-5 py-3 text-center text-sm font-black leading-tight text-white shadow-[0_14px_34px_rgba(15,118,110,0.24)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,118,110,0.32)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0f766e]/20 sm:whitespace-nowrap'

export const NAV_LINKS = [
  { label: 'Самопочуття', id: 'wellbeing', path: '/samopochuttia' },
  { label: 'Симптоми', id: 'symptoms', path: '/symptomy' },
  { label: 'Аналізи', id: 'labs', path: '/analizy' },
  { label: 'Лабораторії', id: 'laboratories', path: '/laboratorii' },
  { label: 'Тарифи', id: 'pricing', path: '/tarify' },
]

const TRUST_CARDS = [
  { title: 'Приватність даних', body: 'Коротко і без зайвих обіцянок: медична інформація має залишатися приватною.', icon: ShieldCheck },
  { title: 'Симптоми + аналізи', body: 'Дивимось на стан комплексно, а не на один показник у бланку.', icon: BrainCircuit },
  { title: 'Для родини', body: 'Зручно вести власні показники й стан близьких.', icon: HeartPulse },
  { title: 'Зрозуміла мова', body: 'Пояснення без медичного туману і wellness-жаргону.', icon: MessageCircle },
]

const HERO_PROOFS = [
  'Почніть із симптомів або аналізів',
  'Підтримка популярних лабораторних форматів',
  'Освітній інструмент, не діагноз',
  'Приватність медичних даних',
]

const LABS = [
  { name: 'Synevo', logo: 'S' },
  { name: 'ДІЛА', logo: 'Д' },
  { name: 'Smartlab', logo: 'Sm' },
  { name: 'CSD', logo: 'C' },
  { name: 'Ескулаб', logo: 'E' },
]

const SYMPTOM_OPTIONS = [
  'Втома',
  'Поганий сон',
  'Низька енергія',
  'Випадіння волосся',
  'Тривожність',
  'Проблеми з концентрацією',
  'Часті застуди',
  'Проблеми у дитини',
]

const FLOW_STEPS = [
  { title: 'Опишіть симптоми', body: 'Почніть з того, що реально турбує: сон, енергія, волосся, травлення або стан дитини.', icon: MessageCircle },
  { title: 'Отримайте напрямки аналізів', body: 'Vitaloop підкаже, які перевірки можуть мати сенс саме для вашої ситуації.', icon: SearchCheck },
  { title: 'Завантажте результати', body: 'Додайте PDF або фото з лабораторії, щоб побачити показники в одному місці.', icon: FileSearch },
  { title: 'Отримайте рекомендації', body: 'Сервіс формує персональний план дій, питання до лікаря і що відстежувати далі.', icon: ClipboardList },
  { title: 'Відстежуйте прогрес', body: 'Порівнюйте самопочуття, показники і повторні перевірки в динаміці.', icon: BarChart3 },
]

const FAMILY_GROUPS = [
  { title: 'Для дітей', body: ['феритин', 'вітамін D', 'часті захворювання', 'енергія та розвиток'] },
  { title: 'Для дорослих', body: ['сон', 'енергія', 'концентрація', 'відновлення'] },
  { title: 'Для батьків', body: ['зрозумілі пояснення', 'контроль динаміки', 'історія результатів'] },
]

const PRIORITY_LEVELS = [
  { title: 'Стабільний стан', tone: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', body: 'Більшість сигналів не потребують термінової уваги, але динаміку варто зберігати.' },
  { title: 'Потребує уваги', tone: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', body: 'Є показники або симптоми, які варто обговорити і перевірити планово.' },
  { title: 'Пріоритетні напрямки', tone: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500', body: 'Сервіс виділяє, що може бути важливим для наступного медичного кроку.' },
]

const SCENARIOS = [
  { title: 'Жінка, 37 років', symptoms: 'втома, слабкість', direction: 'можливий низький феритин', action: 'перевірити залізо, феритин і динаміку самопочуття' },
  { title: 'Чоловік, 42 роки', symptoms: 'поганий сон, низька енергія', direction: 'можливі фактори: вітамін D, магній, стрес', action: 'підготувати питання до лікаря і список перевірок' },
  { title: 'Дитина, 8 років', symptoms: 'швидка втомлюваність', direction: 'можливі напрямки: феритин, вітамін D', action: 'структурувати симптоми перед консультацією' },
]

const RESULT_EXAMPLE = [
  { label: 'Скарга', value: 'Постійна втома, поганий сон, низька енергія' },
  { label: 'Можливий пріоритет', value: 'феритин, вітамін D, якість сну та відновлення' },
  { label: 'Що перевірити', value: 'ЗАК, феритин, 25(OH)D, B12 — без зайвого списку “на все”' },
  { label: 'Що обговорити з лікарем', value: 'динаміку симптомів, дефіцити, повторну перевірку і безпечний план дій' },
]

const FAMILY_CHECKS = [
  'феритин',
  'вітамін D',
  'енергія',
  'концентрація',
]

const EDUCATION_ARTICLES = [
  { title: 'Що таке феритин?', path: '/analizy' },
  { title: 'Чому виникає втома?', path: '/symptomy' },
  { title: 'Як зрозуміти дефіцит вітаміну D?', path: '/analizy' },
  { title: 'Причини випадіння волосся', path: '/symptomy' },
  { title: 'Як покращити сон', path: '/samopochuttia' },
  { title: 'Аналізи для дітей', path: '/samopochuttia' },
]

export const PRICING = [
  {
    name: 'Безкоштовно',
    price: '0 грн',
    note: 'для старту',
    description: 'Перший розбір стану, базові симптоми і короткий підсумок, щоб зрозуміти, з чого почати.',
    features: ['Оцінка самопочуття', 'Базовий розбір симптомів', '1 активне завантаження аналізів', 'Короткий підсумок'],
    cta: 'Почати безкоштовно',
    featured: false,
  },
  {
    name: 'Premium',
    price: '399 грн/міс',
    note: 'для регулярної роботи',
    description: 'Більше завантажень, динаміка, повніші пояснення і пріоритети для наступних перевірок.',
    features: ['Більше завантажень аналізів', 'Повний підсумок стану', 'Динаміка показників', 'Пріоритети і питання до лікаря'],
    cta: 'Спробувати Premium',
    featured: true,
  },
  {
    name: 'Family',
    price: 'Очікується',
    note: 'для сімейного контролю',
    description: 'Окремі профілі для близьких, зручна історія показників і зрозумілі підсумки для батьків.',
    features: ['Профілі членів родини', 'Дитячі сценарії', 'Спільна історія аналізів', 'Нагадування про динаміку'],
    cta: 'Скоро',
    featured: false,
    comingSoon: true,
  },
]

const FAQ_ITEMS = [
  {
    question: 'Чи замінює Vitaloop лікаря?',
    answer: 'Ні. Vitaloop не ставить діагноз і не призначає лікування. Він допомагає структурувати симптоми, аналізи і питання перед консультацією.',
  },
  {
    question: 'Можна почати без аналізів?',
    answer: 'Так. Почніть із симптомів і самопочуття. Аналізи можна додати пізніше, коли буде зрозуміло, що саме варто перевірити.',
  },
  {
    question: 'Чи це тільки для дорослих?',
    answer: 'Ні. Vitaloop можна використовувати для сімейного контролю стану, але будь-які дитячі питання потрібно обговорювати з педіатром.',
  },
  {
    question: 'Чи є лабораторії партнерами?',
    answer: 'Поки ми говоримо про підтримку форматів результатів з популярних лабораторій України. Партнерства будемо позначати окремо.',
  },
  {
    question: 'Що таке індекс пріоритетів?',
    answer: 'Це внутрішній індикатор Vitaloop, який допомагає побачити, які напрямки потребують уваги. Це не діагноз і не медичний висновок.',
  },
  {
    question: 'Що входить у Premium?',
    answer: 'Більше завантажень аналізів, повніший підсумок, динаміка стану, пріоритети і питання до лікаря.',
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
    { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'UAH' },
    { '@type': 'Offer', name: 'Premium', price: '399', priceCurrency: 'UAH' },
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
        <img src="/images/ua-vitaloop-mark-20260603.png" alt="" className="h-[30px] w-[30px] object-contain sm:h-8 sm:w-8" />
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
  const navigate = useNavigate()

  const openPage = (path) => {
    setOpen(false)
    navigate(getUaPath(path))
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#e5dfd6] bg-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div className="mx-auto flex h-[60px] w-full max-w-[1200px] items-center justify-between px-4 sm:h-[68px] sm:px-6">
        <button onClick={() => navigate(getUaPath('/'))} className="flex h-11 items-center gap-1.5 rounded-full pr-1 sm:gap-2" aria-label="Vitaloop Україна">
          <UaBrandMark />
          <UaFlag />
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              onClick={() => openPage(link.path)}
              className="rounded-full px-3.5 py-2 text-sm font-semibold text-[#4b5563] transition duration-200 hover:bg-[#f1fbf8] hover:text-[#0f766e]"
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button
            onClick={() => navigate('/login')}
            className="rounded-full px-4 py-2 text-sm font-semibold text-[#4b5563] transition duration-200 hover:bg-[#f1fbf8] hover:text-[#0f766e]"
          >
            Увійти
          </button>
          <button onClick={() => navigate('/login?signup=true')} className={CTA_CLASS}>
            Почати
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e5dfd6] bg-white text-[#0f172a] shadow-sm transition hover:bg-[#f1fbf8] md:hidden"
          aria-label="Відкрити меню"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-[#e5dfd6] bg-white md:hidden">
          <div className="mx-auto grid max-w-[1200px] gap-1 px-4 py-4">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                onClick={() => openPage(link.path)}
                className="rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#4b5563] transition hover:bg-[#f1fbf8] hover:text-[#0f766e]"
              >
                {link.label}
              </button>
            ))}
            <button onClick={() => navigate('/login?signup=true')} className={`${CTA_CLASS} mt-2 w-full`}>
              Отримати персональну оцінку
            </button>
          </div>
        </div>
      )}
    </header>
  )
}

export function UaFooter() {
  const navigate = useNavigate()

  return (
    <footer className="border-t border-[#e5dfd6] bg-white">
      <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.1fr_0.9fr_0.9fr]">
        <div>
          <button onClick={() => navigate(getUaPath('/'))} className="flex items-center gap-2" aria-label="Vitaloop Україна">
            <UaBrandMark />
            <UaFlag />
          </button>
          <p className="mt-4 max-w-md text-sm leading-7 text-[#4b5563]">
            VITALOOP Ukraine допомагає почати з симптомів, зрозуміти можливі причини і рухатися до кращих рішень щодо здоровʼя.
          </p>
          <div className="mt-5 rounded-[22px] border border-[#e5dfd6] bg-[#f8f5f0] p-4">
            <p className="text-sm font-black text-[#0f172a]">Українська екосистема здоровʼя</p>
            <p className="mt-1 text-sm leading-6 text-[#4b5563]">
              Локальні лабораторії, спеціалісти й сервіси мають бути першими в наших партнерствах, коли це чесно для користувача.
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-[#0f766e]">Сторінки</p>
          <div className="mt-4 grid gap-2">
            {NAV_LINKS.map((link) => (
              <button key={link.id} onClick={() => navigate(getUaPath(link.path))} className="w-fit text-left text-sm font-semibold text-[#4b5563] transition hover:text-[#0f766e]">
                {link.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-[#0f766e]">Важливо</p>
          <p className="mt-4 text-sm leading-7 text-[#4b5563]">
            Vitaloop не ставить діагноз, не призначає лікування і не замінює лікаря. Це освітній інструмент для кращого розуміння стану.
          </p>
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
      <h2 className="mt-3 text-[28px] font-black leading-[1.12] tracking-tight text-[#0f172a] sm:text-[40px] md:text-[48px]">
        {title}
      </h2>
      {body && <p className="mt-4 text-[15px] leading-7 text-[#4b5563] sm:text-base sm:leading-8">{body}</p>}
    </div>
  )
}

export default function UaLanding() {
  const navigate = useNavigate()
  const [selectedSymptoms, setSelectedSymptoms] = useState(['Втома', 'Поганий сон'])

  const startSignup = () => navigate('/login?signup=true')
  const goPage = (path) => navigate(getUaPath(path))
  const toggleSymptom = (symptom) => {
    setSelectedSymptoms((current) =>
      current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom],
    )
  }

  return (
    <div id="top" className="min-h-screen bg-[#f8f5f0] text-[#0f172a]">
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
        <section className="relative overflow-hidden border-b border-[#e5dfd6] bg-[#f8f5f0]">
          <img src={HERO_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover object-[57%_center] opacity-90 sm:object-center" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(248,245,240,0.20)_0%,rgba(248,245,240,0.48)_58%,rgba(248,245,240,0.96)_100%)] sm:bg-[linear-gradient(90deg,rgba(248,245,240,0.98)_0%,rgba(248,245,240,0.90)_42%,rgba(248,245,240,0.30)_78%,rgba(248,245,240,0.08)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.62),transparent_32%)]" />

          <div className="relative mx-auto flex min-h-[690px] w-full max-w-[1200px] items-start px-4 pb-8 pt-[112px] sm:min-h-[calc(100svh-68px)] sm:items-center sm:px-6 sm:py-16">
            <div className="max-w-2xl rounded-[32px] border border-white/80 bg-white/74 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-0">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#e5dfd6] bg-white/88 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.10em] text-[#0f766e] shadow-sm sm:text-xs">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#14b8a6]" />
                Симптоми · причини · план дій
              </div>
              <h1 className="mt-5 max-w-[680px] text-[34px] font-black leading-[1.05] tracking-tight text-[#0f172a] sm:mt-6 sm:text-[52px] lg:text-[66px]">
                Постійна втома? Поганий сон? Низька енергія?
              </h1>
              <p className="mt-5 max-w-xl text-[16px] leading-7 text-[#334155] sm:text-lg sm:leading-8">
                Знайдіть можливу причину та отримайте персональний план дій. Почніть із симптомів або завантажте аналізи, якщо вони вже є.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button onClick={startSignup} className={`${CTA_CLASS} w-full sm:w-auto`}>
                  <span>Отримати персональну оцінку</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => scrollTo('result-example')}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#e5dfd6] bg-white px-5 py-3 text-center text-sm font-black leading-tight text-[#0f172a] shadow-sm transition hover:-translate-y-0.5 hover:border-[#14b8a6]/45 hover:text-[#0f766e] sm:w-auto sm:whitespace-nowrap"
                >
                  Переглянути приклад
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="trust" className="bg-white py-10 sm:py-12">
          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
            <div className="grid gap-6 border-y border-[#e5dfd6] py-6 md:grid-cols-[1.2fr_1fr] md:items-center">
              <p className="max-w-2xl text-lg font-black leading-8 text-[#0f172a]">
                VITALOOP збирає симптоми, аналізи й динаміку в одну зрозумілу картину. Без діагнозів, без гучних обіцянок, без медичного туману.
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm font-bold text-[#4b5563] sm:grid-cols-4 md:grid-cols-2">
                <span>Приватність даних</span>
                <span>Симптоми + аналізи</span>
                <span>Для всієї родини</span>
                <span>Українські формати</span>
              </div>
            </div>
          </div>
        </section>

        <section id="wellbeing" className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div>
            <SectionHeading
              eyebrow="Короткий тест"
              title="Що вас турбує?"
              body="Оберіть кілька сигналів. Vitaloop покаже, які напрямки варто розглянути першими і що може бути повʼязано між собою."
            />
            <button onClick={startSignup} className={`${CTA_CLASS} mt-7 w-full sm:w-auto`}>
              Побачити мої пріоритети
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-[30px] bg-white/78 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] ring-1 ring-[#e5dfd6] backdrop-blur sm:p-5">
            <div className="flex items-center justify-between gap-4 border-b border-[#e5dfd6] pb-4">
              <p className="text-sm font-black text-[#0f172a]">Обрано: {selectedSymptoms.length} симптоми</p>
              <p className="text-xs font-bold text-[#6b7280]">1 хвилина</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {SYMPTOM_OPTIONS.map((symptom) => {
                const active = selectedSymptoms.includes(symptom)
                return (
                  <button
                    key={symptom}
                    onClick={() => toggleSymptom(symptom)}
                    className={`flex items-center gap-3 rounded-[18px] px-4 py-3 text-left text-sm font-black transition hover:-translate-y-0.5 ${active ? 'bg-[#0f766e] text-white shadow-[0_12px_30px_rgba(15,118,110,0.22)]' : 'bg-[#f8f5f0] text-[#0f172a] hover:bg-white hover:text-[#0f766e]'}`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${active ? 'border-white/70 bg-white text-[#0f766e]' : 'border-[#d6d0c7] bg-white text-transparent'}`}>
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    {symptom}
                  </button>
                )
              })}
            </div>
            <div className="mt-5 rounded-[22px] bg-[#f8f5f0] p-4 text-sm leading-6 text-[#4b5563]">
              <span className="font-black text-[#0f172a]">Попередній фокус:</span>{' '}
              {selectedSymptoms.length ? selectedSymptoms.join(', ') : 'оберіть симптоми'} → можливі пріоритети для перевірки.
            </div>
          </div>
        </section>

        <section id="how" className="bg-white py-14 sm:py-20">
          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
            <SectionHeading center eyebrow="Як це працює" title="Від скарг до плану дій" />
            <div className="mt-12 grid gap-8 md:grid-cols-5">
              {FLOW_STEPS.map((item, index) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.title}
                    onClick={() => goPage(index === 2 ? '/analizy' : index === 1 ? '/symptomy' : '/samopochuttia')}
                    className="group relative text-left"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f1fbf8] text-[#0f766e] transition group-hover:-translate-y-0.5 group-hover:bg-[#0f766e] group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="mt-5 block text-xs font-black uppercase tracking-[0.14em] text-[#6b7280]">0{index + 1}</span>
                    <h3 className="mt-2 text-lg font-black text-[#0f172a]">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[#4b5563]">{item.body}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section id="result-example" className="mx-auto w-full max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <SectionHeading
              eyebrow="Приклад результату"
              title="Що ви отримаєте після оцінки"
              body="Після короткого тесту або завантаження аналізів Vitaloop показує не просто список показників, а зрозумілий наступний крок."
            />

            <div className="rounded-[32px] bg-white p-5 shadow-[0_28px_90px_rgba(15,23,42,0.10)] ring-1 ring-[#e5dfd6] sm:p-6">
              <div className="flex flex-col gap-4 border-b border-[#e5dfd6] pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0f766e]">Personal result</p>
                  <h3 className="mt-2 text-2xl font-black text-[#0f172a]">Персональний підсумок</h3>
                </div>
                <span className="w-fit rounded-full bg-[#f4eadb] px-4 py-2 text-xs font-black text-[#8a6a30]">Освітній приклад</span>
              </div>

              <div className="mt-5 grid gap-4">
                {RESULT_EXAMPLE.map((item) => (
                  <div key={item.label} className="grid gap-2 border-b border-[#eee7dc] pb-4 last:border-0 last:pb-0 sm:grid-cols-[160px_1fr]">
                    <p className="text-sm font-black text-[#0f172a]">{item.label}</p>
                    <p className="text-sm leading-7 text-[#4b5563]">{item.value}</p>
                  </div>
                ))}
              </div>

              <button onClick={startSignup} className={`${CTA_CLASS} mt-6 w-full sm:w-auto`}>
                Отримати такий підсумок
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <section className="bg-[linear-gradient(180deg,#f8f5f0,#efebe5)] py-14 sm:py-20">
          <div className="mx-auto grid w-full max-w-[1200px] gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-start">
            <div>
              <SectionHeading
                eyebrow="Родина"
                title="Здоровʼя дорослих і дітей в одному контексті"
                body="Батькам важливо бачити не тільки окремий показник, а стан, динаміку і питання, з якими варто йти до лікаря."
              />
              <div className="mt-8 grid gap-5 sm:grid-cols-3">
                {FAMILY_GROUPS.map((group) => (
                  <div key={group.title}>
                    <h3 className="text-base font-black text-[#0f172a]">{group.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[#4b5563]">{group.body.join(' · ')}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 rounded-[28px] bg-white/70 p-5 shadow-sm ring-1 ring-[#e5dfd6]">
                <p className="text-sm font-black text-[#0f172a]">Для дітей часто починають з:</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {FAMILY_CHECKS.map((item) => (
                    <span key={item} className="inline-flex items-center gap-2 rounded-full bg-[#f8f5f0] px-3 py-2 text-sm font-bold text-[#4b5563]">
                      <Check className="h-3.5 w-3.5 text-[#0f766e]" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <SectionHeading
                eyebrow="Пріоритети"
                title="Не оцінка здоровʼя, а карта уваги"
                body="Індекс пріоритетів допомагає зрозуміти, що варто перевірити або обговорити першим. Це не діагноз і не медичний висновок."
              />
              <div className="mt-8 space-y-5">
                {PRIORITY_LEVELS.map((level) => (
                  <div key={level.title} className="border-l-2 border-[#0f766e]/25 pl-5">
                    <p className="text-base font-black text-[#0f172a]">{level.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#4b5563]">{level.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="laboratories" className="mx-auto w-full max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-start">
            <div>
              <SectionHeading
                eyebrow="Приклади"
                title="Типові сценарії, з яких починають"
                body="Це освітні приклади, не діагноз і не обіцянка результату. Їх задача — показати, як сервіс структурує запит."
              />
              <div className="mt-8 space-y-6">
                {SCENARIOS.map((item) => (
                  <div key={item.title} className="border-t border-[#e5dfd6] pt-5">
                    <h3 className="text-lg font-black text-[#0f172a]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-[#4b5563]">
                      {item.symptoms} → {item.direction} → {item.action}.
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionHeading
                eyebrow="Лабораторії"
                title="Підтримуємо популярні формати результатів"
                body="Можна завантажити PDF або фото з різних лабораторій України. Якщо вашої лабораторії немає у списку — результати все одно можна завантажити. Партнерства будемо позначати окремо, коли вони будуть офіційними."
              />
              <div className="mt-8 flex flex-wrap gap-3">
                {LABS.map((lab) => (
                  <button key={lab.name} onClick={() => goPage('/laboratorii')} className="rounded-full bg-white px-5 py-3 text-sm font-black text-[#0f172a] shadow-sm ring-1 ring-[#e5dfd6] transition hover:-translate-y-0.5 hover:text-[#0f766e]">
                    {lab.name}
                  </button>
                ))}
              </div>
              <button onClick={() => goPage('/analizy')} className="mt-8 inline-flex items-center gap-2 text-sm font-black text-[#0f766e] transition hover:gap-3">
                Як працює розбір аналізів
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white py-14 sm:py-20">
          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
            <SectionHeading center eyebrow="Корисні матеріали" title="Питання, з яких часто починають" />
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {EDUCATION_ARTICLES.slice(0, 4).map((article) => (
                <button key={article.title} onClick={() => goPage(article.path)} className="rounded-[22px] bg-[#f8f5f0] p-5 text-left text-base font-black text-[#0f172a] transition hover:-translate-y-0.5 hover:bg-[#f1fbf8] hover:text-[#0f766e]">
                  {article.title}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6 sm:py-16 md:py-20">
          <SectionHeading center eyebrow="Тарифи" title="Почніть безкоштовно, масштабуйте за потребою" body="Для першої оцінки достатньо безкоштовного старту. Premium потрібен для регулярної роботи з аналізами й динамікою." />
          <div className="mx-auto mt-8 grid max-w-[1100px] gap-4 lg:grid-cols-3">
            {PRICING.map((plan) => (
              <article
                key={plan.name}
                className={`relative rounded-[28px] border p-6 shadow-sm ${plan.featured ? 'border-[#0f766e] bg-[#0f172a] text-white shadow-[0_28px_80px_rgba(15,23,42,0.24)]' : plan.comingSoon ? 'border-[#e5dfd6] bg-[#f8f5f0] text-[#0f172a]' : 'border-[#e5dfd6] bg-white text-[#0f172a]'}`}
              >
                {plan.featured && (
                  <span className="absolute right-5 top-5 rounded-full bg-[#d4b483] px-3 py-1 text-xs font-black text-[#111111]">
                    Найкращий вибір
                  </span>
                )}
                <p className={`text-sm font-black uppercase tracking-[0.14em] ${plan.featured ? 'text-[#5eead4]' : 'text-[#0f766e]'}`}>{plan.name}</p>
                <h3 className="mt-3 text-4xl font-black">{plan.price}</h3>
                <p className={`mt-1 text-sm ${plan.featured ? 'text-[#cbd5e1]' : 'text-[#6b7280]'}`}>{plan.note}</p>
                <p className={`mt-5 text-sm leading-7 ${plan.featured ? 'text-[#e2e8f0]' : 'text-[#4b5563]'}`}>{plan.description}</p>
                <div className="mt-6 grid gap-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${plan.featured ? 'bg-white text-[#0f172a]' : 'bg-[#f1fbf8] text-[#0f766e]'}`}>
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span className={`text-sm leading-6 ${plan.featured ? 'text-white' : 'text-[#4b5563]'}`}>{feature}</span>
                    </div>
                  ))}
                </div>
                <button onClick={plan.comingSoon ? undefined : startSignup} disabled={plan.comingSoon} className={`${plan.comingSoon ? 'inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-black text-[#6b7280] ring-1 ring-[#e5dfd6]' : CTA_CLASS} mt-7 w-full`}>
                  {plan.cta}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[920px] px-4 pb-12 sm:px-6 sm:pb-16 md:pb-20">
          <SectionHeading center eyebrow="Питання" title="Коротко про важливе" />
          <div className="mt-7 divide-y divide-[#e5dfd6] overflow-hidden rounded-[26px] border border-[#e5dfd6] bg-white shadow-sm">
            {FAQ_ITEMS.map((item) => (
              <details key={item.question} className="group p-4 open:bg-[#f8f5f0] sm:p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-black text-[#0f172a]">
                  {item.question}
                  <ChevronDown className="h-5 w-5 shrink-0 text-[#6b7280] transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#4b5563]">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="border-t border-[#e5dfd6] bg-[linear-gradient(145deg,#0f172a,#0f766e)] py-12 text-white sm:py-16">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col items-start justify-between gap-5 px-4 sm:px-6 md:flex-row md:items-center">
            <div>
              <h2 className="max-w-3xl text-[30px] font-black leading-tight tracking-tight sm:text-[44px]">Почніть краще розуміти своє здоровʼя вже сьогодні</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#d9fffb] sm:text-base">
                Не чекайте, поки симптоми стануть проблемою. Почніть із короткої оцінки стану.
              </p>
            </div>
            <button onClick={startSignup} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-black text-[#0f172a] shadow-[0_18px_42px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5">
              Створити безкоштовний акаунт
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <UaFooter />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5dfd6] bg-white/94 px-4 py-3 shadow-[0_-12px_34px_rgba(15,23,42,0.10)] backdrop-blur-xl md:hidden">
        <button onClick={startSignup} className={`${CTA_CLASS} w-full`}>
          Отримати персональну оцінку
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
