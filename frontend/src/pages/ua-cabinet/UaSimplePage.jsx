import { ArrowRight, CreditCard, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function UaSettings() {
  return (
    <section className="rounded-[30px] bg-white/82 p-6 shadow-[0_18px_55px_rgba(15,23,42,0.07)] ring-1 ring-[#e8dfd2] sm:p-7">
      <Settings className="h-9 w-9 text-[#0f766e]" />
      <h2 className="mt-4 text-[32px] font-black leading-tight tracking-tight sm:text-[44px]">Налаштування</h2>
      <p className="mt-3 max-w-2xl text-base leading-8 text-[#64748b]">Профіль, безпека та налаштування акаунта будуть винесені в окремий UA-інтерфейс. Авторизація й дані вже працюють через основну логіку Vitaloop.</p>
    </section>
  )
}

export function UaSubscription() {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <section className="rounded-[30px] bg-white/82 p-6 shadow-[0_18px_55px_rgba(15,23,42,0.07)] ring-1 ring-[#e8dfd2] sm:p-7">
        <CreditCard className="h-9 w-9 text-[#0f766e]" />
        <h2 className="mt-4 text-[32px] font-black leading-tight tracking-tight sm:text-[44px]">Тарифи</h2>
        <p className="mt-3 max-w-2xl text-base leading-8 text-[#64748b]">Free для першого кроку. Premium для регулярної роботи зі станом, аналізами та динамікою.</p>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[28px] bg-white/82 p-6 ring-1 ring-[#e8dfd2]">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-[#64748b]">Безкоштовно</p>
          <h3 className="mt-3 text-3xl font-black">0 грн</h3>
          <p className="mt-3 text-sm leading-7 text-[#64748b]">Перший аналіз, базовий підсумок і знайомство з кабінетом.</p>
        </div>
        <div className="rounded-[28px] bg-[#0f766e] p-6 text-white shadow-[0_24px_60px_rgba(15,118,110,0.22)]">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-white/70">Premium</p>
          <h3 className="mt-3 text-3xl font-black">399 грн/міс</h3>
          <p className="mt-3 text-sm leading-7 text-white/75">Регулярні аналізи, динаміка, персональні пріоритети та сімейний сценарій.</p>
          <button onClick={() => navigate('/upload')} className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#0f766e]">
            Почати з аналізу <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
