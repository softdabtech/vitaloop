import { ArrowRight, ClipboardCheck, FileText, ShieldCheck, Sparkles, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDashboardSummary, useQuestionnaireSession } from '../../hooks/useQueries.js'
import { useAuth } from '../../hooks/useAuth.js'
import { useSubscription } from '../../hooks/useSubscription.js'

function Card({ children, className = '' }) {
  return <section className={`rounded-[28px] bg-white/78 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)] ring-1 ring-[#e8dfd2] ${className}`}>{children}</section>
}

function ActionCard({ icon: Icon, title, body, cta, onClick }) {
  return (
    <button onClick={onClick} className="group rounded-[26px] bg-white/82 p-5 text-left shadow-sm ring-1 ring-[#e8dfd2] transition hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(15,118,110,0.13)]">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f1fbf8] text-[#0f766e]">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-lg font-black">{title}</h3>
      <p className="mt-2 min-h-[52px] text-sm leading-6 text-[#64748b]">{body}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#0f766e]">
        {cta}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </button>
  )
}

export default function UaDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data, isLoading } = useDashboardSummary()
  const { data: questionnaireSession } = useQuestionnaireSession()
  const { isPremium, uploadCount } = useSubscription()
  const stats = data?.stats || {}
  const sessionContext = questionnaireSession?.session_context || questionnaireSession?.session?.session_metadata || {}
  const activeConcern = sessionContext?.active_concern || ''
  const totalUploads = Number(stats.total_uploads || uploadCount || 0)
  const hasSymptoms = Boolean(activeConcern)
  const hasUploads = totalUploads > 0
  const priorityScore = hasUploads ? 78 : hasSymptoms ? 46 : 18

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0f766e]">Ваш наступний крок</p>
            <h2 className="mt-3 max-w-3xl text-[34px] font-black leading-[1.05] tracking-tight sm:text-[48px]">
              {hasUploads ? 'Перегляньте пріоритети за аналізами' : hasSymptoms ? 'Додайте аналізи до опису стану' : 'Почніть з того, що турбує зараз'}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[#475569]">
              Vitaloop збирає симптоми, аналізи й динаміку в одну зрозумілу картину: що може бути повʼязано, що варто перевірити першим і з чим іти до лікаря.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => navigate(hasUploads ? '/lab-results' : '/questionnaire')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#0f766e_0%,#14b8a6_58%,#d4b483_135%)] px-6 text-sm font-black text-white shadow-[0_16px_35px_rgba(15,118,110,0.22)] transition hover:-translate-y-0.5">
                Отримати персональну оцінку
                <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={() => navigate('/upload')} className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-black text-[#0f172a] ring-1 ring-[#e8dfd2] transition hover:-translate-y-0.5 hover:text-[#0f766e]">
                Завантажити аналіз
              </button>
            </div>
          </div>
          <div className="rounded-[30px] bg-[#0f172a] p-5 text-white shadow-[0_28px_70px_rgba(15,23,42,0.24)]">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9dd8d1]">Індекс пріоритетів</p>
            <div className="mt-5 flex items-end gap-2">
              <span className="text-6xl font-black">{priorityScore}</span>
              <span className="pb-2 text-xl font-bold text-white/55">/100</span>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/12">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#14b8a6,#60a5fa,#d4b483)]" style={{ width: `${priorityScore}%` }} />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-black">
              <div className="rounded-2xl bg-white/10 p-3">Стан<br /><span className="text-white/55">{hasSymptoms ? 'є' : 'немає'}</span></div>
              <div className="rounded-2xl bg-white/10 p-3">Аналізи<br /><span className="text-white/55">{totalUploads}</span></div>
              <div className="rounded-2xl bg-white/10 p-3">План<br /><span className="text-white/55">{isPremium ? 'Premium' : 'Free'}</span></div>
            </div>
          </div>
        </div>
      </Card>

      {isLoading && <div className="rounded-2xl bg-white p-4 text-sm font-bold text-[#64748b] ring-1 ring-[#e8dfd2]">Оновлюємо дані кабінету...</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <ActionCard icon={Sparkles} title="Описати самопочуття" body="Втома, сон, енергія, волосся, травлення або концентрація." cta="Пройти оцінку" onClick={() => navigate('/questionnaire')} />
        <ActionCard icon={Upload} title="Додати аналізи" body="Завантажте PDF з лабораторії, щоб побачити структурований підсумок." cta="Завантажити PDF" onClick={() => navigate('/upload')} />
        <ActionCard icon={FileText} title="Переглянути результати" body="Відкрийте історію аналізів, пріоритети та наступні дії." cta="Мої аналізи" onClick={() => navigate('/lab-results')} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <Card>
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f1fbf8] text-[#0f766e]"><ClipboardCheck className="h-6 w-6" /></span>
            <div>
              <h3 className="text-xl font-black">Фокус зараз</h3>
              <p className="mt-2 text-sm leading-7 text-[#64748b]">
                {activeConcern || 'Фокус ще не обрано. Почніть з короткої оцінки симптомів, щоб Vitaloop міг запропонувати релевантні аналізи.'}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff8e7] text-[#9a6a1d]"><ShieldCheck className="h-6 w-6" /></span>
            <div>
              <h3 className="text-xl font-black">Без діагнозів</h3>
              <p className="mt-2 text-sm leading-7 text-[#64748b]">Кабінет допомагає підготуватися до розмови з лікарем і краще зрозуміти власні дані. Це не заміна медичної консультації.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
