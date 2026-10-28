import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { CheckCircle2, CreditCard, Mail, ShieldCheck, Sparkles, XCircle } from 'lucide-react'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { ct } from '../lib/cabinetI18n.js'
import { useSubscription } from '../hooks/useSubscription.js'
import { openCreemBillingPortal, openCreemCheckout } from '../lib/creemCheckout.js'
import { openWayforpayCheckout } from '../lib/wayforpayCheckout.js'
import api from '../lib/api.js'
import { gaViewPricing, gaBeginCheckout, gaPurchase } from '../lib/analytics.js'
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
  const { isPremium, subStatus, uploadCount, uploadLimit, uploadsRemaining, loading, error, refresh } = useSubscription()
  const isUk = isUkrainianLocale()
  const statusLabel = isPremium ? (isUk ? 'Преміум активний' : 'Premium active') : (isUk ? 'Активний безкоштовний тариф' : 'Free plan active')
  const planLabel = isPremium ? 'Premium' : (isUk ? 'Безкоштовний' : 'Free')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [checkoutPlan, setCheckoutPlan] = useState(null) // 'monthly' | 'yearly' | null while idle

  async function handleCreemCheckout(plan) {
    if (checkoutPlan) return
    setCheckoutPlan(plan)
    gaBeginCheckout(plan === 'yearly' ? '$99.99/year' : '$9.99/month')
    try {
      await openCreemCheckout(plan)
    } catch (err) {
      toast.error(isUk ? 'Не вдалося відкрити форму оплати. Спробуйте ще раз.' : 'Could not open checkout. Please try again.')
      setCheckoutPlan(null)
    }
  }

  async function handleWayforpayCheckout(plan) {
    if (checkoutPlan) return
    setCheckoutPlan(plan)
    gaBeginCheckout(plan === 'yearly' ? '2499 грн/рік' : '249 грн/міс')
    try {
      await openWayforpayCheckout(plan, {
        onApproved: () => {
          gaPurchase(`wayforpay_${plan}_${Date.now()}`, plan === 'yearly' ? 2499 : 249, 'UAH')
          toast.success('Оплату прийнято! Активуємо Premium…')
          refresh()
          setTimeout(refresh, 3000)
          setTimeout(refresh, 8000)
          setCheckoutPlan(null)
        },
        onDeclined: (reason) => {
          toast.error(`Оплату відхилено: ${reason}`)
          setCheckoutPlan(null)
        },
        onPending: () => {
          toast('Оплата обробляється…')
          setCheckoutPlan(null)
        },
        onClose: () => setCheckoutPlan(null),
      })
    } catch {
      toast.error('Не вдалося відкрити форму оплати. Спробуйте ще раз.')
      setCheckoutPlan(null)
    }
  }

  useEffect(() => {
    if (loading) return
    gaViewPricing('subscription_page')
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

  if (error) {
    return (
      <>
        <CabinetPageHeader
          title={ct().subscription.title}
          subtitle={ct().subscription.subtitle}
          helper={ct().subscription.helper}
        />
        <div role="alert" className="rounded-[20px] border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <h2 className="text-lg font-bold">{isUk ? 'Не вдалося завантажити статус підписки' : 'We could not load your subscription status'}</h2>
          <p className="mt-2 text-sm leading-6">
            {isUk
              ? 'Спробуйте ще раз. Якщо статус доступу виглядає неправильно, напишіть команді підтримки.'
              : 'Try again. If your access status still looks wrong, email our support team at info@softdab.tech.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={refresh} className="cabinet-btn cabinet-btn--primary min-h-11">
              {isUk ? 'Повторити' : 'Retry'}
            </button>
            <a href="mailto:info@softdab.tech" className="cabinet-btn cabinet-btn--secondary min-h-11">
              {isUk ? 'Написати підтримці' : 'Contact support'}
            </a>
          </div>
        </div>
      </>
    )
  }

  async function handleCancelSubscription() {
    setCancelling(true)
    try {
      if (isUk) {
        await api.post('/wayforpay/cancel')
        toast.success('Підписку скасовано. Premium залишиться активним до кінця поточного періоду.')
        refresh()
      } else {
        await openCreemBillingPortal()
      }
    } catch (err) {
      toast.error(isUk
        ? 'Не вдалося відкрити керування підпискою. Напишіть нам, якщо проблема повториться.'
        : 'Could not open subscription management. Please contact support if the problem continues.')
    } finally {
      setCancelling(false)
      setShowCancelConfirm(false)
    }
  }

  async function handleManageBilling() {
    try {
      await openCreemBillingPortal()
    } catch {
      toast.error('Could not open subscription management. Please contact support if the problem continues.')
    }
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
                onClick={() => (isUk ? handleWayforpayCheckout('monthly') : handleCreemCheckout('monthly'))}
                disabled={Boolean(checkoutPlan)}
                className="cabinet-btn cabinet-btn--primary disabled:opacity-60"
              >
                <CreditCard className="h-4 w-4" />
                {checkoutPlan === 'monthly' ? (isUk ? 'Відкриваємо оплату…' : 'Opening checkout…') : (isUk ? 'Оформити Premium — 249 грн/міс' : 'Get Premium — $9.99/month')}
              </button>
              <button
                type="button"
                onClick={() => (isUk ? handleWayforpayCheckout('yearly') : handleCreemCheckout('yearly'))}
                disabled={Boolean(checkoutPlan)}
                className="cabinet-btn cabinet-btn--secondary disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                {checkoutPlan === 'yearly' ? (isUk ? 'Відкриваємо оплату…' : 'Opening checkout…') : (isUk ? 'Оформити на рік — 2499 грн/рік' : 'Get annual Premium — $99.99/year')}
              </button>
              <p className="text-xs leading-5 text-slate-500">
                <strong className="text-slate-600">{isUk ? 'Безпечна оплата:' : 'Secure checkout:'}</strong>{' '}
                {isUk ? 'оплата проходить на захищеній сторінці WayForPay. Ми не бачимо й не зберігаємо дані картки; Premium активується після підтвердження оплати.' : 'payment is completed on Creem’s secure hosted checkout. We do not see or store card details; Premium activates after payment is confirmed.'}
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
                      disabled={cancelling}
                      className="cabinet-btn cabinet-btn--danger cabinet-btn--sm flex-1 disabled:opacity-60"
                    >
                      {cancelling ? (isUk ? 'Скасовуємо…' : 'Cancelling…') : (isUk ? 'Так, скасувати' : 'Yes, cancel')}
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
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isUk ? 'Завантаження' : 'Lab uploads'}</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">
              {isPremium ? (isUk ? 'Без обмежень' : 'Unlimited') : `${uploadsRemaining} / ${uploadLimit}`}
            </p>
            {!isPremium && (
              <p className="mt-1 text-xs text-slate-500">
                {isUk ? `Використано: ${uploadCount}` : `${uploadCount} used`}
              </p>
            )}
          </div>
        </div>
      </motion.section>

      {isPremium ? (
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-[var(--vtl-radius-card)] border border-[var(--vtl-color-border)] bg-[var(--vtl-color-surface)] p-6 shadow-[var(--vtl-shadow-card)]"
        >
          <h3 className="text-lg font-bold text-[var(--vtl-color-ink)]">{isUk ? 'Керування Premium' : 'Manage Premium'}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--vtl-color-ink-secondary)]">
            {isUk
              ? 'Ваш доступ Premium активний. Перегляньте історію оплат або зверніться до підтримки, якщо потрібна допомога з підпискою.'
              : 'Your Premium access is active. Review your billing history or contact support if you need help with your subscription.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {!isUk && (
              <button type="button" onClick={handleManageBilling} className="cabinet-btn cabinet-btn--secondary min-h-11">
                {isUk ? 'Керувати оплатою' : 'Manage billing'}
              </button>
            )}
            <a href="/billing-history" className="cabinet-btn cabinet-btn--secondary min-h-11">
              {isUk ? 'Історія оплат' : 'Billing history'}
            </a>
          </div>
        </motion.section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-[var(--vtl-radius-card)] border border-[var(--vtl-color-border)] bg-[var(--vtl-color-surface)] p-6 shadow-[var(--vtl-shadow-card)]"
          >
            <h3 className="mb-2 text-lg font-bold text-[var(--vtl-color-ink)]">Premium</h3>
            <p className="mb-5 text-sm leading-6 text-[var(--vtl-color-ink-secondary)]">
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
            className="rounded-[var(--vtl-radius-card)] border border-[var(--vtl-color-border)] bg-[var(--vtl-color-surface)] p-6 shadow-[var(--vtl-shadow-card)]"
          >
            <h3 className="mb-2 text-lg font-bold text-[var(--vtl-color-ink)]">{isUk ? 'Безкоштовний' : 'Free'}</h3>
            <p className="mb-5 text-sm leading-6 text-[var(--vtl-color-ink-secondary)]">
              {isUk
                ? 'Легкий старт, щоб спробувати VITALOOP перед запитом повного доступу Premium.'
                : 'A lightweight starting point for trying VITALOOP before requesting full Premium access.'}
            </p>
            <FeatureList items={isUk ? FREE_FEATURES.uk : FREE_FEATURES.en} />
          </motion.section>
        </div>
      )}

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-[20px] border border-blue-200 bg-blue-50 p-6"
      >
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
          <div>
            <h3 className="text-base font-bold text-blue-950">{isUk ? 'Питання щодо оплати Premium' : 'Premium access support'}</h3>
            <p className="mt-1 text-sm leading-6 text-blue-800">
              {isUk
                ? 'Оплата Premium проходить через WayForPay і активується автоматично після підтвердження. Ми не передаємо симптоми, завантажені аналізи, біомаркери, звіти чи медичні нотатки платіжному провайдеру.'
                : 'Premium is billed through Creem and activates automatically after payment is confirmed. We do not send symptoms, uploaded labs, biomarkers, reports, or medical notes to the payment provider.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href="mailto:info@softdab.tech" className="cabinet-btn cabinet-btn--secondary cabinet-btn--sm min-h-11">
                {isUk ? 'Написати нам' : 'Contact support'}
              </a>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  )
}
