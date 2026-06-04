import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, FileUp, Loader2, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api.js'

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

export default function UaUpload() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [labName, setLabName] = useState('')
  const [symptoms, setSymptoms] = useState('')
  const [busy, setBusy] = useState(false)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!busy) {
      setSeconds(0)
      return undefined
    }
    const id = window.setInterval(() => setSeconds((v) => v + 1), 1000)
    return () => window.clearInterval(id)
  }, [busy])

  function validate(nextFile) {
    if (!nextFile) return 'Оберіть PDF-файл з результатами аналізів.'
    if (!nextFile.name?.toLowerCase().endsWith('.pdf') && nextFile.type !== 'application/pdf') return 'Поки підтримуємо PDF-файли з лабораторій.'
    if (nextFile.size > MAX_FILE_SIZE_BYTES) return 'Файл завеликий. Максимум 20MB.'
    return ''
  }

  async function submit(event) {
    event.preventDefault()
    const error = validate(file)
    if (error) {
      toast.error(error)
      return
    }

    const form = new FormData()
    form.append('file', file)
    if (labName.trim()) form.append('lab_name', labName.trim())
    symptoms.split(',').map((item) => item.trim()).filter(Boolean).forEach((item) => form.append('symptoms', item))

    setBusy(true)
    try {
      const { data } = await api.post('/analyze/pdf', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Аналіз оброблено')
      navigate(`/results/${data.upload_id}`)
    } catch (err) {
      const detail = err?.response?.data?.detail
      const message = typeof detail === 'object' ? detail.detail : detail
      toast.error(message || 'Не вдалося обробити файл. Спробуйте ще раз.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="rounded-[30px] bg-white/82 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)] ring-1 ring-[#e8dfd2] sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0f766e]">Завантаження</p>
        <h2 className="mt-3 text-[32px] font-black leading-tight tracking-tight sm:text-[44px]">Додайте результати лабораторії</h2>
        <p className="mt-3 max-w-2xl text-base leading-8 text-[#64748b]">
          Завантажте PDF, а Vitaloop структурує показники, звʼяже їх із симптомами та покаже, що потребує уваги першим.
        </p>

        <form onSubmit={submit} className="mt-7 grid gap-5">
          <label className="grid cursor-pointer place-items-center rounded-[28px] border-2 border-dashed border-[#b7d8d2] bg-[#f1fbf8] px-5 py-12 text-center transition hover:border-[#0f766e] hover:bg-white">
            <FileUp className="h-10 w-10 text-[#0f766e]" />
            <span className="mt-4 text-lg font-black">{file ? file.name : 'Оберіть PDF-файл'}</span>
            <span className="mt-2 text-sm font-semibold text-[#64748b]">До 20MB. Фото додамо окремим шаром.</span>
            <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-[#64748b]">Лабораторія</span>
              <input value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="Сінево, ДІЛА, Smartlab..." className="min-h-12 rounded-2xl border border-[#e8dfd2] bg-[#f8f5f0] px-4 font-semibold outline-none focus:border-[#0f766e] focus:bg-white" />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-[#64748b]">Симптоми</span>
              <input value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="втома, сон, енергія" className="min-h-12 rounded-2xl border border-[#e8dfd2] bg-[#f8f5f0] px-4 font-semibold outline-none focus:border-[#0f766e] focus:bg-white" />
            </label>
          </div>

          <button disabled={busy} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#0f766e_0%,#14b8a6_58%,#d4b483_135%)] px-6 text-sm font-black text-white shadow-[0_16px_35px_rgba(15,118,110,0.22)] transition hover:-translate-y-0.5 disabled:opacity-70">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {busy ? `Обробляємо ${seconds ? `${seconds}с` : ''}` : 'Завантажити аналіз'}
          </button>
        </form>
      </section>

      <aside className="space-y-4">
        {[
          ['Що зберігаємо', 'Текст і структуровані показники після аналізу. Сам PDF не потрібен після обробки.'],
          ['Що отримаєте', 'Список показників, пріоритети, пояснення простими словами та наступний крок.'],
          ['Безпека', 'Дані привʼязані до вашого акаунта. Видалення користувача видаляє повʼязані аналізи.'],
        ].map(([title, body]) => (
          <div key={title} className="rounded-[26px] bg-white/76 p-5 ring-1 ring-[#e8dfd2]">
            <div className="flex items-center gap-2 text-sm font-black text-[#0f766e]"><ShieldCheck className="h-4 w-4" />{title}</div>
            <p className="mt-2 text-sm leading-6 text-[#64748b]">{body}</p>
          </div>
        ))}
      </aside>
    </div>
  )
}
