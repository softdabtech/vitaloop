import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart2,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react'
import Seo from '../components/Seo.jsx'
import { fadeUp, fadeUpBlur, stagger, staggerChild, EASE } from '../lib/motion.js'

/* ─── Data ──────────────────────────────────────────────── */

const PAIN_POINTS = [
  {
    icon: ClipboardList,
    title: 'Протоколы разбросаны по файлам',
    body: 'Google Docs, PDF, мессенджеры — данные пациентов теряются. Нет единой системы контроля выполнения рекомендаций.',
  },
  {
    icon: FlaskConical,
    title: 'Анализы приходят в разных форматах',
    body: 'Каждая лаборатория — свой бланк, свои единицы. Ручная расшифровка занимает час, когда нужна минута.',
  },
  {
    icon: HeartPulse,
    title: 'Пациент пропадает после консультации',
    body: 'Нет инструмента для постоянного контакта, мониторинга прогресса и адаптации программы между сессиями.',
  },
]

const WORKFLOW_STEPS = [
  {
    icon: Users,
    step: '01',
    title: 'Добавьте пациентов',
    body: 'Пригласите клиентов по email. Каждый получает личный кабинет для загрузки анализов и отслеживания прогресса.',
    accent: '#10b981',
  },
  {
    icon: Upload,
    step: '02',
    title: 'Анализы расшифруются за минуту',
    body: 'Пациент загружает PDF-бланк. VITALOOP извлекает 85+ биомаркеров, нормализует единицы и выявляет отклонения.',
    accent: '#0ea5e9',
  },
  {
    icon: BrainCircuit,
    step: '03',
    title: 'AI строит черновик протокола',
    body: 'На основе биомаркеров, симптомов и анамнеза система предлагает нутрициологический протокол — вы дорабатываете финальную версию.',
    accent: '#8b5cf6',
  },
  {
    icon: Calendar,
    step: '04',
    title: 'Еженедельный check-in держит пациента в программе',
    body: 'Автоматические опросы фиксируют самочувствие и adherence. Вы видите динамику без лишних звонков.',
    accent: '#f59e0b',
  },
  {
    icon: TrendingUp,
    step: '05',
    title: 'Лонгитюдная аналитика на каждом цикле',
    body: 'Новые анализы сравниваются с предыдущими. Вы видите, что улучшилось, что нужно скорректировать, и когда пора пересдать.',
    accent: '#10b981',
  },
]

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: 'Единый дашборд практикующего специалиста',
    body: 'Все пациенты, все протоколы, все анализы — в одном окне. Красные флаги видны сразу.',
  },
  {
    icon: ClipboardList,
    title: 'Персонализированные программы',
    body: 'Создавайте программы реабилитации, нутрициологической поддержки или лонgevity-курсы с конкретными заданиями и дедлайнами.',
  },
  {
    icon: BarChart2,
    title: 'Динамика биомаркеров во времени',
    body: 'Графики изменения ключевых показателей помогают объяснить прогресс пациенту и обосновать коррекцию протокола.',
  },
  {
    icon: MessageSquare,
    title: 'Встроенные задания и проверки',
    body: 'Назначайте конкретные действия: анализ, БАД, изменение рациона. Пациент отмечает выполнение — вы отслеживаете adherence.',
  },
  {
    icon: ShieldCheck,
    title: 'Конфиденциальность данных',
    body: 'Медицинские данные не продаются и не передаются третьим сторонам. VITALOOP — privacy-first платформа.',
  },
  {
    icon: Sparkles,
    title: 'AI как второй взгляд, не замена',
    body: 'Система выдаёт черновики и сигналы, решение принимаете вы. Ваша экспертиза остаётся в центре.',
  },
]

const USE_CASES = [
  {
    title: 'Реабилитационные программы',
    body: 'Пациенты после болезни, операции или выгорания. Отслеживайте восстановление по биомаркерам и корректируйте питание поэтапно.',
    tag: 'Rehabilitation',
    tagColor: '#10b981',
  },
  {
    title: 'Лонgevity и превентивная нутрициология',
    body: 'Клиенты без острых проблем, но с запросом на здоровое долголетие. Ежеквартальные циклы анализов + адаптивный протокол.',
    tag: 'Longevity',
    tagColor: '#8b5cf6',
  },
  {
    title: 'Спортивное питание и восстановление',
    body: 'Контроль ферритина, B12, D3, гормонального фона у активных клиентов. Протокол обновляется под тренировочный цикл.',
    tag: 'Sports',
    tagColor: '#0ea5e9',
  },
  {
    title: 'Пищевая непереносимость и ЖКТ',
    body: 'Динамика воспалительных маркеров, нутриентного статуса и симптоматики за несколько циклов питания.',
    tag: 'Gut health',
    tagColor: '#f59e0b',
  },
]

