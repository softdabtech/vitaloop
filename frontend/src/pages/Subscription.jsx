import { useEffect, useState } from 'react'
import { CreditCard, CheckCircle2, AlertCircle, ArrowRight, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { useAuth } from '../hooks/useAuth.js'
import api from '../lib/api.js'
import '../styles/dashboard2026.css'

const PLANS = {
  free: {
    name: 'Free',
    price: '$0',
    period: '/month',
    features: [
      '1 active upload',
      'Basic biomarker summary',
      'Core dashboard',
      'Community support'
    ],
    color: 'slate',
  },
  personal_pro: {
    name: 'Personal Pro',
    price: '$9.99',
    period: '/month',
    features: [
      'Unlimited uploads',
      'Personalized protocol',
      'Weekly AI check-ins',
      'Priority insights',
      'Email support',
      'Progress tracking'
    ],
    color: 'emerald',
    yearly: '$95/year (save 21%)',
  },
  enterprise: {
    name: 'Enterprise',
    price: '$99+',
    period: '/month',
    features: [
      'Team seats',
      'Practitioner CRM',
      'Workflow automation',
      'Dedicated onboarding',
      'Priority support',
      'Custom integrations'
    ],
    color: 'blue',
  },
}

function PlanCard({ plan, planKey, currentPlan, onSelect, isLoading }) {
  const isCurrentPlan = currentPlan === planKey
  const colorMap = {
    slate: { bg: 'bg-slate-50', border: 'border-slate-200', button: 'bg-slate-600 hover:bg-slate-700' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', button: 'bg-emerald-600 hover:bg-emerald-700' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', button: 'bg-blue-600 hover:bg-blue-700' },
  }
  const colors = colorMap[plan.color]

  return (
    <div className={`rounded-2xl border-2 ${isCurrentPlan ? colors.border : 'border-slate-200'} ${colors.bg} p-6 sm:p-8 relative overflow-hidden`}>
      {isCurrentPlan && (
        <div className="absolute top-4 right-4 flex items-center gap-1 bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
          <CheckCircle2 className="w-3 h-3" />
          Active
        </div>
      )}

      <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
      <div className="mb-6">
        <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
        <span className="text-sm text-slate-500 ml-2">{plan.period}</span>
        {plan.yearly && (
          <div className="text-xs text-emerald-700 font-semibold mt-2">{plan.yearly}</div>
        )}
      </div>

      <ul className="space-y-3 mb-8">
        {plan.features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-slate-700">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(planKey)}
        disabled={isCurrentPlan || isLoading}
        className={`w-full py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
          isCurrentPlan
            ? 'bg-slate-300 text-slate-600 cursor-default'
            : `${colors.button} text-white`
        }`}
      >
        {isCurrentPlan ? 'Current Plan' : planKey === 'enterprise' ? 'Contact Sales' : 'Select Plan'}
        {!isCurrentPlan && planKey !== 'enterprise' && <ArrowRight className="w-4 h-4" />}
      </button>
    </div>
  )
}

export default function Subscription() {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)

  const currentPlan = subscription?.plan_tier?.toLowerCase().replace(/\s+/g, '_') || 'free'
  const planStatus = subscription?.status || 'inactive'
  const daysRemaining = subscription?.days_remaining ?? null
  const uploadCount = subscription?.upload_count || 0
  const uploadLimit = subscription?.upload_limit || 1

  useEffect(() => {
    loadSubscription()
  }, [user])

  async function loadSubscription() {
    setLoading(true)
    try {
      const { data } = await api.get('/stripe/subscription')
      setSubscription(data)
    } catch (error) {
      console.error('Failed to load subscription:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectPlan(planKey) {
    if (planKey === currentPlan) return
    if (planKey === 'enterprise') {
      window.location.href = 'mailto:sales@vitaloop.today?subject=Enterprise%20Plan%20Inquiry'
      return
    }

    setUpgrading(true)
    try {
      const { data } = await api.post('/stripe/checkout', { plan_tier: planKey })
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      }
    } catch (error) {
      toast.error('Failed to initiate checkout')
      console.error(error)
    } finally {
      setUpgrading(false)
    }
  }

  async function openBillingPortal() {
    try {
      const { data } = await api.post('/stripe/billing-portal')
      if (data.portal_url) {
        window.open(data.portal_url, '_blank')
      }
    } catch (error) {
      toast.error('Failed to open billing portal')
      console.error(error)
    }
  }

  if (loading) {
    return (
      <>
        <CabinetPageHeader
          title="Subscription & Billing"
          subtitle="Manage your subscription plan and billing details"
          helper="View your current plan, usage, and payment history."
        />
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </>
    )
  }

  return (
    <>
      <CabinetPageHeader
        title="Subscription & Billing"
        subtitle="Manage your subscription plan and billing details"
        helper="View your current plan, usage, and payment history."
      />

      <div className="grid gap-8">
        {/* Current Status */}
        {subscription && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Current Subscription</h3>
                <div className="flex items-center gap-2 mb-4">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                    planStatus === 'active'
                      ? 'bg-emerald-100 text-emerald-700'
                      : planStatus === 'paused'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {planStatus === 'active' && <CheckCircle2 className="w-4 h-4" />}
                    {planStatus === 'active' ? 'Active' : planStatus === 'paused' ? 'Paused' : 'Inactive'}
                  </div>
                  {planStatus !== 'active' && (
                    <div className="flex items-center gap-1.5 text-amber-700 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      Your plan is {planStatus}
                    </div>
                  )}
                </div>
              </div>
              {planStatus === 'active' && (
                <button
                  onClick={openBillingPortal}
                  className="rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition"
                >
                  Manage Billing
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Current Plan</div>
                <div className="text-2xl font-bold text-slate-900">{PLANS[currentPlan]?.name || 'Free'}</div>
              </div>

              {currentPlan !== 'free' && daysRemaining !== null && (
                <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200">
                  <div className="flex items-center gap-1 mb-2">
                    <Calendar className="w-3 h-3 text-emerald-600" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Days Remaining</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-700">{daysRemaining}</div>
                </div>
              )}

              {currentPlan !== 'free' && (
                <div className="rounded-xl bg-blue-50 p-4 border border-blue-200">
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-2">Uploads</div>
                  <div className="text-2xl font-bold text-blue-900">{uploadCount}/{uploadLimit}</div>
                </div>
              )}

              <div className="rounded-xl bg-purple-50 p-4 border border-purple-200">
                <div className="text-xs font-semibold uppercase tracking-wide text-purple-600 mb-2">Status</div>
                <div className="text-sm font-bold text-purple-900 capitalize">{planStatus}</div>
              </div>
            </div>
          </div>
        )}

        {/* Usage Statistics */}
        {currentPlan !== 'free' && subscription && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Usage Statistics</h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-slate-700">Lab Uploads</span>
                  <span className="text-sm font-semibold text-slate-500">{uploadCount} of {uploadLimit}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{ width: `${Math.min((uploadCount / uploadLimit) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {subscription?.features && (
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">Included Features</h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {subscription.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Plan Selection */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4">Choose Your Plan</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(PLANS).map(([key, plan]) => (
              <PlanCard
                key={key}
                planKey={key}
                plan={plan}
                currentPlan={currentPlan}
                onSelect={handleSelectPlan}
                isLoading={upgrading}
              />
            ))}
          </div>
        </div>

        {/* Payment History Info */}
        {planStatus === 'active' && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">Manage Payment Method</h4>
                <p className="text-sm text-blue-800 mb-4">
                  Update your billing address, payment method, and view invoices in your billing portal.
                </p>
                <button
                  onClick={openBillingPortal}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900 transition"
                >
                  Go to Billing Portal
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
