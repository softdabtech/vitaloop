import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Mail, Receipt } from 'lucide-react'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { ct } from '../lib/cabinetI18n.js'
import { useSubscription } from '../hooks/useSubscription.js'
import { isUkrainianLocale } from '../lib/locale.js'
import '../styles/dashboard2026.css'

export default function BillingHistory() {
  const { isPremium, subStatus } = useSubscription()
  const navigate = useNavigate()
  const isUk = isUkrainianLocale()

  return (
    <>
      <CabinetPageHeader
        title={ct().billing.title}
        subtitle={ct().billing.subtitle}
        helper={ct().billing.helper}
      />

      <div className="grid gap-6">
        <button
          onClick={() => navigate('/subscription')}
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {isUk ? 'Назад до Підписки' : 'Back to Subscription'}
        </button>

        <section className="rounded-[20px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Mail className="h-5 w-5" />
            </span>
            <div>
              <h2 className="cabinet-title-lg text-slate-950">{isUk ? 'Підтримка доступу Premium' : 'Premium access support'}</h2>
              <p className="text-sm text-slate-500">{isUk ? 'Оформлення та керування Premium доступні через WayForPay.' : 'Premium checkout and management are available through Creem.'}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isUk ? 'Тариф' : 'Plan'}</p>
              <p className="mt-1 text-lg font-bold text-slate-950">{isPremium ? 'Premium' : (isUk ? 'Безкоштовний' : 'Free')}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isUk ? 'Статус' : 'Status'}</p>
              <p className="mt-1 text-lg font-bold capitalize text-slate-950">{subStatus || (isUk ? 'безкоштовний' : 'free')}</p>
            </div>
          </div>

          <p className="mt-6 max-w-2xl text-sm leading-6 text-slate-600">
            {isUk
              ? 'Оформіть або керуйте Premium у розділі підписки. VITALOOP не передає симптоми, файли аналізів, біомаркери, звіти чи текст протоколу платіжному провайдеру.'
              : 'Choose or manage Premium on the Subscription page. VITALOOP does not send symptoms, lab files, biomarkers, reports, or protocol text to the payment provider.'}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/subscription')}
              className="cabinet-btn cabinet-btn--primary"
            >
              <Mail className="h-4 w-4" />
              {isUk ? 'Перейти до Premium' : 'View Premium plans'}
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = 'mailto:info@softdab.tech' }}
              className="cabinet-btn cabinet-btn--secondary"
            >
              <Mail className="h-4 w-4" />
              {isUk ? 'Звʼязатися з підтримкою' : 'Contact support'}
            </button>
          </div>
        </section>

        <section className="rounded-[20px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Receipt className="h-5 w-5" />
            </span>
            <div>
              <h2 className="cabinet-title-lg text-slate-950">{isUk ? 'Історія платежів' : 'Billing history'}</h2>
              <p className="text-sm text-slate-500">{isUk ? 'Транзакції з’являться тут після підключення платіжної історії.' : 'Transactions will appear here when billing history is available.'}</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-slate-600">
            {isUk
              ? 'Наразі для англомовного кабінету немає підтверджених платіжних транзакцій для відображення. Статус доступу наведено вище.'
              : 'There are no confirmed billing transactions to display for the English cabinet yet. Your current access status is shown above.'}
          </p>
        </section>
      </div>
    </>
  )
}