const METRICS = [
  { value: '85+', label: 'Биомаркеров нормализуется с одного бланка' },
  { value: '<60с', label: 'От загрузки до готового черновика протокола' },
  { value: '100%', label: 'История анализов пациента в одном месте' },
  { value: 'N:N', label: 'Один специалист — несколько пациентов одновременно' },
]

/* ─── Sub-components ────────────────────────────────────── */

function GlowBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_5%,rgba(16,185,129,0.18),transparent_36%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_92%_12%,rgba(14,165,233,0.10),transparent_34%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_80%,rgba(139,92,246,0.07),transparent_40%)]" />
    </div>
  )
}

function SectionLabel({ children, color = '#10b981' }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]"
      style={{ borderColor: `${color}33`, background: `${color}12`, color }}
    >
      {children}
    </span>
  )
}

function MetricCard({ value, label }) {
  return (
    <motion.div
      variants={staggerChild}
      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center backdrop-blur-sm"
    >
      <div className="text-4xl font-bold tracking-tight text-emerald-400">{value}</div>
      <div className="mt-2 text-sm leading-snug text-slate-400">{label}</div>
    </motion.div>
  )
}

function PainCard({ icon: Icon, title, body }) {
  return (
    <motion.div
      variants={staggerChild}
      className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm transition hover:border-slate-700"
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
        <Icon className="h-5 w-5 text-red-400" />
      </div>
      <h3 className="mb-2 text-base font-semibold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-400">{body}</p>
    </motion.div>
  )
}

function WorkflowStep({ icon: Icon, step, title, body, accent, index }) {
  return (
    <motion.div
      variants={fadeUp}
      custom={index * 0.08}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      className="flex gap-5"
    >
      <div className="flex flex-col items-center">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: `${accent}18`, border: `1px solid ${accent}33` }}
        >
          <Icon className="h-5 w-5" style={{ color: accent }} />
        </div>
        {index < WORKFLOW_STEPS.length - 1 && (
          <div className="mt-2 w-px flex-1 bg-gradient-to-b from-slate-700 to-transparent" />
        )}
      </div>
      <div className="pb-10">
        <div className="mb-1 text-xs font-bold tracking-widest" style={{ color: accent }}>{step}</div>
        <h3 className="mb-1.5 text-lg font-semibold text-white">{title}</h3>
        <p className="text-sm leading-relaxed text-slate-400">{body}</p>
      </div>
    </motion.div>
  )
}

function FeatureCard({ icon: Icon, title, body }) {
  return (
    <motion.div
      variants={staggerChild}
      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm transition hover:border-emerald-500/30"
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
        <Icon className="h-5 w-5 text-emerald-400" />
      </div>
      <h3 className="mb-2 text-base font-semibold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-400">{body}</p>
    </motion.div>
  )
}

function UseCaseCard({ title, body, tag, tagColor }) {
  return (
    <motion.div
      variants={staggerChild}
      className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm transition hover:border-slate-700"
    >
      <span
        className="mb-3 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"
        style={{ background: `${tagColor}18`, color: tagColor }}
      >
        {tag}
      </span>
      <h3 className="mb-2 text-base font-semibold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-400">{body}</p>
    </motion.div>
  )
}

/* ─── Page ──────────────────────────────────────────────── */

