import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Mail } from 'lucide-react'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { ct } from '../lib/cabinetI18n.js'
import { useAuth } from '../hooks/useAuth.js'
import { useSubscription } from '../hooks/useSubscription.js'
import { requestPremiumAccess } from '../lib/premiumAccess.js'
import '../styles/dashboard2026.css'

export default function BillingHistory() {
  const { user } = useAuth()
  const { isPremium, subStatus, planName } = useSubscription()
  const navigate = useNavigate()

  async function handlePremiumRequest() {
    await requestPremiumAccess({ userEmail: user?.email, source: 'billing_history' })
  }

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
          Back to Subscription
        </button>

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Mail className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-950">Premium access support</h2>
              <p className="text-sm text-slate-500">Premium is currently activated manually by the VITALOOP team.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</p>
              <p className="mt-1 text-lg font-bold text-slate-950">{isPremium ? 'Premium' : 'Free'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
              <p className="mt-1 text-lg font-bold capitalize text-slate-950">{subStatus || 'free'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Access key</p>
              <p className="mt-1 text-lg font-bold capitalize text-slate-950">{planName || (isPremium ? 'premium' : 'free')}</p>
            </div>
          </div>

          <p className="mt-6 max-w-2xl text-sm leading-6 text-slate-600">
            Contact us to activate or review Premium access. VITALOOP does not send symptoms, lab files, biomarkers, reports, or protocol text to billing tools.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePremiumRequest}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              <Mail className="h-4 w-4" />
              Request Premium access
            </button>
            <button
              type="button"
              onClick={handlePremiumRequest}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <Mail className="h-4 w-4" />
              Contact support
            </button>
          </div>
        </section>
      </div>
    </>
  )
}
