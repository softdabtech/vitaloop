import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Beaker, CheckCircle2, Circle, Coins, FlaskConical, HelpCircle, ShieldAlert, Upload, UserRound } from 'lucide-react'
import { CoachBadge, CoachButton, CoachCard, CoachProgress, EmptyCoachState, InsightCard } from '../components/coach/CoachUI.jsx'
import { useQuestionnaireSession, useUserProfile } from '../hooks/useQueries.js'
import { isUkrainianLocale } from '../lib/locale.js'

const LAB_CATALOG = [
  {
    name: 'CBC',
    category: 'Core',
    systems: ['General', 'Recovery'],
    signals: ['fatigue', 'tired', 'energy', 'hair', 'dizzy', 'weak', 'втом', 'енерг', 'волос', 'запамороч', 'слаб'],
    why: 'Baseline blood pattern: hemoglobin, red cells, white cells, platelets, and indirect inflammation clues.',
    ukWhy: 'Базова картина крові: гемоглобін, еритроцити, лейкоцити, тромбоцити та непрямі сигнали запалення.',
    answers: 'Can anemia, infection/inflammation context, or recovery load be part of the picture?',
    ukAnswers: 'Чи може бути частиною картини анемія, запальний контекст або навантаження на відновлення?',
  },
  {
    name: 'Ferritin + iron panel',
    category: 'Core',
    systems: ['General', 'Recovery'],
    signals: ['fatigue', 'energy', 'hair', 'stamina', 'cold', 'втом', 'енерг', 'волос', 'витрив', 'мерз'],
    why: 'Iron storage and transport markers help interpret fatigue, hair shedding, low stamina, and low reticulocyte indices.',
    ukWhy: 'Запаси й транспорт заліза допомагають інтерпретувати втому, випадіння волосся, низьку витривалість та знижені індекси ретикулоцитів.',
    answers: 'Is there enough evidence to discuss iron status, or is the report missing key context?',
    ukAnswers: 'Чи достатньо даних для розмови про статус заліза, чи у звіті бракує ключового контексту?',
  },
  {
    name: 'CRP',
    category: 'Core',
    systems: ['General', 'Musculoskeletal', 'Digestive'],
    signals: ['pain', 'swelling', 'fever', 'inflammation', 'digest', 'біль', 'набряк', 'темпера', 'запал', 'трав'],
    why: 'Inflammation context prevents over-interpreting nutrient markers that can shift during illness or recovery.',
    ukWhy: 'Контекст запалення допомагає не переоцінювати нутрієнтні маркери, які можуть змінюватися під час хвороби або відновлення.',
    answers: 'Could inflammation be changing the interpretation of ferritin, blood count, or symptoms?',
    ukAnswers: 'Чи може запалення змінювати трактування феритину, показників крові або симптомів?',
  },
  {
    name: 'Vitamin D',
    category: 'Core',
    systems: ['General', 'Musculoskeletal', 'Recovery'],
    signals: ['mood', 'aches', 'immune', 'fatigue', 'sleep', 'настр', 'ломот', 'імун', 'втом', 'сон'],
    why: 'Vitamin D is often reviewed with fatigue, low mood, muscle aches, immunity, and recovery goals.',
    ukWhy: 'Вітамін D часто переглядають при втомі, зниженому настрої, ломоті, імунному контексті та цілях відновлення.',
    answers: 'Is this a useful supportive marker for energy, immune, and muscle context?',
    ukAnswers: 'Чи є це корисним допоміжним маркером для енергії, імунного та мʼязового контексту?',
  },
  {
    name: 'TSH + free T4',
    category: 'Recommended',
    systems: ['Hormonal'],
    signals: ['fatigue', 'brain fog', 'cold', 'weight', 'hair', 'sleep', 'втом', 'туман', 'мерз', 'вага', 'волос', 'сон'],
    why: 'Thyroid context matters when fatigue, cold intolerance, hair changes, weight change, or brain fog persist.',
    ukWhy: 'Контекст щитоподібної залози важливий, коли зберігаються втома, мерзлякуватість, зміни волосся, ваги або туман у голові.',
    answers: 'Could thyroid regulation be one of the systems worth discussing?',
    ukAnswers: 'Чи може регуляція щитоподібної залози бути однією із систем для обговорення?',
  },
  {
    name: 'Vitamin B12 + folate',
    category: 'Recommended',
    systems: ['Neurological', 'General'],
    signals: ['brain fog', 'numb', 'tingling', 'fatigue', 'focus', 'туман', 'онім', 'покол', 'втом', 'фокус'],
    why: 'B12 and folate support nerve function, red blood cell production, and cognitive energy.',
    ukWhy: 'B12 і фолат підтримують нервову систему, утворення еритроцитів і когнітивну енергію.',
    answers: 'Is there missing nutrient context behind blood count or neurological symptoms?',
    ukAnswers: 'Чи бракує нутрієнтного контексту для показників крові або неврологічних симптомів?',
  },
  {
    name: 'Glucose + HbA1c',
    category: 'Recommended',
    systems: ['Cardiometabolic'],
    signals: ['craving', 'sleepy after meals', 'energy dips', 'weight', 'thirst', 'тяга', 'сонлив', 'спади енергі', 'вага', 'спрага'],
    why: 'Blood sugar patterns can influence energy dips, cravings, sleepiness after meals, and cardiometabolic context.',
    ukWhy: 'Патерни цукру крові можуть впливати на спади енергії, тягу до їжі, сонливість після їжі та кардіометаболічний контекст.',
    answers: 'Are energy changes connected with glucose regulation or meal response?',
    ukAnswers: 'Чи повʼязані зміни енергії з регуляцією глюкози або реакцією на їжу?',
  },
  {
    name: 'Magnesium',
    category: 'Optional',
    systems: ['Recovery', 'Musculoskeletal'],
    signals: ['sleep', 'cramps', 'stress', 'tension', 'сон', 'судом', 'стрес', 'напруг'],
    why: 'Magnesium can be useful when sleep quality, cramps, stress response, or muscle tension are part of the story.',
    ukWhy: 'Магній може бути корисним, коли у картині є якість сну, судоми, реакція на стрес або мʼязова напруга.',
    answers: 'Is recovery or neuromuscular context worth adding later?',
    ukAnswers: 'Чи варто пізніше додати контекст відновлення або нервово-мʼязової системи?',
  },
  {
    name: 'Omega-3 Index',
    category: 'Optional',
    systems: ['Cardiometabolic', 'Recovery'],
    signals: ['inflammation', 'recovery', 'heart', 'cardio', 'запал', 'віднов', 'серц'],
    why: 'Useful for longer-term inflammation, recovery, and cardiometabolic goals when the basic panel is already clear.',
    ukWhy: 'Корисний для довгострокового контексту запалення, відновлення та кардіометаболічних цілей, коли базова панель уже зрозуміла.',
    answers: 'Would a long-term nutrition/recovery marker add value after core testing?',
    ukAnswers: 'Чи додасть довгостроковий нутрієнтний або recovery-маркер цінність після базових аналізів?',
  },
]

