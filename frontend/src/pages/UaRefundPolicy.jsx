import { Link } from 'react-router-dom'
import { RotateCcw, ShieldCheck, Stethoscope } from 'lucide-react'
import Seo from '../components/Seo.jsx'
import Footer from '../components/landing/Footer.jsx'

export default function UaRefundPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Seo
        title="Політика повернення | VITALOOP Ukraine"
        description="Ознайомтеся з політикою повернення VITALOOP, скасування, доступу до підписки та підтримки виставлення рахунків."
        path="/refund-policy"
      />
      <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:py-20">
        <Link to="/" className="text-sm font-semibold text-emerald-700 underline-offset-4 hover:underline">
          ← Назад до VITALOOP
        </Link>

        <section className="mt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            <RotateCcw className="h-4 w-4" />
            Політика повернення
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Повернення, скасування та підтримка виставлення рахунків
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            VITALOOP Premium — це підписка на освітню медичну інтелектуальну платформу: підтримка завантаження аналізів, пояснення біомаркерів, структура звітів, протоколи, відстеження прогресу та перевірки. Вона не надає діагнозу, лікування, рецептів або екстренихмедичних послуг.
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-500">Останнє оновлення: 24 серпня 2026</p>
        </section>

        <section className="mt-10 grid gap-5">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Скасування</h2>
            <p className="mt-3 leading-7 text-slate-600">
              Ви можете скасувати підписку Premium в будь-який час з облікового запису в розділі виставлення рахунків або зв'язавшись з <a className="font-bold text-emerald-700 underline" href="mailto:info@softdab.tech">info@softdab.tech</a>. Після скасування доступ Premium зазвичай залишається доступним до закінчення активного періоду оплати, якщо не запитано та не підтверджено негайне скасування.
            </p>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Розгляд повернення</h2>
            <p className="mt-3 leading-7 text-slate-600">
              Запити на повернення розглядаються в індивідуальному порядку. Ми зазвичай розглядаємо повернення для дублювання платежів, випадкових покупок, технічних проблем із оформленням замовлення або доступу, або ситуацій, коли доступ Premium не був надан після оплати. Щоб запитати розгляд, зв'яжіться з підтримкою протягом 14 днів з дати платежу та укажіть адресу електронної пошти облікового запису та деталі транзакції.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              Схвалення повернення не гарантується після значного використання функцій Premium, включаючи повторні завантаження аналізів, генерацію звітів, генерацію протоколів або експорт діяльності.
            </p>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Обробка платежів</h2>
            <p className="mt-3 leading-7 text-slate-600">
              VITALOOP розділяє дані виставлення рахунків та медичної інтелектуальної системи. Ми не відправляємо завантажені лабораторні файли, симптоми, значення біомаркерів, звіти про здоров'я або текст протоколу до інструментів виставлення рахунків.
            </p>
          </article>

          <article className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <Stethoscope className="h-6 w-6 text-amber-700" />
            <h2 className="mt-4 text-xl font-black text-slate-950">Медичний дисклеймер</h2>
            <p className="mt-3 leading-7 text-slate-700">
              VITALOOP — це освітня платформа для здоров'я та медичних даних. Рішення про повернення грошей не засновані на результатах лікування. Завжди обговорюйте тривожні симптоми, аномальні значення лабораторних аналізів, добавки та рішення щодо лікування з кваліфікованим клініцистом.
            </p>
          </article>

          <article className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
            <ShieldCheck className="h-6 w-6 text-emerald-700" />
            <h2 className="mt-4 text-xl font-black text-slate-950">Потрібна допомога?</h2>
            <p className="mt-3 leading-7 text-slate-600">
              З питань щодо скасування, виставлення рахунків або повернення, напишіть електронний лист на <a className="font-bold text-emerald-700 underline" href="mailto:info@softdab.tech">info@softdab.tech</a>.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold">
              <Link className="text-emerald-700 underline" to="/pricing/">Ціни</Link>
              <Link className="text-emerald-700 underline" to="/terms/">Умови</Link>
              <Link className="text-emerald-700 underline" to="/privacy-policy/">Політика приватності</Link>
              <Link className="text-emerald-700 underline" to="/contact/">Контакти</Link>
            </div>
          </article>
        </section>
      </main>
      <Footer />
    </div>
  )
}