export default function ForNutritionists() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#09101d] text-white">
      <Seo
        title="Для нутрициологов | VITALOOP"
        description="VITALOOP — платформа для нутрициологов: ведите пациентов, расшифровывайте анализы за минуту, создавайте персонализированные протоколы питания и реабилитации."
        path="/for-nutritionists"
      />

      <GlowBg />

      {/* Nav back */}
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-400/50 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          На главную
        </button>
      </div>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-[1240px] px-4 pb-20 pt-8 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible">
              <SectionLabel>Для нутрициологов</SectionLabel>
            </motion.div>
            <motion.h1
              variants={fadeUpBlur}
              custom={0.06}
              initial="hidden"
              animate="visible"
              className="mt-5 text-5xl font-bold leading-[1.08] tracking-[-0.03em] text-white md:text-6xl"
            >
              Ведите пациентов&nbsp;—<br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                не&nbsp;таблицы
              </span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              custom={0.12}
              initial="hidden"
              animate="visible"
              className="mt-5 max-w-xl text-lg leading-8 text-slate-300"
            >
              VITALOOP превращает анализы крови в персонализированные протоколы питания и реабилитации.
              Подключайте клиентов, отслеживайте прогресс, корректируйте программы — всё в одном инструменте.
            </motion.p>
            <motion.div
              variants={fadeUp}
              custom={0.18}
              initial="hidden"
              animate="visible"
              className="mt-8 flex flex-wrap gap-3"
            >
              <button
                onClick={() => navigate('/login?signup=true')}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                Начать бесплатно
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate('/example-report')}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/60 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                Пример анализа
              </button>
            </motion.div>
            <motion.div
              variants={fadeUp}
              custom={0.22}
              initial="hidden"
              animate="visible"
              className="mt-6 flex flex-wrap gap-4"
            >
              {['Бесплатный старт', 'Без интеграций с ЭМК', 'Работает с любой лабораторией'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  {t}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Hero card */}
          <motion.div
            variants={fadeUp}
            custom={0.1}
            initial="hidden"
            animate="visible"
            className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Пациент: Анна К., 34 г.</span>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">Активный протокол</span>
            </div>
            <div className="space-y-3">
              {[
                { marker: 'Ферритин', val: '11 нг/мл', flag: 'Низкий', color: '#ef4444' },
                { marker: 'Витамин D (25-OH)', val: '18 нмоль/л', flag: 'Дефицит', color: '#f59e0b' },
                { marker: 'B12', val: '245 пмоль/л', flag: 'Граница', color: '#f59e0b' },
                { marker: 'ТТГ', val: '2.1 мМЕ/л', flag: 'Норма', color: '#10b981' },
                { marker: 'hsCRP', val: '0.8 мг/л', flag: 'Норма', color: '#10b981' },
              ].map(({ marker, val, flag, color }) => (
                <div key={marker} className="flex items-center justify-between rounded-xl bg-slate-800/50 px-4 py-2.5">
                  <span className="text-sm text-slate-300">{marker}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white">{val}</span>
                    <span className="min-w-[70px] rounded-full px-2 py-0.5 text-center text-[11px] font-semibold" style={{ background: `${color}1a`, color }}>{flag}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-4">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <BrainCircuit className="h-3.5 w-3.5" />
                AI-черновик протокола
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                Приоритет: восполнение Fe + D3. Рекомендован бисглицинат железа 25 мг/сут с витамином C. D3 5000 МЕ/сут. Повтор ферритина через 8 недель.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Метрики ── */}
      <section className="border-y border-slate-800/60 bg-slate-900/30 py-12">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mx-auto grid max-w-[1240px] grid-cols-2 gap-4 px-4 sm:px-6 lg:grid-cols-4"
        >
          {METRICS.map((m) => (
            <MetricCard key={m.label} {...m} />
          ))}
        </motion.div>
      </section>

      {/* ── Боли ── */}
      <section className="mx-auto max-w-[1240px] px-4 py-20 sm:px-6">
        <div className="mb-12 text-center">
          <SectionLabel color="#ef4444">Типичные проблемы</SectionLabel>
          <motion.h2
            variants={fadeUp}
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl"
          >
            Почему ведение клиентов сейчас — это больно
          </motion.h2>
        </div>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid gap-5 md:grid-cols-3"
        >
          {PAIN_POINTS.map((p) => (
            <PainCard key={p.title} {...p} />
          ))}
        </motion.div>
      </section>

      {/* ── Как это работает ── */}
      <section className="border-y border-slate-800/60 bg-slate-900/20 py-20">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
          <div className="mb-14 max-w-xl">
            <SectionLabel>Рабочий процесс</SectionLabel>
            <motion.h2
              variants={fadeUp}
              custom={0}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl"
            >
              От первого визита до динамики — 5 шагов
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={0.06}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="mt-3 text-slate-400"
            >
              Весь цикл работы с пациентом в одном инструменте без интеграций с ЭМК и сложной настройки.
            </motion.p>
          </div>
          <div className="max-w-2xl">
            {WORKFLOW_STEPS.map((step, i) => (
              <WorkflowStep key={step.step} {...step} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Возможности ── */}
      <section className="mx-auto max-w-[1240px] px-4 py-20 sm:px-6">
        <div className="mb-12 text-center">
          <SectionLabel>Инструменты</SectionLabel>
          <motion.h2
            variants={fadeUp}
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl"
          >
            Всё необходимое для работы нутрициолога
          </motion.h2>
        </div>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </motion.div>
      </section>

      {/* ── Сценарии применения ── */}
      <section className="border-y border-slate-800/60 bg-slate-900/20 py-20">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
          <div className="mb-12 text-center">
            <SectionLabel color="#8b5cf6">Направления</SectionLabel>
            <motion.h2
              variants={fadeUp}
              custom={0}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl"
            >
              Подходит для любого направления нутрициологии
            </motion.h2>
          </div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
          >
            {USE_CASES.map((u) => (
              <UseCaseCard key={u.title} {...u} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Для пациента ── */}
      <section className="mx-auto max-w-[1240px] px-4 py-20 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <motion.div
            variants={fadeUp}
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <SectionLabel color="#0ea5e9">Ценность для пациента</SectionLabel>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Пациент видит результат, а не только рекомендации
            </h2>
            <p className="mt-4 text-slate-400">
              Личный кабинет пациента показывает динамику биомаркеров, текущий протокол и прогресс по заданиям.
              Это создаёт вовлечённость и снижает отток между сессиями.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'История всех анализов в одном месте',
                'Понятная интерпретация без медицинского образования',
                'Еженедельные напоминания о выполнении протокола',
                'Прогресс-тренды мотивируют придерживаться программы',
                'Мобильная версия — всё доступно со смартфона',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-slate-300">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Mockup: patient view */}
          <motion.div
            variants={fadeUp}
            custom={0.08}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur-sm"
          >
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Прогресс Анны</span>
              <span className="text-xs text-slate-500">8 нед. на протоколе</span>
            </div>
            <div className="mb-4 space-y-3">
              {[
                { marker: 'Ферритин', before: '11', after: '28', unit: 'нг/мл', up: true },
                { marker: 'Витамин D', before: '18', after: '47', unit: 'нмоль/л', up: true },
                { marker: 'B12', before: '245', after: '390', unit: 'пмоль/л', up: true },
              ].map(({ marker, before, after, unit, up }) => (
                <div key={marker} className="rounded-xl bg-slate-800/50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{marker}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                      <TrendingUp className="h-3 w-3" />
                      {before} → {after} {unit}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                      initial={{ width: '20%' }}
                      whileInView={{ width: '72%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease: EASE, delay: 0.2 }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-slate-700 p-4">
              <div className="mb-2 text-xs font-semibold text-slate-400">Задания на неделю</div>
              {[
                { done: true,  text: 'Принять железо с витамином C' },
                { done: true,  text: 'D3 + K2 утром с едой' },
                { done: false, text: 'Сдать общий анализ крови (запланировано)' },
              ].map(({ done, text }) => (
                <div key={text} className="flex items-center gap-2 py-1.5 text-sm">
                  <CheckCircle2 className={`h-4 w-4 shrink-0 ${done ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span className={done ? 'text-slate-300' : 'text-slate-500'}>{text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-slate-800/60 bg-gradient-to-b from-slate-900/40 to-[#09101d] py-24">
        <div className="mx-auto max-w-[720px] px-4 text-center sm:px-6">
          <motion.div
            variants={fadeUp}
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <SectionLabel>Начните сегодня</SectionLabel>
            <h2 className="mt-5 text-4xl font-bold tracking-[-0.03em] text-white md:text-5xl">
              Приведите первого пациента<br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                прямо сейчас
              </span>
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-400">
              Бесплатный аккаунт. Загрузите анализы одного пациента и убедитесь, что VITALOOP экономит вам час на каждой консультации.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={() => navigate('/login?signup=true')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 sm:w-auto"
              >
                Зарегистрироваться бесплатно
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate('/how-it-works')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/60 px-7 py-3.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 sm:w-auto"
              >
                Как работает платформа
              </button>
            </div>
            <p className="mt-5 text-xs text-slate-600">
              Не требует интеграций с ЭМК · Работает с PDF из любой лаборатории · Данные не продаются
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
