import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FlaskConical, ShieldAlert } from 'lucide-react'
import { useLabResults } from '../../hooks/useQueries.js'

function statusLabel(status) {
  const value = String(status || '').toUpperCase()
  if (value === 'OPTIMAL') return 'У межах'
  if (value === 'BORDERLINE') return 'На межі'
  if (value === 'DEFICIENT') return 'Нижче бажаного'
  if (value === 'ELEVATED') return 'Вище бажаного'
  return status || 'Потребує перегляду'
}

function statusClass(status) {
  const value = String(status || '').toUpperCase()
  if (value === 'OPTIMAL') return 'bg-[#f1fbf8] text-[#0f766e]'
  if (value === 'BORDERLINE') return 'bg-[#fff8e7] text-[#9a6a1d]'
  return 'bg-[#fff1f2] text-[#be123c]'
}

export default function UaResults() {
  const { uploadId } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, error } = useLabResults(uploadId)
  const biomarkers = Array.isArray(data?.biomarkers) ? data.biomarkers : Array.isArray(data) ? data : []
  const attention = biomarkers.filter((item) => String(item.status || '').toUpperCase() !== 'OPTIMAL')

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] bg-white/82 p-6 shadow-[0_18px_55px_rgba(15,23,42,0.07)] ring-1 ring-[#e8dfd2] sm:p-7">
        <button onClick={() => navigate('/lab-results')} className="inline-flex items-center gap-2 rounded-full bg-[#f8f5f0] px-4 py-2 text-sm font-black text-[#0f172a] ring-1 ring-[#e8dfd2]">
          <ArrowLeft className="h-4 w-4" />
          До аналізів
        </button>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0f766e]">Підсумок</p>
            <h2 className="mt-3 text-[32px] font-black leading-tight tracking-tight sm:text-[44px]">Результат аналізу</h2>
            <p className="mt-3 max-w-2xl text-base leading-8 text-[#64748b]">Показники структуровано простими словами. Це не діагноз, а підготовка до наступного кроку та розмови з лікарем.</p>
          </div>
          <div className="rounded-[26px] bg-[#0f172a] p-5 text-white">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9dd8d1]">Потребують уваги</p>
            <div className="mt-3 text-5xl font-black">{attention.length}</div>
            <p className="mt-2 text-sm text-white/62">з {biomarkers.length || 0} показників</p>
          </div>
        </div>
      </section>

      {isLoading && <div className="rounded-2xl bg-white p-4 text-sm font-bold text-[#64748b] ring-1 ring-[#e8dfd2]">Завантажуємо результат...</div>}
      {error && <div className="rounded-2xl bg-[#fff7ed] p-4 text-sm font-bold text-[#9a3412] ring-1 ring-[#fed7aa]">Не вдалося завантажити результат.</div>}

      <section className="grid gap-3">
        {biomarkers.map((item) => (
          <div key={`${item.name}-${item.id || item.value}`} className="rounded-[24px] bg-white/82 p-5 ring-1 ring-[#e8dfd2]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-[#0f766e]" />
                  <h3 className="truncate text-lg font-black">{item.name || item.display_name || 'Показник'}</h3>
                </div>
                <p className="mt-1 text-sm font-semibold text-[#64748b]">
                  {item.value ?? '-'} {item.unit || ''}
                  {(item.ref_low || item.ref_high) ? ` · референс ${item.ref_low ?? ''}-${item.ref_high ?? ''}` : ''}
                </p>
              </div>
              <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
            </div>
          </div>
        ))}
      </section>

      {!isLoading && biomarkers.length === 0 && (
        <section className="rounded-[30px] bg-white/82 p-8 text-center ring-1 ring-[#e8dfd2]">
          <ShieldAlert className="mx-auto h-10 w-10 text-[#0f766e]" />
          <h3 className="mt-4 text-2xl font-black">Показники ще не знайдено</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-[#64748b]">Спробуйте завантажити чіткий PDF, де видно назви показників, значення, одиниці та референси.</p>
        </section>
      )}

      <section className="rounded-[28px] bg-[#f1fbf8] p-5 ring-1 ring-[#b7d8d2]">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#0f766e]" />
          <p className="text-sm font-semibold leading-7 text-[#0f172a]">Vitaloop допомагає побачити пріоритети, але не замінює лікаря. Якщо симптоми різкі або стан погіршується, зверніться до медичного спеціаліста.</p>
        </div>
      </section>
    </div>
  )
}