const CATEGORY_LABELS = {
  Core: { en: 'Core', uk: 'Базовий' },
  Recommended: { en: 'Recommended', uk: 'Рекомендовано' },
  Optional: { en: 'Optional', uk: 'Додатково' },
}

function normalizeText(value) {
  return String(value || '').toLowerCase()
}

function tokenizeContext(summary, concern) {
  return [
    concern,
    summary?.relatedSymptoms,
    summary?.related_symptoms,
    summary?.whatTried,
    summary?.what_tried,
    summary?.medications,
    summary?.supplements,
    summary?.bodySystem,
    summary?.body_system,
  ].map(normalizeText).join(' ')
}

function scoreLab(item, summary, concern) {
  const context = tokenizeContext(summary, concern)
  const bodySystem = String(summary?.bodySystem || summary?.body_system || '')
  let score = item.category === 'Core' ? 3 : item.category === 'Recommended' ? 1 : 0

  if (bodySystem && item.systems.includes(bodySystem)) score += 3
  for (const signal of item.signals) {
    if (context.includes(normalizeText(signal))) score += 2
  }
  return score
}

function buildPlan(summary, concern) {
  const ranked = LAB_CATALOG
    .map((item) => ({ ...item, matchScore: scoreLab(item, summary, concern) }))
    .sort((a, b) => b.matchScore - a.matchScore || LAB_CATALOG.indexOf(a) - LAB_CATALOG.indexOf(b))

  const selectedNames = new Set([
    ...ranked.filter((item) => item.category === 'Core').map((item) => item.name),
    ...ranked.filter((item) => item.category !== 'Core' && item.matchScore >= 3).slice(0, 4).map((item) => item.name),
  ])

  return {
    core: ranked.filter((item) => selectedNames.has(item.name) && item.category === 'Core'),
    recommended: ranked.filter((item) => selectedNames.has(item.name) && item.category === 'Recommended'),
    optional: ranked.filter((item) => item.category === 'Optional').slice(0, 3),
    strongest: ranked.find((item) => item.matchScore >= 4) || ranked[0],
  }
}

function missingProfileFields(profile) {
  const data = profile?.profile || profile || {}
  const fields = [
    ['age', 'age', 'вік'],
    ['sex', 'sex', 'стать'],
    ['height_cm', 'height', 'зріст'],
    ['weight_kg', 'weight', 'вага'],
  ]
  return fields.filter(([key]) => !data?.[key]).map(([, en, uk]) => ({ en, uk }))
}

