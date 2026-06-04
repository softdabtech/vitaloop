import { ArrowRight, FileText, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api.js'

function useUaUploads() {
  return useQuery({
    queryKey: ['ua-uploads-recent'],
    queryFn: async () => {
      const { data } = await api.get('/uploads/recent')
      return Array.isArray(data) ? data : []
    },
    staleTime: 3 * 60 * 1000,
  })
}

export default function UaLabResults() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useUaUploads()
  const uploads = Array.isArray(data) ? data : []

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] bg-white/82 p-6 shadow-[0_18px_55px_rgba(15,23,42,0.07)] ring-1 ring-[#e8dfd2] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0f766e]">Історія</p>
            <h2 className="mt-3 text-[32px] font-black leading-tight tracking-tight sm:text-[44px]">Ваші аналізи</h2>
            <p className="mt-3 max-w-2xl text-base leading-8 text-[#64748b]">Тут зʼявляються завантажені результати, статус обробки та швидкий перехід до підсумку.</p>
          </div>
          <button onClick={() => navigate('/upload')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#0f766e] px-5 text-sm font-black text-white transition hover:-translate-y-0.5">
            <Plus className="h-4 w-4" /> Додати аналіз
          </button>
        </div>
      </section>

      {isLoading && <div className="rounded-2xl bg-white p-4 text-sm font-bold text-[#64748b] ring-1 ring-[#e8dfd2]">Завантажуємо історію...</div>}
      {error && <div className="rounded-2xl bg-[#fff7ed] p-4 text-sm font-bold text-[#9a3412] ring-1 ring-[#fed7aa]">Не вдалося завантажити список аналізів.</div>}

      {uploads.length === 0 && !isLoading ? (
        <section className="rounded-[30px] bg-white/82 p-8 text-center ring-1 ring-[#e8dfd2]">
          <FileText className="mx-auto h-10 w-10 text-[#0f766e]" />
          <h3 className="mt-4 text-2xl font-black">Аналізів ще немає</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-[#64748b]">Завантажте перший PDF або почніть з оцінки симптомів, якщо результатів лабораторії поки немає.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button onClick={() => navigate('/upload')} className="rounded-full bg-[#0f766e] px-6 py-3 text-sm font-black text-white">Завантажити PDF</button>
            <button onClick={() => navigate('/questionnaire')} className="rounded-full bg-white px-6 py-3 text-sm font-black text-[#0f172a] ring-1 ring-[#e8dfd2]">Описати симптоми</button>
          </div>
        </section>
      ) : (
        <div className="grid gap-3">
          {uploads.map((item) => (
            <button key={item.id} onClick={() => navigate(`/results/${item.id}`)} className="flex items-center justify-between gap-4 rounded-[24px] bg-white/82 p-5 text-left ring-1 ring-[#e8dfd2] transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,118,110,0.10)]">
              <div className="min-w-0">
                <p className="truncate text-lg font-black">{item.lab_name || 'Лабораторний результат'}</p>
                <p className="mt-1 text-sm font-semibold text-[#64748b]">{item.created_at ? new Date(item.created_at).toLocaleDateString('uk-UA') : 'Дата не вказана'} · {item.status || 'done'}</p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-[#0f766e]" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
