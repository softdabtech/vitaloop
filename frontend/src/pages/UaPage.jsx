import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Check,
  ClipboardList,
  FileSearch,
  FlaskConical,
  HeartPulse,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import Seo from '../components/Seo.jsx'
import { CTA_CLASS, PRICING, UaFooter, UaHeader, getUaPath } from './UaLanding.jsx'

const PAGE_CONTENT = {
  samopochuttia: {
    eyebrow: 'Самопочуття',
    title: 'Почніть із того, що відчуваєте',
    description:
      'Vitaloop допомагає спокійно описати стан, побачити повторювані сигнали й зрозуміти, що варто перевірити першим.',
    icon: HeartPulse,
    cta: 'Оцінити самопочуття',
    blocks: [
      ['Енергія', 'Втома, відновлення після сну, спад сил протягом дня.'],
      ['Сон', 'Якість сну, пробудження, напруга ввечері та вранці.'],
      ['Тіло', 'Біль, тиск, травлення, цикл, шкіра, серцебиття.'],
      ['Динаміка', 'Що змінилося за останні тижні і що повторюється.'],
    ],
    steps: [
      ['Короткий опис', 'Пишете простими словами, без медичних формулювань.'],
      ['Структура', 'Сервіс розкладає скарги за напрямками.'],
      ['Пріоритет', 'Виділяємо, з чого логічно почати перевірку.'],
    ],
  },
  symptomy: {
    eyebrow: 'Симптоми',
    title: 'Розбір симптомів без паніки',
    description:
      'Коли аналізів ще немає, Vitaloop допомагає зібрати симптоми в зрозумілу картину: що, коли, як часто і з чим може бути повʼязано.',
    icon: MessageCircle,
    cta: 'Описати симптоми',
    blocks: [
      ['Що турбує', 'Фіксуємо основні скарги без складних термінів.'],
      ['Як давно', 'Відокремлюємо нові симптоми від давніх станів.'],
      ['Що впливає', 'Їжа, сон, стрес, навантаження, ліки, цикл.'],
      ['Що уточнити', 'Готуємо питання, які варто обговорити з лікарем.'],
    ],
    steps: [
      ['Опис', 'Ви описуєте стан як у звичайній розмові.'],
      ['Звʼязки', 'Vitaloop показує можливі групи симптомів.'],
      ['Наступний крок', 'Отримуєте короткий список дій без зайвого шуму.'],
    ],
  },
  analizy: {
    eyebrow: 'Аналізи',
    title: 'Аналізи українською, а не мовою бланків',
    description:
      'Завантажте PDF або фото результатів, щоб побачити показники, референси й можливі пріоритети в контексті вашого самопочуття.',
    icon: FileSearch,
    cta: 'Додати аналізи',
    blocks: [
      ['Українські назви', 'Феритин, вітамін D, ТТГ, глюкоза та інші показники зрозумілою мовою.'],
      ['Референси', 'Пояснюємо одиниці виміру і межі, які вказує лабораторія.'],
      ['Контекст', 'Показники не відірвані від симптомів, сну, стресу і стану.'],
      ['Підсумок', 'Що важливо зараз, що відстежувати і що запитати у лікаря.'],
    ],
    steps: [
      ['Завантаження', 'PDF або фото результатів з українських лабораторій.'],
      ['Нормалізація', 'Назви й одиниці приводяться до зрозумілого вигляду.'],
      ['Пояснення', 'Отримуєте короткий підсумок без медичного туману.'],
    ],
  },
  laboratorii: {
    eyebrow: 'Лабораторії',
    title: 'Підкажемо, де здати потрібні аналізи',
    description:
      'Після оцінки стану Vitaloop формує список перевірок і допомагає перейти до українських лабораторій, де ці аналізи можна здати.',
    icon: FlaskConical,
    cta: 'Підібрати перевірки',
    blocks: [
      ['Сінево', 'Широка мережа відділень і популярні базові панелі.'],
      ['Діла', 'Гормони, дефіцити, профілактичні та спеціалізовані пакети.'],
      ['Ескулаб', 'Регіональна доступність і зручні формати результатів.'],
      ['CSD', 'Розширені дослідження для складніших запитів.'],
    ],
    steps: [
      ['Список аналізів', 'Спершу формується логічний перелік перевірок.'],
      ['Вибір лабораторії', 'Пізніше додамо міста, ціни й партнерські посилання.'],
      ['Повернення результатів', 'Після здачі аналізи можна додати назад у Vitaloop.'],
    ],
  },
  tarify: {
    eyebrow: 'Тарифи',
    title: 'Free для старту, Premium для регулярної роботи',
    description:
      'Почніть безкоштовно, а коли потрібні більше аналізів, динаміка й повніші підсумки, перейдіть на Premium.',
    icon: Sparkles,
    cta: 'Почати безкоштовно',
    blocks: [],
    steps: [
      ['Free', 'Перший розбір стану, базові симптоми й стартовий підсумок.'],
      ['Premium', 'Більше завантажень, динаміка, повніші пояснення і пріоритети.'],
      ['399 грн/міс', 'Проста ціна для регулярної роботи зі станом.'],
    ],
  },
}

