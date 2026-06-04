import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const SYMPTOMS = ['Втома', 'Поганий сон', 'Низька енергія', 'Випадіння волосся', 'Тривожність', 'Концентрація', 'Травлення', 'Часті застуди', 'Стан дитини']

export default function UaQuestionnaire() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState([])

  function toggle(item) {
    setSelected((prev) => prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item])
  }

  function continueFlow() {
    toast.success(selected.length ? `Обрано симптомів: ${selected.length}` : 'Можна почати з аналізів')
    navigate('/upload')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="rounded-[30px] bg-white/82 p-6 shadow-[0_18px_55px_rgba(15,23,42,0.07)] ring-1 ring-[#e8dfd2] sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0f766e]">Оцінка стану</p>
        <h2 className="mt-3 text-[32px] font-black leading-tight tracking-tight sm:text-[44px]">Що вас турбує зараз?</h2>
        <p className="mt-3 max-w-2xl text-base leading-8 text-[#64748b]">Оберіть кілька пунктів. Це допоможе привʼязати аналізи до реального самопочуття, а не дивитися на показники окремо.</p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SYMPTOMS.map((item) => {
            const active = selected.includes(item)
            return (
              <button key={item} onClick={() => toggle(item)} className={`flex min-h-14 items-center justify-between rounded-2xl px-4 text-left text-sm font-black transition ${active ? 'bg-[#0f766e] text-white shadow-[0_14px_32px_rgba(15,118,110,0.20)]' : 'bg-[#f8f5f0] text-[#0f172a] ring-1 ring-[#e8dfd2] hover:bg-white'}`}>
                {item}
                {active && <Check className="h-4 w-4" />}
              </button>
            )
          })}
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button onClick={continueFlow} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#0f766e_0%,#14b8a6_58%,#d4b483_135%)] px-6 text-sm font-black text-white shadow-[0_16px_35px_rgba(15,118,110,0.22)]">
            Продовжити
            <ArrowRight className="h-4 w-4" />
          </button>
          <span className="text-sm font-bold text-[#64748b]">Обрано: {selected.length}</span>
        </div>
      </section>

      <aside className="rounded-[30px] bg-[#0f172a] p-6 text-white shadow-[0_28px_70px_rgba(15,23,42,0.22)]">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9dd8d1]">Далі</p>
        <h3 className="mt-3 text-2xl font-black">Vitaloop запропонує, що перевірити першим</h3>
        <p className="mt-3 text-sm leading-7 text-white/68">Якщо аналізів ще немає, почнемо з симптомів. Якщо є PDF, додамо його на наступному кроці.</p>
      </aside>
    </div>
  )
}
