import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { ct } from '../lib/cabinetI18n.js'
import { useAuth } from '../hooks/useAuth.js'
import { useSubscription } from '../hooks/useSubscription.js'
import { requestPremiumAccess } from '../lib/premiumAccess.js'
import { gaViewPricing } from '../lib/analytics.js'
import '../styles/dashboard2026.css'

const PREMIUM_FEATURES = [
  'Unlimited lab uploads, so every new report gets the same full analysis',
  'Clinical Reasoning Map — see how your symptoms and biomarkers connect',
  'Evidence Gaps & Next Tests — know what to check next, not just what is missing',
  'Personal Baseline & Progress — track your own trends across reports',
  'Doctor Discussion Prep — a clear, exportable summary for your next appointment',
  'Weekly check-ins and retest planning',
]

const FREE_FEATURES = [
  'Starter symptom intake',
  'One full lab analysis to try the workflow',
  'Core dashboard access',
  'Basic biomarker summary',
]

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
  const statusLabel = isPremium ? 'Premium active' : 'Free plan active'
  const planLabel = isPremium ? 'Premium' : 'Free'

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
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Access status
            </div>
            <h2 className="text-3xl font-bold text-slate-950">{statusLabel}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Your free report shows what VITALOOP found. Premium is for going further: understanding why it was flagged, closing evidence gaps, tracking your baseline over time, and preparing for your next doctor conversation.
            </p>
          </div>
          {!isPremium && (
            <div className="grid w-full gap-3 sm:w-auto sm:min-w-[260px]">
              <button
                type="button"
                onClick={handlePremiumRequest}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <Mail className="h-4 w-4" />
                Request Premium access
              </button>
              <button
                type="button"
                onClick={handlePremiumRequest}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100"
              >
                <Sparkles className="h-4 w-4" />
                Ask about annual access
              </button>
              <p className="text-xs leading-5 text-slate-500">
                <strong className="text-slate-600">What happens next:</strong> clicking either button opens an email to our team with your account details pre-filled. We confirm and activate Premium by email — nothing is charged automatically.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{planLabel}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
            <p className="mt-1 text-2xl font-bold capitalize text-slate-950">{subStatus || 'free'}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Access key</p>
            <p className="mt-1 text-2xl font-bold capitalize text-slate-950">{planName || planLabel}</p>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`rounded-2xl border p-6 shadow-sm ${isPremium ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}
        >
          <h3 className="mb-2 text-lg font-bold text-slate-950">Premium</h3>
          <p className="mb-5 text-sm leading-6 text-slate-600">
            Designed for ongoing work with lab results, reports, action plans, progress tracking, and follow-up loops.
          </p>
          <FeatureList items={PREMIUM_FEATURES} />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h3 className="mb-2 text-lg font-bold text-slate-950">Free</h3>
          <p className="mb-5 text-sm leading-6 text-slate-600">
            A lightweight starting point for trying VITALOOP before requesting full Premium access.
          </p>
          <FeatureList items={FREE_FEATURES} />
        </motion.section>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl border border-blue-200 bg-blue-50 p-6"
      >
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
          <div>
            <h3 className="text-base font-bold text-blue-950">Premium access support</h3>
            <p className="mt-1 text-sm leading-6 text-blue-800">
              Premium access is currently invite-based and activated manually by the VITALOOP team. We do not send symptoms, uploaded labs, biomarkers, reports, or medical notes to billing tools.
            </p>
            <button type="button" onClick={handlePremiumRequest} className="mt-4 inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
              Email us
            </button>
          </div>
        </div>
      </motion.section>
    </div>
  )
}