function LabCard({ item, status, isUk }) {
  const tone = item.category === 'Core' ? 'primary' : item.category === 'Recommended' ? 'warning' : 'neutral'
  return (
    <CoachCard className="p-4" interactive>
      <div className="mb-4 flex items-start justify-between gap-3">
        <CoachBadge tone={tone}>{isUk ? CATEGORY_LABELS[item.category].uk : CATEGORY_LABELS[item.category].en}</CoachBadge>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${status === 'matched' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {status === 'matched' ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
          {status === 'matched' ? (isUk ? 'відповідає запиту' : 'matched') : (isUk ? 'контекст' : 'context')}
        </span>
      </div>
      <h3 className="text-xl font-extrabold text-slate-950">{item.name}</h3>
      <p className="mt-3 text-sm font-bold text-slate-700">{isUk ? 'Навіщо' : 'Why'}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{isUk ? item.ukWhy : item.why}</p>
      <p className="mt-3 text-sm font-bold text-slate-700">{isUk ? 'На яке питання відповідає' : 'Question it answers'}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{isUk ? item.ukAnswers : item.answers}</p>
    </CoachCard>
  )
}

export default function LabPlan() {
  const navigate = useNavigate()
  const isUk = isUkrainianLocale()
  const { data: questionnaireSession } = useQuestionnaireSession()
  const { data: profile } = useUserProfile()
  const sessionContext = questionnaireSession?.session_context || questionnaireSession?.session?.session_metadata || {}
  const concern = sessionContext?.active_concern || ''
  const concernSummary = sessionContext?.summary || {}
  const plan = useMemo(() => buildPlan(concernSummary, concern), [concernSummary, concern])
  const missingFields = missingProfileFields(profile)

  const readiness = useMemo(() => {
    const symptomReadiness = Number(concernSummary?.readiness || 42)
    const profilePenalty = missingFields.length * 8
    return Math.max(20, Math.min(98, symptomReadiness - profilePenalty))
  }, [concernSummary?.readiness, missingFields.length])

  if (!concern) {
    return (
      <div className="coach-shell">
        <EmptyCoachState
          icon={FlaskConical}
          title={isUk ? 'Почніть із самопочуття' : 'Start with how you feel'}
          body={isUk ? 'План аналізів має сенс тільки тоді, коли VITALOOP знає головний запит: втому, сон, енергію, волосся, травлення або інший симптом.' : 'A useful lab plan starts with the symptom or concern you actually want to understand.'}
          actionLabel={isUk ? 'Почати перевірку симптомів' : 'Start symptom check'}
          onAction={() => navigate('/questionnaire')}
        />
      </div>
    )
  }

  return (
    <div className="coach-shell coach-grid">
      <section className="coach-hero">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="coach-eyebrow">{isUk ? 'План аналізів із контекстом' : 'Contextual lab plan'}</p>
            <h1 className="coach-title-xl">{isUk ? 'Не більше аналізів, а кращі питання до них.' : 'Not more tests. Better questions for the tests.'}</h1>
            <p className="coach-body mt-4 max-w-2xl">
              {isUk ? 'Поточний фокус: ' : 'Current focus: '}<strong>{concern}</strong>.
              {' '}
              {isUk ? 'VITALOOP використовує цей контекст під час завантаження результатів: профіль, симптоми, безпеку, quality gate, KB та evidence gaps.' : 'VITALOOP uses this context during upload: profile, symptoms, safety, quality gate, KB, and evidence gaps.'}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <CoachButton icon={Upload} trailingIcon={ArrowRight} onClick={() => navigate('/upload')}>{isUk ? 'Завантажити результати' : 'Upload results'}</CoachButton>
              <CoachButton variant="secondary" icon={HelpCircle} onClick={() => document.getElementById('why-tests')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{isUk ? 'Як формується план' : 'How this plan is built'}</CoachButton>
            </div>
          </div>
          <CoachCard className="p-5" tone="soft">
            <p className="coach-eyebrow">{isUk ? 'Готовність до якісного аналізу' : 'Analysis readiness'}</p>
            <h2 className="text-2xl font-extrabold text-slate-950">{readiness}%</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {missingFields.length
                ? (isUk ? `Додайте ${missingFields.map((item) => item.uk).join(', ')}, щоб безпечніше інтерпретувати результати.` : `Add ${missingFields.map((item) => item.en).join(', ')} for safer interpretation.`)
                : (isUk ? 'Профіль достатньо заповнений для контекстного аналізу.' : 'Your profile has enough context for safer interpretation.')}
            </p>
            <div className="mt-5"><CoachProgress value={readiness} label={isUk ? 'Готовність' : 'Readiness'} /></div>
          </CoachCard>
        </div>
      </section>

      <div className="coach-grid coach-grid--3">
        <InsightCard icon={Beaker} title={isUk ? 'Що важливо спочатку' : 'First priority'} body={isUk ? `${plan.strongest.name}: ${plan.strongest.ukAnswers}` : `${plan.strongest.name}: ${plan.strongest.answers}`} />
        <InsightCard icon={UserRound} tone={missingFields.length ? 'warning' : 'success'} title={isUk ? 'Контекст людини' : 'Person context'} body={missingFields.length ? (isUk ? 'Без віку, статі, зросту й ваги pediatric/adult інтерпретація може бути неточною.' : 'Without age, sex, height, and weight, pediatric/adult interpretation can be less reliable.') : (isUk ? 'Профіль буде використаний у safety та evidence layer.' : 'Profile context will be used by safety and evidence layers.')} />
        <InsightCard icon={ShieldAlert} title={isUk ? 'Межа безпеки' : 'Safety boundary'} body={isUk ? 'План не ставить діагноз і не призначає лікування. Він готує дані для сильнішого звіту та розмови з лікарем.' : 'This plan does not diagnose or prescribe. It prepares better data for the report and clinician discussion.'} />
      </div>

      <CoachCard className="p-5 sm:p-6">
        <div className="mb-5">
          <p className="coach-eyebrow">{isUk ? 'Базові аналізи' : 'Core tests'}</p>
          <h2 className="coach-title-lg">{isUk ? 'Мінімальний набір, який зменшує ризик хибних висновків' : 'Minimum set that reduces weak conclusions'}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plan.core.map((item) => <LabCard key={item.name} item={item} status={item.matchScore >= 4 ? 'matched' : 'context'} isUk={isUk} />)}
        </div>
      </CoachCard>

      <CoachCard className="p-5 sm:p-6">
        <div className="mb-5">
          <p className="coach-eyebrow">{isUk ? 'Рекомендовані за симптомами' : 'Recommended from symptoms'}</p>
          <h2 className="coach-title-lg">{isUk ? 'Додаються, коли ваш запит вказує на конкретну систему' : 'Added when your concern points to a specific system'}</h2>
        </div>
        {plan.recommended.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {plan.recommended.map((item) => <LabCard key={item.name} item={item} status="matched" isUk={isUk} />)}
          </div>
        ) : (
          <p className="coach-body">{isUk ? 'Поки що сильного симптомного сигналу для додаткової панелі немає. Почніть із базових аналізів або уточніть симптоми.' : 'No strong symptom signal for an additional panel yet. Start with core tests or refine the symptom check.'}</p>
        )}
      </CoachCard>

      <CoachCard className="p-5 sm:p-6">
        <div className="mb-5">
          <p className="coach-eyebrow">{isUk ? 'Додатковий контекст' : 'Optional context'}</p>
          <h2 className="coach-title-lg">{isUk ? 'Не перший крок, але може бути корисним для динаміки' : 'Not first-line, but useful for longitudinal context'}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {plan.optional.map((item) => <LabCard key={item.name} item={item} status={item.matchScore >= 3 ? 'matched' : 'context'} isUk={isUk} />)}
        </div>
      </CoachCard>

      <CoachCard id="why-tests" className="p-5 sm:p-6">
        <p className="coach-eyebrow">{isUk ? 'Як це потрапить у звіт' : 'How this feeds the report'}</p>
        <h2 className="coach-title-lg">{isUk ? 'Цей план готує якісний input для Health Intelligence Core.' : 'This plan prepares better input for the Health Intelligence Core.'}</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <InsightCard icon={FlaskConical} title={isUk ? 'Quality gate' : 'Quality gate'} body={isUk ? 'Після завантаження система перевірить одиниці, референси, дублікати, правдоподібність значень і повноту профілю.' : 'After upload, the system checks units, ranges, duplicates, value plausibility, and profile completeness.'} />
          <InsightCard icon={Beaker} title={isUk ? 'KB + evidence gaps' : 'KB + evidence gaps'} body={isUk ? 'База знань не просто читає маркер, а дивиться, яких доказів бракує для сильнішого висновку.' : 'The Knowledge Base does not just read a marker; it identifies missing evidence for a stronger conclusion.'} />
          <InsightCard icon={Coins} title={isUk ? 'Пріоритет бюджету' : 'Budget priority'} body={isUk ? 'Якщо бюджет обмежений, почніть із базового набору й додайте рекомендовані панелі за симптомним патерном.' : 'If budget is limited, start with the core set and add recommended panels based on the symptom pattern.'} />
        </div>
      </CoachCard>
    </div>
  )
}
