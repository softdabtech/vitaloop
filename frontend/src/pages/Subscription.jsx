import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Mail, ShieldCheck, Sparkles, XCircle } from 'lucide-react'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { ct } from '../lib/cabinetI18n.js'
import { useAuth } from '../hooks/useAuth.js'
import { useSubscription } from '../hooks/useSubscription.js'
import { requestPremiumAccess, requestSubscriptionCancellation } from '../lib/premiumAccess.js'
import { gaViewPricing } from '../lib/analytics.js'
import { isUkrainianLocale } from '../lib/locale.js'
import '../styles/dashboard2026.css'

const PREMIUM_FEATURES = {
  en: [
    'Unlimited lab uploads, so every new report gets the same full analysis',
    'Clinical Reasoning Map — see how your symptoms and biomarkers connect',
    'Evidence Gaps & Next Tests — know what to check next, not just what is missing',
    'Personal Baseline & Progress — track your own trends across reports',
    'Doctor Discussion Prep — a clear, exportable summary for your next appointment',
    'Weekly check-ins and retest planning',
  ],
  uk: [
    'Необмежені завантаження аналізів — кожен новий звіт отримує той самий повний аналіз',
    'Карта клінічного мислення — побачте, як пов’язані ваші симптоми та біомаркери',
    'Прогалини в доказах і наступні аналізи — знайте, що перевірити далі, а не лише чого бракує',
    'Особистий базовий рівень і прогрес — відстежуйте власну динаміку між звітами',
    'Підготовка до розмови з лікарем — чіткий, експортований підсумок для наступного візиту',
    'Щотижневі чек-іни та планування повторних аналізів',
  ],
}

const FREE_FEATURES = {
  en: [
    'Starter symptom intake',
    'One full lab analysis to try the workflow',
    'Core dashboard access',
    'Basic biomarker summary',
  ],
  uk: [
    'Стартовий опис симптомів',
    'Один повний аналіз лабораторних результатів, щоб спробувати сервіс',
    'Доступ до основного дашборду',
    'Базовий підсумок біомаркерів',
  ],
}