const DEFAULT_SLUG = 'samopochuttia'

function PageIcon({ icon: Icon }) {
  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-white text-[#0f766e] shadow-[0_18px_34px_rgba(15,118,110,0.12)] ring-1 ring-[#e5dfd6]">
      <Icon className="h-7 w-7" />
    </span>
  )
}

const SECONDARY_BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-[#e5dfd6] bg-white px-5 py-3 text-center text-sm font-black leading-tight text-[#0f172a] shadow-sm transition hover:-translate-y-0.5 hover:border-[#14b8a6]/45 hover:text-[#0f766e]'

function PricingPanel({ startSignup }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {PRICING.map((plan) => (
        <article
          key={plan.name}
          className={`relative rounded-[28px] border p-5 shadow-sm sm:p-6 ${plan.featured ? 'border-[#0f766e] bg-[#0f172a] text-white shadow-[0_28px_80px_rgba(15,23,42,0.24)]' : plan.comingSoon ? 'border-[#e5dfd6] bg-[#f8f5f0] text-[#0f172a]' : 'border-[#e5dfd6] bg-white text-[#0f172a]'}`}
        >
          {plan.featured && (
            <span className="absolute right-5 top-5 rounded-full bg-[#d4b483] px-3 py-1 text-xs font-black text-[#111111]">
              Найкращий вибір
            </span>
          )}
          <p className={`text-sm font-black uppercase tracking-[0.14em] ${plan.featured ? 'text-[#5eead4]' : 'text-[#0f766e]'}`}>{plan.name}</p>
          <h2 className="mt-3 text-4xl font-black">{plan.price}</h2>
          <p className={`mt-2 text-sm ${plan.featured ? 'text-[#cbd5e1]' : 'text-[#6b7280]'}`}>{plan.note}</p>
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
  )
}

export default function UaPage({ pageSlug }) {
  const params = useParams()
  const navigate = useNavigate()
  const slug = pageSlug || params.pageSlug || DEFAULT_SLUG
  const page = PAGE_CONTENT[slug] || PAGE_CONTENT[DEFAULT_SLUG]
  const startSignup = () => navigate('/login?signup=true')
  const Icon = page.icon

  const schema = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${page.title} | Vitaloop Ukraine`,
    url: `https://ua.vitaloop.today/${slug}`,
    inLanguage: 'uk-UA',
    description: page.description,
  }), [page.description, page.title, slug])

  return (
    <div className="min-h-screen bg-[#f8f5f0] text-[#0f172a]">
      <Seo
        title={`${page.title} | Vitaloop Ukraine`}
        description={page.description}
        canonicalUrl={`https://ua.vitaloop.today/${slug}`}
        locale="uk_UA"
        image="https://ua.vitaloop.today/images/ua-health-hero-dashboard-ua-20260603.png"
        schemas={[schema]}
      />
      <UaHeader />

      <main>
        <section className="relative overflow-hidden border-b border-[#e5dfd6] bg-[#f8f5f0]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(20,184,166,0.12),transparent_34%),radial-gradient(circle_at_86%_18%,rgba(212,180,131,0.20),transparent_30%)]" />
          <div className="relative mx-auto grid w-full max-w-[1200px] gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:py-20">
            <div>
              <PageIcon icon={Icon} />
              <p className="mt-6 text-xs font-black uppercase tracking-[0.14em] text-[#0f766e] sm:text-sm">{page.eyebrow}</p>
              <h1 className="mt-3 max-w-3xl text-[34px] font-black leading-[1.08] tracking-tight sm:text-[48px] lg:text-[58px]">
                {page.title}
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#4b5563] sm:text-lg sm:leading-8">
                {page.description}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button onClick={startSignup} className={CTA_CLASS}>
                  {page.cta}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button onClick={() => navigate(getUaPath('/'))} className={SECONDARY_BUTTON}>
                  На головну
                </button>
              </div>
            </div>

            <div className="rounded-[30px] bg-white/82 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] ring-1 ring-[#e5dfd6] backdrop-blur sm:p-6">
              <div className="grid gap-3">
                {page.steps.map(([title, body], index) => (
                  <div key={title} className="flex gap-4 rounded-[22px] bg-[#f8f5f0] p-4">
                    <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-[#0f766e] ring-1 ring-[#e5dfd6]">
                      0{index + 1}
                    </span>
                    <div>
                      <h2 className="text-base font-black text-[#0f172a]">{title}</h2>
                      <p className="mt-1 text-sm leading-6 text-[#4b5563]">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {slug === 'tarify' ? (
          <section className="mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6 sm:py-16 md:py-20">
            <PricingPanel startSignup={startSignup} />
          </section>
        ) : (
          <section className="mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6 sm:py-16 md:py-20">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {page.blocks.map(([title, body]) => (
                <article key={title} className="flex min-h-[190px] flex-col rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-[#e5dfd6] transition duration-200 hover:-translate-y-0.5 hover:ring-[#14b8a6]/45 hover:shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
                  <h2 className="text-xl font-black text-[#0f172a]">{title}</h2>
                  <p className="mt-3 text-sm leading-7 text-[#4b5563]">{body}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="border-y border-[#e5dfd6] bg-white py-12 sm:py-16">
          <div className="mx-auto grid w-full max-w-[1200px] gap-6 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0f766e] sm:text-sm">Наступний крок</p>
              <h2 className="mt-3 text-[28px] font-black leading-[1.12] tracking-tight text-[#0f172a] sm:text-[42px]">
                Зберіть стан у короткий план
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                [ClipboardList, 'Стан', 'Що відчуваєте зараз'],
                [BarChart3, 'Пріоритети', 'Що перевірити першим'],
                [ShieldCheck, 'Підсумок', 'Що взяти до лікаря'],
              ].map(([StepIcon, title, body]) => (
                <div key={title} className="rounded-[22px] bg-[#f8f5f0] p-4 text-center ring-1 ring-[#e5dfd6]">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#0f766e] ring-1 ring-[#e5dfd6]">
                    <StepIcon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-black text-[#0f172a]">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#4b5563]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-[1200px] flex-col items-start justify-between gap-5 px-4 py-10 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[#0f172a]">Можна почати з однієї відповіді</h2>
            <p className="mt-2 text-sm leading-6 text-[#4b5563]">
              Опишіть, що турбує зараз, і Vitaloop допоможе скласти перший зрозумілий маршрут.
            </p>
          </div>
          <button onClick={startSignup} className={CTA_CLASS}>
            Отримати персональну оцінку
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>

        <UaFooter />
      </main>
    </div>
  )
}