function FeatureList({ items }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((feature) => (
        <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  )
}

export default function Subscription() {
  const { user } = useAuth()
  const { isPremium, subStatus, planName, loading } = useSubscription()
  const isUk = isUkrainianLocale()
  const statusLabel = isPremium ? (isUk ? 'Преміум активний' : 'Premium active') : (isUk ? 'Активний безкоштовний тариф' : 'Free plan active')
  const planLabel = isPremium ? 'Premium' : (isUk ? 'Безкоштовний' : 'Free')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  useEffect(() => {
    if (loading) return
    gaViewPricing('subscription_page')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  if (loading) {
    return (
      <>
        <CabinetPageHeader
          title={ct().subscription.title}
          subtitle={ct().subscription.subtitle}
          helper={ct().subscription.helper}
        />
        <div className="py-12 text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-emerald-600" />
        </div>
      </>
    )
  }

  async function handlePremiumRequest() {
    await requestPremiumAccess({ userEmail: user?.email, source: 'subscription_page' })
  }

  async function handleCancelSubscription() {
    await requestSubscriptionCancellation({ userEmail: user?.email, source: 'subscription_page' })
    setShowCancelConfirm(false)
  }

  return (
    <div className="space-y-6">
      <CabinetPageHeader
        title={ct().subscription.title}
        subtitle={ct().subscription.subtitle}
        helper={ct().subscription.helper}
      />

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              {isUk ? 'Статус доступу' : 'Access status'}
            </div>
            <h2 className="cabinet-title-lg text-slate-950">{statusLabel}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {isUk
                ? 'Ваш безкоштовний звіт показує, що знайшов VITALOOP. Premium — для того, щоб піти далі: зрозуміти, чому щось позначено, закрити прогалини в доказах, відстежувати динаміку з часом і підготуватися до наступної розмови з лікарем.'
                : 'Your free report shows what VITALOOP found. Premium is for going further: understanding why it was flagged, closing evidence gaps, tracking your baseline over time, and preparing for your next doctor conversation.'}
            </p>
          </div>
          {!isPremium && (
            <div className="grid w-full gap-3 sm:w-auto sm:min-w-[260px]">
              <button
                type="button"
                onClick={handlePremiumRequest}
                className="cabinet-btn cabinet-btn--primary"
              >
                <Mail className="h-4 w-4" />
                {isUk ? 'Запросити доступ Premium' : 'Request Premium access'}
              </button>
              <button
                type="button"
                onClick={handlePremiumRequest}
                className="cabinet-btn cabinet-btn--secondary"
              >
                <Sparkles className="h-4 w-4" />
                {isUk ? 'Дізнатися про річний доступ' : 'Ask about annual access'}
              </button>
              <p className="text-xs leading-5 text-slate-500">
                <strong className="text-slate-600">{isUk ? 'Що далі:' : 'What happens next:'}</strong>{' '}
                {isUk
                  ? 'натискання будь-якої кнопки відкриває лист нашій команді з уже заповненими даними акаунта. Ми підтвердимо й активуємо Premium електронною поштою — нічого не списується автоматично.'
                  : 'clicking either button opens an email to our team with your account details pre-filled. We confirm and activate Premium by email — nothing is charged automatically.'}
              </p>
            </div>
          )}
          {isPremium && (
            <div className="grid w-full gap-3 sm:w-auto sm:min-w-[260px]">
              {!showCancelConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  className="cabinet-btn cabinet-btn--secondary cabinet-btn--sm"
                >
                  <XCircle className="h-4 w-4" />
                  {isUk ? 'Скасувати підписку' : 'Cancel subscription'}
                </button>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{isUk ? 'Скасувати підписку Premium?' : 'Cancel your Premium subscription?'}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {isUk
                      ? 'Доступ Premium залишиться до кінця поточного розрахункового періоду. Ми підтвердимо електронною поштою.'
                      : "You'll keep Premium access through the end of your current billing period. We'll confirm by email."}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={handleCancelSubscription}
                      className="cabinet-btn cabinet-btn--danger cabinet-btn--sm flex-1"
                    >
                      {isUk ? 'Так, скасувати' : 'Yes, cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(false)}
                      className="cabinet-btn cabinet-btn--secondary cabinet-btn--sm flex-1"
                    >
                      {isUk ? 'Залишити Premium' : 'Keep Premium'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isUk ? 'Тариф' : 'Plan'}</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{planLabel}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isUk ? 'Статус' : 'Status'}</p>
            <p className="mt-1 text-2xl font-bold capitalize text-slate-950">{subStatus || (isUk ? 'безкоштовний' : 'free')}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isUk ? 'Код доступу' : 'Access key'}</p>
            <p className="mt-1 text-2xl font-bold capitalize text-slate-950">{planName || planLabel}</p>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`rounded-[20px] border p-6 shadow-sm ${isPremium ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}
        >
          <h3 className="mb-2 text-lg font-bold text-slate-950">Premium</h3>
          <p className="mb-5 text-sm leading-6 text-slate-600">
            {isUk
              ? 'Створено для постійної роботи з результатами аналізів, звітами, планами дій, відстеженням прогресу та подальшими кроками.'
              : 'Designed for ongoing work with lab results, reports, action plans, progress tracking, and follow-up loops.'}
          </p>
          <FeatureList items={isUk ? PREMIUM_FEATURES.uk : PREMIUM_FEATURES.en} />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h3 className="mb-2 text-lg font-bold text-slate-950">{isUk ? 'Безкоштовний' : 'Free'}</h3>
          <p className="mb-5 text-sm leading-6 text-slate-600">
            {isUk
              ? 'Легкий старт, щоб спробувати VITALOOP перед запитом повного доступу Premium.'
              : 'A lightweight starting point for trying VITALOOP before requesting full Premium access.'}
          </p>
          <FeatureList items={isUk ? FREE_FEATURES.uk : FREE_FEATURES.en} />
        </motion.section>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-[20px] border border-blue-200 bg-blue-50 p-6"
      >
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
          <div>
            <h3 className="text-base font-bold text-blue-950">{isUk ? 'Підтримка доступу Premium' : 'Premium access support'}</h3>
            <p className="mt-1 text-sm leading-6 text-blue-800">
              {isUk
                ? 'Наразі доступ Premium надається за запрошенням і активується вручну командою VITALOOP. Ми не передаємо симптоми, завантажені аналізи, біомаркери, звіти чи медичні нотатки платіжним інструментам.'
                : 'Premium access is currently invite-based and activated manually by the VITALOOP team. We do not send symptoms, uploaded labs, biomarkers, reports, or medical notes to billing tools.'}
            </p>
            <button type="button" onClick={handlePremiumRequest} className="cabinet-btn cabinet-btn--secondary cabinet-btn--sm mt-4">
              {isUk ? 'Написати нам' : 'Email us'}
            </button>
          </div>
        </div>
      </motion.section>
    </div>
  )
}
